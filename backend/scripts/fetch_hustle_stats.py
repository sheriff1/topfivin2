#!/usr/bin/env python3
"""
Backfill: Hustle V2 stats for existing game_stats rows.

Calls BoxScoreHustleV2 DF1 (team-level) for every game that has
contested_shots IS NULL, and UPDATEs those columns in game_stats.

Columns written:
  contested_shots, deflections, screen_assists, screen_assist_pts,
  box_outs, loose_balls_recovered,
  contested_shots_2pt, contested_shots_3pt, charges_drawn,
  loose_balls_off, loose_balls_def, box_outs_off, box_outs_def

Resumable: re-running skips any game_id already filled (contested_shots IS NOT NULL).
Run via: make fetch-hustle

Note: BoxScoreHustleV2 DF0 (player rows) returns only active players (18 rows
vs 26 in other endpoints). DF1 (team totals) always returns exactly 2 rows,
which is all we need here.
"""

import os
import sys
import time
from datetime import datetime
import random
import psycopg2

# ── Header patch ─────────────────────────────────────────────────────────────
NBA_STATS_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Host": "stats.nba.com",
    "Origin": "https://www.nba.com",
    "Pragma": "no-cache",
    "Referer": "https://www.nba.com/",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
}

def patch_headers():
    try:
        from nba_api.stats.library import http as stats_http
        from nba_api.library import http as base_http
        stats_http.STATS_HEADERS = NBA_STATS_HEADERS
        stats_http.NBAStatsHTTP.headers = NBA_STATS_HEADERS
        if hasattr(stats_http.NBAStatsHTTP, "_session"):
            stats_http.NBAStatsHTTP._session = None
        if hasattr(base_http.NBAHTTP, "_session"):
            base_http.NBAHTTP._session = None
    except Exception as e:
        print(f"⚠️  Header patch failed: {e}")

patch_headers()

from nba_api.stats.endpoints import BoxScoreHustleV2

# ── Config ────────────────────────────────────────────────────────────────────
REQUEST_DELAY  = 2.0
REQUEST_JITTER = 0.3
RETRY_ATTEMPTS = 3
RETRY_DELAY    = 5

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

def delay():
    jitter = random.uniform(-REQUEST_JITTER, REQUEST_JITTER)
    time.sleep(max(0.5, REQUEST_DELAY + jitter))

def _i(row, col):
    import pandas as pd
    val = row.get(col)
    return int(val) if val is not None and pd.notna(val) else None

def fetch_hustle(game_id):
    """Return dict of team_id -> hustle stats or raise."""
    result = BoxScoreHustleV2(game_id=game_id, timeout=60)
    df = result.get_data_frames()[1]  # DF1 = team-level hustle totals
    out = {}
    for _, row in df.iterrows():
        team_id = int(row["teamId"])
        out[team_id] = {
            "contested_shots":       _i(row, "contestedShots"),
            "deflections":           _i(row, "deflections"),
            "screen_assists":        _i(row, "screenAssists"),
            "screen_assist_pts":     _i(row, "screenAssistPoints"),
            "box_outs":              _i(row, "boxOuts"),
            "loose_balls_recovered": _i(row, "looseBallsRecoveredTotal"),
            "contested_shots_2pt":   _i(row, "contestedShots2pt"),
            "contested_shots_3pt":   _i(row, "contestedShots3pt"),
            "charges_drawn":         _i(row, "chargesDrawn"),
            "loose_balls_off":       _i(row, "looseBallsRecoveredOffensive"),
            "loose_balls_def":       _i(row, "looseBallsRecoveredDefensive"),
            "box_outs_off":          _i(row, "offensiveBoxOuts"),
            "box_outs_def":          _i(row, "defensiveBoxOuts"),
            "box_out_team_reb":      _i(row, "boxOutPlayerTeamRebounds"),
            "box_out_player_reb":    _i(row, "boxOutPlayerRebounds"),
        }
    return out

def main():
    print("=" * 60)
    print("BACKFILL: fetch_hustle_stats.py")
    print("Endpoint: BoxScoreHustleV2 DF1")
    print("Columns:  contested_shots, deflections, screen_assists,")
    print("          screen_assist_pts, box_outs, loose_balls_recovered,")
    print("          contested_shots_2pt, contested_shots_3pt, charges_drawn,")
    print("          loose_balls_off, loose_balls_def, box_outs_off, box_outs_def,")
    print("          box_out_team_reb, box_out_player_reb")
    print("=" * 60)

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT game_id FROM game_stats
        WHERE contested_shots IS NULL OR contested_shots_2pt IS NULL OR box_out_team_reb IS NULL
        ORDER BY game_id
    """)
    pending = [row[0] for row in cur.fetchall()]
    total = len(pending)
    print(f"\n📋 Games to backfill: {total}\n")

    updated = failed = consecutive_failures = 0
    bad_data_games = []
    COOLDOWN_THRESHOLD = 2
    COOLDOWN_SECS      = 300

    for idx, game_id in enumerate(pending, 1):
        print(f"  [{idx:4}/{total}] game_id={game_id}", end=" ", flush=True)

        for attempt in range(RETRY_ATTEMPTS):
            try:
                delay()
                team_stats = fetch_hustle(game_id)

                for team_id, stats in team_stats.items():
                    cur.execute("""
                        UPDATE game_stats
                        SET contested_shots=%(contested_shots)s,
                            deflections=%(deflections)s,
                            screen_assists=%(screen_assists)s,
                            screen_assist_pts=%(screen_assist_pts)s,
                            box_outs=%(box_outs)s,
                            loose_balls_recovered=%(loose_balls_recovered)s,
                            contested_shots_2pt=%(contested_shots_2pt)s,
                            contested_shots_3pt=%(contested_shots_3pt)s,
                            charges_drawn=%(charges_drawn)s,
                            loose_balls_off=%(loose_balls_off)s,
                            loose_balls_def=%(loose_balls_def)s,
                            box_outs_off=%(box_outs_off)s,
                            box_outs_def=%(box_outs_def)s,
                            box_out_team_reb=%(box_out_team_reb)s,
                            box_out_player_reb=%(box_out_player_reb)s
                        WHERE game_id=%(game_id)s AND team_id=%(team_id)s
                    """, {**stats, "game_id": game_id, "team_id": team_id})

                conn.commit()
                updated += 1
                consecutive_failures = 0
                print("✓")
                break

            except Exception as e:
                conn.rollback()
                if isinstance(e, (AttributeError, ValueError)):
                    bad_data_games.append(game_id)
                    print(f"⚠️  bad data — skipping (no retry): {e}")
                    break
                if attempt < RETRY_ATTEMPTS - 1:
                    wait = RETRY_DELAY * (2 ** attempt)
                    print(f"⚠ attempt {attempt+1} failed ({e}) — retrying in {wait}s", end=" ", flush=True)
                    time.sleep(wait)
                else:
                    failed += 1
                    consecutive_failures += 1
                    print(f"❌ failed after {RETRY_ATTEMPTS} attempts: {e}")
                    if consecutive_failures >= COOLDOWN_THRESHOLD:
                        ts_pause = datetime.now().strftime('%H:%M:%S')
                        print(f"\n⏸  [{ts_pause}] Rate limit detected ({consecutive_failures} consecutive failures) — pausing {COOLDOWN_SECS//60} min...", flush=True)
                        time.sleep(COOLDOWN_SECS)
                        ts_resume = datetime.now().strftime('%H:%M:%S')
                        print(f"▶  [{ts_resume}] Resuming...\n", flush=True)
                        consecutive_failures = 0

    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print(f"✅ Done — updated: {updated}  failed: {failed}")
    if bad_data_games:
        print(f"   ⚠️  Bad data (skipped, no retry): {', '.join(bad_data_games)}")
    if failed:
        print(f"   Re-run to retry {failed} failed games")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
