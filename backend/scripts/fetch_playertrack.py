#!/usr/bin/env python3
"""
Backfill: Player tracking stats from BoxScorePlayerTrackV3 DF1.

Calls BoxScorePlayerTrackV3 for every game that has distance IS NULL,
and UPDATEs those columns in game_stats.

Columns written:
  distance           ← distance (FLOAT, miles)
  reb_chances_off    ← reboundChancesOffensive (INT)
  reb_chances_def    ← reboundChancesDefensive (INT)
  reb_chances_total  ← reboundChancesTotal (INT)
  touches            ← touches (INT)
  secondary_ast      ← secondaryAssists (INT)
  ft_ast             ← freeThrowAssists (INT)
  passes             ← passes (INT)
  contested_fgm      ← contestedFieldGoalsMade (INT)
  contested_fga      ← contestedFieldGoalsAttempted (INT)
  contested_fg_pct   ← contestedFieldGoalPercentage (FLOAT)
  uncontested_fgm    ← uncontestedFieldGoalsMade (INT)
  uncontested_fga    ← uncontestedFieldGoalsAttempted (INT)
  uncontested_fg_pct ← uncontestedFieldGoalsPercentage (FLOAT)
  dar_fgm            ← defendedAtRimFieldGoalsMade (INT)
  dar_fga            ← defendedAtRimFieldGoalsAttempted (INT)
  dar_fg_pct         ← defendedAtRimFieldGoalPercentage (FLOAT)

  Skipped:
    speed             — always NULL in team-level data (SportVU)
    assists           — duplicate of ast (already stored)
    fieldGoalPercentage — duplicate of fg_pct (already stored)

Resumable: re-running skips any game_id already filled (distance IS NOT NULL).
Run via: make fetch-playertrack
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

from nba_api.stats.endpoints import BoxScorePlayerTrackV3

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

def _i(row, col):
    import pandas as pd
    val = row.get(col)
    return int(val) if val is not None and pd.notna(val) else None

def fetch_playertrack(game_id):
    """Return dict of team_id -> {distance, reb_chances_off, ...} or raise."""
    result = BoxScorePlayerTrackV3(game_id=game_id, timeout=60)
    df = result.get_data_frames()[1]  # DF1 = team-level player tracking
    out = {}
    for _, row in df.iterrows():
        team_id = int(row["teamId"])
        out[team_id] = {
            "distance":           _f(row, "distance"),
            "reb_chances_off":    _i(row, "reboundChancesOffensive"),
            "reb_chances_def":    _i(row, "reboundChancesDefensive"),
            "reb_chances_total":  _i(row, "reboundChancesTotal"),
            "touches":            _i(row, "touches"),
            "secondary_ast":      _i(row, "secondaryAssists"),
            "ft_ast":             _i(row, "freeThrowAssists"),
            "passes":             _i(row, "passes"),
            "contested_fgm":      _i(row, "contestedFieldGoalsMade"),
            "contested_fga":      _i(row, "contestedFieldGoalsAttempted"),
            "contested_fg_pct":   _f(row, "contestedFieldGoalPercentage"),
            "uncontested_fgm":    _i(row, "uncontestedFieldGoalsMade"),
            "uncontested_fga":    _i(row, "uncontestedFieldGoalsAttempted"),
            "uncontested_fg_pct": _f(row, "uncontestedFieldGoalsPercentage"),
            "dar_fgm":            _i(row, "defendedAtRimFieldGoalsMade"),
            "dar_fga":            _i(row, "defendedAtRimFieldGoalsAttempted"),
            "dar_fg_pct":         _f(row, "defendedAtRimFieldGoalPercentage"),
        }
    return out

def main():
    print("=" * 60)
    print("BACKFILL: fetch_playertrack.py")
    print("Endpoint: BoxScorePlayerTrackV3 DF1")
    print("Columns:  distance, reb_chances_off/def/total, touches,")
    print("          secondary_ast, ft_ast, passes,")
    print("          contested_fgm/fga/fg_pct,")
    print("          uncontested_fgm/fga/fg_pct,")
    print("          dar_fgm/fga/fg_pct")
    print("=" * 60)

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT game_id FROM game_stats
        WHERE distance IS NULL
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
                team_stats = fetch_playertrack(game_id)

                for team_id, stats in team_stats.items():
                    cur.execute("""
                        UPDATE game_stats
                        SET distance=%(distance)s,
                            reb_chances_off=%(reb_chances_off)s,
                            reb_chances_def=%(reb_chances_def)s,
                            reb_chances_total=%(reb_chances_total)s,
                            touches=%(touches)s,
                            secondary_ast=%(secondary_ast)s,
                            ft_ast=%(ft_ast)s,
                            passes=%(passes)s,
                            contested_fgm=%(contested_fgm)s,
                            contested_fga=%(contested_fga)s,
                            contested_fg_pct=%(contested_fg_pct)s,
                            uncontested_fgm=%(uncontested_fgm)s,
                            uncontested_fga=%(uncontested_fga)s,
                            uncontested_fg_pct=%(uncontested_fg_pct)s,
                            dar_fgm=%(dar_fgm)s,
                            dar_fga=%(dar_fga)s,
                            dar_fg_pct=%(dar_fg_pct)s
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
