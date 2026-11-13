"""NULL handling in derive_team_stats averages (issue #273).

Runs the real aggregation SQL against TEMP copies of game_stats/team_stats on the
local Postgres, so nothing real is touched. Skipped when no database is reachable
(e.g. CI), since the repo's Python CI has no Postgres service.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

psycopg2 = pytest.importorskip("psycopg2")
from derive_team_stats import INSERT_STATS_SQL  # noqa: E402  (also loads backend/.env)


@pytest.fixture
def cur():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 5432)),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "nba_stats"),
            connect_timeout=2,
        )
    except psycopg2.OperationalError as e:
        pytest.skip(f"no local Postgres: {e}")
    c = conn.cursor()
    try:
        # TEMP tables shadow the real ones for this session only.
        for t in ("game_stats", "team_stats"):
            c.execute(f"CREATE TEMP TABLE {t} (LIKE public.{t} INCLUDING ALL)")
    except psycopg2.Error as e:
        conn.rollback()
        conn.close()
        pytest.skip(f"schema not available: {e}")
    yield c
    conn.rollback()
    conn.close()


def _game(c, game_id, team, pts, distance):
    c.execute(
        "INSERT INTO game_stats (game_id, team_id, game_date, season, pts, distance, win) "
        "VALUES (%s, %s, '2026-11-01', '2026', %s, %s, 1)",
        (game_id, team, pts, distance),
    )


def test_average_skips_null_stat_game(cur):
    # Team 1: tracking data missing for one of three games -> average of the two real games.
    _game(cur, "g1", 1, 100, 10)
    _game(cur, "g2", 1, 100, None)
    _game(cur, "g3", 1, 100, 20)
    # Team 2: no tracking data at all -> 0, not NULL (rankings sort NULLs first).
    _game(cur, "g4", 2, 90, None)
    _game(cur, "g5", 2, 90, None)
    cur.execute(INSERT_STATS_SQL)
    cur.execute("SELECT team_id, distance, pts, pts_avg FROM team_stats ORDER BY team_id")
    (t1, d1, pts1, pa1), (t2, d2, pts2, pa2) = cur.fetchall()
    assert float(d1) == 15.0  # was 10.0 with AVG(COALESCE(x, 0))
    assert d2 is not None and float(d2) == 0.0
    # Totals and fully-populated averages are unchanged.
    assert pts1 == 300 and float(pa1) == 100.0
    assert pts2 == 180 and float(pa2) == 90.0


def test_no_avg_coalesce_left():
    assert "AVG(COALESCE" not in INSERT_STATS_SQL
