"""
Freshness check: fail when the newest stored game is too old during the season.

Game data is fetched by hand (NBA.com blocks cloud IPs), so this runs on a
schedule in GitHub Actions and turns a missed manual fetch into a failed run
(GitHub emails the failure).

Env:
  DATABASE_URL           required
  FRESHNESS_MAX_DAYS     optional, default 3
  FRESHNESS_TODAY        optional YYYY-MM-DD override (for testing a stale/fresh DB)
"""
import os
import sys
from datetime import date, datetime

DEFAULT_MAX_DAYS = 3


def in_skip_window(today):
    """True when no games are expected: offseason (Jun 25 - Oct 20) or the All-Star break (Feb 13 - 22)."""
    md = (today.month, today.day)
    if (6, 25) <= md <= (10, 20):
        return True
    if (2, 13) <= md <= (2, 22):
        return True
    return False


def evaluate(newest, today, max_days=DEFAULT_MAX_DAYS):
    """Return (ok, message)."""
    if in_skip_window(today):
        return True, f"{today}: no games expected (offseason or All-Star break), skipping"
    if newest is None:
        return False, "No games stored at all"
    age = (today - newest).days
    if age > max_days:
        return False, f"Stale: newest game is {newest} ({age} days old, limit {max_days}). Run `make pipeline-prod`."
    return True, f"Fresh: newest game is {newest} ({age} days old, limit {max_days})"


def newest_game_date(database_url):
    import psycopg2
    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT MAX(game_date) FROM game_stats")
            row = cur.fetchone()
    finally:
        conn.close()
    value = row[0] if row else None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    return value


def main():
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        print("DATABASE_URL is required", file=sys.stderr)
        return 2
    today_raw = os.getenv("FRESHNESS_TODAY", "")
    today = date.fromisoformat(today_raw) if today_raw else date.today()
    max_days = int(os.getenv("FRESHNESS_MAX_DAYS", DEFAULT_MAX_DAYS))
    ok, message = evaluate(newest_game_date(database_url), today, max_days)
    print(message)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
