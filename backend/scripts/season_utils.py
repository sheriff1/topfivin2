"""
Season helpers shared by the pipeline scripts.

- calendar_season(): the season the *fetch* step targets. A new season has no
  rows yet, so it cannot come from stored data; it is derived from the date
  (NBA seasons start in October).
- latest_stored_season(): the current season for every other step (derive,
  rank, social images). Mirrors the API: the latest season present in
  team_stats/games.
"""
import sys
from datetime import date


def calendar_season(today=None):
    """Season start year as a string: year if month >= 10 else year - 1."""
    today = today or date.today()
    return str(today.year if today.month >= 10 else today.year - 1)


def latest_stored_season(conn):
    """Latest season present in team_stats or games, or None if both are empty."""
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT MAX(season) FROM (
                SELECT season FROM team_stats
                UNION
                SELECT season FROM games
            ) s
            """
        )
        row = cur.fetchone()
    finally:
        cur.close()
    return str(row[0]) if row and row[0] is not None else None


def require_latest_stored_season(conn):
    """Like latest_stored_season but exits with a clear message when empty."""
    season = latest_stored_season(conn)
    if not season:
        print("❌ No season data in the database yet. Run the fetch step first.")
        sys.exit(1)
    return season
