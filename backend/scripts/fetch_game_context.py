#!/usr/bin/env python3
"""
Backfill: Game context stats from BoxScoreSummaryV3 DF0 + DF4.

Calls BoxScoreSummaryV3 for every game that has attendance IS NULL, and
UPDATEs game_stats with:
  - attendance (INT)  — from DF0 (game-level, same for both teams in a game)
  - duration_mins (FLOAT) — parsed from DF0 gameDuration string → decimal minutes
  - q1_pts, q2_pts, q3_pts, q4_pts (INT) — from DF4 (per-team period scores)

Notes on raw data:
  - DF0 gameDuration may be "2:13" (H:MM) or "PT2H13M00S" (ISO 8601) or similar.
    Raw value is logged for the first game so we can confirm parsing works correctly.
  - DF4 column names for per-period pts are unknown. All column names are logged on
    the first game so we can confirm which key to use (likely "value" or "pts").
  - attendance and duration_mins are game-level, written identically for both teams.

Resumable: re-running skips any game_id already filled (attendance IS NOT NULL).
Run via: make fetch-game-context
"""

import os
import re
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

from nba_api.stats.endpoints import BoxScoreSummaryV3

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

def parse_duration_mins(raw) -> float | None:
    """
    Parse a game duration string into decimal minutes (float).
    Handles:
      "2:13"        (H:MM)   → 133.0
      "2:13:45"     (H:MM:SS)→ 133.75
      "PT2H13M00.0S"(ISO8601)→ 133.0
      "133"         (plain int minutes) → 133.0
      None / ""              → None
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None

    # ISO 8601: PT2H13M00.0S  or  PT0H31M25.0S
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?", s, re.IGNORECASE)
    if m:
        hours   = float(m.group(1) or 0)
        minutes = float(m.group(2) or 0)
        secs    = float(m.group(3) or 0)
        return round(hours * 60 + minutes + secs / 60, 2)

    # H:MM or H:MM:SS
    if ":" in s:
        parts = s.split(":")
        try:
            hours   = int(parts[0])
            minutes = int(parts[1])
            secs    = int(parts[2]) if len(parts) > 2 else 0
            return round(hours * 60 + minutes + secs / 60, 2)
        except (ValueError, IndexError):
            pass

    # Plain integer (minutes)
    try:
        return float(s)
    except ValueError:
        pass

    return None

def fetch_game_context(game_id, log_columns=False):
    """
    Return (game_level, per_team_dict) where:
      game_level = {"attendance": INT, "duration_mins": FLOAT}
      per_team_dict = {team_id: {"q1_pts": INT, "q2_pts": INT, "q3_pts": INT, "q4_pts": INT}}
    """
    result = BoxScoreSummaryV3(game_id=game_id, timeout=60)
    dfs = result.get_data_frames()

    # ── DF0: game-level info (one row, but may have multiple rows) ────────────
    df0 = dfs[0]
    if log_columns:
        print(f"    [COLS] DF0 columns: {list(df0.columns)}")

    attendance_raw = None
    duration_raw   = None
    if not df0.empty:
        row0 = df0.iloc[0]
        if log_columns:
            print(f"    [ROW0] DF0 first row: {dict(row0)}")

        # Try common column names; log whichever key exists
        for att_col in ("attendance", "Attendance", "gameAttendance"):
            if att_col in row0.index:
                attendance_raw = row0.get(att_col)
                break
        for dur_col in ("gameDuration", "GameDuration", "duration", "Duration"):
            if dur_col in row0.index:
                duration_raw = row0.get(dur_col)
                break

        if log_columns:
            print(f"    [DUR] raw gameDuration = {duration_raw!r}")
            print(f"    [ATT] raw attendance   = {attendance_raw!r}")

    attendance = int(attendance_raw) if attendance_raw is not None and str(attendance_raw).strip() else None
    duration_mins = parse_duration_mins(duration_raw)

    game_level = {"attendance": attendance, "duration_mins": duration_mins}

    # ── DF4: per-team period scores (wide format) ────────────────────────────
    # Columns: teamId, period1Score, period2Score, period3Score, period4Score, …
    # One row per team; OT scores are in period5Score+ (ignored here).
    df4 = dfs[4]
    if log_columns:
        print(f"    [COLS] DF4 columns: {list(df4.columns)}")
        if not df4.empty:
            print(f"    [DF4] first 8 rows:\n{df4.head(8).to_string()}")

    per_team = {}
    if not df4.empty:
        import pandas as pd
        for _, row in df4.iterrows():
            t_id = row.get("teamId")
            if t_id is None:
                continue
            try:
                t_id = int(t_id)
            except (ValueError, TypeError):
                continue

            def _si(col):
                v = row.get(col)
                return int(v) if v is not None and pd.notna(v) else None

            per_team[t_id] = {
                "q1_pts": _si("period1Score"),
                "q2_pts": _si("period2Score"),
                "q3_pts": _si("period3Score"),
                "q4_pts": _si("period4Score"),
            }

    return game_level, per_team

def main():
    print("=" * 60)
    print("BACKFILL: fetch_game_context.py")
    print("Endpoint: BoxScoreSummaryV3 DF0 (attendance, duration)")
    print("                           DF4 (per-team period scores)")
    print("Columns:  attendance, duration_mins, q1_pts…q4_pts")
    print("=" * 60)

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT game_id FROM game_stats
        WHERE attendance IS NULL OR q1_pts IS NULL
        ORDER BY game_id
    """)
    pending = [row[0] for row in cur.fetchall()]
    total = len(pending)
    print(f"\n📋 Games to backfill: {total}\n")
    print("ℹ️  First game will log raw DF0/DF4 column names and values\n")

    updated = failed = consecutive_failures = 0
    bad_data_games = []
    COOLDOWN_THRESHOLD = 2
    COOLDOWN_SECS      = 30  # 30 seconds

    first_game = True

    for idx, game_id in enumerate(pending, 1):
        log_cols = first_game
        print(f"  [{idx:4}/{total}] game_id={game_id}", end=" ", flush=True)

        for attempt in range(RETRY_ATTEMPTS):
            try:
                delay()
                game_level, per_team = fetch_game_context(game_id, log_columns=log_cols)

                if first_game:
                    first_game = False
                    print(f"\n    [Result] game_level={game_level}")
                    print(f"    [Result] per_team={per_team}\n", flush=True)

                # Write attendance + duration to both team rows for this game
                cur.execute("""
                    UPDATE game_stats
                    SET attendance=%(attendance)s,
                        duration_mins=%(duration_mins)s
                    WHERE game_id=%(game_id)s
                """, {**game_level, "game_id": game_id})

                # Write per-team period scores
                for team_id, qs in per_team.items():
                    cur.execute("""
                        UPDATE game_stats
                        SET q1_pts=%(q1_pts)s,
                            q2_pts=%(q2_pts)s,
                            q3_pts=%(q3_pts)s,
                            q4_pts=%(q4_pts)s
                        WHERE game_id=%(game_id)s AND team_id=%(team_id)s
                    """, {
                        "q1_pts":  qs.get("q1_pts"),
                        "q2_pts":  qs.get("q2_pts"),
                        "q3_pts":  qs.get("q3_pts"),
                        "q4_pts":  qs.get("q4_pts"),
                        "game_id": game_id,
                        "team_id": team_id,
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
                        print(f"\n⏸  [{ts_pause}] Rate limit detected ({consecutive_failures} consecutive failures) — pausing {COOLDOWN_SECS}s...", flush=True)
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
