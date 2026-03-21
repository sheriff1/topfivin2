#!/usr/bin/env python3
"""
Spike: Print TEAM-LEVEL stats only from newly discovered endpoints.
Game ID: 0022501012 (LAC @ NOP, 2026-03-19)

Endpoints with useful team-level DataFrames:
  BoxScoreAdvancedV3   → DF1 (team advanced: ORTG/DRTG/eFG%/TS%/pace/PIE etc.)
  BoxScoreFourFactorsV3 → DF1 (team four factors: eFG%, FTA rate, TOV%, OREB%)
  BoxScoreHustleV2     → DF1 (team hustle: contested shots, deflections, etc.)
  BoxScoreMiscV3       → DF1 (team misc: paint pts, fast break, second chance, etc.)
  BoxScoreSummaryV3    → DF7 (team game summary: biggest lead, bench pts, etc.)

Skipped:
  BoxScoreTraditionalV3 → already in DB
  BoxScoreUsageV3       → team rows are all 1.0 (meaningless at team level)
  BoxScoreDefensiveV2   → team DF1 has only IDs + None minutes (no useful data)
  BoxScoreScoringV3     → percentage-of-percentage; low value for rankings
"""

import time
import sys

# ── Header patch ─────────────────────────────────────────────────────────────
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
    except Exception as e:
        print(f"⚠️  Header patch failed: {e}")

patch_headers()

from nba_api.stats.endpoints import (
    BoxScoreAdvancedV3,
    BoxScoreFourFactorsV3,
    BoxScoreHustleV2,
    BoxScoreMiscV3,
    BoxScoreSummaryV3,
)

GAME_ID = "0022501012"
DELAY = 1.0

# Columns to skip — identity/metadata columns not useful as stats
IDENTITY_COLS = {"gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug", "minutes"}

def fetch(name, cls, df_index, label):
    print(f"\n⏳ Fetching {name}...")
    sys.stdout.flush()
    result = cls(game_id=GAME_ID, timeout=60)
    df = result.get_data_frames()[df_index]
    return df, label

def print_team_stats(df, label, stat_cols):
    print(f"\n{'='*65}")
    print(f"  {label}")
    print(f"{'='*65}")
    teams = df["teamTricode"].tolist()
    for _, row in df.iterrows():
        team = row["teamTricode"]
        print(f"\n  {team}")
        for col in stat_cols:
            if col in row:
                val = row[col]
                print(f"    {col}: {val}")


# ── Fetch all endpoints sequentially with delays ─────────────────────────────
results = []

df_adv, lbl = fetch("BoxScoreAdvancedV3", BoxScoreAdvancedV3, 1, "BoxScoreAdvancedV3 — Team Advanced Stats")
results.append((df_adv, lbl))
time.sleep(DELAY)

df_ff, lbl = fetch("BoxScoreFourFactorsV3", BoxScoreFourFactorsV3, 1, "BoxScoreFourFactorsV3 — Team Four Factors")
results.append((df_ff, lbl))
time.sleep(DELAY)

df_hus, lbl = fetch("BoxScoreHustleV2", BoxScoreHustleV2, 1, "BoxScoreHustleV2 — Team Hustle Stats")
results.append((df_hus, lbl))
time.sleep(DELAY)

df_misc, lbl = fetch("BoxScoreMiscV3", BoxScoreMiscV3, 1, "BoxScoreMiscV3 — Team Misc Stats")
results.append((df_misc, lbl))
time.sleep(DELAY)

df_sum, lbl = fetch("BoxScoreSummaryV3", BoxScoreSummaryV3, 7, "BoxScoreSummaryV3 DF7 — Team Game Summary")
results.append((df_sum, lbl))


# ── Print team stats for each endpoint ───────────────────────────────────────
for df, label in results:
    stat_cols = [c for c in df.columns if c not in IDENTITY_COLS]
    print_team_stats(df, label, stat_cols)

print(f"\n\n{'='*65}")
print("✅ Team-level spike output complete.")
