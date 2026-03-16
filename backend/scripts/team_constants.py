"""
Shared configuration and constants for backend scripts.

This module centralizes NBA team data and other constants used across
the backend data pipeline scripts. All constants are sourced from official
NBA APIs and resources (nba_api SDK, stats.nba.com, cdn.nba.com).

Team data should be kept synchronized with the database teams table.
"""

# All 30 NBA teams (team_id -> team_name)
# Source: nba_api.stats.static.teams
NBA_TEAMS = {
    1610612737: 'Atlanta Hawks',
    1610612738: 'Boston Celtics',
    1610612739: 'Cleveland Cavaliers',
    1610612740: 'New Orleans Pelicans',
    1610612741: 'Chicago Bulls',
    1610612742: 'Dallas Mavericks',
    1610612743: 'Denver Nuggets',
    1610612744: 'Golden State Warriors',
    1610612745: 'Houston Rockets',
    1610612746: 'LA Clippers',
    1610612747: 'LA Lakers',
    1610612748: 'Miami Heat',
    1610612749: 'Milwaukee Bucks',
    1610612750: 'Minnesota Timberwolves',
    1610612751: 'Brooklyn Nets',
    1610612752: 'New York Knicks',
    1610612753: 'Orlando Magic',
    1610612754: 'Indiana Pacers',
    1610612755: 'Philadelphia 76ers',
    1610612756: 'Phoenix Suns',
    1610612757: 'Portland Trail Blazers',
    1610612758: 'Sacramento Kings',
    1610612759: 'San Antonio Spurs',
    1610612760: 'Oklahoma City Thunder',
    1610612761: 'Toronto Raptors',
    1610612762: 'Utah Jazz',
    1610612763: 'Memphis Grizzlies',
    1610612764: 'Washington Wizards',
    1610612765: 'Detroit Pistons',
    1610612766: 'Charlotte Hornets',
}

# Team abbreviation to team ID mapping
# Source: nba_api.stats.static.teams
# Used for parsing MATCHUP strings from LeagueGameLog API
TEAM_ABBR_TO_ID = {
    'ATL': 1610612737, 'BOS': 1610612738, 'CLE': 1610612739,
    'NOP': 1610612740, 'CHI': 1610612741, 'DAL': 1610612742,
    'DEN': 1610612743, 'GSW': 1610612744, 'HOU': 1610612745,
    'LAC': 1610612746, 'LAL': 1610612747, 'MIA': 1610612748,
    'MIL': 1610612749, 'MIN': 1610612750, 'BKN': 1610612751,
    'NYK': 1610612752, 'ORL': 1610612753, 'IND': 1610612754,
    'PHI': 1610612755, 'PHX': 1610612756, 'POR': 1610612757,
    'SAC': 1610612758, 'SAS': 1610612759, 'OKC': 1610612760,
    'TOR': 1610612761, 'UTA': 1610612762, 'MEM': 1610612763,
    'WAS': 1610612764, 'DET': 1610612765, 'CHA': 1610612766
}

# NBA CDN base URL for logos
NBA_CDN_BASE = "https://cdn.nba.com/logos/nba"
