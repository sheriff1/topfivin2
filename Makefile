.PHONY: backend frontend services stop pipeline pipeline-prod fetch fetch-prod derive derive-prod backup backup-clean k6-smoke k6-load k6-stress

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
# Local targets (fetch, derive, pipeline) use backend/.env → localhost postgres
# Production targets (fetch-prod, derive-prod, pipeline-prod) use backend/.env.production → Railway
# backup / backup-clean always target production

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
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	redis-cli FLUSHDB
	@$(MAKE) backup
	@echo "✅ Full pipeline complete (production) — rankings updated + backup saved"

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
