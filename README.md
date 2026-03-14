# NBA Stats Ranking Dashboard

A full-stack application that fetches NBA team statistics from the official NBA.com API (via the `nba_api` Python library), calculates rankings across 15 stat categories, and displays them in a web dashboard. Stats are collected by running Python pipeline scripts manually; rankings and stats are served via a Node.js/Express API backed by PostgreSQL and Redis.

## Architecture

```
nba_api (Python)
  └─ fetch_nba_stats.py       → games + game_stats tables
       └─ derive_team_stats.py    → team_stats table
            └─ derive_rankings.py     → stat_rankings table
                                            │
                                Node.js / Express (port 5001)
                                GET /api/categories
                                GET /api/rankings
                                GET /api/team/:id/stats
                                GET /api/team/:id/rankings
                                GET /api/audit/games
                                            │
                                React Frontend (port 3000)
                                daisyUI + Tailwind + React Query
```

PostgreSQL stores all data; Redis caches ranking responses (1-hour TTL).

## Quick Start

### Prerequisites

- Node.js 18+, pnpm
- Python 3.13 (Homebrew: `/opt/homebrew/bin/python3.13`)
- PostgreSQL 13+ and Redis 6+ running locally

### 1. Backend

```bash
cd backend
cp .env.example .env      # defaults work for local dev
pnpm install
pnpm run migrate          # creates all tables
node src/index.js         # starts on http://localhost:5001
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # defaults work out of the box
pnpm install
pnpm start                # opens http://localhost:3000
```

### 3. Populate Data (Python pipeline)

```bash
# From repo root — create and activate the Python virtual environment
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Step 1 – fetch all season games (~15-20 min, skips already-collected games on re-run)
cd backend && python scripts/fetch_nba_stats.py

# Step 2 – derive team season averages from collected games
python scripts/derive_team_stats.py

# Step 3 – compute rankings (15 categories × 30 teams = 450 rows)
python scripts/derive_rankings.py

# Step 4 – seed team logos from NBA CDN
cd ../../backend && pnpm run migrate:logos && pnpm run seed:logos

# Step 5 – flush Redis so backend picks up the new data
redis-cli FLUSHDB
```

## Configuration

### `backend/.env`

```env
PORT=5001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=nba_stats

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

CURRENT_SEASON=2025
```

### `frontend/.env`

```env
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_CURRENT_SEASON=2025
```

### Python pipeline (reads from shell env, or set explicitly)

```bash
export DB_HOST=localhost DB_PORT=5432 DB_USER=postgres \
       DB_PASSWORD="" DB_NAME=nba_stats CURRENT_SEASON=2025
```

## Database Schema

| Table           | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `teams`         | Team metadata (id, name, logo_url from NBA CDN)                |
| `games`         | Game log — game_id, date, home/away team IDs, `collected` flag |
| `game_stats`    | Per-team per-game box score rows                               |
| `team_stats`    | Season averages derived by `derive_team_stats.py`              |
| `stat_rankings` | Pre-computed rankings — 15 categories × 30 teams = 450 rows    |
| `refresh_logs`  | Pipeline run audit trail                                       |

### Useful queries

```sql
-- Collection status for current season
SELECT COUNT(*) AS total,
       SUM(CASE WHEN collected THEN 1 ELSE 0 END) AS collected,
       ROUND(100.0 * SUM(CASE WHEN collected THEN 1 ELSE 0 END) / COUNT(*), 2) AS pct
FROM games WHERE season = '2025';

-- Top 5 teams by PPG
SELECT t.team_name, sr.rank, sr.value
FROM stat_rankings sr JOIN teams t ON sr.team_id = t.team_id
WHERE sr.stat_category = 'PPG' ORDER BY sr.rank LIMIT 5;

-- All rankings for one team
SELECT stat_category, rank, value FROM stat_rankings
WHERE team_id = 1610612743 ORDER BY stat_category;
```

## Stat Categories (15)

| Code       | Label              | Code | Label                   |
| ---------- | ------------------ | ---- | ----------------------- |
| PPG        | Points Per Game    | RPG  | Rebounds Per Game       |
| APG        | Assists Per Game   | SPG  | Steals Per Game         |
| BPG        | Blocks Per Game    | FG%  | Field Goal %            |
| 3P%        | 3-Point %          | FT%  | Free Throw %            |
| TO         | Turnovers Per Game | PF   | Personal Fouls Per Game |
| OREB       | Offensive Rebounds | DREB | Defensive Rebounds      |
| PLUS_MINUS | Plus/Minus         | FGM  | FG Made Per Game        |
| FG3M       | 3PM Per Game       |      |                         |

See `backend/src/services/statProcessor.js` for the full `STAT_CATEGORIES` config.

## API Endpoints

All on `http://localhost:5001`.

| Method | Path                                     | Description                       |
| ------ | ---------------------------------------- | --------------------------------- |
| GET    | `/health`                                | Server health check               |
| GET    | `/api/categories`                        | List all 15 stat categories       |
| GET    | `/api/rankings?category=PPG&season=2025` | League rankings for a stat        |
| GET    | `/api/team/:teamId/stats?season=2025`    | All stats for one team            |
| GET    | `/api/team/:teamId/rankings?season=2025` | How a team ranks across all stats |
| GET    | `/api/audit/games?season=2025&limit=10`  | Data collection audit             |

```bash
curl "http://localhost:5001/api/rankings?category=PPG&season=2025"
curl "http://localhost:5001/api/team/1610612743/stats?season=2025"
curl "http://localhost:5001/api/audit/games?season=2025&limit=5"
```

## Project Structure

```
topfivin2/
├── backend/
│   ├── scripts/
│   │   ├── fetch_nba_stats.py       # Game-by-game box score fetcher
│   │   ├── derive_team_stats.py     # Aggregates game_stats → team_stats
│   │   ├── derive_rankings.py       # Computes stat_rankings from team_stats
│   │   └── backup_database.py       # Exports all tables to backups/
│   ├── migrations/
│   │   └── 001_init_schema.js
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   │   ├── api.js               # Route aggregator
│   │   │   ├── rankings.js          # /categories, /rankings
│   │   │   ├── teams.js             # /team/:id/stats, /team/:id/rankings
│   │   │   └── audit.js             # /audit/games
│   │   ├── services/
│   │   │   ├── rankingsService.js
│   │   │   ├── teamsService.js
│   │   │   ├── auditService.js
│   │   │   └── statProcessor.js     # STAT_CATEGORIES config
│   │   ├── cache/redisClient.js
│   │   └── db/postgresClient.js
│   ├── .env / .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── RankingsPage.jsx
│   │   │   ├── TeamPage.jsx
│   │   │   └── AuditPage.jsx
│   │   ├── components/RankingsGrid.jsx
│   │   ├── hooks/useApi.js
│   │   └── App.js
│   ├── .env / .env.example
│   └── package.json
│
├── backups/                          # JSON exports from backup_database.py (gitignored)
├── .venv/                            # Python virtualenv (gitignored — recreate with requirements.txt)
├── requirements.txt                  # Python dependencies
└── README.md
```

## NBA Team IDs

```
1610612738  Boston Celtics          1610612739  Cleveland Cavaliers
1610612740  New Orleans Pelicans    1610612741  Chicago Bulls
1610612742  Dallas Mavericks        1610612743  Denver Nuggets
1610612744  Golden State Warriors   1610612745  Houston Rockets
1610612746  LA Clippers             1610612747  LA Lakers
1610612748  Miami Heat              1610612749  Milwaukee Bucks
1610612750  Minnesota Timberwolves  1610612751  Brooklyn Nets
1610612752  New York Knicks         1610612755  Philadelphia 76ers
1610612756  Phoenix Suns            1610612757  Portland Trail Blazers
1610612758  Sacramento Kings        1610612759  San Antonio Spurs
1610612760  Oklahoma City Thunder   1610612761  Toronto Raptors
1610612762  Utah Jazz               1610612763  Memphis Grizzlies
1610612764  Washington Wizards      1610612765  Detroit Pistons
1610612766  Charlotte Hornets       1610612767  Atlanta Hawks
1610612768  Orlando Magic           1610612769  Indiana Pacers
```

## Redis Cache

```bash
redis-cli KEYS "nba:rankings:*"          # list all cached ranking keys
redis-cli TTL "nba:rankings:PPG:2025"    # seconds until expiry
redis-cli FLUSHDB                         # clear cache (run after pipeline)
```

## Stack

**Backend:** Express 5, PostgreSQL (`pg`), Redis (`ioredis`), dotenv  
**Frontend:** React 19, React Query, Axios, Tailwind CSS, daisyUI  
**Data pipeline:** Python 3.13, nba_api 1.11.4, psycopg2-binary, pandas

## Troubleshooting

**Dashboard shows no data**

1. Confirm backend running: `curl http://localhost:5001/health`
2. Confirm rankings populated: `psql -U postgres -d nba_stats -c "SELECT COUNT(*) FROM stat_rankings;"`
3. Check `.env` files point to port 5001

**PostgreSQL or Redis not running**

```bash
brew services start postgresql@16
brew services start redis
redis-cli ping   # should return PONG
```

**Python script errors**

```bash
source .venv/bin/activate
python -c "import nba_api; print('OK')"
# If missing: pip install nba_api psycopg2-binary
```

**Stale data after running pipeline**

```bash
redis-cli FLUSHDB   # force cache miss on next request
```

## License

MIT
