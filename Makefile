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
pipeline:
	source .venv/bin/activate && \
	cd backend && \
	python scripts/fetch_nba_stats.py && \
	python scripts/derive_team_stats.py && \
	python scripts/derive_rankings.py && \
	redis-cli FLUSHDB
	@echo "✅ Pipeline complete — rankings updated"

# ── Teardown ──────────────────────────────────────────────────────────────────
stop:
	brew services stop postgresql@16
	brew services stop redis
