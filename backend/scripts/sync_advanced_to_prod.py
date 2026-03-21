#!/usr/bin/env python3
"""
Sync the 24 V3 advanced columns from local game_stats to production Railway DB.

Use this instead of make backfill-prod when the local DB already has all the
data — avoids re-fetching from the NBA API (which rate-limits after ~600 calls).

How it works:
  1. Reads from the LOCAL DB (via DB_HOST/DB_USER/DB_NAME etc.)
  2. Batch-UPDATEs into the PROD DB (via DATABASE_URL)

Both sets of env vars must be set — source backend/.env first, then
backend/.env.production (DATABASE_URL overrides without clobbering local vars).

Run via: make sync-advanced-prod
"""

import os
import sys
import psycopg2
import psycopg2.extras

COLUMNS = [
    # Advanced
    "ortg", "drtg", "net_rtg", "efg_pct", "pace", "possessions", "pie",
    # Summary
    "biggest_lead", "bench_points", "lead_changes", "times_tied", "biggest_scoring_run",
    # Misc
    "pts_paint", "pts_fast_break", "pts_second_chance", "pts_off_to",
    "opp_pts_paint", "opp_pts_fast_break",
    # Hustle
    "contested_shots", "deflections", "screen_assists", "screen_assist_pts",
    "box_outs", "loose_balls_recovered",
]

BATCH_SIZE = 200


def local_connect():
    """Connect to local DB using DB_HOST/DB_USER/etc env vars."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "nba_stats"),
    )


def prod_connect():
    """Connect to Railway DB using DATABASE_URL env var."""
    url = os.getenv("DATABASE_URL", "")
    if not url:
        print("❌  DATABASE_URL not set. Source backend/.env.production before running.")
        sys.exit(1)
    return psycopg2.connect(url)


def main():
    print("=" * 60)
    print("SYNC: sync_advanced_to_prod.py")
    print(f"Columns: {len(COLUMNS)} advanced V3 columns")
    print("Source:  local DB (DB_HOST/DB_USER/DB_NAME)")
    print("Target:  Railway DB (DATABASE_URL)")
    print("=" * 60)

    local_conn = local_connect()
    prod_conn  = prod_connect()
    local_cur  = local_conn.cursor()
    prod_cur   = prod_conn.cursor()

    col_select = ", ".join(COLUMNS)
    col_set = ", ".join(f"{c} = s.{c}" for c in COLUMNS)
    col_staging = ", ".join(
        f"{c} FLOAT" if c in {"ortg","drtg","net_rtg","efg_pct","pace","possessions","pie"}
        else f"{c} INT"
        for c in COLUMNS
    )

    # ── Read all rows from local that have at least one column filled ──────────
    null_guards = " OR ".join(f"{c} IS NOT NULL" for c in COLUMNS)
    local_cur.execute(f"""
        SELECT game_id, team_id, {col_select}
        FROM game_stats
        WHERE {null_guards}
        ORDER BY game_id, team_id
    """)
    rows = local_cur.fetchall()
    total = len(rows)
    print(f"\n📋 Rows to sync from local DB: {total}\n")

    if total == 0:
        print("⚠️  No rows with advanced data found in local DB. Run make backfill first.")
        sys.exit(0)

    # ── Create temp staging table in prod ─────────────────────────────────────
    prod_cur.execute(f"""
        CREATE TEMP TABLE _advanced_staging (
            game_id TEXT NOT NULL,
            team_id BIGINT NOT NULL,
            {col_staging}
        )
    """)

    # ── Batch insert into staging ─────────────────────────────────────────────
    col_names = ["game_id", "team_id"] + COLUMNS
    inserted = 0
    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        psycopg2.extras.execute_values(
            prod_cur,
            f"INSERT INTO _advanced_staging ({', '.join(col_names)}) VALUES %s",
            batch,
            page_size=BATCH_SIZE,
        )
        inserted += len(batch)
        pct = inserted / total * 100
        print(f"  Staged {inserted}/{total} rows ({pct:.0f}%)", end="\r", flush=True)

    print(f"  Staged {total}/{total} rows (100%)          ")

    # ── Apply UPDATE from staging into game_stats ─────────────────────────────
    print("\n⏳ Applying updates to production game_stats...")
    prod_cur.execute(f"""
        UPDATE game_stats gs
        SET {col_set}
        FROM _advanced_staging s
        WHERE gs.game_id = s.game_id
          AND gs.team_id = s.team_id
    """)
    updated = prod_cur.rowcount
    prod_conn.commit()

    print(f"✅  Updated {updated} rows in production game_stats")

    # ── Verify nulls remaining ────────────────────────────────────────────────
    prod_cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE ortg IS NULL)             AS adv_null,
            COUNT(*) FILTER (WHERE biggest_lead IS NULL)     AS summary_null,
            COUNT(*) FILTER (WHERE pts_paint IS NULL)        AS misc_null,
            COUNT(*) FILTER (WHERE contested_shots IS NULL)  AS hustle_null
        FROM game_stats
    """)
    adv, summ, misc, hustle = prod_cur.fetchone()
    print(f"\n📊 Remaining NULLs in production game_stats:")
    print(f"   ortg (advanced):           {adv}")
    print(f"   biggest_lead (summary):    {summ}")
    print(f"   pts_paint (misc):          {misc}")
    print(f"   contested_shots (hustle):  {hustle}")

    local_cur.close()
    local_conn.close()
    prod_cur.close()
    prod_conn.close()


if __name__ == "__main__":
    main()
