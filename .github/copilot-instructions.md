# TopFivin2 — Copilot Instructions

## Project Overview

NBA team stats dashboard. React frontend + Node.js/Express backend + PostgreSQL database.
Hosted on Railway (backend + DB) and Vercel (frontend).

---

## Stack

| Layer           | Tech                                                          |
| --------------- | ------------------------------------------------------------- |
| Frontend        | React 19, React Router 7, Tailwind CSS 4.2, DaisyUI 5.5, Vite |
| Backend         | Node.js, Express, `backend/src/index.js`                      |
| Database        | PostgreSQL (local: `nba_stats`, production: Railway)          |
| Cache           | Redis                                                         |
| Scripts         | Python 3 (`.venv` at repo root)                               |
| Package manager | `pnpm` (frontend), `npm` (backend)                            |

---

## Ports

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`
- Production backend: Railway (PORT=8080 auto-injected)

---

## Key Files & Directories

```
backend/
  src/
    index.js               — Express server entry point
    routes/
      api.js               — Route aggregator
      rankings.js          — GET /api/categories, GET /api/rankings
      teams.js             — GET /api/teams, /api/teams/abbr/:abbr,
                             /api/team/:teamId/stats, /api/team/:teamId/rankings
      audit.js             — GET /api/audit/games, /api/audit/game/:gameId/stats
    services/
      rankingsService.js
      teamsService.js
      auditService.js
      statProcessor.js
    utils/
      teamConstants.js     — TEAM_COLORS for all 30 NBA teams
    db/
      postgresClient.js
    cache/
      redisClient.js
  migrations/              — Node.js migration files (001–009), run against Railway via make migrate-prod
  scripts/                 — Python data pipeline scripts (fetch, derive, sync)
frontend/
  src/
    pages/                 — Dashboard, RankingsPage, TeamPage, TeamsPage, AuditPage
    components/            — RankingsGrid, TeamCard, Top5Showcase, GameStatsRow, etc.
    hooks/useApi.js
    utils/statFormatter.js
```

---

## Environment Files

- `backend/.env` — local DB credentials (`DB_HOST`, `DB_USER`, `DB_NAME=nba_stats`, `PORT=5001`, `CURRENT_SEASON`)
- `backend/.env.production` — Railway credentials (`DATABASE_URL`, `REDIS_URL`) — **gitignored, never commit**

---

## API Endpoints (all prefixed `/api`)

| Method | Path                        | Description                                           |
| ------ | --------------------------- | ----------------------------------------------------- |
| GET    | `/categories`               | All 115 stat categories                               |
| GET    | `/rankings`                 | Rankings for a category (`?category=PPG&season=2025`) |
| GET    | `/teams`                    | All 30 teams with colors/logos                        |
| GET    | `/teams/abbr/:abbr`         | Team lookup by abbreviation                           |
| GET    | `/team/:teamId/stats`       | Full team stats (`?season=2025`)                      |
| GET    | `/team/:teamId/rankings`    | All rankings for a team                               |
| GET    | `/audit/games`              | All games in DB for audit                             |
| GET    | `/audit/game/:gameId/stats` | Per-game stats for a specific game                    |

---

## Database Schema (key tables)

- `game_stats` — one row per team per game (~2,130 rows for 1,065 games), 190+ columns
- `team_stats` — one row per team, derived from `game_stats` averages (30 rows)
- `stat_rankings` — one row per team per stat category (3,450 rows = 30 teams × 115 categories)
- `teams` — 30 teams, team metadata + colors

### Migrations (001–009, applied in order)

All use `ADD COLUMN IF NOT EXISTS` — safe to re-run. Applied to production via:

```bash
make migrate-prod MIGRATION=<migration_name_without_.js>
```

---

## Data Pipeline (local → production flow)

```
make fetch                 # fetch_nba_stats.py — base game stats (BoxScoreTraditionalV3)
make fetch-advanced-extras # BoxScoreAdvancedV3 — ortg, drtg, pace, pie, etc.
make fetch-summary-extras  # BoxScoreSummaryV3 — bench_pts, lead_changes, etc.
make fetch-misc            # BoxScoreMiscV3 — pts_paint, fast_break, opp_* cols
make fetch-hustle          # BoxScoreHustleV2 — deflections, box_outs, contested_shots
make fetch-summary         # BoxScoreSummaryV3 full — attendance, q1-q4_pts, pts_from_tov
make fetch-fourfactors     # BoxScoreFourFactorsV3 — ft_rate, tov_pct, oreb_pct, opp_*
make fetch-scoring         # BoxScoreScoringV3 — pct_fga_*, pct_pts_*, pct_ast_*
make fetch-playertrack     # BoxScorePlayerTrackV3 — distance, touches, passes, contested_fg*
make derive                # derive_team_stats.py + derive_rankings.py + redis FLUSHDB
```

**All fetch scripts use IS NULL guards** — safe to re-run, will only process new/missing games.

### Production deployment (after local pipeline):

```bash
make sync-prod             # sync_to_prod.py — copies 139 columns from local → Railway game_stats
make derive-prod           # same as derive but targets Railway DB
```

### Full production pipeline (fetches + derives on Railway DB directly):

```bash
make pipeline-prod
```

---

## Make Targets Reference

```bash
make dev                   # Start services + backend + frontend
make backend               # Backend only (nodemon)
make frontend              # Frontend only (vite)
make pipeline              # fetch + derive (local)
make migrate-prod MIGRATION=<name>  # Apply a migration to Railway
make sync-prod             # Sync game_stats columns local → Railway
make derive-prod           # Rebuild team_stats + rankings on Railway + flush Redis
make check-progress        # Show backfill completion per column (local)
make check-progress-prod   # Same against Railway
make backup                # pg_dump Railway → local backups/
```

---

## Git Workflow

- **Main branch**: `main`
- **Feature branches**: `feature/{feature-name}-#{issue-number}`
- PRs must be merged via GitHub UI — squash merge is used

### "Ship It" — push branch + open PR for review (never merge locally to main)

```bash
# 1. Run all tests first — must pass before pushing
cd backend && npm test
cd frontend && npm test

# 2. Push branch
git push -u origin feature/your-feature-name

# 3. Create PR via gh CLI (write body to file first to avoid shell escaping issues)
gh pr create --title "Your title" --body-file /tmp/pr-body.md --base main
```

PR description must end with `Closes #ISSUE_NUMBER` to auto-close the linked issue on merge.
If there is no issue number, omit the closing keyword entirely.

### "Sync & Clean" (S&C) — run after PR is confirmed merged on GitHub

```bash
git checkout main && git pull origin main
git branch -d feature/your-feature-name
```

If the branch shows "not fully merged" (expected with squash merge), force-delete:

```bash
git branch -D feature/your-feature-name
```

---

## Team Color Algorithm (frontend)

```javascript
// Luminance = (0.299*r + 0.587*g + 0.114*b) / 255
// luminance < 0.5 (dark bg): use primary color + white text
// luminance >= 0.5 (light bg): use secondary color + white text
// Exceptions: Jazz (1610612762) & Rockets (1610612745) always use secondary
```

Source of truth: `backend/src/utils/teamConstants.js` → `TEAM_COLORS`

---

## NBA API Rate Limiting

Backfill scripts hit rate limits around ~600 games during bulk backfills.

- Symptom: 2+ consecutive games exhausting all 3 retry attempts with `Read timed out`
- Fix: kill the script, wait 5–10 min, re-run — IS NULL guards resume from where it stopped
- Do NOT let it keep running through consecutive failures

---

## Deployment Infrastructure

- **Backend + DB**: Railway — `DATABASE_URL` and `REDIS_URL` set as env vars in Railway service
- **Frontend**: Vercel — env vars: `REACT_APP_API_URL`, `REACT_APP_CURRENT_SEASON`
- Railway uses PORT=8080 (auto-injected) — not 5001
- NBA API calls must run locally (Railway IPs are blocked by stats.nba.com)
