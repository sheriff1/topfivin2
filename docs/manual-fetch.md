# Manual fetch runbook

The NBA API blocks cloud IPs, so fetching runs **on your Mac** (residential IP) and writes straight to the production (Neon) database. Nothing fetches automatically: this is the permanent model (#200). The scheduled `Data Freshness Check` workflow (daily 14:00 UTC) fails and emails you when the newest stored game is more than 3 days old during the season, so a missed run gets noticed.

## Prerequisites

- `.venv` with `pip install -r requirements.txt`
- `backend/.env.production` containing `DATABASE_URL='postgresql://...'` — **single-quote the value**, it contains `&`
- Postgres v18 client tools (`pg_dump --version`) for the backup step
- Never paste or print `DATABASE_URL`

## Routine fetch (a few days or weeks behind)

Run from the repo root, in this order:

```bash
make pipeline-prod
```

This runs, in order: `fetch_nba_stats.py` (new games only, already-collected games are skipped) → 8 supplementary fetch scripts (advanced, summary, four factors, scoring, starters/bench, player tracking, misc, hustle; each fills only `NULL` columns, so reruns are safe) → `derive_team_stats.py` → `derive_rankings.py` → `make backup`.

Social images are not part of it; run `make social-images-prod` if you want them.

To run the steps by hand (e.g. after a failure part-way), use `make fetch-prod`, then `make derive-prod` (derive + rankings + social images), then `make backup`.

## Catch-up after a long gap or at a new season

The fetch season defaults to the calendar season (year if month ≥ 10, else year − 1). Override it explicitly when needed:

```bash
FETCH_SEASON=2026 make pipeline-prod   # whole chain, fetching 2026-27
make fetch-prod SEASON=2026            # or just the main fetch
```

`FETCH_SEASON` is read by the fetch script, so it works with the whole chain. Every step after the fetch uses the latest season stored in the database.

Note: a new season's first fetch creates its rows, which makes it the "current" season for the API (`GET /api/seasons`).

## Verify

1. **Logs**: each step prints `✅ … complete`; a non-zero exit stops the chain. `make backup` now fails loudly (non-zero, no empty file).
2. **API**: `GET /api/seasons` shows the current season; `GET /api/rankings` returns teams with up-to-date game counts. Use the deployed API once it exists (before that, ask for a read-only check rather than querying production by hand).
3. **Backup**: a new non-empty `backups/nba_stats_<timestamp>.dump` exists (`pg_restore --list <file> | head`).
4. **GitHub**: run `gh workflow run freshness-check.yml` and confirm it succeeds (it fails if the newest game is over 3 days old; pass `-f today=YYYY-MM-DD` to test). `Database Backup to GitHub Releases` runs weekly (Sun 02:00 UTC) and can be dispatched the same way.

Reading the supplementary-script summaries (`✅ Done — updated: N`):

- **`updated`** games got real data written.
- **`⏳ Waiting for data`** games: NBA returned empty values (it has not published that endpoint's data yet, often for several hours after a game; player tracking can take longer). Nothing is written and the next run retries them.
- **`⚠️ Bad data (skipped, no retry)`** games: the endpoint errors for that game. Some are permanent NBA gaps (see the README "Data Accuracy & Completeness" table); they are skipped for that run only.

## Common failures

| Symptom                                 | What to do                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Timeouts / 429 from stats.nba.com       | Wait several minutes and rerun; the fetch skips games already stored                    |
| `connection refused` / SSL errors       | Check `DATABASE_URL` is quoted, uses the direct Neon host, and includes `sslmode`       |
| Neon endpoint slow on first connection  | Free-tier compute is suspended when idle; retry after a few seconds                     |
| `Backup FAILED`                         | Read the redacted `pg_dump` error printed; check client version is 18 and Neon is up    |
| `Cannot trigger on a disabled workflow` | GitHub disables scheduled workflows after 60 days of inactivity: `gh workflow enable …` |
