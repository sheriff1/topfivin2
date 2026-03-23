# NBA Stats Ranking Dashboard

A full-stack web app that fetches NBA team statistics from the official NBA.com API, computes rankings across 27 stat categories, and displays them in an interactive dashboard. Data is fetched locally via Python scripts and served through a Node.js/Express API backed by PostgreSQL and Redis.

---

## Tech Stack

| Layer              | Technologies                                                                   |
| ------------------ | ------------------------------------------------------------------------------ |
| **Frontend**       | React 19, React Router 7, TanStack Query 5, Tailwind CSS 4, DaisyUI 5, Vite 6  |
| **Backend**        | Node.js 20, Express 5, PostgreSQL (pg), Redis (ioredis), Helmet, Winston, Jest |
| **Data Pipeline**  | Python 3.13, nba_api, psycopg2                                                 |
| **Infrastructure** | Railway (production DB + Redis), GitHub Actions CI/CD                          |

---

## Architecture

```
nba_api (Python — run locally)
  └─ fetch_nba_stats.py         → games + game_stats tables
       ├─ fetch_advanced_extras.py  ┐
       ├─ fetch_summary_extras.py   ├─ backfill (one-time, resumable — post-migration only)
       ├─ fetch_misc_stats.py       │
       └─ fetch_hustle_stats.py     ┘
            └─ derive_team_stats.py     → team_stats table
                 └─ derive_rankings.py      → stat_rankings table
                                                  │
                                      Node.js / Express  (port 5001)
                                      GET /api/categories
                                      GET /api/rankings
                                      GET /api/teams
                                      GET /api/teams/abbr/:abbreviation
                                      GET /api/team/:id/stats
                                      GET /api/team/:id/rankings
                                      GET /api/audit/games
                                      GET /api/audit/game/:gameId/stats
                                                  │
                                      React Frontend  (port 3000)
                                      Tailwind + DaisyUI + TanStack Query
```

PostgreSQL stores all data. Redis caches ranking responses (1-hour TTL).

> **Note:** `fetch_nba_stats.py` must run **locally** — nba.com actively blocks GitHub Actions IP ranges. All other pipeline steps (derive + rank) run automatically daily via GitHub Actions.

---

## Local Setup

### Prerequisites

- Node.js 20+, pnpm
- Python 3.13
- PostgreSQL 16+ and Redis running locally (`make services` starts both via Homebrew)

### 1. Clone and install dependencies

```bash
git clone https://github.com/sheriff1/topfivin2.git
cd topfivin2

cd backend && pnpm install && cd ..
cd frontend && pnpm install && cd ..
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set **`DB_USER`** to your system username:

```bash
whoami   # copy this value into DB_USER
```

> **macOS Homebrew:** PostgreSQL creates a role matching your system username, not `postgres`.

### 3. Start services and run migrations

```bash
make services              # start PostgreSQL + Redis
cd backend && pnpm run migrate && cd ..
```

### 4. Set up Python and fetch data

> **Required first-time step** — takes ~15–20 min on first run (skips already-collected games on re-runs).

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

make pipeline   # fetch → derive team stats → compute rankings → flush cache
```

### 5. Start the app

```bash
make dev   # starts services + backend (port 5001) + frontend (port 3000)
```

---

## Environment Variables

### Local development — `backend/.env`

Copy from `backend/.env.example`. Key vars:

```env
PORT=5001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_username   # macOS: run `whoami`; Linux/Docker: postgres
DB_PASSWORD=
DB_NAME=nba_stats

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

CURRENT_SEASON=2025
FRONTEND_URL=http://localhost:3000
```

### Production — `backend/.env.production`

This file is **gitignored** and never committed. It contains a single Railway-provided connection string:

```env
DATABASE_URL=postgresql://...   # from Railway dashboard
```

---

## Makefile Reference

### Dev

| Target          | Description                              |
| --------------- | ---------------------------------------- |
| `make dev`      | Start services + backend + frontend      |
| `make backend`  | Start backend only (nodemon)             |
| `make frontend` | Start frontend only (Vite)               |
| `make services` | Start PostgreSQL 16 + Redis via Homebrew |
| `make stop`     | Stop PostgreSQL + Redis                  |

### Data Pipeline

| Target               | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `make fetch`         | Fetch new games from nba_api → local DB                       |
| `make derive`        | Derive team stats + rankings → flush local Redis              |
| `make pipeline`      | Full local pipeline: fetch → derive → rankings                |
| `make backfill`      | One-time backfill of 24 V3 advanced columns → local DB        |
| `make backfill-prod` | Same backfill against Railway DB (run locally post-migration) |

### Production

| Target               | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `make fetch-prod`    | Fetch games → Railway DB                                                |
| `make derive-prod`   | Derive stats + rankings → flush Railway Redis                           |
| `make pipeline-prod` | Full production pipeline: fetch → backfill → derive → rankings → backup |

### Backup & Archive

| Target                | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `make backup`         | Dump production DB to `backups/` (warns if local pg_dump version mismatch) |
| `make backup-clean`   | Delete local backup files older than 7 days                                |
| `make archive-season` | Export season CSVs + SHA-256 checksums to `season_archive/`                |

### Load Testing

| Target           | Description                             |
| ---------------- | --------------------------------------- |
| `make k6-smoke`  | k6 smoke test (default: localhost:5001) |
| `make k6-load`   | k6 load test (20 VUs)                   |
| `make k6-stress` | k6 stress test (50 VUs)                 |

Override the target URL: `BASE_URL=https://your-server.com make k6-load`

### Automation

| Target                | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `make install-cron`   | Install launchd job — runs `pipeline-prod` daily at 09:00 UTC |
| `make uninstall-cron` | Remove launchd job                                            |
| `make logs-clean`     | Delete `logs/pipeline_prod.log` if it exceeds 50 MB           |

---

## GitHub Actions

Two workflows run **automatically** on a schedule. The rest are triggered manually.

| Workflow                                   | Trigger                                   | What it does                                                                       | Secrets needed                                |
| ------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| **CI** (`ci.yml`)                          | Push / PR to `main`                       | Dependency audit, lint, unit tests (backend + frontend), E2E (Playwright)          | —                                             |
| **NBA Data Pipeline** (`nba-pipeline.yml`) | **Daily 10:00 UTC** (auto) + manual       | Derives team stats + rankings on production, flushes Redis                         | `DATABASE_URL`, `REDIS_URL`, `CURRENT_SEASON` |
| **DB Backup** (`backup-release.yml`)       | **Every Sunday 2:00 UTC** (auto) + manual | `pg_dump` production DB → GitHub Release                                           | `DATABASE_URL`                                |
| **Load Tests** (`load-test.yml`)           | Manual                                    | k6 smoke / load / stress against a target URL                                      | —                                             |
| **Season Archive** (`season-archive.yml`)  | Manual                                    | Exports season CSVs + full DB dump → GitHub Release tagged `season-archive-{YEAR}` | `DATABASE_URL`, `CURRENT_SEASON`              |

---

## Automated Local Pipeline

The GitHub Actions daily job (10:00 UTC) only derives and ranks — it cannot fetch new games because nba.com blocks cloud IPs. A macOS `launchd` job runs `make pipeline-prod` locally at **09:00 UTC daily**, ensuring production data is always fresh before the derive step.

### Prerequisites

- `backend/.env.production` exists with a valid `DATABASE_URL`
- `.venv` is set up (`python3.13 -m venv .venv && pip install -r requirements.txt`)

### Install

```bash
make install-cron
```

This substitutes the absolute repo path into `launchd/com.topfivin2.pipeline.plist` and installs it to `~/Library/LaunchAgents/`. The job runs `make pipeline-prod` (fetch → derive → rankings → backup) daily at 09:00 UTC.

### Monitor

```bash
tail -f logs/pipeline_prod.log
```

### Uninstall

```bash
make uninstall-cron
```

### Notes

- The machine must be **on and awake** at 09:00 UTC for the job to fire on schedule. `StartCalendarInterval` automatically re-runs a missed job the next time the machine wakes — no extra configuration needed. Since `fetch_nba_stats.py` skips already-collected games, a catch-up run is safe.
- `logs/pipeline_prod.log` is gitignored and grows ~100 lines per day. Run `make logs-clean` to remove it if it exceeds 50 MB.
- To reproduce this setup on a new machine: `make install-cron` (the plist template is committed at `launchd/com.topfivin2.pipeline.plist`).

---

## API Reference

### Rankings

| Method | Endpoint                                 | Description                                 |
| ------ | ---------------------------------------- | ------------------------------------------- |
| `GET`  | `/api/categories`                        | All available stat categories               |
| `GET`  | `/api/rankings?category=PPG&season=2025` | Rankings for a stat category (Redis-cached) |

### Teams

| Method | Endpoint                                 | Description                                |
| ------ | ---------------------------------------- | ------------------------------------------ |
| `GET`  | `/api/teams`                             | All 30 teams (optional `?team_id=` filter) |
| `GET`  | `/api/teams/abbr/:abbreviation`          | Team by abbreviation (e.g., `LAL`)         |
| `GET`  | `/api/team/:teamId/stats?season=2025`    | Season stats for a team                    |
| `GET`  | `/api/team/:teamId/rankings?season=2025` | All-category rankings for a team           |

### Audit

| Method | Endpoint                                                                                    | Description                            |
| ------ | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| `GET`  | `/api/audit/games?season=2025&status=collected\|missing&date=YYYY-MM-DD&limit=100&offset=0` | Game collection status with pagination |
| `GET`  | `/api/audit/game/:gameId/stats`                                                             | Per-team box score for a specific game |

---

## Database Schema

| Table           | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `teams`         | Team metadata (id, name, logo URL, colors)                     |
| `games`         | Game log — game_id, date, home/away team IDs, `collected` flag |
| `game_stats`    | Per-team per-game box score rows                               |
| `team_stats`    | Season averages derived by `derive_team_stats.py`              |
| `stat_rankings` | Pre-computed rankings — 27 categories × 30 teams = 810 rows    |

---

## Data Accuracy & Completeness

Stat rankings are computed from season averages across all collected games. A small number of games have permanently incomplete records in the NBA API:

| Game ID      | Missing data source   | Affected columns                                                                                                                                                                                                                       |
| ------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0022500259` | BoxScoreSummaryV3 DF7 | `biggest_lead`, `bench_points`, `lead_changes`, `times_tied`, `biggest_scoring_run`, `pts_from_tov`                                                                                                                                    |
| `0022500260` | BoxScoreSummaryV3 DF7 | same                                                                                                                                                                                                                                   |
| `0022500261` | BoxScoreSummaryV3 DF7 | same                                                                                                                                                                                                                                   |
| `0022500265` | BoxScoreSummaryV3 DF7 | same                                                                                                                                                                                                                                   |
| `0022500603` | BoxScoreAdvancedV3    | `dreb_pct`, `reb_pct`, `oreb_pct`, `tm_tov_pct`, `e_tov_pct`, `ast_to_tov`, `ast_pct`, `ast_ratio`, `pace_per40`, `pie`, `poss`, `e_ortg`, `e_drtg`, `e_net_rtg`, `e_pace`, `opp_efg_pct`, `opp_tov_pct`, `opp_ft_rate`, `e_usage_pct` |

**Cause:** These games appear to have incomplete records in the NBA API — likely postponed or rescheduled games that were never fully recorded. All 5 failed on every retry attempt.

**Impact:** Negligible. `COALESCE` treats missing values as 0 in season averages. With 70+ games per team in a season, 5 missing games shift any affected average by less than 0.1%.

---

## Contributing

### Branching

```bash
git checkout -b feature/your-feature-#ISSUE
```

Branch naming convention: `feature/{feature-name}-#{issue-number}`

### Commit & push

Atomic commits — one feature, one commit when possible:

```bash
git add .
git commit -m "Descriptive message - Issue #ISSUE"
git push -u origin feature/your-feature-#ISSUE
```

### Pull request

Include a closing keyword in the PR body to auto-close the linked issue on merge:

```
Closes #ISSUE
```

### Code layout

| Path                       | Contents                                        |
| -------------------------- | ----------------------------------------------- |
| `backend/src/routes/`      | Express route handlers (rankings, teams, audit) |
| `backend/src/services/`    | Business logic and DB queries                   |
| `backend/scripts/`         | Python data pipeline scripts                    |
| `frontend/src/pages/`      | Full page views                                 |
| `frontend/src/components/` | Reusable UI components                          |

### Testing

Before merging code to main, run all tests to ensure quality:

#### Frontend tests (vitest)

```bash
cd frontend
npm test              # run all tests once
npm test -- --watch  # run in watch mode during development
```

#### Backend tests (jest)

```bash
cd backend
npm test              # run all tests once
npm test -- --watch  # run in watch mode during development
```

#### Run all tests

```bash
cd frontend && npm test && cd ..
cd backend && npm test
```

### Ship it (feature branch → PR → merge)

The complete workflow for merging code to main:

1. **Create feature branch** (from `main`)

   ```bash
   git checkout main && git pull origin main
   git checkout -b feature/your-feature-#ISSUE
   ```

2. **Make changes & test locally**
   - Edit files and commit atomically
   - Test changes in the browser (dev server running)
   - Ensure linting passes: `npm run lint` in frontend/backend

3. **Run full test suite** (required before pushing)

   ```bash
   cd frontend && npm test -- --run && cd ..
   cd backend && npm test
   ```

   - All tests must pass before proceeding
   - Update tests if component structure changes

4. **Push feature branch**

   ```bash
   git push -u origin feature/your-feature-#ISSUE
   ```

5. **Create PR on GitHub**
   - Link the PR to the issue with closing keyword: `Closes #ISSUE`
   - Include description of changes made

6. **After PR merge**
   ```bash
   git checkout main && git pull origin main
   git branch -d feature/your-feature-#ISSUE  # clean up local branch
   ```
