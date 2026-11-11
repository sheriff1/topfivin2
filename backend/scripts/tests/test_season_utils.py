"""Unit tests for season_utils and the fetch season override (no DB or network)."""
import sys
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from season_utils import (  # noqa: E402
    calendar_season,
    latest_stored_season,
    require_latest_stored_season,
)


class TestCalendarSeason:
    @pytest.mark.parametrize(
        "d, expected",
        [
            (date(2026, 9, 30), "2025"),   # offseason, before rollover
            (date(2026, 10, 1), "2026"),   # rollover day
            (date(2026, 12, 31), "2026"),
            (date(2027, 1, 1), "2026"),
            (date(2027, 6, 30), "2026"),   # finals / offseason still previous season
        ],
    )
    def test_october_rollover(self, d, expected):
        assert calendar_season(d) == expected


def _conn(value):
    cur = MagicMock()
    cur.fetchone.return_value = (value,)
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn


class TestLatestStoredSeason:
    def test_returns_string(self):
        assert latest_stored_season(_conn("2026")) == "2026"

    def test_empty_db_is_none(self):
        assert latest_stored_season(_conn(None)) is None

    def test_require_exits_on_empty(self):
        with pytest.raises(SystemExit):
            require_latest_stored_season(_conn(None))


class TestResolveFetchSeason:
    @pytest.fixture(autouse=True)
    def _no_env(self, monkeypatch):
        monkeypatch.delenv("FETCH_SEASON", raising=False)

    def _resolve(self, argv):
        pytest.importorskip("nba_api")
        from fetch_nba_stats import resolve_fetch_season
        return resolve_fetch_season(argv)

    def test_default_is_calendar(self):
        assert self._resolve([]) == calendar_season()

    def test_cli_override(self):
        assert self._resolve(["--season", "2023"]) == "2023"

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("FETCH_SEASON", "2024")
        assert self._resolve([]) == "2024"

    def test_rejects_bad_value(self):
        with pytest.raises(SystemExit):
            self._resolve(["--season", "2025-26"])
