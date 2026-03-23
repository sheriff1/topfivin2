#!/usr/bin/env python3
"""
Backfill: Four Factors stats from BoxScoreFourFactorsV3 DF1.

Calls BoxScoreFourFactorsV3 for every game that has ft_rate IS NULL,
and UPDATEs those columns in game_stats.

Columns written:
  ft_rate      ← freeThrowAttemptRate
  tm_tov_pct   ← teamTurnoverPercentage
  oreb_pct     ← offensiveReboundPercentage
  opp_efg_pct  ← oppEffectiveFieldGoalPercentage
  opp_ft_rate  ← oppFreeThrowAttemptRate
  opp_tov_pct  ← oppTeamTurnoverPercentage
  opp_oreb_pct ← oppOffensiveReboundPercentage
  (effectiveFieldGoalPercentage skipped — already stored as efg_pct from AdvancedV3)

Resumable: re-running skips any game_id already filled (ft_rate IS NOT NULL).
Run via: make fetch-fourfactors
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

from nba_api.stats.endpoints import BoxScoreFourFactorsV3

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

def _f(row, col):
    import pandas as pd
    val = row.get(col)
    return float(val) if val is not None and pd.notna(val) else None

def fetch_fourfactors(game_id):
    """Return dict of team_id -> {ft_rate, tm_tov_pct, oreb_pct, ...} or raise."""
    result = BoxScoreFourFactorsV3(game_id=game_id, timeout=60)
    df = result.get_data_frames()[1]  # DF1 = team-level four factors
    out = {}
    for _, row in df.iterrows():
        team_id = int(row["teamId"])
        out[team_id] = {
            "ft_rate":      _f(row, "freeThrowAttemptRate"),
            "tm_tov_pct":   _f(row, "teamTurnoverPercentage"),
            "oreb_pct":     _f(row, "offensiveReboundPercentage"),
            "opp_efg_pct":  _f(row, "oppEffectiveFieldGoalPercentage"),
            "opp_ft_rate":  _f(row, "oppFreeThrowAttemptRate"),
            "opp_tov_pct":  _f(row, "oppTeamTurnoverPercentage"),
            "opp_oreb_pct": _f(row, "oppOffensiveReboundPercentage"),
        }
    return out

def main():
    print("=" * 60)
    print("BACKFILL: fetch_fourfactors.py")
    print("Endpoint: BoxScoreFourFactorsV3 DF1")
    print("Columns:  ft_rate, tm_tov_pct, oreb_pct,")
    print("          opp_efg_pct, opp_ft_rate, opp_tov_pct, opp_oreb_pct")
    print("=" * 60)

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT game_id FROM game_stats
        WHERE ft_rate IS NULL
        ORDER BY game_id
    """)
    pending = [row[0] for row in cur.fetchall()]
    total = len(pending)
    print(f"\n📋 Games to backfill: {total}\n")

    updated = failed = consecutive_failures = 0
    bad_data_games = []
    COOLDOWN_THRESHOLD = 1
    COOLDOWN_SECS      = 30

    for idx, game_id in enumerate(pending, 1):
        print(f"  [{idx:4}/{total}] game_id={game_id}", end=" ", flush=True)

        for attempt in range(RETRY_ATTEMPTS):
            try:
                delay()
                team_stats = fetch_fourfactors(game_id)

                for team_id, stats in team_stats.items():
                    cur.execute("""
                        UPDATE game_stats
                        SET ft_rate=%(ft_rate)s,
                            tm_tov_pct=%(tm_tov_pct)s,
                            oreb_pct=%(oreb_pct)s,
                            opp_efg_pct=%(opp_efg_pct)s,
                            opp_ft_rate=%(opp_ft_rate)s,
                            opp_tov_pct=%(opp_tov_pct)s,
                            opp_oreb_pct=%(opp_oreb_pct)s
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
                        print(f"\n⏸  [{ts_pause}] Rate limit detected ({consecutive_failures} consecutive failures) — resetting session & pausing {COOLDOWN_SECS}s...", flush=True)
                        try:
                            from nba_api.stats.library import http as _sh
                            from nba_api.library import http as _bh
                            _sh.NBAStatsHTTP._session = None
                            _bh.NBAHTTP._session = None
                        except Exception:
                            pass
                        time.sleep(COOLDOWN_SECS)
                        ts_resume = datetime.now().strftime('%H:%M:%S')
                        print(f"▶  [{ts_resume}] Resuming...\n", flush=True)
                        consecutive_failures = 0

    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print(f"✅ Done — updated: {updated}  failed: {failed}")
    if bad_data_games:
        print(f"   ⚠️  Bad data (skipped, no retry): {', '.join(map(str, bad_data_games))}")
    if failed:
        print(f"   Re-run to retry {failed} failed games")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
