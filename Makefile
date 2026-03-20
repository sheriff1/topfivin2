.PHONY: backend frontend services stop pipeline backup backup-clean k6-smoke k6-load k6-stress

# ── Infrastructure ───────────────────────────────────────────────────────────
services:
	brew services start postgresql@16
	brew services start redis

# ── Application ──────────────────────────────────────────────────────────────
backend:
	cd backend && npm run dev

frontend:
	cd frontend && pnpm dev

# ── Data pipeline ─────────────────────────────────────────────────────────────
# Note: fetch now runs locally via cron to bypass NBA IP blocks
# Use 'make fetch' for manual NBA data fetch only
# Use 'make derive' for derive+rank steps (runs automatically in CI/CD)

fetch:
	source .venv/bin/activate && \
	set -a && source backend/.env && set +a && \
	cd backend && \
	python scripts/fetch_nba_stats.py
	@echo "✅ Fetch complete"

derive:
	source .venv/bin/activate && \
	source backend/.env && \
	cd backend && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	redis-cli FLUSHDB
	@echo "✅ Derive + Rankings complete"

pipeline:
	source .venv/bin/activate && \
	source backend/.env && \
	cd backend && \
	python scripts/fetch_nba_stats.py && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	redis-cli FLUSHDB
	@$(MAKE) backup
	@echo "✅ Full pipeline complete — rankings updated + backup saved"

backup:
	@mkdir -p backups
	@echo "📦 Backing up production database..."
	@set -a && source backend/.env && set +a && \
	pg_dump $$DATABASE_URL -F c -f backups/nba_stats_$$(date +%Y%m%d_%H%M%S).dump
	@echo "✅ Backup saved to backups/"

backup-clean:
	@find backups/ -name "*.dump" -mtime +7 -delete
	@echo "🧹 Backups older than 7 days removed"

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
