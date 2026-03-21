#!/usr/bin/env python3
"""
Spike: Live probe of NBA API Box Score V3 endpoints for a single game.
Game ID: 0022501012

Outputs column names, DataFrame shape, and a sample row for each
result set from each endpoint. Sequential calls with polite delays
to avoid triggering stats.nba.com rate limits.

Endpoints probed:
  BoxScoreTraditionalV3  ← currently used (V2 variant) in fetch_nba_stats.py
  BoxScoreAdvancedV3     ← new
  BoxScoreFourFactorsV3  ← new
  BoxScoreHustleV2       ← new  (note: V2 — newest available)
  BoxScoreMiscV3         ← new
  BoxScoreScoringV3      ← new
  BoxScoreUsageV3        ← new
  BoxScoreDefensiveV2    ← new  (note: V2 — newest available)
  BoxScoreSummaryV3      ← already used in fetch_nba_stats.py
"""

import time
import sys

# ── Header patch (identical to fetch_nba_stats.py) ──────────────────────────
NBA_STATS_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Host": "stats.nba.com",
    "Origin": "https://www.nba.com",
    "Pragma": "no-cache",
    "Referer": "https://www.nba.com/",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
}

def patch_headers():
    try:
        from nba_api.stats.library import http as stats_http
        from nba_api.library import http as base_http
        stats_http.STATS_HEADERS = NBA_STATS_HEADERS
        stats_http.NBAStatsHTTP.headers = NBA_STATS_HEADERS
        if hasattr(stats_http.NBAStatsHTTP, '_session'):
            stats_http.NBAStatsHTTP._session = None
        if hasattr(base_http.NBAHTTP, '_session'):
            base_http.NBAHTTP._session = None
        print("✅ Headers patched\n")
    except Exception as e:
        print(f"⚠️  Header patch failed: {e}\n")

patch_headers()

# ── Now safe to import endpoints ─────────────────────────────────────────────
from nba_api.stats.endpoints import (
    BoxScoreTraditionalV3,
    BoxScoreAdvancedV3,
    BoxScoreFourFactorsV3,
    BoxScoreHustleV2,
    BoxScoreMiscV3,
    BoxScoreScoringV3,
    BoxScoreUsageV3,
    BoxScoreDefensiveV2,
    BoxScoreSummaryV3,
)

GAME_ID = "0022501012"
REQUEST_DELAY = 3.0  # seconds between calls — conservative to avoid 429s

ENDPOINTS = [
    ("BoxScoreTraditionalV3", BoxScoreTraditionalV3),
    ("BoxScoreAdvancedV3",    BoxScoreAdvancedV3),
    ("BoxScoreFourFactorsV3", BoxScoreFourFactorsV3),
    ("BoxScoreHustleV2",      BoxScoreHustleV2),
    ("BoxScoreMiscV3",        BoxScoreMiscV3),
    ("BoxScoreScoringV3",     BoxScoreScoringV3),
    ("BoxScoreUsageV3",       BoxScoreUsageV3),
    ("BoxScoreDefensiveV2",   BoxScoreDefensiveV2),
    ("BoxScoreSummaryV3",     BoxScoreSummaryV3),
]


def probe_endpoint(name, cls):
    print(f"\n{'='*70}")
    print(f"ENDPOINT: {name}  |  game_id={GAME_ID}")
    print(f"{'='*70}")
    try:
        result = cls(game_id=GAME_ID, timeout=60)
        dfs = result.get_data_frames()
        print(f"  ↳ {len(dfs)} DataFrame(s) returned")

        for i, df in enumerate(dfs):
            print(f"\n  [DataFrame {i}]  shape={df.shape}")
            print(f"  COLUMNS ({len(df.columns)}):")
            for col in df.columns:
                print(f"    - {col}")

            if not df.empty:
                print(f"\n  SAMPLE ROW (first row):")
                row = df.iloc[0].to_dict()
                for k, v in row.items():
                    print(f"    {k}: {v}")

    except Exception as e:
        print(f"  ❌ ERROR: {e}")


for i, (name, cls) in enumerate(ENDPOINTS):
    probe_endpoint(name, cls)
    if i < len(ENDPOINTS) - 1:
        print(f"\n  ⏳ Waiting {REQUEST_DELAY}s before next request...")
        sys.stdout.flush()
        time.sleep(REQUEST_DELAY)

print(f"\n\n{'='*70}")
print("✅ Spike complete.")
