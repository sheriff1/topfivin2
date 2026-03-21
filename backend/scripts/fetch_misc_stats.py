#!/usr/bin/env python3
"""
Backfill: Misc V3 stats for existing game_stats rows.

Calls BoxScoreMiscV3 DF1 (team-level) for every game that has
pts_paint IS NULL, and UPDATEs those columns in game_stats.

Columns written:
  pts_paint, pts_fast_break, pts_second_chance, pts_off_to,
  opp_pts_paint, opp_pts_fast_break,
  opp_pts_off_to, opp_pts_second_chance, blk_against, fouls_drawn

Resumable: re-running skips any game_id already filled (pts_paint IS NOT NULL).
Run via: make fetch-misc
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

from nba_api.stats.endpoints import BoxScoreMiscV3

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

def fetch_misc(game_id):
    """Return dict of team_id -> misc stats or raise."""
    result = BoxScoreMiscV3(game_id=game_id, timeout=60)
    df = result.get_data_frames()[1]  # DF1 = team-level misc
    out = {}
    for _, row in df.iterrows():
        team_id = int(row["teamId"])
        out[team_id] = {
            "pts_paint":              _i(row, "pointsPaint"),
            "pts_fast_break":         _i(row, "pointsFastBreak"),
            "pts_second_chance":      _i(row, "pointsSecondChance"),
            "pts_off_to":             _i(row, "pointsOffTurnovers"),
            "opp_pts_paint":          _i(row, "oppPointsPaint"),
            "opp_pts_fast_break":     _i(row, "oppPointsFastBreak"),
            "opp_pts_off_to":         _i(row, "oppPointsOffTurnovers"),
            "opp_pts_second_chance":  _i(row, "oppPointsSecondChance"),
            "blk_against":            _i(row, "blocksAgainst"),
            "fouls_drawn":            _i(row, "foulsDrawn"),
        }
    return out

def main():
    print("=" * 60)
    print("BACKFILL: fetch_misc_stats.py")
    print("Endpoint: BoxScoreMiscV3 DF1")
    print("Columns:  pts_paint, pts_fast_break, pts_second_chance,")
    print("          pts_off_to, opp_pts_paint, opp_pts_fast_break,")
    print("          opp_pts_off_to, opp_pts_second_chance, blk_against, fouls_drawn")
    print("=" * 60)

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT game_id FROM game_stats
        WHERE pts_paint IS NULL OR opp_pts_off_to IS NULL
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
                team_stats = fetch_misc(game_id)

                for team_id, stats in team_stats.items():
                    cur.execute("""
                        UPDATE game_stats
                        SET pts_paint=%(pts_paint)s,
                            pts_fast_break=%(pts_fast_break)s,
                            pts_second_chance=%(pts_second_chance)s,
                            pts_off_to=%(pts_off_to)s,
                            opp_pts_paint=%(opp_pts_paint)s,
                            opp_pts_fast_break=%(opp_pts_fast_break)s,
                            opp_pts_off_to=%(opp_pts_off_to)s,
                            opp_pts_second_chance=%(opp_pts_second_chance)s,
                            blk_against=%(blk_against)s,
                            fouls_drawn=%(fouls_drawn)s
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
