import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_freshness import evaluate, in_skip_window  # noqa: E402


def test_fresh_in_season():
    ok, _ = evaluate(date(2026, 11, 10), date(2026, 11, 12))
    assert ok


def test_boundary_three_days_is_fresh():
    ok, _ = evaluate(date(2026, 11, 9), date(2026, 11, 12))
    assert ok


def test_stale_in_season():
    ok, msg = evaluate(date(2026, 11, 8), date(2026, 11, 12))
    assert not ok and "Stale" in msg


def test_empty_db_fails():
    ok, _ = evaluate(None, date(2026, 11, 12))
    assert not ok


def test_offseason_and_all_star_skipped():
    assert in_skip_window(date(2026, 8, 1))
    assert in_skip_window(date(2027, 2, 16))
    assert not in_skip_window(date(2026, 11, 12))
    ok, _ = evaluate(date(2026, 4, 1), date(2026, 8, 1))
    assert ok
