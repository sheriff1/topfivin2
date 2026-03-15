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

Side-by-side (as-needed):
┌────────────────────────────┐
│ seed_team_logos.js         │  Populate logo URLs from NBA CDN (one-time)
└────────────────────────────┘
┌────────────────────────────────────┐
│ extract_colors_from_logos.py       │  Extract colors from logos (one-time or re-run)
└────────────────────────────────────┘
┌────────────────────────────┐
│ backup_database.py         │  Backup database to JSON (utility)
└────────────────────────────┘
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

- **NBA CDN** — `https://cdn.nba.com/logos/nba`
  - Official team logo SVGs and PNGs
  - Used by seed_team_logos.js and extract_colors_from_logos.py

---

## Team Data Sourcing

### Team Constants: `config.py`

All team data is centralized in [config.py](./config.py):

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
  - Used by seed_team_logos.js and extract_colors_from_logos.py

**Important**: Keep `config.py` synchronized with the database `teams` table. If new teams are added to the NBA in the future, update both config.py and run `seed_team_logos.js` and `extract_colors_from_logos.py` to refresh.

---

## Script Reference

### Data Pipeline (Recurring)

#### `fetch_nba_stats.py`
**Purpose**: Download game-by-game box scores for a season from nba_api and populate the database.

**Dependencies**:
- `nba_api` (for stats.nba.com data)
- `psycopg2` (PostgreSQL connection)
- `config.py` (imports `TEAM_ABBR_TO_ID`)

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

### Data Initialization & Utilities

#### `seed_team_logos.js`
**Purpose**: One-time seed script to populate logo URLs for all 30 teams from NBA CDN.

**Environment**:
- Node.js v14+
- Database must be initialized with teams table

**Usage**:
```bash
node seed_team_logos.js
```

**Environment Variables**:
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/nba_stats
```

**Output**:
- Updates `teams` table with `logo_url` for all 30 teams
- Each URL points to SVG on https://cdn.nba.com/logos/nba

**Notes**:
- Idempotent: safe to re-run
- Uses official NBA CDN URLs; no external data needed

---

#### `extract_colors_from_logos.py`
**Purpose**: Extract 3 dominant colors from team logos (primary, secondary, tertiary) with WCAG AAA contrast validation.

**Status**: Reusable utility — can be run anytime logos are updated.

**Dependencies**:
- `PIL/Pillow` (image processing)
- `scikit-learn` (K-means clustering)
- `psycopg2` (PostgreSQL connection)
- `requests` (download PNG logos)
- `config.py` (imports `NBA_TEAMS`, `NBA_CDN_BASE`)

**Usage**:
```bash
# Download PNGs from CDN and extract colors
python extract_colors_from_logos.py

# Use local PNG files (e.g., from convert_svgs_to_pngs.py)
python extract_colors_from_logos.py --png-dir /path/to/png/directory
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
- Updates `teams` table with `team_colors` JSONB column
- Format: `{"primary": "#RRGGBB", "secondary": "#RRGGBB", "tertiary": "#RRGGBB"}`
- All colors validated for WCAG AAA 7:1 contrast ratio

**Color Extraction Methodology**:

1. **Download/Load Logo** — Fetch PNG from NBA CDN or use local file
2. **K-means Clustering** — Reduce image to dominant colors (k=3)
   - Downscale image to 50×50 for performance
   - Run K-means clustering on RGB pixel values per team
   - Extract 3 cluster centers as candidate colors
3. **Saturation Sorting** — Sort colors by HSL saturation (descending)
   - Most saturated → primary
   - Mid saturation → secondary
   - Least saturated → tertiary
4. **WCAG AAA Validation** — Ensure min 7:1 contrast ratio with #000000 or #FFFFFF
   - Calculate relative luminance for each color (WCAG formula)
   - If contrast < 7:1: adjust lightness in HSL space until compliant
   - Primary/secondary validated; tertiary uses fallback if needed
5. **Fallback Logic** — If clustering yields < 3 colors:
   - 1 color → add #000000 and #FFFFFF
   - 2 colors → add #FFFFFF or #000000 (whichever has better contrast)

**WCAG AAA Contrast Formula**:
```
Luminance(color) = 0.2126*R + 0.7152*G + 0.0722*B  (where R,G,B are gamma-corrected)
Contrast Ratio = (L1 + 0.05) / (L2 + 0.05)  (where L1 ≥ L2)
Target: Ratio ≥ 7:1 for AAA compliance
```

**Notes**:
- Idempotent: safe to re-run (overwrites team_colors)
- Supports both CDN download and local PNG input
- Logged to stdout with progress per team

---

#### `backup_database.py`
**Purpose**: Backup database schema and data to JSON files for disaster recovery.

**Usage**:
```bash
python backup_database.py [--output backups/] [--verbose]
```

**Output**:
- Creates timestamped JSON files: `nba_stats_backup_YYYYMMDD_HHMMSS.json`
- Contains all tables and data

**Notes**:
- Utility script; not part of core pipeline
- Can be scheduled via cron for regular backups

---

## Execution Order & Setup

### Initial Setup (One-Time)
```bash
# 1. Database must be initialized (run migrations first)
node backend/migrations/001_init_schema.js

# 2. Seed team logos (populates logo_url)
node backend/scripts/seed_team_logos.js

# 3. Extract colors from logos (populates team_colors)
python backend/scripts/extract_colors_from_logos.py
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
pip install psycopg2-binary scikit-learn numpy pillow requests nba-api
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
1. Update `config.py`:
   - Add `TEAM_ID: 'Team Name'` to `NBA_TEAMS`
   - Add `'ABBR': TEAM_ID` to `TEAM_ABBR_TO_ID`
2. Run `seed_team_logos.js` to fetch logo URL
3. Run `extract_colors_from_logos.py` to extract colors
4. Insert row into `teams` table via migration or manually

### Updating Team Colors
If team rebrands or logos are updated on NBA CDN:
```bash
python extract_colors_from_logos.py  # Re-run to detect new colors
```

### Debugging
- Add `--verbose` flag to most scripts for detailed logging
- Check database logs: `psql -U postgres -d nba_stats -c "SELECT * FROM teams LIMIT 1;"`
- View audit logs for operation history: `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;`

---

## Related Documentation

- [SVG_CONVERSION_GUIDE.md](../SVG_CONVERSION_GUIDE.md) — Optional offline SVG→PNG conversion (reference only)
- [PYTHON_SCRIPT_REFERENCE.md](../PYTHON_SCRIPT_REFERENCE.md) — API reference for fetch_nba_stats.py
- [README.md](../README.md) — Overall project architecture
