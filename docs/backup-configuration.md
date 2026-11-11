# Database Backup Configuration

## Strategy

Automated local `pg_dump` backups integrated into the existing data pipeline workflow. Because NBA stats data is fetched locally (Railway IP restriction workaround), the pipeline already runs against the production database from the local machine — making a post-pipeline backup a natural, zero-overhead addition.

Railway's native volume backup feature requires the Pro plan and is deferred for now. This strategy provides equivalent recovery capability using standard PostgreSQL tooling.

## How Backups Work

### Automatic (via pipeline)

Every `make pipeline` run automatically creates a backup after the data is fully processed :

```bash
make pipeline
# Fetches NBA stats → derives team stats → updates rankings → creates backup
```

### Manual (standalone)

Create a backup at any time without running the full pipeline:

```bash
make backup
```

### Clean old backups

Remove backup files older than 7 days:

```bash
make backup-clean
```

## File Format & Location

- **Location**: `backups/` (gitignored — never committed to the repository)
- **Filename**: `nba_stats_YYYYMMDD_HHMMSS.dump` (e.g. `nba_stats_20260320_143022.dump`)
- **Format**: PostgreSQL custom compressed format (`-F c`) — smaller than plain SQL, supports selective restore
- **Retention**: 7 days local (run `make backup-clean` to prune)

## Connectivity

`pg_dump` connects to Railway via the external TCP Proxy URL (`DATABASE_URL` in `backend/.env`):

```
postgresql://postgres:<password>@mainline.proxy.rlwy.net:<port>/railway
```

No additional configuration is required — this is the same URL the application uses.

## Restore Procedure

To restore a backup to the Railway production database:

```bash
# 1. Source the environment variables
source backend/.env

# 2. Restore (--clean drops existing objects before recreating)
pg_restore --clean --no-acl --no-owner \
  -d $DATABASE_URL \
  backups/nba_stats_YYYYMMDD_HHMMSS.dump
```

> **Warning**: `--clean` will drop and recreate all tables. Only run this against a database you intend to fully overwrite.

### Restoring into a fresh Neon database

Used for the Railway → Neon migration (#176) and reusable for any empty Postgres. Use **v18 client tools** (the servers are Postgres 18), the **direct** (non-pooled) connection string, and never paste it into logs or commits.

```bash
# 1. Get a dump: latest GitHub release backup (or a local backups/*.dump)
gh release download db-backup-N -R sheriff1/topfivin2 -D /path/to/empty/dir

# 2. Restore into the empty database (no --clean needed on an empty DB)
pg_restore --no-owner --no-privileges --exit-on-error \
  -d "$NEON_DIRECT_URL" /path/to/empty/dir/nba_stats_YYYYMMDD.dump

# 3. Record/apply migrations (idempotent; adds anything newer than the dump)
cd backend && DATABASE_URL="$NEON_DIRECT_URL" node migrations/index.js

# 4. Verify: row counts for teams, games, game_stats, team_stats, stat_rankings
#    must match the dump; then re-run the derive steps and confirm no value changes
cd backend && DATABASE_URL="$NEON_DIRECT_URL" python scripts/derive_team_stats.py \
  && DATABASE_URL="$NEON_DIRECT_URL" python scripts/derive_rankings.py
```

Dumps from Postgres 18.3 restore cleanly into Neon's 18.x with client 18.4. `schema_migrations` is not in older dumps, so step 3 creates it and records all migrations.

To list available backups before choosing one:

```bash
ls -lh backups/*.dump
```

## Prerequisites

`pg_dump` and `pg_restore` must be installed locally. On macOS with Homebrew:

```bash
brew install libpq
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Verify:

```bash
pg_dump --version
```

## Upgrading to Railway Native Backups

When upgrading to Railway Pro plan, enable backups via:

1. Railway dashboard → Production environment → PostgreSQL service → **Backups** tab
2. Enable **Daily** schedule (kept 6 days) and optionally **Weekly** (kept 1 month)
3. Repeat for Staging environment

At that point, `make backup` can remain as a local on-demand option alongside Railway's automated snapshots.
