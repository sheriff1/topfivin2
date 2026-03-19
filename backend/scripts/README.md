# Backend Scripts Guide

This directory contains Python and Node.js scripts that power the NBA Stats data pipeline and team data initialization.

---

## Overview

The backend scripts are organized into two categories:

1. **Data Pipeline Scripts** — Recurring tasks that fetch, process, and rank NBA stats
2. **Data Initialization Scripts** — One-time or as-needed setup tasks for team data

### Script Ecosystem & Dependencies

```
┌─────────────────────┐
│  fetch_nba_stats.py │  Download games & box scores from nba_api
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│ derive_team_stats.py    │  Aggregate player stats into season averages
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────┐
│ derive_rankings.py       │  Calculate stat rankings from team averages
└──────────────────────────┘
```

---

## Official Data Sources

All team data and constants are sourced from official NBA resources:

- **nba_api SDK** — `https://github.com/swar/nba_api`
  - Provides `stats.nba.com` data (games, box scores, stats)
  - Contains `nba_api.stats.static.teams` for team static data
  - All team IDs and abbreviations conform to official NBA data

- **stats.nba.com** — `https://stats.nba.com`
  - Game schedules and box scores via nba_api
  - Stat categories and rankings

---

## Team Data Sourcing

### Team Constants: `team_constants.py`

All team data is centralized in [team_constants.py](./team_constants.py):

- **`NBA_TEAMS`** (dict) — Maps team_id → team_name
  - Source: nba_api.stats.static.teams
  - 30 entries (all NBA teams)
  - Synchronized with `teams` table in database

- **`TEAM_ABBR_TO_ID`** (dict) — Maps abbreviation → team_id
  - Source: nba_api.stats.static.teams
  - Used for parsing MATCHUP strings from LeagueGameLog API
  - Examples: 'LAL' → 1610612747, 'BOS' → 1610612738

- **`NBA_CDN_BASE`** (str) — Base URL for official logos
  - Value: `https://cdn.nba.com/logos/nba`

**Important**: Keep `team_constants.py` synchronized with the database `teams` table. If new teams are added to the NBA in the future, update team_constants.py accordingly.

---

## Script Reference

### Data Pipeline (Recurring)

#### `fetch_nba_stats.py`

**Purpose**: Download game-by-game box scores for a season from nba_api and populate the database.

**Dependencies**:

- `nba_api` (for stats.nba.com data)
- `psycopg2` (PostgreSQL connection)
- `team_constants.py` (imports `TEAM_ABBR_TO_ID`)

**Usage**:

```bash
python fetch_nba_stats.py [--season YYYY] [--verbose]
```

**Environment Variables**:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=nba_stats
CURRENT_SEASON=2025  # Used if --season not specified
```

**Output**:

- Populates `games` table with game schedule and scores
- Populates `game_stats` table with player-level box scores
- Creates audit log entries for tracking

**Notes**:

- Fetches seasonal game list from nba_api (schedule)
- Downloads box scores for each game (traditional, advanced, 4-factor stats)
- Handles retries and rate-limiting via urllib3
- Clears old data for season if re-running (can be disabled)

---

#### `derive_team_stats.py`

**Purpose**: Aggregate player-level game_stats into team season averages and standard deviations.

**Dependencies**:

- `psycopg2` (PostgreSQL connection)

**Usage**:

```bash
python derive_team_stats.py [--season YYYY] [--verbose]
```

**Environment Variables**:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=nba_stats
```

**Output**:

- Populates `team_stats` table with 30 teams × 15 stats per season
- Computes mean, stdev, min, max for each stat

**Notes**:

- Depends on `game_stats` being populated by `fetch_nba_stats.py`
- Stat categories: PPG, RPG, APG, FG%, 3P%, FT%, SPG, BPG, TS%, ORB%, DRB%, TRB%, AST%, USG%, TOV%

---

#### `derive_rankings.py`

**Purpose**: Calculate percentile rankings for all stats across teams for a season.

**Dependencies**:

- `psycopg2` (PostgreSQL connection)

**Usage**:

```bash
python derive_rankings.py [--season YYYY] [--verbose]
```

**Environment Variables**:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=nba_stats
```

**Output**:

- Populates `stat_rankings` table with percentile ranks (0-100) for each team/stat/season

**Notes**:

- Depends on `team_stats` being populated by `derive_team_stats.py`
- Percentile: team_rank = (teams_below + 0.5) / 30 × 100
- Example: 1st place = ~98th percentile, 15th place = 50th percentile, 30th place = ~2nd percentile

---

## Execution Order & Setup

### Initial Setup (One-Time)

```bash
# Database must be initialized (run migrations first)
node backend/migrations/001_init_schema.js
```

### Recurring Data Updates (e.g., nightly)

```bash
# 1. Fetch all games and box scores for season
python backend/scripts/fetch_nba_stats.py --season 2025

# 2. Aggregate into team season stats
python backend/scripts/derive_team_stats.py --season 2025

# 3. Calculate stat rankings
python backend/scripts/derive_rankings.py --season 2025
```

---

## Environment Setup

### Requirements

All scripts assume:

- PostgreSQL 12+ running locally or accessible via `DB_HOST`
- Python 3.8+ with dependencies (see requirements.txt)
- Node.js 14+ for .js scripts

### Python Dependencies

```bash
pip install psycopg2-binary requests nba-api
```

### Environment File (.env)

Create `.env` or export environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=your_password
export DB_NAME=nba_stats
export CURRENT_SEASON=2025
```

---

## Contributing & Maintenance

### Adding a New Team (Future NBA Expansion)

1. Update `team_constants.py`:
   - Add `TEAM_ID: 'Team Name'` to `NBA_TEAMS`
   - Add `'ABBR': TEAM_ID` to `TEAM_ABBR_TO_ID`
2. Insert row into `teams` table via migration or manually

### Debugging

- Add `--verbose` flag to most scripts for detailed logging
- Check database: `psql -U postgres -d nba_stats -c "SELECT * FROM teams LIMIT 1;"`
- View audit logs: `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;`

---

## Related Documentation

- [PYTHON_SCRIPT_REFERENCE.md](../PYTHON_SCRIPT_REFERENCE.md) — API reference for fetch_nba_stats.py
- [README.md](../README.md) — Overall project architecture
