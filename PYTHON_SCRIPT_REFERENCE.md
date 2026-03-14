# fetch_nba_stats.py - Reference Guide

## Purpose

Fetches NBA game-by-game box scores from nba_api and aggregates them into season average statistics for storage in PostgreSQL.

## Quick Start

```bash
export DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD="" \
       DB_NAME=nba_stats CURRENT_SEASON="2025"

source /path/to/.venv/bin/activate
python backend/scripts/fetch_nba_stats.py
```

## Configuration

All settings via environment variables:

- `DB_HOST` - PostgreSQL hostname (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: empty string)
- `DB_NAME` - Database name (default: nba_stats)
- `CURRENT_SEASON` - NBA season year (default: "2025")

## Function Reference

### `connect_db()`

Establishes PostgreSQL connection using environment variables.

**Returns**: `psycopg2.connection` object  
**Raises**: Exception if connection fails

### `get_team_mapping()`

Fetches all 30 NBA teams from nba_api.stats.static.teams module.

**Returns**: Dict mapping team_id (int) → team_name (str)  
**Example**:

```python
{
    1610612738: 'Boston Celtics',
    1610612751: 'Brooklyn Nets',
    ...
}
```

### `fetch_season_games(season)`

Queries NBA LeagueGameLog endpoint to get game IDs for a season.

**Args**: `season` (str) - Season year, e.g., "2025"  
**Returns**: Deduplicated list of all game_id strings for the season  
**Note**: Skips games already marked `collected=true` in the DB to support resumable runs

### `extract_team_stats(game_id, game_date, team_mapping)`

Fetches detailed box score for a single game from boxscoretraditionalv2 endpoint.

**Args**:

- `game_id` (str): NBA game identifier
- `game_date` (str): Game date (YYYY-MM-DD)
- `team_mapping` (dict): Team ID → Name mapping

**Returns**: Dict mapping team_id → Dict of stats

```python
{
    1610612738: {
        'PTS': 120,
        'FGM': 45,
        'FGA': 92,
        'FG_PCT': 0.489,
        ...
    },
    1610612751: {
        'PTS': 115,
        ...
    }
}
```

**Error Handling**:

- Catches HTTPError, Timeout, ContentDecodingError
- Logs error with game_id but continues processing
- Returns empty dict if fetch fails

**Key Implementation Detail**:
BoxScoreTraditionalV2 returns 3 dataframes:

- [0]: Player stats (25 rows)
- [1]: Team stats (2 rows) ← **Used here**
- [2]: Starter/bench breakdown (4 rows)

Accesses df[1] to get team-level aggregated stats.

### `aggregate_season_stats(game_stats_list)`

Converts game-by-game stats into season averages.

**Args**: `game_stats_list` - List of game stat dicts from extract_team_stats()

**Returns**: Tuple of (season_avg, game_counts)

- `season_avg`: Dict mapping team_id → Dict of averaged stats
- `game_counts`: Dict mapping team_id → Number of games processed

**Algorithm**:

```
For each team across all games:
  1. Sum each stat value
  2. Count games team played
  3. Divide sum by count to get average
```

**Example**:

```python
season_avg = {
    1610612738: {
        'PTS': 112.5,  # Average points per game
        'FG_PCT': 0.485,  # Average FG%
        ...
    }
}
game_counts = {
    1610612738: 40  # Team played 40 games
}
```

### `store_season_stats(conn, season_avg, game_counts, team_mapping)`

Upserts aggregated stats into PostgreSQL.

**Args**:

- `conn`: psycopg2 connection
- `season_avg`: Dict from aggregate_season_stats()
- `game_counts`: Dict of games per team
- `team_mapping`: Team ID → Name mapping

**Database Operations**:

1. Creates `teams` table if not exists
2. Inserts/updates teams with team_id, team_name, season
3. Creates `team_stats` table if not exists
4. Inserts/updates stats with JSONB `stats_json` field

**Upsert Logic**: Uses ON CONFLICT clauses

- If team exists for season, updates stats_json
- If team is new, inserts new row
- Version tracking via updated_at timestamp

**Returns**: None

## Statistics Categories

The script tracks 19 traditional basketball metrics:

| Abbreviation | Full Name                | Type       |
| ------------ | ------------------------ | ---------- |
| PTS          | Points Per Game          | Offensive  |
| FGM          | Field Goals Made         | Offensive  |
| FGA          | Field Goals Attempted    | Offensive  |
| FG_PCT       | Field Goal Percentage    | Offensive  |
| FG3M         | Three-Pointers Made      | Offensive  |
| FG3A         | Three-Pointers Attempted | Offensive  |
| FG3_PCT      | Three-Point Percentage   | Offensive  |
| FTM          | Free Throws Made         | Offensive  |
| FTA          | Free Throws Attempted    | Offensive  |
| FT_PCT       | Free Throw Percentage    | Offensive  |
| REB          | Total Rebounds           | Rebounding |
| OREB         | Offensive Rebounds       | Rebounding |
| DREB         | Defensive Rebounds       | Rebounding |
| AST          | Assists Per Game         | Offensive  |
| STL          | Steals Per Game          | Defensive  |
| BLK          | Blocks Per Game          | Defensive  |
| TO           | Turnovers                | Offensive  |
| PF           | Personal Fouls           | Defensive  |
| PLUS_MINUS   | Point Differential       | Context    |

## Execution Flow

```
main()
  ├─ connect_db()              [Connect to PostgreSQL]
  ├─ get_team_mapping()        [Load 30 NBA teams]
  ├─ fetch_season_games()      [Get 50 game IDs for 2024 season]
  └─ For each game:
      ├─ extract_team_stats()  [Fetch box score from nba_api]
      └─ Accumulate in list
  ├─ aggregate_season_stats()  [Calculate per-team season averages]
  └─ store_season_stats()      [Upsert into PostgreSQL]
```

## Performance Notes

- **Typical Runtime**: 15-20 min for a full season (~989 games); re-runs that skip collected games finish in seconds
- **Bottleneck**: NBA.com API response times (occasional 30-60s timeouts)
- **Error Rate**: ~7% API timeouts on full runs (handled gracefully, retrying with another run collects the rest)
- **Database Insert**: ~2-3 seconds for all teams

## Debugging Tips

### View current game data

```python
# Add this in extract_team_stats() to inspect response:
from nba_api.stats.endpoints import boxscoretraditionalv2

data_frames = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id).get_data_frames()
print("DataFrame shapes:", [df.shape for df in data_frames])
print("Team stats columns:", data_frames[1].columns.tolist())
```

### Check database contents

```bash
# Connect to database
psql -U postgres -d nba_stats

# View teams
SELECT * FROM teams LIMIT 5;

# View stats for one team
SELECT team_id, stats_json FROM team_stats WHERE team_id = 1610612738;

# Check data freshness
SELECT MAX(updated_at) FROM team_stats;
```

### Monitor API calls

```python
# Add to the script for verbose logging:
import logging
logging.basicConfig(level=logging.DEBUG)

# nba_api uses urllib3, will show all requests
```

## Known Issues

### ⚠️ V2 Advanced Endpoints Deprecated

- `boxscoreadvancedv2` returns 'resultSet' errors
- `boxscorefourfactorsv2` similar deprecation issues
- `boxscoresummaryv2` unreliable
- **Solution**: Upgrade to V3 endpoints when nba_api updates

### ⚠️ API Timeouts

- ~7% of requests timeout on a full season run
- Caused by occasional stats.nba.com rate limiting
- Script gracefully skips failed games; re-running collects the remainder
- **Solution**: Implement exponential backoff retry for higher reliability

### ⚠️ DataFrame Index Sensitive

- Must use `df[1]` for team stats (not [2])
- Other indices contain player or breakdown stats
- If nba_api updates, index may change

## Extension Ideas

### 1. Add Advanced Stats

```python
# Future: fetch from boxscoreadvancedv3
advanced_stats = {
    'OFF_RATING': offensive_rating,
    'DEF_RATING': defensive_rating,
    'TS_PCT': true_shooting_pct,
}
```

### 2. Retry with Exponential Backoff

```python
import time
import random

def fetch_with_retry(game_id, max_retries=3):
    for attempt in range(max_retries):
        try:
            # fetch logic
        except Timeout:
            wait = 2 ** attempt + random.uniform(0, 1)
            time.sleep(wait)
```

### 3. Multi-Season Historical Data

```python
for season in ["2025", "2024", "2023", "2022"]:
    os.environ['CURRENT_SEASON'] = season
    main()
```

### 4. Incremental Updates

```python
# Fetch only new games since last run
def fetch_new_games(last_game_id):
    # Use statuses API to get games updated after timestamp
    pass
```

---

**Python**: 3.13  
**Dependencies**: nba_api 1.11.4, psycopg2-binary, pandas  
**Status**: ✅ Full 2025-26 season collected (988/989 games)
