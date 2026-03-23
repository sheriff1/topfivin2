#!/usr/bin/env python3
"""
Backfill: Consolidated BoxScoreSummaryV3 script (replaces fetch_game_context.py
and fetch_summary_extras.py).

Calls BoxScoreSummaryV3 for every game that is missing any of the 15 stored
columns, and writes all of them in a single DB update per game:

  From DF0 (game-level, same value written to both team rows):
    attendance (INT), duration_mins (FLOAT)

  From DF4 (per-team period scores, wide format):
    q1_pts, q2_pts, q3_pts, q4_pts (INT)

  From DF7 (team game summary):
    biggest_lead (INT), bench_points (INT), lead_changes (INT),
    times_tied (INT), biggest_scoring_run (INT),
    tov_team (INT), tov_total (INT), reb_team (INT),
    pts_from_tov (INT)  ← migration 009 addition

Resumable: skips games where attendance IS NOT NULL AND pts_from_tov IS NOT NULL.
Run via: make fetch-summary
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

def _f(row, col):
    import pandas as pd
    val = row.get(col)
    return float(val) if val is not None and pd.notna(val) else None

def parse_duration_mins(raw) -> float | None:
    """
    Parse a game duration string into decimal minutes.
    Handles ISO 8601 (PT2H13M00.0S), H:MM, H:MM:SS, and plain integers.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?", s, re.IGNORECASE)
    if m:
        hours   = float(m.group(1) or 0)
        minutes = float(m.group(2) or 0)
        secs    = float(m.group(3) or 0)
        return round(hours * 60 + minutes + secs / 60, 2)
    if ":" in s:
        parts = s.split(":")
        try:
            hours   = int(parts[0])
            minutes = int(parts[1])
            secs    = int(parts[2]) if len(parts) > 2 else 0
            return round(hours * 60 + minutes + secs / 60, 2)
        except (ValueError, IndexError):
            pass
    try:
        return float(s)
    except ValueError:
        pass
    return None

def fetch_summary(game_id):
    """
    Returns:
      game_level = {"attendance": INT|None, "duration_mins": FLOAT|None}
      per_team   = {team_id: {"q1_pts":…, "q4_pts":…, "biggest_lead":…, "pts_from_tov":…}}
    """
    import pandas as pd

    result = BoxScoreSummaryV3(game_id=game_id, timeout=60)
    dfs = result.get_data_frames()

    # ── DF0: game-level (attendance, duration) ────────────────────────────────
    df0 = dfs[0]
    attendance_raw = None
    duration_raw   = None
    if not df0.empty:
        row0 = df0.iloc[0]
        for att_col in ("attendance", "Attendance", "gameAttendance"):
            if att_col in row0.index:
                attendance_raw = row0.get(att_col)
                break
        for dur_col in ("gameDuration", "GameDuration", "duration", "Duration"):
            if dur_col in row0.index:
                duration_raw = row0.get(dur_col)
                break
    attendance    = int(attendance_raw) if attendance_raw is not None and str(attendance_raw).strip() else None
    duration_mins = parse_duration_mins(duration_raw)
    game_level = {"attendance": attendance, "duration_mins": duration_mins}

    # ── DF4: per-team period scores ───────────────────────────────────────────
    df4 = dfs[4]
    per_team = {}
    if not df4.empty:
        for _, row in df4.iterrows():
            t_id = row.get("teamId")
            if t_id is None:
                continue
            try:
                t_id = int(t_id)
            except (ValueError, TypeError):
                continue
            per_team[t_id] = {
                "q1_pts": _i(row, "period1Score"),
                "q2_pts": _i(row, "period2Score"),
                "q3_pts": _i(row, "period3Score"),
                "q4_pts": _i(row, "period4Score"),
            }

    # ── DF7: team game summary ────────────────────────────────────────────────
    df7 = dfs[7]
    if not df7.empty:
        for _, row in df7.iterrows():
            t_id_raw = row.get("teamId")
            if t_id_raw is None:
                continue
            try:
                t_id = int(t_id_raw)
            except (ValueError, TypeError):
                continue
            entry = per_team.setdefault(t_id, {})
            entry.update({
                "biggest_lead":        _i(row, "biggestLead"),
                "bench_points":        _i(row, "benchPoints"),
                "lead_changes":        _i(row, "leadChanges"),
                "times_tied":          _i(row, "timesTied"),
                "biggest_scoring_run": _i(row, "biggestScoringRun"),
                "tov_team":            _i(row, "turnoversTeam"),
                "tov_total":           _i(row, "turnoversTotal"),
                "reb_team":            _i(row, "reboundsTeam"),
                "pts_from_tov":        _i(row, "pointsFromTurnovers"),
            })

    return game_level, per_team

def main():
    print("=" * 60)
    print("BACKFILL: fetch_summary.py")
    print("Endpoint: BoxScoreSummaryV3 DF0 + DF4 + DF7")
    print("Columns:  attendance, duration_mins, q1_pts..q4_pts,")
    print("          biggest_lead, bench_points, lead_changes,")
    print("          times_tied, biggest_scoring_run,")
    print("          tov_team, tov_total, reb_team, pts_from_tov")
    print("=" * 60)

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT game_id FROM game_stats
        WHERE attendance IS NULL
           OR biggest_lead IS NULL
           OR pts_from_tov IS NULL
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
                game_level, per_team = fetch_summary(game_id)

                # Write attendance + duration to both team rows for this game
                cur.execute("""
                    UPDATE game_stats
                    SET attendance=%(attendance)s,
                        duration_mins=%(duration_mins)s
                    WHERE game_id=%(game_id)s
                """, {**game_level, "game_id": game_id})

                # Write per-team columns
                for team_id, stats in per_team.items():
                    cur.execute("""
                        UPDATE game_stats
                        SET q1_pts=%(q1_pts)s,
                            q2_pts=%(q2_pts)s,
                            q3_pts=%(q3_pts)s,
                            q4_pts=%(q4_pts)s,
                            biggest_lead=%(biggest_lead)s,
                            bench_points=%(bench_points)s,
                            lead_changes=%(lead_changes)s,
                            times_tied=%(times_tied)s,
                            biggest_scoring_run=%(biggest_scoring_run)s,
                            tov_team=%(tov_team)s,
                            tov_total=%(tov_total)s,
                            reb_team=%(reb_team)s,
                            pts_from_tov=%(pts_from_tov)s
                        WHERE game_id=%(game_id)s AND team_id=%(team_id)s
                    """, {
                        "q1_pts":              stats.get("q1_pts"),
                        "q2_pts":              stats.get("q2_pts"),
                        "q3_pts":              stats.get("q3_pts"),
                        "q4_pts":              stats.get("q4_pts"),
                        "biggest_lead":        stats.get("biggest_lead"),
                        "bench_points":        stats.get("bench_points"),
                        "lead_changes":        stats.get("lead_changes"),
                        "times_tied":          stats.get("times_tied"),
                        "biggest_scoring_run": stats.get("biggest_scoring_run"),
                        "tov_team":            stats.get("tov_team"),
                        "tov_total":           stats.get("tov_total"),
                        "reb_team":            stats.get("reb_team"),
                        "pts_from_tov":        stats.get("pts_from_tov"),
                        "game_id":             game_id,
                        "team_id":             team_id,
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
