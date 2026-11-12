# Spike: static JSON export instead of a hosted API and database (#184)

**Recommendation: defer.** The design works and is cheaper to run, but the current Neon + Render + Vercel setup is already live at $0, so switching now buys little. Revisit if the Render free tier, Neon limits or cold starts become a real problem.

## What the data looks like

Sizes come from the 2026-11-12 backup (two seasons stored, so halve the table sizes for one season):

| Table         | Rows (2 seasons) | Raw size (2 seasons) | Used by                                         |
| ------------- | ---------------- | -------------------- | ----------------------------------------------- |
| stat_rankings | 8,820            | ~0.8 MB              | `/rankings`, `/team/:id/rankings`, random facts |
| team_stats    | 60               | ~60 KB               | `/team/:id/stats`                               |
| teams         | 30               | ~6 KB                | `/teams`, `/teams/abbr/:abbr`                   |
| games         | 1,370            | ~150 KB              | audit list                                      |
| game_stats    | 2,740            | ~2 MB                | audit per-game box score                        |

Per season that is roughly 1.5 MB raw, well under 300 KB gzipped for everything except the per-game box scores. Data changes once a day (today, by a manual `make pipeline-prod`).

## Design sketch

- A new `export_static.py` step at the end of the pipeline writes, per season:
  - `seasons.json` (current + available)
  - `categories.json`
  - `teams.json`
  - `{season}/rankings/{category}.json` (about 30 files)
  - `{season}/team/{teamId}/stats.json` and `rankings.json` (60 files)
  - `{season}/random-facts.json` (a pool of facts; the frontend samples N)
  - `{season}/audit/games.json` (all games, about 700 rows) and `{season}/audit/game/{gameId}.json` (about 700 small files)
- Host the files next to the frontend (Vercel static output or Cloudflare Pages). The files must be published after every pipeline run: either commit them to a data branch that triggers a deploy, or call a Vercel deploy hook, or upload to object storage.
- Frontend: `useApi.js` swaps `apiClient.get(path, { params })` for static fetches by path. Query and path semantics that the API handles today move to the client:
  - `/audit/games` filtering (`status`, `date`) and pagination (`limit`, `offset`) become client-side over one `games.json` (about 700 rows is fine).
  - Random facts sampling moves to the client.
  - Season default: `seasons.json` replaces `/seasons`.
- Audit tab: still works. The list is one file; the expanded box score is a lazy fetch of one small file per game.

## What goes away and what stays

Goes away from production: the Express API, Render, rate limiter, `/ready` check, cold-start message (#179), Sentry on the API, Neon being on the request path, CORS and trust-proxy config.

Stays: the pipeline still needs a database (Neon or a local Postgres) as its working store, since derive/rank scripts and the archive/backup flows are written against it. So the saving is the Render service and runtime risk, not the database.

## Comparison

|                                                      | Neon + Render (now)                        | Static JSON                                                       |
| ---------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| Monthly cost                                         | $0 (free tiers)                            | $0                                                                |
| Cold start                                           | up to ~60 s on first request               | none (CDN)                                                        |
| Moving parts in production                           | API, DB, Vercel                            | Vercel only                                                       |
| Freshness                                            | live as soon as the pipeline writes the DB | after the next publish                                            |
| Flexibility (new filters, queries, ad-hoc endpoints) | high                                       | low; every new view needs a new export                            |
| Code to write                                        | none                                       | exporter, publish step, frontend data layer, tests                |
| Risk                                                 | free-tier limits changing                  | publish step silently failing leaves stale data (pairs with #192) |

## Estimated effort

About 2 to 3 days: exporter script and tests (1), frontend data layer and test updates (1), publish step and docs (0.5 to 1). Removing the API afterwards is extra, and deleting Render/Neon from production is the last step.

## Why defer

- The migration just finished and the site works; the cold-start cost is already mitigated by the waking-up message and the 60 s timeout.
- The current pipeline is manual, so a publish step adds one more manual action unless the scheduling question (#200) is solved first.
- The season selector (#189) is cheap in either design and does not depend on this.

## Triggers to revisit

- Render free tier is withdrawn or cold starts hurt users.
- Neon free-tier limits (storage, compute hours) are hit.
- The pipeline becomes automated, which makes the publish step free.
