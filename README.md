# NBA Stats Ranking Dashboard

A full-stack web app that fetches NBA team statistics from the official NBA.com API, computes rankings across 147 stat categories, and displays them in an interactive dashboard. Data is fetched locally via Python scripts and served through a Node.js/Express API backed by PostgreSQL.

---

## Tech Stack

| Layer              | Technologies                                                                  |
| ------------------ | ----------------------------------------------------------------------------- |
| **Frontend**       | React 19, React Router 7, TanStack Query 5, Tailwind CSS 4, DaisyUI 5, Vite 6 |
| **Backend**        | Node.js 26, Express 5, PostgreSQL (pg), Helmet, Winston, Jest                 |
| **Data Pipeline**  | Python 3.13, nba_api, psycopg2                                                |
| **Infrastructure** | Neon (Postgres), Render (API), Vercel (frontend), GitHub Actions CI/CD        |

---

## Architecture

```
nba_api (Python — run locally)
  └─ fetch_nba_stats.py           → games + game_stats tables
       ├─ fetch_advanced_extras.py   ┐
       ├─ fetch_summary.py           │
       ├─ fetch_fourfactors.py       │
       ├─ fetch_scoring.py           ├─ daily pipeline (resumable via IS NULL guards)
       ├─ fetch_starters_bench.py    │
       ├─ fetch_playertrack.py       │
       ├─ fetch_misc_stats.py        │
       └─ fetch_hustle_stats.py      ┘
            └─ derive_team_stats.py     → team_stats table
                 └─ derive_rankings.py      → stat_rankings table
                                                  │
                                      Node.js / Express  (port 5001)
                                      GET /api/categories
                                      GET /api/rankings
                                      GET /api/rankings/random-facts
                                      GET /api/teams
                                      GET /api/teams/abbr/:abbreviation
                                      GET /api/team/:id/stats
                                      GET /api/team/:id/rankings
                                      GET /api/seasons
                                      GET /api/audit/games
                                      GET /api/audit/game/:gameId/stats
                                                  │
                                      React Frontend  (port 3000, Vercel in prod)
                                      Tailwind + DaisyUI + TanStack Query
```

PostgreSQL stores all data. An in-process cache holds ranking responses (5-minute TTL; fresh data appears within 5 minutes of the daily derive).

> **Note:** `fetch_nba_stats.py` must run **locally** — nba.com actively blocks cloud IP ranges (GitHub Actions, Render). In practice the whole production pipeline is run by hand with `make pipeline-prod`; a scheduled freshness check on GitHub Actions alerts you if a fetch is missed (see [GitHub Actions](#github-actions)).

---

## Local Setup

### Prerequisites

- Node.js 26+ (the version CI and Render use is pinned in [.nvmrc](.nvmrc); `nvm use` picks it up)
- pnpm (the version is pinned by `packageManager` in the root [package.json](package.json); with corepack, `corepack enable` makes it used automatically; Node 25+ no longer bundles corepack, so install it with `npm i -g corepack` first)
- Python 3.13
- PostgreSQL 16+ running locally (`make services` starts it via Homebrew)

### 1. Clone and install dependencies

```bash
git clone https://github.com/sheriff1/topfivin2.git
cd topfivin2

pnpm install   # one install at the repo root covers backend and frontend (pnpm workspace)
```

> Use **pnpm** everywhere (CI and the lockfile are pnpm). `npm` is not supported.

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
make services              # start PostgreSQL
pnpm --filter backend migrate
```

### 4. Set up Python and fetch data

> **Required first-time step** — takes ~15–20 min on first run (skips already-collected games on re-runs).

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt   # runtime deps + pytest
# macOS: social images (CairoSVG) also need the cairo library: brew install cairo

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


FRONTEND_URL=http://localhost:3000
```

### Production pipeline — `backend/.env.production`

This file is **gitignored** and never committed. The `*-prod` Makefile targets (run from your machine) load it to reach the production database. It contains a single connection string:

```env
DATABASE_URL=postgresql://...   # Neon dashboard > Connect (direct or pooled both work)
```

The deployed API does not read this file; its variables are set in Render (see [Deploying](#deploying)).

---

## Deploying

Production runs on three services: **Neon** (Postgres), **Render** (Express API) and **Vercel** (React frontend). Data is loaded into Neon from your own machine with `make pipeline-prod`; the API only reads it.

### 1. Database (Neon)

1. Create a Neon project (Postgres 18) and copy its connection string (Neon dashboard > **Connect**). Use the **direct** string for dumps and restores; the pooled string works for the API.
2. Put it in `backend/.env.production` as `DATABASE_URL` for the pipeline (see [Environment Variables](#environment-variables)).
3. Schema: nothing to do by hand. The API applies pending migrations on start-up (below). To load existing data into an empty database, see [docs/backup-configuration.md](docs/backup-configuration.md#restoring-into-a-fresh-neon-database).

### 2. API (Render)

The service is defined as code in [render.yaml](render.yaml) (a Render Blueprint: Node version from `.nvmrc`, free plan, Ohio, health check `/health`, auto-deploy on every commit to `main`).

1. In Render, **New > Blueprint**, pick this repo and branch `main`.
2. Fill in the prompted variables (they use `sync: false` so they are never stored in git):

| Variable         | Value                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | Neon connection string                                                                         |
| `FRONTEND_URL`   | Vercel production URL, no trailing slash (used for CORS)                                       |
| `FRONTEND_URL_2` | Optional second allowed origin, e.g. a custom domain                                           |
| `TRUST_PROXY`    | Set by the blueprint to `3` (Render sits behind Cloudflare + an internal proxy); leave it      |
| `LOG_CLIENT_IP`  | Set by the blueprint to `false`; `true` logs `req.ip` and `X-Forwarded-For` for debugging only |

`PORT` is injected by Render, `NODE_ENV=production` is set by the blueprint, and logs go to stdout. There is no season variable; the API follows the latest season in the database.

3. The build installs only the backend workspace (`corepack pnpm install --frozen-lockfile --filter backend...`, pnpm version from `packageManager`, same as CI) and starts with `node src/index.js`. Check `https://<service>.onrender.com/health`.

> The free plan sleeps after inactivity, so the first request after a pause can take 30-60s (cold start). The frontend allows for this (60s request timeout, retries, and a "waking up" message after 3s). There is deliberately no keep-alive ping: it would use most of Render's free monthly hours and Neon auto-suspends anyway. `/health` is shallow and is what Render polls; `/ready` also runs `SELECT 1` against the database, so use it for manual checks only (it wakes a suspended Neon database).

### Rate limiting

All `/api` routes share one limiter (`apiLimiter`: 200 requests per 15 minutes per IP; `/health` and `/ready` are exempt, and it is off in development). It uses `express-rate-limit`'s default in-memory store, so counters reset on every restart (including cold starts) and are **not shared between instances**. That is fine for the single Render instance; if the API ever runs more than one instance, or abuse appears, switch to a shared store (e.g. Postgres-backed) or host-level rate limiting.

### Migrations

Migrations run automatically every time the API starts, so a deploy applies any new ones (idempotent, guarded by an advisory lock, recorded in `schema_migrations`). To add one, create the next numbered file in `backend/migrations/` and register it in `backend/migrations/index.js` (a test fails if you forget). To run them without deploying:

```bash
set -a && source backend/.env.production && set +a
pnpm --filter backend migrate
```

### 3. Frontend (Vercel)

1. Import the repo in Vercel with **Root Directory** `frontend` (Vite preset).
2. Set `VITE_API_URL` to the API base **including `/api`**, e.g. `https://<service>.onrender.com/api`. It is baked in at build time, so redeploy after changing it. Without it the app calls `/api` on its own origin.
3. Add the resulting Vercel URL to the API's `FRONTEND_URL` in Render, otherwise browsers will block the API calls (CORS).

### 4. Update production data

From your machine (nba.com blocks cloud IPs): `make pipeline-prod`. See [Makefile Reference](#makefile-reference).

---

## Makefile Reference

### Dev

| Target          | Description                         |
| --------------- | ----------------------------------- |
| `make dev`      | Start services + backend + frontend |
| `make backend`  | Start backend only (nodemon)        |
| `make frontend` | Start frontend only (Vite)          |
| `make services` | Start PostgreSQL 16 via Homebrew    |
| `make stop`     | Stop PostgreSQL                     |

### Data Pipeline

| Target               | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `make fetch`         | Fetch new games from nba_api → local DB                    |
| `make derive`        | Derive team stats + rankings                               |
| `make pipeline`      | Full local pipeline: fetch → derive → rankings (no backup) |
| `make backfill`      | One-time backfill of 24 V3 advanced columns → local DB     |
| `make backfill-prod` | Same backfill against the production (Neon) DB             |

### Production

| Target               | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `make fetch-prod`    | Fetch games → production (Neon) DB                                      |
| `make derive-prod`   | Derive stats + rankings on the production DB                            |
| `make pipeline-prod` | Full production pipeline: fetch → backfill → derive → rankings → backup |

### Manual fetch

See [docs/manual-fetch.md](docs/manual-fetch.md) for the exact order, verification and troubleshooting.

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

| Target            | Description                                         |
| ----------------- | --------------------------------------------------- |
| `make logs-clean` | Delete `logs/pipeline_prod.log` if it exceeds 50 MB |

---

## GitHub Actions

CI runs on every push and PR. Two workflows are also **scheduled** (daily freshness check, weekly backup); the rest are manual. The daily data fetch itself is **manual** (`make pipeline-prod`, see [docs/manual-fetch.md](docs/manual-fetch.md)). GitHub disables scheduled workflows after 60 days without repo activity; the freshness check re-enables itself and the backup on every run to guard against that.

| Workflow                                         | Trigger                                   | What it does                                                                                                                                               | Secrets needed                           |
| ------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **CI** (`ci.yml`)                                | Push / PR to `main`                       | Dependency audit, lint, unit tests (backend + frontend), E2E (Playwright)                                                                                  | —                                        |
| **Data Freshness Check** (`freshness-check.yml`) | **Daily 14:00 UTC** (auto) + manual       | Fails when the newest stored game is more than 3 days old during the season (skips Jun 25 – Oct 20 and the All-Star break); re-enables scheduled workflows | `DATABASE_URL`                           |
| **DB Backup** (`backup-release.yml`)             | **Every Sunday 2:00 UTC** (auto) + manual | `pg_dump` production DB → GitHub Release                                                                                                                   | `DATABASE_URL`                           |
| **Load Tests** (`load-test.yml`)                 | Manual                                    | k6 smoke / load / stress against a target URL                                                                                                              | —                                        |
| **Season Archive** (`season-archive.yml`)        | Manual                                    | Exports season CSVs + full DB dump → GitHub Release tagged `season-archive-{YEAR}`                                                                         | `DATABASE_URL`; optional input: `season` |

---

## Daily Data Fetch (manual)

The daily fetch is run by hand: `make pipeline-prod` (fetch → derive → rankings → backup) on a machine with a residential IP, because nba.com blocks cloud IPs. See [docs/manual-fetch.md](docs/manual-fetch.md) for the runbook. Automation was tried (macOS `launchd`) and dropped; the decision is recorded in #200.

If a fetch is missed, the **Data Freshness Check** workflow fails and GitHub emails you. A catch-up run is safe because the fetch skips games already stored.

**Social images are on demand.** `pipeline-prod` does not generate them. Run `make social-images-prod` (or `make derive-prod`, which includes the step) when you want to post; output goes to `backend/social_images/` (gitignored, needs the cairo library). The local `make pipeline` does generate them.

`logs/pipeline_prod.log` is gitignored. Run `make logs-clean` to remove it if it exceeds 50 MB.

---

## API Reference

### Seasons

| Method | Endpoint       | Description                                                                          |
| ------ | -------------- | ------------------------------------------------------------------------------------ |
| `GET`  | `/api/seasons` | `{ current, available }`: latest stored season and all stored seasons (newest first) |

Routes that take `?season=` default to the latest stored season when it is omitted (404 if the database is empty). The lookup is cached for 5 minutes.

**Season rollover is automatic.** There is no season environment variable. The current season is the latest one stored in the database (`GET /api/seasons`), and the site, API and every derive/rank/social/archive step follow it. Only the fetch step uses the calendar (October starts a new season; override with `FETCH_SEASON`). When the first game of a new season is stored it becomes current, with no config change. See [docs/manual-fetch.md](docs/manual-fetch.md).

**Browsing previous seasons.** Every table is keyed by `season`, and the pipeline only replaces the season it is refreshing (`clear_season_data()` deletes `team_stats` and `stat_rankings` for that one season; `games` and `game_stats` are never deleted), so earlier seasons stay available. When two or more seasons are stored, the navbar shows a season picker (from `available`). The choice is remembered in the browser (`localStorage`) and applies to rankings, teams, team pages, the game, and the audit views. Picking the latest season goes back to following it automatically.

**Storage impact.** One season is roughly 1.5 MB of table data (about 0.4 MB of `stat_rankings`, 30 KB of `team_stats`, 75 KB of `games` and 1 MB of `game_stats`, measured from a backup holding two seasons). Neon's free tier allows 0.5 GB, so keeping every season is not a concern for a long time. Old seasons can still be exported with `make archive-season` before any manual cleanup.

### Rankings

| Method | Endpoint                                 | Description                                       |
| ------ | ---------------------------------------- | ------------------------------------------------- |
| `GET`  | `/api/categories`                        | All available stat categories                     |
| `GET`  | `/api/rankings?category=PPG&season=2025` | Rankings for a stat category (cached)             |
| `GET`  | `/api/rankings/random-facts?season=2025` | Random stat facts for the "Did You Know" carousel |

### Teams

| Method | Endpoint                                 | Description                                                                  |
| ------ | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `GET`  | `/api/teams?season=2025`                 | All 30 teams (optional `?team_id=` filter); `trophy_count` is for the season |
| `GET`  | `/api/teams/abbr/:abbreviation`          | Team by abbreviation (e.g., `LAL`); optional `?season=` for `trophy_count`   |
| `GET`  | `/api/team/:teamId/stats?season=2025`    | Season stats for a team                                                      |
| `GET`  | `/api/team/:teamId/rankings?season=2025` | All-category rankings for a team                                             |

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
| `stat_rankings` | Pre-computed rankings — 147 categories × 30 teams = 4,410 rows |

---

## Data Accuracy & Completeness

Stat rankings are computed from season averages across all collected games. A small number of games have permanently incomplete records in the NBA API (box score summary data such as bench points and lead changes, or player tracking data such as distance, touches and contested shots).

**Cause:** These games appear to have incomplete records in the NBA API — likely postponed or rescheduled games that were never fully recorded. They failed on every retry attempt.

**Impact:** Season averages skip games with no data for a stat (`AVG` ignores NULLs), so a missing game no longer drags an average toward 0. Totals (`SUM(COALESCE(x, 0))`) still treat missing as 0. A team with no data at all for a stat shows 0 rather than NULL (rankings sort NULLs first). Averages for stats not yet backfilled for the latest games are computed from the games that do have data until the backfill runs; rerun the derive step afterwards.

---

## Data Completeness Status

### Recently Backfilled (Issue #135)

The following stat categories were previously unavailable (0.0 for all teams) but are now fully populated:

**Team Plus-Minus:**

- `pm_avg` (Plus/Minus Per Game) — Team-level point differential per game
- **Source:** BoxScoreTraditionalV3 DF2 via `fetch_starters_bench.py`
- **Status:** ✅ Fully populated as of Issue #135

**⚠️ API Limitation - Unavailable Stats:**

- `starters_pm` (Starter Plus/Minus Per Game) — NOT AVAILABLE from NBA API
- `bench_pm` (Bench Plus/Minus Per Game) — NOT AVAILABLE from NBA API
- **Reason:** The NBA Stats API (BoxScoreTraditionalV3) does not provide per-group (Starters vs Bench) plus/minus metrics. Only team-level plus/minus is available. These stats have been removed from the frontend.

**Scoring Breakdown Percentages:**

- `pct_fga_*` — Percentage of FGA by type (2PT, 3PT)
- `pct_pts_*` — Percentage of team points by source (2PT, 3PT, FT, paint, fast break, off turnovers)
- `pct_ast_*` — Percentage of team assists (assisted/unassisted FG breakdown)
- **Source:** BoxScoreScoringV3 via `fetch_scoring.py`
- **Status:** ✅ Fully populated as of Issue #135

**Player Tracking Stats:**

- Distance traveled, touches, passes, secondary assists, free throw assists
- Contested shots (2PT/3PT), uncontested shots, shooter/defender matchup percentages
- Defensive Assist Ratio (DAR) — defended vs undefended FG attempts
- Rebound chances (offensive, defensive, total)
- **Source:** BoxScorePlayerTrackV3 DF1 via `fetch_playertrack.py`
- **Status:** ✅ Fully populated as of Issue #135

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
pnpm test -- --run    # run all tests once
pnpm test             # run in watch mode during development
```

#### Backend tests (jest)

```bash
cd backend
pnpm test             # run all tests once
pnpm test -- --watch  # run in watch mode during development
```

#### Run all tests

```bash
pnpm --filter frontend test -- --run
pnpm --filter backend test
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
   - Ensure linting passes: `pnpm --filter backend lint && pnpm --filter frontend lint`

3. **Run full test suite** (required before pushing)

   ```bash
   pnpm --filter frontend test -- --run
   pnpm --filter backend test
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
