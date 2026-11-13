.PHONY: dev backend frontend services stop pipeline pipeline-prod fetch fetch-prod derive derive-prod social-images social-images-prod social-image-manual backup backup-clean restore-local archive-season k6-smoke k6-load k6-stress fetch-advanced-extras fetch-misc fetch-hustle fetch-summary fetch-fourfactors fetch-scoring fetch-starters-bench fetch-playertrack backfill backfill-prod backfill-missing sync-advanced-prod sync-missing-prod sync-prod migrate-prod check-progress check-progress-prod logs-clean vercel-slots

# ── Infrastructure ───────────────────────────────────────────────────────────
services:
	@echo "Starting services..."
	@(lsof -i :5432 > /dev/null 2>&1 && echo "✓ PostgreSQL already running on 5432") || (brew services start postgresql@16 || true)

# ── Deploy budget ────────────────────────────────────────────────────────────
# Vercel Hobby allows 100 deployments per rolling 24h across the whole team (docs/deploy-budget.md)
vercel-slots:
	@./scripts/vercel-slots.sh

# ── Application ──────────────────────────────────────────────────────────────
dev:
	$(MAKE) services
	cd backend && pnpm run dev &
	cd frontend && pnpm dev

backend:
	cd backend && pnpm run dev

frontend:
	cd frontend && pnpm dev

# ── Data pipeline ─────────────────────────────────────────────────────────────
# Local targets (fetch, derive, pipeline) use backend/.env → localhost postgres
# Production targets (fetch-prod, derive-prod, pipeline-prod) use backend/.env.production → production PostgreSQL
# pipeline-prod: fetch → 9 V3 scripts (IS NULL guard) → derive → rankings → backup
# backup / backup-clean always target production

fetch:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py $(if $(SEASON),--season $(SEASON))
	@echo "✅ Fetch complete (local)"

fetch-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py $(if $(SEASON),--season $(SEASON))
	@echo "✅ Fetch complete (production)"

derive:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	python scripts/generate_social_images.py
	@echo "✅ Derive + Rankings + Social Images complete (local)"

social-images:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/generate_social_images.py
	@echo "✅ Social images generated (local)"

social-image-manual:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/generate_social_image_manual.py
	@echo "✅ Manual social image generated"

derive-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	ENV_FILE=.env.production python scripts/generate_social_images.py
	@echo "✅ Derive + Rankings + Social Images complete (production)"

social-images-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	ENV_FILE=.env.production python scripts/generate_social_images.py
	@echo "✅ Social images generated (production)"

pipeline:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py && \
	python scripts/fetch_advanced_extras.py && \
	python scripts/fetch_summary.py && \
	python scripts/fetch_fourfactors.py && \
	python scripts/fetch_scoring.py && \
	python scripts/fetch_starters_bench.py && \
	python scripts/fetch_playertrack.py && \
	python scripts/fetch_misc_stats.py && \
	python scripts/fetch_hustle_stats.py && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	python scripts/generate_social_images.py
	@echo "✅ Full pipeline complete (local) — all stats backfilled + rankings updated"

pipeline-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py && \
	python scripts/fetch_advanced_extras.py && \
	python scripts/fetch_summary.py && \
	python scripts/fetch_fourfactors.py && \
	python scripts/fetch_scoring.py && \
	python scripts/fetch_starters_bench.py && \
	python scripts/fetch_playertrack.py && \
	python scripts/fetch_misc_stats.py && \
	python scripts/fetch_hustle_stats.py && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py
	@$(MAKE) backup
	@echo "✅ Full pipeline complete (production) — ranked updated + backup saved"

# ── V3 backfill targets (local only — NBA API blocked from cloud IPs) ─────────
# Run these once after migration 004 to populate the 24 new columns.
# Each script uses IS NULL as a resumability guard — safe to re-run.
# Logs written to logs/backfill_*.log — tail -f logs/backfill_<name>.log to monitor.

LOGS_DIR := $(CURDIR)/logs

fetch-advanced-extras:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_advanced_extras.py 2>&1 | tee $(LOGS_DIR)/backfill_advanced.log
	@echo "✅ Advanced extras backfill complete (local)"

fetch-misc:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_misc_stats.py 2>&1 | tee $(LOGS_DIR)/backfill_misc.log
	@echo "✅ Misc stats backfill complete (local)"

fetch-hustle:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_hustle_stats.py 2>&1 | tee $(LOGS_DIR)/backfill_hustle.log
	@echo "✅ Hustle stats backfill complete (local)"

fetch-summary:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_summary.py 2>&1 | tee $(LOGS_DIR)/backfill_summary2.log
	@echo "✅ Summary (pts_from_tov) backfill complete (local)"

fetch-fourfactors:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_fourfactors.py 2>&1 | tee $(LOGS_DIR)/backfill_fourfactors.log
	@echo "✅ FourFactors backfill complete (local)"

fetch-scoring:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_scoring.py 2>&1 | tee $(LOGS_DIR)/backfill_scoring.log
	@echo "✅ Scoring breakdown backfill complete (local)"

fetch-starters-bench:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_starters_bench.py 2>&1 | tee $(LOGS_DIR)/backfill_starters_bench.log
	@echo "✅ Starters/Bench backfill complete (local)"

fetch-playertrack:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_playertrack.py 2>&1 | tee $(LOGS_DIR)/backfill_playertrack.log
	@echo "✅ PlayerTrack backfill complete (local)"

backfill:
	$(MAKE) fetch-advanced-extras
	$(MAKE) fetch-summary
	$(MAKE) fetch-misc
	$(MAKE) fetch-hustle
	@echo "✅ All backfill scripts complete — run: make derive"

# ── Migration-005 backfill: fetch missing stats from all 4 endpoints (local only) ──
# Run once after migration 005 to populate the 17 new game_stats columns.
# Each script uses IS NULL guard — safe to re-run.
backfill-missing:
	$(MAKE) fetch-advanced-extras
	$(MAKE) fetch-summary
	$(MAKE) fetch-misc
	$(MAKE) fetch-hustle
	@echo "✅ Migration-005 backfill complete — run: make derive"

# ── V3 backfill against production DB (run locally — NBA API blocked from cloud IPs) ──
# Requires DATABASE_URL to be set in backend/.env.production.
# Run after migration 004 on prod: node backend/migrations/004_add_advanced_team_metrics.js
backfill-prod:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_advanced_extras.py 2>&1 | tee $(LOGS_DIR)/backfill_prod_advanced.log
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_summary.py 2>&1 | tee $(LOGS_DIR)/backfill_prod_summary.log
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_misc_stats.py 2>&1 | tee $(LOGS_DIR)/backfill_prod_misc.log
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_hustle_stats.py 2>&1 | tee $(LOGS_DIR)/backfill_prod_hustle.log
	@echo "✅ All prod backfill scripts complete — run: make derive-prod"

# ── Run a migration against production ──────────────────────────────
# Usage: make migrate-prod MIGRATION=005_add_missing_stats
# Runs the specified migration file against DATABASE_URL.
migrate-prod:
	set -a && source backend/.env.production && set +a && \
	node backend/migrations/$(MIGRATION).js
	@echo "✅ Migration $(MIGRATION) applied to production"

# ── Check backfill progress (local or production) ─────────────────────────────
check-progress:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/check_backfill_progress.py

check-progress-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/check_backfill_progress.py

# ── Sync advanced columns local → prod (use instead of backfill-prod when local DB is already filled) ──
# Reads the 24 V3 columns directly from local game_stats and batch-UPDATEs.
# No NBA API calls — immune to rate limiting. Completes in seconds not hours.
sync-advanced-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/sync_advanced_to_prod.py
	@echo "✅ Advanced columns synced local → production"

# ── Sync migration-005 columns local → prod (use instead of backfill-missing against prod) ──
# Reads the 17 new game_stats columns from local and batch-UPDATEs.
# No NBA API calls — immune to rate limiting.
sync-missing-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/sync_missing_to_prod.py
	@echo "✅ Migration-005 columns synced local → production"

# ── Sync ALL backfilled columns local → prod (use after migration 009 to avoid NBA API) ──
# Reads all 139 backfilled game_stats columns from local and batch-UPDATEs.
# No NBA API calls — immune to rate limiting. Run after: make migrate-prod MIGRATION=009_add_remaining_team_stats
sync-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/sync_to_prod.py
	@echo "✅ All backfilled columns synced local → production"

backup:
	@mkdir -p backups
	@echo "📦 Backing up production database..."
	@set -a && source backend/.env.production && set +a && \
	OUT=backups/nba_stats_$$(date +%Y%m%d_%H%M%S).dump && \
	TMP=$$OUT.partial && \
	if pg_dump "$$DATABASE_URL" -F c -f "$$TMP" 2>backups/.pg_dump.err \
	   && [ -s "$$TMP" ] && pg_restore --list "$$TMP" >/dev/null 2>&1; then \
	  mv "$$TMP" "$$OUT" && echo "✅ Backup saved to $$OUT"; \
	else \
	  rm -f -- "$$TMP"; \
	  echo "❌ Backup FAILED — no dump written. pg_dump said:" >&2; \
	  sed -E 's#postgres(ql)?://[^ ]*#<url>#g' backups/.pg_dump.err >&2; \
	  exit 1; \
	fi

# Restores the newest backups/*.dump (or DUMP=path) into the local DB (DB_NAME from backend/.env).
# Never deletes anything: the dump is restored into a timestamped temp DB, and only if it loaded
# is the current DB renamed to <DB_NAME>_prev_<timestamp> and the temp DB renamed into place.
# Remove old copies yourself with `dropdb`. pg_restore may warn about newer pg_dump settings
# (e.g. transaction_timeout); that is tolerated, the games-table check is what gates the swap.
restore-local:
	@set -a && source backend/.env && set +a && \
	DUMP="$(or $(DUMP),$$(ls -t backups/*.dump 2>/dev/null | head -1))" && \
	{ [ -n "$$DUMP" ] && [ -f "$$DUMP" ] || { echo "❌ No dump found (run make backup or pass DUMP=path)" >&2; exit 1; }; } && \
	TS=$$(date +%Y%m%d_%H%M%S) && \
	TMPDB="$${DB_NAME}_restore_$$TS" && PREV="$${DB_NAME}_prev_$$TS" && \
	echo "📥 Restoring $$DUMP into $$TMPDB..." && \
	createdb "$$TMPDB" && \
	{ pg_restore --no-owner --no-privileges -d "$$TMPDB" "$$DUMP" 2>backups/.pg_restore.err || true; } && \
	ROWS=$$(psql -Atc "select count(*) from games" "$$TMPDB" 2>/dev/null || echo 0) && \
	if [ "$${ROWS:-0}" -gt 0 ]; then \
	  psql postgres -qc "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$$DB_NAME' and pid <> pg_backend_pid()" >/dev/null && \
	  { psql postgres -qc "alter database \"$$DB_NAME\" rename to \"$$PREV\"" 2>/dev/null && echo "📦 Previous local DB kept as $$PREV" || true; } && \
	  psql postgres -qc "alter database \"$$TMPDB\" rename to \"$$DB_NAME\"" && \
	  echo "✅ $$DB_NAME restored ($$ROWS games, newest $$(psql -Atc 'select max(game_date) from games' "$$DB_NAME"))"; \
	else \
	  echo "❌ Restore failed (no games loaded); $$DB_NAME left untouched. Leftover DB: $$TMPDB (dropdb it when done). pg_restore said:" >&2; \
	  sed -E 's#postgres(ql)?://[^ ]*#<url>#g' backups/.pg_restore.err >&2; exit 1; \
	fi

backup-clean:
	@find backups/ -name "*.dump" -mtime +7 -delete
	@echo "🧹 Backups older than 7 days removed"

archive-season:
	@echo "📦 Archiving season..."
	@source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	ARCHIVE_DIR=season_archive $(if $(SEASON),ARCHIVE_SEASON=$(SEASON)) python backend/scripts/archive_season.py
	@echo "✅ Season archive complete — CSVs + checksums in season_archive/"

logs-clean:
	@find $(LOGS_DIR) -name "pipeline_prod.log" -size +50M -delete && \
	  echo "🧹 pipeline_prod.log truncated (was over 50 MB)" || true

# ── Load Testing (k6) ────────────────────────────────────────────────────────
# Requires: k6 installed (brew install k6) and a running backend server.
# Override the target URL with: BASE_URL=https://your-server.com make k6-load

BASE_URL ?= http://localhost:5001

k6-smoke:
	BASE_URL=$(BASE_URL) k6 run load-tests/smoke.js

k6-load:
	BASE_URL=$(BASE_URL) k6 run load-tests/load.js

k6-stress:
	BASE_URL=$(BASE_URL) k6 run load-tests/stress.js

# ── Teardown ──────────────────────────────────────────────────────────────────
stop:
	brew services stop postgresql@16
