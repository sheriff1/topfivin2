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
