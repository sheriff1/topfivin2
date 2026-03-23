#!/usr/bin/env python3
"""
Sync ALL backfilled game_stats columns from local DB → production Railway DB.

Replaces sync_advanced_to_prod.py and sync_missing_to_prod.py, and adds
the new columns introduced by migrations 007, 008 and 009.

Columns synced (139 total):
  Migration 004 (24)  — BoxScore V3 advanced/summary/misc/hustle core
  Migration 005 (20)  — BoxScore V3 additional extras
  Migration 007 (45)  — Starters/bench split, game context, plus_minus fix
  Migration 008  (4)  — Estimated advanced ratings (e_ortg etc.)
  Migration 009 (46)  — Remaining box score stats (AdvancedV3 extras, FourFactors,
                        Scoring breakdown, PlayerTrack)

How it works:
  1. Reads ALL rows from the LOCAL DB (DB_HOST/DB_USER/DB_NAME)
  2. Bulk-inserts into a temp staging table on the PROD DB (DATABASE_URL)
  3. One UPDATE joins staging → prod game_stats on (game_id, team_id)

Both env var sets must be loaded — source backend/.env THEN
backend/.env.production so DATABASE_URL overrides without clobbering locals.

Run via: make sync-prod
"""

import os
import sys
import psycopg2
import psycopg2.extras

# ── Column definitions ────────────────────────────────────────────────────────

COLUMNS = [
    # ── Migration 004: BoxScore V3 advanced / summary / misc / hustle ────────
    "ortg", "drtg", "net_rtg", "efg_pct", "pace", "possessions", "pie",
    "biggest_lead", "bench_points", "lead_changes", "times_tied", "biggest_scoring_run",
    "pts_paint", "pts_fast_break", "pts_second_chance", "pts_off_to",
    "opp_pts_paint", "opp_pts_fast_break",
    "contested_shots", "deflections", "screen_assists", "screen_assist_pts",
    "box_outs", "loose_balls_recovered",
    # ── Migration 005: additional V3 extras ──────────────────────────────────
    "ast_to_tov", "ast_ratio", "tov_ratio",
    "opp_pts_off_to", "opp_pts_second_chance", "blk_against", "fouls_drawn",
    "tov_team", "tov_total", "reb_team",
    "contested_shots_2pt", "contested_shots_3pt", "charges_drawn",
    "loose_balls_off", "loose_balls_def", "box_outs_off", "box_outs_def",
    "box_out_team_reb", "box_out_player_reb",
    "pace_per40",
    # ── Migration 007: starters group (19 cols) ───────────────────────────────
    "starters_fg", "starters_fga", "starters_fg_pct",
    "starters_three_p", "starters_three_pa", "starters_three_p_pct",
    "starters_ft", "starters_fta", "starters_ft_pct",
    "starters_oreb", "starters_dreb", "starters_reb",
    "starters_ast", "starters_stl", "starters_blk", "starters_tov",
    "starters_pf", "starters_pts", "starters_pm",
    # ── Migration 007: bench group (19 cols) ──────────────────────────────────
    "bench_fg", "bench_fga", "bench_fg_pct",
    "bench_three_p", "bench_three_pa", "bench_three_p_pct",
    "bench_ft", "bench_fta", "bench_ft_pct",
    "bench_oreb", "bench_dreb", "bench_reb",
    "bench_ast", "bench_stl", "bench_blk", "bench_tov",
    "bench_pf", "bench_pts", "bench_pm",
    # ── Migration 007: game context + plus_minus fix (7 cols) ─────────────────
    "plus_minus",
    "attendance", "duration_mins",
    "q1_pts", "q2_pts", "q3_pts", "q4_pts",
    # ── Migration 008: estimated advanced ratings (4 cols) ────────────────────
    "e_ortg", "e_drtg", "e_net_rtg", "e_pace",
    # ── Migration 009: remaining box score stats (46 cols) ───────────────────
    # BoxScoreAdvancedV3 DF1 extras
    "ast_pct", "dreb_pct", "reb_pct", "e_tov_pct", "ts_pct", "e_usage_pct",
    # BoxScoreSummaryV3 DF7
    "pts_from_tov",
    # BoxScoreFourFactorsV3 DF1
    "ft_rate", "tm_tov_pct", "oreb_pct", "opp_efg_pct", "opp_ft_rate", "opp_tov_pct", "opp_oreb_pct",
    # BoxScoreScoringV3 DF1
    "pct_fga_2pt", "pct_fga_3pt", "pct_pts_2pt", "pct_pts_2pt_mr", "pct_pts_3pt",
    "pct_pts_fb", "pct_pts_ft", "pct_pts_off_tov", "pct_pts_paint",
    "pct_ast_2pm", "pct_uast_2pm", "pct_ast_3pm", "pct_uast_3pm", "pct_ast_fgm", "pct_uast_fgm",
    # BoxScorePlayerTrackV3 DF1
    "distance", "reb_chances_off", "reb_chances_def", "reb_chances_total",
    "touches", "secondary_ast", "ft_ast", "passes",
    "contested_fgm", "contested_fga", "contested_fg_pct",
    "uncontested_fgm", "uncontested_fga", "uncontested_fg_pct",
    "dar_fgm", "dar_fga", "dar_fg_pct",
]

# Columns stored as FLOAT in game_stats (everything else is INT)
FLOAT_COLS = {
    # mig 004
    "ortg", "drtg", "net_rtg", "efg_pct", "pace", "possessions", "pie",
    # mig 005
    "ast_to_tov", "ast_ratio", "tov_ratio", "pace_per40",
    # mig 007
    "starters_fg_pct", "starters_three_p_pct", "starters_ft_pct", "starters_pm",
    "bench_fg_pct", "bench_three_p_pct", "bench_ft_pct", "bench_pm",
    "plus_minus", "duration_mins",
    # mig 008
    "e_ortg", "e_drtg", "e_net_rtg", "e_pace",
    # mig 009
    "ast_pct", "dreb_pct", "reb_pct", "e_tov_pct", "ts_pct", "e_usage_pct",
    "ft_rate", "tm_tov_pct", "oreb_pct", "opp_efg_pct", "opp_ft_rate", "opp_tov_pct", "opp_oreb_pct",
    "pct_fga_2pt", "pct_fga_3pt", "pct_pts_2pt", "pct_pts_2pt_mr", "pct_pts_3pt",
    "pct_pts_fb", "pct_pts_ft", "pct_pts_off_tov", "pct_pts_paint",
    "pct_ast_2pm", "pct_uast_2pm", "pct_ast_3pm", "pct_uast_3pm", "pct_ast_fgm", "pct_uast_fgm",
    "distance", "contested_fg_pct", "uncontested_fg_pct", "dar_fg_pct",
}

BATCH_SIZE = 200


# ── DB helpers ────────────────────────────────────────────────────────────────

def local_connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "nba_stats"),
    )


def prod_connect():
    url = os.getenv("DATABASE_URL", "")
    if not url:
        print("❌  DATABASE_URL not set. Source backend/.env.production before running.")
        sys.exit(1)
    return psycopg2.connect(url)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("SYNC: sync_to_prod.py")
    print(f"Columns: {len(COLUMNS)} total (mig 004 + 005 + 007 + 008 + 009)")
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

    # ── Read all game_stats rows from local ───────────────────────────────────
    local_cur.execute(f"""
        SELECT game_id, team_id, {col_select}
        FROM game_stats
        ORDER BY game_id, team_id
    """)
    rows = local_cur.fetchall()
    total = len(rows)
    print(f"\n📋 Rows to sync from local DB: {total}\n")

    if total == 0:
        print("⚠️  No rows found in local game_stats.")
        sys.exit(0)

    # ── Create temp staging table on prod ─────────────────────────────────────
    prod_cur.execute(f"""
        CREATE TEMP TABLE _sync_staging (
            game_id  TEXT   NOT NULL,
            team_id  BIGINT NOT NULL,
            {col_staging}
        )
    """)

    # ── Batch insert rows into staging ────────────────────────────────────────
    col_names = ["game_id", "team_id"] + COLUMNS
    inserted  = 0
    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        psycopg2.extras.execute_values(
            prod_cur,
            f"INSERT INTO _sync_staging ({', '.join(col_names)}) VALUES %s",
            batch,
            page_size=BATCH_SIZE,
        )
        inserted += len(batch)
        print(f"  Staged {inserted}/{total} rows ({inserted/total*100:.0f}%)", end="\r", flush=True)

    print(f"  Staged {total}/{total} rows (100%)          ")

    # ── Apply UPDATE to prod game_stats ───────────────────────────────────────
    print("\n⏳ Applying updates to production game_stats...")
    prod_cur.execute(f"""
        UPDATE game_stats gs
        SET {col_set}
        FROM _sync_staging s
        WHERE gs.game_id = s.game_id
          AND gs.team_id = s.team_id
    """)
    updated = prod_cur.rowcount
    prod_conn.commit()
    print(f"✅  Updated {updated} rows in production game_stats")

    # ── Spot-check nulls remaining in prod ────────────────────────────────────
    print("\n🔍 Spot-check nulls remaining in production:")
    prod_cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE ortg            IS NULL) AS ortg_null,
            COUNT(*) FILTER (WHERE ast_to_tov      IS NULL) AS ast_to_tov_null,
            COUNT(*) FILTER (WHERE starters_pts    IS NULL) AS starters_pts_null,
            COUNT(*) FILTER (WHERE attendance      IS NULL) AS attendance_null,
            COUNT(*) FILTER (WHERE e_ortg          IS NULL) AS e_ortg_null,
            SUM(CASE WHEN plus_minus = 0 THEN 1 ELSE 0 END) AS pm_zero,
            COUNT(*)                                        AS total_rows
        FROM game_stats
    """)
    r = prod_cur.fetchone()
    print(f"   ortg null:         {r[0]}/{r[6]}")
    print(f"   ast_to_tov null:   {r[1]}/{r[6]}")
    print(f"   starters_pts null: {r[2]}/{r[6]}")
    print(f"   attendance null:   {r[3]}/{r[6]}")
    print(f"   e_ortg null:       {r[4]}/{r[6]}")
    print(f"   plus_minus = 0:    {r[5]}/{r[6]}")

    local_cur.close()
    local_conn.close()
    prod_cur.close()
    prod_conn.close()

    print(f"\n{'='*60}")
    print("✅  Sync complete — run: make derive-prod")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
