.PHONY: dev backend frontend services stop pipeline pipeline-prod fetch fetch-prod derive derive-prod backup backup-clean archive-season k6-smoke k6-load k6-stress fetch-advanced-extras fetch-summary-extras fetch-misc fetch-hustle backfill backfill-prod sync-advanced-prod install-cron uninstall-cron logs-clean

# ── Infrastructure ───────────────────────────────────────────────────────────
services:
	brew services start postgresql@16
	brew services start redis

# ── Application ──────────────────────────────────────────────────────────────
dev:
	$(MAKE) services
	cd backend && npm run dev &
	cd frontend && pnpm dev

backend:
	cd backend && npm run dev

frontend:
	cd frontend && pnpm dev

# ── Data pipeline ─────────────────────────────────────────────────────────────
# Local targets (fetch, derive, pipeline) use backend/.env → localhost postgres
# Production targets (fetch-prod, derive-prod, pipeline-prod) use backend/.env.production → Railway# pipeline-prod: fetch → backfill (4 V3 scripts, IS NULL guard) → derive → rankings → backup# backup / backup-clean always target production

fetch:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py
	@echo "✅ Fetch complete (local)"

fetch-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py
	@echo "✅ Fetch complete (production)"

derive:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	redis-cli FLUSHDB
	@echo "✅ Derive + Rankings complete (local)"

derive-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	redis-cli FLUSHDB
	@echo "✅ Derive + Rankings complete (production)"

pipeline:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	redis-cli FLUSHDB
	@echo "✅ Full pipeline complete (local) — rankings updated"

pipeline-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py && \
	python scripts/fetch_advanced_extras.py && \
	python scripts/fetch_summary_extras.py && \
	python scripts/fetch_misc_stats.py && \
	python scripts/fetch_hustle_stats.py && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	redis-cli FLUSHDB
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

fetch-summary-extras:
	mkdir -p $(LOGS_DIR)
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_summary_extras.py 2>&1 | tee $(LOGS_DIR)/backfill_summary.log
	@echo "✅ Summary extras backfill complete (local)"

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

backfill:
	$(MAKE) fetch-advanced-extras
	$(MAKE) fetch-summary-extras
	$(MAKE) fetch-misc
	$(MAKE) fetch-hustle
	@echo "✅ All backfill scripts complete — run: make derive"

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
	python scripts/fetch_summary_extras.py 2>&1 | tee $(LOGS_DIR)/backfill_prod_summary.log
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_misc_stats.py 2>&1 | tee $(LOGS_DIR)/backfill_prod_misc.log
	source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/fetch_hustle_stats.py 2>&1 | tee $(LOGS_DIR)/backfill_prod_hustle.log
	@echo "✅ All prod backfill scripts complete — run: make derive-prod"

# ── Sync advanced columns local → prod (use instead of backfill-prod when local DB is already filled) ──
# Reads the 24 V3 columns directly from local game_stats and batch-UPDATEs Railway.
# No NBA API calls — immune to rate limiting. Completes in seconds not hours.
sync-advanced-prod:
	source .venv/bin/activate && \
	set -a && source backend/.env && source backend/.env.production && set +a && \
	cd backend && \
	python scripts/sync_advanced_to_prod.py
	@echo "✅ Advanced columns synced local → production"

backup:
	@mkdir -p backups
	@echo "📦 Backing up production database..."
	@set -a && source backend/.env.production && set +a && \
	pg_dump $$DATABASE_URL -F c -f backups/nba_stats_$$(date +%Y%m%d_%H%M%S).dump \
	&& echo "✅ Backup saved to backups/" \
	|| echo "⚠️  Local pg_dump skipped (version mismatch with Railway PostgreSQL 18). Backups run automatically via GitHub Actions weekly."

backup-clean:
	@find backups/ -name "*.dump" -mtime +7 -delete
	@echo "🧹 Backups older than 7 days removed"

archive-season:
	@echo "📦 Archiving season..."
	@source .venv/bin/activate && \
	set -a && source backend/.env.production && set +a && \
	ARCHIVE_DIR=season_archive python backend/scripts/archive_season.py
	@echo "✅ Season archive complete — CSVs + checksums in season_archive/"

# ── Automation (launchd) ─────────────────────────────────────────────────────
# install-cron installs a macOS launchd job that runs make pipeline-prod daily
# at 09:00 UTC — one hour before the GitHub Actions derive job (10:00 UTC).
# Prerequisite: backend/.env.production and .venv must already exist.
# Monitor: tail -f logs/pipeline_prod.log

install-cron:
	mkdir -p $(LOGS_DIR)
	sed 's|__REPO_DIR__|$(CURDIR)|g' launchd/com.topfivin2.pipeline.plist \
	  > $(HOME)/Library/LaunchAgents/com.topfivin2.pipeline.plist
	launchctl load $(HOME)/Library/LaunchAgents/com.topfivin2.pipeline.plist
	@echo "✅ launchd job installed — runs make pipeline-prod daily at 09:00 UTC"
	@echo "   Monitor: tail -f $(LOGS_DIR)/pipeline_prod.log"

uninstall-cron:
	-launchctl unload $(HOME)/Library/LaunchAgents/com.topfivin2.pipeline.plist
	-rm -f $(HOME)/Library/LaunchAgents/com.topfivin2.pipeline.plist
	@echo "🗑️  launchd job removed"

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
	brew services stop redis
