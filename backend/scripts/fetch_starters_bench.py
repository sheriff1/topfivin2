#!/usr/bin/env python3
"""
Backfill: Starters vs. bench split stats from BoxScoreTraditionalV3 DF1.

Calls BoxScoreTraditionalV3 DF1 (starters/bench group split, 4 rows per game:
2 teams × "Starters"/"Bench") for every game that has starters_pts IS NULL,
and UPDATEs those columns in game_stats.

Columns written:
  starters_fg, starters_fga, starters_fg_pct,
  starters_three_p, starters_three_pa, starters_three_p_pct,
  starters_ft, starters_fta, starters_ft_pct,
  starters_oreb, starters_dreb, starters_reb,
  starters_ast, starters_stl, starters_blk, starters_tov,
  starters_pf, starters_pts, starters_pm
  (same 19 with bench_ prefix)

Also logs raw plusMinusPoints from DF2 (team totals) for the first 5 games
to verify whether team-level plus/minus is genuinely always 0.

Resumable: re-running skips any game_id already filled (starters_pts IS NOT NULL).
Run via: make fetch-starters-bench
"""

import os
import sys
import time
from datetime import datetime
import random
import psycopg2

# ── Load .env configuration ───────────────────────────────────────────────────
def load_env():
    try:
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        key, val = line.split('=', 1)
                        os.environ.setdefault(key, val)
    except Exception as e:
        print(f"⚠️  .env load failed: {e}")

load_env()

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

from nba_api.stats.endpoints import BoxScoreTraditionalV3

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

def _f(row, col):
    import pandas as pd
    val = row.get(col)
    return float(val) if val is not None and pd.notna(val) else None

def _group_stats(row):
    """Extract all per-group stats from a DF1 row into a flat dict."""
    return {
        "fg":          _i(row, "fieldGoalsMade"),
        "fga":         _i(row, "fieldGoalsAttempted"),
        "fg_pct":      _f(row, "fieldGoalsPercentage"),
        "three_p":     _i(row, "threePointersMade"),
        "three_pa":    _i(row, "threePointersAttempted"),
        "three_p_pct": _f(row, "threePointersPercentage"),
        "ft":          _i(row, "freeThrowsMade"),
        "fta":         _i(row, "freeThrowsAttempted"),
        "ft_pct":      _f(row, "freeThrowsPercentage"),
        "oreb":        _i(row, "reboundsOffensive"),
        "dreb":        _i(row, "reboundsDefensive"),
        "reb":         _i(row, "reboundsTotal"),
        "ast":         _i(row, "assists"),
        "stl":         _i(row, "steals"),
        "blk":         _i(row, "blocks"),
        "tov":         _i(row, "turnovers"),
        "pf":          _i(row, "foulsPersonal"),
        "pts":         _i(row, "points"),
        "pm":          _f(row, "plusMinusPoints"),
    }

def fetch_starters_bench(game_id):
    """
    Return dict of team_id -> {starters: {...}, bench: {...}, plus_minus: float} or raise.
    Extracts starters/bench group stats from DF1 and team-level plus/minus from DF2.
    """
    result = BoxScoreTraditionalV3(game_id=game_id, timeout=60)
    dfs = result.get_data_frames()
    df1 = dfs[1]  # DF1 = starters/bench split (4 rows: 2 teams × 2 groups)
    df2 = dfs[2]  # DF2 = team totals (has real plusMinusPoints)

    # Extract real team-level plus/minus from DF2
    team_pm = {}
    for _, row in df2.iterrows():
        tid = int(row["teamId"])
        team_pm[tid] = _f(row, "plusMinusPoints")

    out = {}
    for _, row in df1.iterrows():
        team_id = int(row["teamId"])
        group = str(row.get("startersBench", "")).strip()
        stats = _group_stats(row)

        if team_id not in out:
            out[team_id] = {"plus_minus": team_pm.get(team_id)}

        if group == "Starters":
            out[team_id]["starters"] = stats
        elif group == "Bench":
            out[team_id]["bench"] = stats

    return out

def main():
    print("=" * 60)
    print("BACKFILL: fetch_starters_bench.py")
    print("Endpoint: BoxScoreTraditionalV3 DF1 (starters/bench split)")
    print("          + DF2 (team totals) for real plus_minus")
    print("Columns:  starters_fg … starters_pm (19 cols)")
    print("          bench_fg … bench_pm (19 cols)")
    print("          plus_minus (real value from DF2 plusMinusPoints)")
    print("=" * 60)

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT game_id FROM game_stats
        WHERE starters_pts IS NULL OR plus_minus = 0
        ORDER BY game_id
    """)
    pending = [row[0] for row in cur.fetchall()]
    total = len(pending)
    print(f"\n📋 Games to backfill: {total}\n")

    updated = failed = consecutive_failures = 0
    bad_data_games = []
    COOLDOWN_THRESHOLD = 2
    COOLDOWN_SECS      = 480  # 8 minutes

    for idx, game_id in enumerate(pending, 1):
        print(f"  [{idx:4}/{total}] game_id={game_id}", end=" ", flush=True)

        for attempt in range(RETRY_ATTEMPTS):
            try:
                delay()
                team_data = fetch_starters_bench(game_id)

                for team_id, groups in team_data.items():
                    starters = groups.get("starters", {})
                    bench    = groups.get("bench", {})

                    cur.execute("""
                        UPDATE game_stats
                        SET starters_fg=%(s_fg)s,
                            starters_fga=%(s_fga)s,
                            starters_fg_pct=%(s_fg_pct)s,
                            starters_three_p=%(s_three_p)s,
                            starters_three_pa=%(s_three_pa)s,
                            starters_three_p_pct=%(s_three_p_pct)s,
                            starters_ft=%(s_ft)s,
                            starters_fta=%(s_fta)s,
                            starters_ft_pct=%(s_ft_pct)s,
                            starters_oreb=%(s_oreb)s,
                            starters_dreb=%(s_dreb)s,
                            starters_reb=%(s_reb)s,
                            starters_ast=%(s_ast)s,
                            starters_stl=%(s_stl)s,
                            starters_blk=%(s_blk)s,
                            starters_tov=%(s_tov)s,
                            starters_pf=%(s_pf)s,
                            starters_pts=%(s_pts)s,
                            starters_pm=%(s_pm)s,
                            bench_fg=%(b_fg)s,
                            bench_fga=%(b_fga)s,
                            bench_fg_pct=%(b_fg_pct)s,
                            bench_three_p=%(b_three_p)s,
                            bench_three_pa=%(b_three_pa)s,
                            bench_three_p_pct=%(b_three_p_pct)s,
                            bench_ft=%(b_ft)s,
                            bench_fta=%(b_fta)s,
                            bench_ft_pct=%(b_ft_pct)s,
                            bench_oreb=%(b_oreb)s,
                            bench_dreb=%(b_dreb)s,
                            bench_reb=%(b_reb)s,
                            bench_ast=%(b_ast)s,
                            bench_stl=%(b_stl)s,
                            bench_blk=%(b_blk)s,
                            bench_tov=%(b_tov)s,
                            bench_pf=%(b_pf)s,
                            bench_pts=%(b_pts)s,
                            bench_pm=%(b_pm)s,
                            plus_minus=%(plus_minus)s
                        WHERE game_id=%(game_id)s AND team_id=%(team_id)s
                    """, {
                        "s_fg":          starters.get("fg"),
                        "s_fga":         starters.get("fga"),
                        "s_fg_pct":      starters.get("fg_pct"),
                        "s_three_p":     starters.get("three_p"),
                        "s_three_pa":    starters.get("three_pa"),
                        "s_three_p_pct": starters.get("three_p_pct"),
                        "s_ft":          starters.get("ft"),
                        "s_fta":         starters.get("fta"),
                        "s_ft_pct":      starters.get("ft_pct"),
                        "s_oreb":        starters.get("oreb"),
                        "s_dreb":        starters.get("dreb"),
                        "s_reb":         starters.get("reb"),
                        "s_ast":         starters.get("ast"),
                        "s_stl":         starters.get("stl"),
                        "s_blk":         starters.get("blk"),
                        "s_tov":         starters.get("tov"),
                        "s_pf":          starters.get("pf"),
                        "s_pts":         starters.get("pts"),
                        "s_pm":          starters.get("pm"),
                        "b_fg":          bench.get("fg"),
                        "b_fga":         bench.get("fga"),
                        "b_fg_pct":      bench.get("fg_pct"),
                        "b_three_p":     bench.get("three_p"),
                        "b_three_pa":    bench.get("three_pa"),
                        "b_three_p_pct": bench.get("three_p_pct"),
                        "b_ft":          bench.get("ft"),
                        "b_fta":         bench.get("fta"),
                        "b_ft_pct":      bench.get("ft_pct"),
                        "b_oreb":        bench.get("oreb"),
                        "b_dreb":        bench.get("dreb"),
                        "b_reb":         bench.get("reb"),
                        "b_ast":         bench.get("ast"),
                        "b_stl":         bench.get("stl"),
                        "b_blk":         bench.get("blk"),
                        "b_tov":         bench.get("tov"),
                        "b_pf":          bench.get("pf"),
                        "b_pts":         bench.get("pts"),
                        "b_pm":          bench.get("pm"),
                        "plus_minus":    groups.get("plus_minus"),
                        "game_id":       game_id,
                        "team_id":       team_id,
                    })

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
