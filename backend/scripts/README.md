# Backend Scripts Guide

Python scripts that power the NBA Stats data pipeline.

---

## Overview

### Script Ecosystem & Dependencies

```
┌─────────────────────┐
│  fetch_nba_stats.py │  Download games & box scores from nba_api
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│ derive_team_stats.py    │  Aggregate game stats into season averages
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────┐
│ derive_rankings.py       │  Calculate stat rankings from team averages
└──────────────────────────┘
           │
           ▼ (end-of-season only)
┌──────────────────────────┐
│ archive_season.py        │  Export immutable season snapshot (CSVs + checksums)
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

---

## Script Reference

### `fetch_nba_stats.py`

**Purpose**: Download game-by-game box scores for a season from nba_api and populate the database.

**Dependencies**: `nba_api`, `psycopg2`, `team_constants.py`

**Environment Variables**:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_username   # macOS Homebrew: run `whoami`; Linux/Docker: postgres
DB_PASSWORD=
DB_NAME=nba_stats
CURRENT_SEASON=2025
```

**Output**:

- Populates `games` table with game schedule
- Populates `game_stats` table with per-game team box scores
- Skips already-collected games on re-run (resumable)

**Notes**:

- nba.com actively blocks GitHub Actions IPs — run locally (`make fetch`) rather than in CI
- First run for a full season takes ~15-20 minutes due to rate limiting

---

### `derive_team_stats.py`

**Purpose**: Aggregate `game_stats` into season averages per team.

**Dependencies**: `psycopg2`

**Environment Variables**:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_username
DB_PASSWORD=
DB_NAME=nba_stats
CURRENT_SEASON=2025
```

**Output**:

- Populates `team_stats` table with season averages for all 30 teams

**Notes**:

- Depends on `game_stats` being populated by `fetch_nba_stats.py`
- Stat categories: PPG, RPG, APG, FG%, 3P%, FT%, SPG, BPG, TS%, ORB%, DRB%, TRB%, AST%, USG%, TOV%

---

### `derive_rankings.py`

**Purpose**: Calculate stat rankings across all teams for a season and flush the Redis cache.

**Dependencies**: `psycopg2`

**Environment Variables**:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_username
DB_PASSWORD=
DB_NAME=nba_stats
CURRENT_SEASON=2025
# Production: REDIS_URL (flushes remote cache)
# Local:      REDIS_HOST / REDIS_PORT
```

**Output**:

- Populates `stat_rankings` table — 15 categories × 30 teams = 450 rows per season
- Flushes Redis so the API immediately serves fresh data

**Notes**:

- Depends on `team_stats` being populated by `derive_team_stats.py`

---

### `archive_season.py`

**Purpose**: Export an immutable annual snapshot of a season as CSVs + SHA-256 checksum manifest. Intended as a one-time end-of-season operation.

**Dependencies**: `psycopg2`

**Environment Variables**:

```bash
DATABASE_URL=postgresql://...   # or DB_* vars (same as other scripts)
ARCHIVE_SEASON=2025             # season to snapshot; falls back to CURRENT_SEASON
ARCHIVE_DIR=season_archive      # output directory (default: ./season_archive)
```

**Output** (written to `ARCHIVE_DIR`):

- `games_{SEASON}.csv`
- `game_stats_{SEASON}.csv`
- `team_stats_{SEASON}.csv`
- `stat_rankings_{SEASON}.csv`
- `checksums_{SEASON}.txt` — SHA-256 digest for each CSV

**Notes**:

- Typically triggered via `make archive-season` or the [Season Archive GitHub Actions workflow](../../.github/workflows/season-archive.yml)
- Full DB dump is also produced by the workflow (requires `postgresql-client-18`)

---

## Execution Order

### Recommended: use Makefile targets

```bash
make pipeline        # local: fetch → derive → rankings
make pipeline-prod   # production: same + auto-backup
make archive-season  # end-of-season: CSVs + checksums (reads backend/.env.production)
```

### Manual execution

```bash
# From repo root, with venv activated:
source .venv/bin/activate
set -a && source backend/.env && set +a

cd backend
python scripts/fetch_nba_stats.py
python scripts/derive_team_stats.py
python scripts/derive_rankings.py
```

---

## Environment Setup

### Requirements

- PostgreSQL 16+ running locally or accessible via network
- Python 3.13 with dependencies installed (`pip install -r requirements.txt`)
- Redis running locally (for cache flushing)

### Python Dependencies

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Environment File

```bash
cp backend/.env.example backend/.env
# Edit DB_USER to match your system username (run: whoami on macOS)
```

---

## Contributing & Maintenance

### Adding a New Team (Future NBA Expansion)

1. Update `team_constants.py`:
   - Add `TEAM_ID: 'Team Name'` to `NBA_TEAMS`
   - Add `'ABBR': TEAM_ID` to `TEAM_ABBR_TO_ID`
2. Insert row into `teams` table via a new migration

---

## Related Documentation

- [README.md](../../README.md) — Overall project architecture and local setup
