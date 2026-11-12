"""Helpers for telling finished games from in-progress or scheduled ones."""


def is_final(wl):
    """LeagueGameLog sets WL ('W'/'L') only once a game has a result."""
    return isinstance(wl, str) and wl.strip() in ('W', 'L')


def final_game_ids(game_details):
    """Return the set of game_ids with a result (WL set on at least one team row)."""
    return {g['game_id'] for g in game_details if is_final(g.get('wl'))}
