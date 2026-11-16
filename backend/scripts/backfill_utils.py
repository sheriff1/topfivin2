"""Shared helpers for the supplementary backfill scripts (fetch_*.py)."""
import math


def has_data(value):
    """True if any leaf value (in nested dicts/lists/tuples) is a real value.

    NBA sometimes returns well-formed rows whose stat columns are all empty
    (None/NaN) for games that just finished. Writing those marks nothing as
    filled, so the scripts treat them as "no data published yet".
    """
    if value is None:
        return False
    if isinstance(value, dict):
        return any(has_data(v) for v in value.values())
    if isinstance(value, (list, tuple, set)):
        return any(has_data(v) for v in value)
    if isinstance(value, float) and math.isnan(value):
        return False
    return True


def load_endpoint(endpoint_cls, **kwargs):
    """Construct an nba_api endpoint, returning None if NBA has no payload yet.

    For games whose box score isn't published yet, nba_api's constructor
    raises AttributeError ('NoneType' object has no attribute 'get') while
    parsing the empty response. That is "not published yet", not bad data, so
    callers treat None as waiting and retry on the next run.
    """
    try:
        return endpoint_cls(**kwargs)
    except AttributeError:
        return None
