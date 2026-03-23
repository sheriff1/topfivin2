#!/usr/bin/env python3
"""
Chain runner: waits for fetch_advanced_extras to finish, then runs:
  fetch_summary → fetch_fourfactors → fetch_scoring → fetch_playertrack → make derive
"""
import time
import psycopg2
import subprocess
import sys
import os

ROOT = "/Users/sheriffjolaoso/Documents/dev/topfivin2"
ENV_FILE = os.path.join(ROOT, "backend", ".env")


def load_dotenv(path):
    """Load key=value pairs from a .env file into os.environ (skip comments/blanks)."""
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())
    except FileNotFoundError:
        pass


load_dotenv(ENV_FILE)


def connect():
    url = os.getenv("DATABASE_URL", "")
    if url:
        return psycopg2.connect(url)
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        user=os.getenv("DB_USER", "sheriffjolaoso"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "nba_stats"),
    )


def null_count(col):
    conn = connect()
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM game_stats WHERE {col} IS NULL")
    n = cur.fetchone()[0]
    conn.close()
    return n


SCRIPTS = [
    ("fetch_summary",     "pts_from_tov", f"{ROOT}/backend/scripts/fetch_summary.py"),
    ("fetch_fourfactors", "ft_rate",       f"{ROOT}/backend/scripts/fetch_fourfactors.py"),
    ("fetch_scoring",     "pct_fga_2pt",   f"{ROOT}/backend/scripts/fetch_scoring.py"),
    ("fetch_playertrack", "distance",      f"{ROOT}/backend/scripts/fetch_playertrack.py"),
]

# ── Step 1: wait for background fetch_advanced_extras to finish ─────────────
# Proceed when NULL count reaches 0, OR when it has been stable (unchanged)
# for 3 consecutive polls (meaning background script finished/skipped those rows).
print("⏳ Waiting for fetch_advanced_extras.py (background) to complete...")
print("   Polling every 60s — proceeds when dreb_pct NULL count is 0 or stable for 3 polls", flush=True)
prev_remaining = None
stable_streak = 0
STABLE_THRESHOLD = 3
while True:
    remaining = null_count("dreb_pct")
    ts = time.strftime('%H:%M:%S')
    print(f"   [{ts}] dreb_pct NULL remaining: {remaining}", flush=True)
    if remaining == 0:
        print("✅ fetch_advanced_extras done (all filled)!\n", flush=True)
        break
    if remaining == prev_remaining:
        stable_streak += 1
        print(f"   ↳ stable for {stable_streak}/{STABLE_THRESHOLD} polls", flush=True)
        if stable_streak >= STABLE_THRESHOLD:
            print(f"✅ fetch_advanced_extras done ({remaining} rows permanently skipped — bad data).\n", flush=True)
            break
    else:
        stable_streak = 0
    prev_remaining = remaining
    time.sleep(60)

# ── Step 2: run each subsequent script sequentially ─────────────────────────
for name, guard_col, script in SCRIPTS:
    before = null_count(guard_col)
    print(f"\n{'='*60}", flush=True)
    print(f"▶  Starting {name}  ({before} games need {guard_col})", flush=True)
    print(f"{'='*60}", flush=True)

    result = subprocess.run(
        [sys.executable, script],
        env=os.environ.copy(),
        cwd=ROOT
    )
    if result.returncode != 0:
        print(f"\n❌ {name} exited with code {result.returncode} — stopping chain.")
        sys.exit(result.returncode)

    after = null_count(guard_col)
    print(f"\n✅ {name} complete  ({guard_col} NULL: {before} → {after})", flush=True)

# ── Step 3: make derive ──────────────────────────────────────────────────────
print(f"\n{'='*60}", flush=True)
print("▶  Running make derive...", flush=True)
print(f"{'='*60}", flush=True)
result = subprocess.run(
    ["make", "derive"],
    cwd=ROOT,
    env=os.environ.copy()
)
if result.returncode != 0:
    print(f"\n❌ make derive failed with code {result.returncode}")
    sys.exit(result.returncode)

print("\n🏆 All done! Run 'make dev' to verify in the browser.", flush=True)
