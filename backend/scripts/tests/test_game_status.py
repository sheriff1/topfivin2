"""Unit tests for game_status (no DB or network)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from game_status import final_game_ids, is_final  # noqa: E402


@pytest.mark.parametrize("wl, expected", [
    ("W", True), ("L", True), (" W ", True),
    (None, False), ("", False), (float("nan"), False),
])
def test_is_final(wl, expected):
    assert is_final(wl) is expected


def test_final_game_ids_skips_in_progress():
    games = [
        {"game_id": "001", "wl": "W"}, {"game_id": "001", "wl": "L"},
        {"game_id": "002", "wl": None}, {"game_id": "002", "wl": None},
        {"game_id": "003"},
    ]
    assert final_game_ids(games) == {"001"}


from datetime import date  # noqa: E402

from game_status import needs_status_check, should_skip  # noqa: E402


@pytest.mark.parametrize("status, expected", [(1, True), (2, True), (3, False), (None, False)])
def test_should_skip_is_fail_open(status, expected):
    assert should_skip(status) is expected


@pytest.mark.parametrize("game_date, expected", [
    ("2026-11-12", True), ("2026-11-11", True), ("2026-11-10", False),
    ("2025-11-19", False), ("garbage", True), (None, True),
])
def test_needs_status_check_recent_only(game_date, expected):
    assert needs_status_check(game_date, date(2026, 11, 12)) is expected
