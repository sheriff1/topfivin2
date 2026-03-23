#!/usr/bin/env python3
"""
Sync the 17 missing stats columns (migration 005) from local game_stats to
production Railway DB.

Use this instead of running the 4 backfill scripts against prod — avoids
re-fetching from the NBA API (which rate-limits after ~600 calls).

How it works:
  1. Reads from the LOCAL DB (via DB_HOST/DB_USER/DB_NAME etc.)
  2. Batch-UPDATEs into the PROD DB (via DATABASE_URL)

Both sets of env vars must be set — source backend/.env first, then
backend/.env.production (DATABASE_URL overrides without clobbering local vars).

Run via: make sync-missing-prod
"""

import os
import sys
import psycopg2
import psycopg2.extras

COLUMNS = [
    # BoxScoreAdvancedV3 new extras
    "ast_to_tov", "ast_ratio", "tov_ratio",
    # BoxScoreMiscV3 new extras
    "opp_pts_off_to", "opp_pts_second_chance", "blk_against", "fouls_drawn",
    # BoxScoreSummaryV3 DF7 new extras
    "tov_team", "tov_total", "reb_team",
    # BoxScoreHustleV2 new extras
    "contested_shots_2pt", "contested_shots_3pt", "charges_drawn",
    "loose_balls_off", "loose_balls_def", "box_outs_off", "box_outs_def",
    "box_out_team_reb", "box_out_player_reb",
    # BoxScoreAdvancedV3 extra
    "pace_per40",
]

FLOAT_COLS = {"ast_to_tov", "ast_ratio", "tov_ratio", "pace_per40"}

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
    print("SYNC: sync_missing_to_prod.py")
    print(f"Columns: {len(COLUMNS)} migration-005 columns")
    print("Source:  local DB (DB_HOST/DB_USER/DB_NAME)")
    print("Target:  Railway DB (DATABASE_URL)")
    print("=" * 60)

    local_conn = local_connect()
    prod_conn  = prod_connect()
    local_cur  = local_conn.cursor()
    prod_cur   = prod_conn.cursor()

    col_select  = ", ".join(COLUMNS)
    col_set     = ", ".join(f"{c} = s.{c}" for c in COLUMNS)
    col_staging = ", ".join(
        f"{c} FLOAT" if c in FLOAT_COLS else f"{c} INT"
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
        print("⚠️  No rows with migration-005 data found in local DB.")
        print("   Run make backfill-missing first.")
        sys.exit(0)

    # ── Create temp staging table in prod ─────────────────────────────────────
    prod_cur.execute(f"""
        CREATE TEMP TABLE _missing_staging (
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
            f"INSERT INTO _missing_staging ({', '.join(col_names)}) VALUES %s",
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
        FROM _missing_staging s
        WHERE gs.game_id = s.game_id
          AND gs.team_id = s.team_id
    """)
    updated = prod_cur.rowcount
    prod_conn.commit()

    print(f"✅  Updated {updated} rows in production game_stats")

    # ── Verify nulls remaining ────────────────────────────────────────────────
    prod_cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE ast_to_tov IS NULL)           AS adv_null,
            COUNT(*) FILTER (WHERE opp_pts_off_to IS NULL)       AS misc_null,
            COUNT(*) FILTER (WHERE tov_team IS NULL)             AS summary_null,
            COUNT(*) FILTER (WHERE contested_shots_2pt IS NULL)  AS hustle_null
        FROM game_stats
    """)
    adv, misc, summ, hustle = prod_cur.fetchone()
    print(f"\n📊 Remaining NULLs in production game_stats:")
    print(f"   ast_to_tov (advanced):         {adv}")
    print(f"   opp_pts_off_to (misc):         {misc}")
    print(f"   tov_team (summary):            {summ}")
    print(f"   contested_shots_2pt (hustle):  {hustle}")

    local_cur.close()
    local_conn.close()
    prod_cur.close()
    prod_conn.close()


if __name__ == "__main__":
    main()
