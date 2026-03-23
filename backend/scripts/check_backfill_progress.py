#!/usr/bin/env python3
"""
Check backfill progress for migration-004 and migration-005 columns.

Shows per-endpoint coverage across game_stats rows so you can see how
much of the local (or production) data collection is complete.

Usage:
    python scripts/check_backfill_progress.py         # local DB
    DATABASE_URL=<url> python scripts/...             # Railway
    make check-progress                               # local (via Makefile)
    make check-progress-prod                          # Railway (via Makefile)
"""

import os
import psycopg2

# ---------------------------------------------------------------------------
# Endpoints and their sentinel columns (one per endpoint, enough to gauge
# coverage).  "new" = added by migration-005; "original" = from 004.
# ---------------------------------------------------------------------------
CHECKS = [
    # (label, column, migration, description)
    # ── migration-004 originals ────────────────────────────────────────────
    ("AdvancedV3",   "ortg",              "004", "offensiveRating / team advanced"),
    ("SummaryV3",    "biggest_lead",      "004", "biggest_lead / game summary"),
    ("MiscV3",       "pts_paint",         "004", "pts in the paint / team misc"),
    ("HustleV2",     "contested_shots",   "004", "total contested shots"),
    # ── migration-005 new columns ──────────────────────────────────────────
    ("AdvancedV3+",  "ast_to_tov",        "005", "assist-to-turnover ratio"),
    ("SummaryV3+",   "tov_team",          "005", "team turnovers (from summary)"),
    ("MiscV3+",      "opp_pts_off_to",    "005", "opponent pts off turnovers"),
    ("HustleV2+",    "contested_shots_2pt","005","2pt contested shots"),
    # ── additional 005 columns worth spot-checking ─────────────────────────
    ("HustleV2+",    "charges_drawn",     "005", "charges drawn"),
    ("HustleV2+",    "box_outs_off",      "005", "offensive box outs"),
    ("MiscV3+",      "fouls_drawn",       "005", "fouls drawn"),
    ("MiscV3+",      "blk_against",       "005", "blocks against"),
    ("SummaryV3+",   "reb_team",          "005", "team rebounds"),
    ("AdvancedV3+",  "ast_ratio",         "005", "assist ratio"),
    ("AdvancedV3+",  "tov_ratio",         "005", "turnover ratio"),
    ("AdvancedV3+",  "pace_per40",        "005", "pace per 40 minutes"),
    ("HustleV2+",    "box_out_team_reb",  "005", "box out team rebounds"),
    ("HustleV2+",    "box_out_player_reb","005", "box out player rebounds"),
]


def db_connect():
    url = os.getenv("DATABASE_URL", "")
    if url:
        return psycopg2.connect(url)
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "nba_stats"),
    )


def main():
    conn = db_connect()
    cur = conn.cursor()

    # Total distinct game_stats rows (one per team per game)
    cur.execute("SELECT COUNT(*) FROM game_stats")
    total_rows = cur.fetchone()[0]

    # Total distinct games
    cur.execute("SELECT COUNT(DISTINCT game_id) FROM game_stats")
    total_games = cur.fetchone()[0]

    env = "Railway" if os.getenv("DATABASE_URL") else "local"
    print(f"\n{'='*70}")
    print(f"  Backfill Progress  [{env}]")
    print(f"  {total_games} games  |  {total_rows} team-game rows in game_stats")
    print(f"{'='*70}")
    print(f"  {'Endpoint':<16} {'Column':<26} {'Mig':<5} {'Filled':>7} {'Total':>7} {'Pct':>6}  Status")
    print(f"  {'-'*16} {'-'*26} {'-'*5} {'-'*7} {'-'*7} {'-'*6}  ------")

    prev_mig = None
    for label, col, mig, desc in CHECKS:
        # Check column exists before querying (migration may not have run yet)
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'game_stats' AND column_name = %s
        """, (col,))
        col_exists = cur.fetchone()[0] > 0

        if not col_exists:
            if prev_mig != mig:
                print()
            print(f"  {label:<16} {col:<26} {mig:<5} {'—':>7} {total_rows:>7} {'  —':>6}  ⚠ column not found (migration not run)")
            prev_mig = mig
            continue

        cur.execute(f"SELECT COUNT(*) FROM game_stats WHERE {col} IS NOT NULL")
        filled = cur.fetchone()[0]
        pct = (filled / total_rows * 100) if total_rows > 0 else 0

        if prev_mig != mig:
            print()  # blank line between migration groups

        if pct >= 100.0:
            status = "✅ complete"
        elif pct >= 50.0:
            status = f"⏳ in progress"
        elif pct > 0:
            status = f"🔄 started"
        else:
            status = "⬜ not started"

        print(f"  {label:<16} {col:<26} {mig:<5} {filled:>7} {total_rows:>7} {pct:>5.1f}%  {status}")
        prev_mig = mig

    print(f"\n{'='*70}")
    print("  Tip: re-run any time to check live progress during a backfill.")
    print(f"{'='*70}\n")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
