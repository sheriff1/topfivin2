.PHONY: backend frontend services stop pipeline

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
	@echo "✅ Full pipeline complete — rankings updated"

# ── Teardown ──────────────────────────────────────────────────────────────────
stop:
	brew services stop postgresql@16
	brew services stop redis
