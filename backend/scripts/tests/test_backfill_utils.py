import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backfill_utils import has_data  # noqa: E402


def test_all_none_is_no_data():
    assert not has_data({1: {"a": None, "b": None}, 2: {"a": None}})


def test_nan_counts_as_empty():
    assert not has_data({1: {"a": float("nan")}})


def test_real_value_is_data():
    assert has_data({1: {"a": None, "b": 0}})


def test_zero_and_empty_string_are_data():
    assert has_data({1: {"a": 0}})
    assert has_data({1: {"a": ""}})


def test_nested_and_tuple():
    assert not has_data(({"x": None}, {1: {"starters": {"pts": None}, "bench": {"pts": None}}}))
    assert has_data(({"x": None}, {1: {"starters": {"pts": 12}}}))


def test_empty_containers_are_no_data():
    assert not has_data({})
    assert not has_data(None)
