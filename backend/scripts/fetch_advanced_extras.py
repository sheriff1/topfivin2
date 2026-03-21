#!/usr/bin/env python3
"""
Backfill: Advanced V3 extras for existing game_stats rows.

Calls BoxScoreAdvancedV3 DF1 (team-level) for every game that has
ortg IS NULL, and UPDATEs those columns in game_stats.

Columns written:
  ortg, drtg, net_rtg, efg_pct, pace, possessions, pie

Resumable: re-running skips any game_id already filled (ortg IS NOT NULL).
Run via: make fetch-advanced-extras

Note: BoxScoreAdvancedV3 is already called by fetch_nba_stats.py, but only
7 of its 23 team-level columns are extracted. This script backfills the
remaining columns for the already-populated game_stats rows.
"""

import os
import re
import sys
import time
import random
import psycopg2

# ── Header patch (identical to fetch_nba_stats.py) ───────────────────────────
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

from nba_api.stats.endpoints import BoxScoreAdvancedV3

# ── Config ────────────────────────────────────────────────────────────────────
REQUEST_DELAY  = 2.0   # seconds between API calls
REQUEST_JITTER = 0.3   # ±jitter on delay
RETRY_ATTEMPTS = 3
RETRY_DELAY    = 5     # seconds, doubles each retry

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

def fetch_advanced(game_id):
    """Return dict of team_id -> {ortg, drtg, ...} or raise."""
    result = BoxScoreAdvancedV3(game_id=game_id, timeout=60)
    df = result.get_data_frames()[1]  # DF1 = team-level advanced
    out = {}
    for _, row in df.iterrows():
        team_id = int(row["teamId"])
        out[team_id] = {
            "ortg":        _f(row, "offensiveRating"),
            "drtg":        _f(row, "defensiveRating"),
            "net_rtg":     _f(row, "netRating"),
            "efg_pct":     _f(row, "effectiveFieldGoalPercentage"),
            "pace":        _f(row, "pace"),
            "possessions": _f(row, "possessions"),
            "pie":         _f(row, "PIE"),
        }
    return out

def _f(row, col):
    import pandas as pd
    val = row.get(col)
    return float(val) if val is not None and pd.notna(val) else None

def main():
    print("=" * 60)
    print("BACKFILL: fetch_advanced_extras.py")
    print("Endpoint: BoxScoreAdvancedV3 DF1")
    print("Columns:  ortg, drtg, net_rtg, efg_pct, pace, possessions, pie")
    print("=" * 60)

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT game_id FROM game_stats
        WHERE ortg IS NULL
        ORDER BY game_id
    """)
    pending = [row[0] for row in cur.fetchall()]
    total = len(pending)
    print(f"\n📋 Games to backfill: {total}  (already filled will be skipped automatically)\n")

    skipped = updated = failed = 0

    for idx, game_id in enumerate(pending, 1):
        print(f"  [{idx:4}/{total}] game_id={game_id}", end=" ", flush=True)

        for attempt in range(RETRY_ATTEMPTS):
            try:
                delay()
                team_stats = fetch_advanced(game_id)

                for team_id, stats in team_stats.items():
                    cur.execute("""
                        UPDATE game_stats
                        SET ortg=%(ortg)s, drtg=%(drtg)s, net_rtg=%(net_rtg)s,
                            efg_pct=%(efg_pct)s, pace=%(pace)s,
                            possessions=%(possessions)s, pie=%(pie)s
                        WHERE game_id=%(game_id)s AND team_id=%(team_id)s
                    """, {**stats, "game_id": game_id, "team_id": team_id})

                conn.commit()
                updated += 1
                print("✓")
                break

            except Exception as e:
                conn.rollback()
                if attempt < RETRY_ATTEMPTS - 1:
                    wait = RETRY_DELAY * (2 ** attempt)
                    print(f"⚠ attempt {attempt+1} failed ({e}) — retrying in {wait}s", end=" ", flush=True)
                    time.sleep(wait)
                else:
                    failed += 1
                    print(f"❌ failed after {RETRY_ATTEMPTS} attempts: {e}")

    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print(f"✅ Done — updated: {updated}  skipped: {skipped}  failed: {failed}")
    if failed:
        print(f"   Re-run to retry {failed} failed games (IS NULL check handles resumability)")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
