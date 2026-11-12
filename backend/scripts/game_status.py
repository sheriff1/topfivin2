"""Helpers for telling finished games from in-progress or scheduled ones."""
from datetime import date


def is_final(wl):
    """LeagueGameLog sets WL ('W'/'L') only once a game has a result."""
    return isinstance(wl, str) and wl.strip() in ('W', 'L')


def final_game_ids(game_details):
    """Return the set of game_ids with a result (WL set on at least one team row)."""
    return {g['game_id'] for g in game_details if is_final(g.get('wl'))}


# BoxScoreSummaryV3 gameStatus: 1 = not started, 2 = in progress, 3 = final
STATUS_FINAL = 3


def needs_status_check(game_date, today, days=2):
    """Only games from the last `days` days can still be live; older ones skip the extra call."""
    try:
        gd = date.fromisoformat(str(game_date)[:10])
    except ValueError:
        return True  # unknown date: be careful and check
    return (today - gd).days < days


def should_skip(status):
    """Skip only when the summary positively reports a non-final status.

    A failed summary call (status None) must not block collection: BoxScoreSummaryV3 errors
    permanently for some finished games (e.g. 0022500259), so we fall back to the W/L check.
    """
    return status is not None and status != STATUS_FINAL
