#!/usr/bin/env python3
"""
Spike: Inspect NBA API endpoint signatures and result set definitions
without making any live network requests.
"""
import inspect
import nba_api.stats.endpoints as ep_module

# Endpoints to investigate for the spike
TARGET_ENDPOINTS = [
    "LeagueDashTeamStats",
    "LeagueDashPlayerStats",
    "LeagueDashTeamClutch",
    "LeagueHustleStatsTeam",
    "LeagueHustleStatsPlayer",
    "LeagueDashPtStats",
    "TeamEstimatedMetrics",
    "LeagueStandingsV3",
    "LeagueLeaders",
    "LeagueDashLineups",
    "BoxScoreAdvancedV3",
    "BoxScoreFourFactorsV3",
    "BoxScoreHustleV2",
    "BoxScoreMiscV3",
    "BoxScoreScoringV3",
    "BoxScoreUsageV3",
    "BoxScoreDefensiveV2",
    "BoxScoreSummaryV3",
    "BoxScoreTraditionalV3",
    "ShotChartLeagueWide",
    "ShotChartDetail",
    "CommonTeamRoster",
    "ScoreboardV3",
    "PlayByPlayV3",
]

for name in TARGET_ENDPOINTS:
    cls = getattr(ep_module, name, None)
    if cls is None:
        print(f"\n[MISSING] {name}")
        continue

    sig = inspect.signature(cls.__init__)
    params = [
        f"{p}={v.default!r}" if v.default is not inspect.Parameter.empty else p
        for p, v in sig.parameters.items()
        if p != "self"
    ]

    # Try to get result sets from class attribute if present
    result_sets = getattr(cls, "ResultSets", None) or getattr(cls, "result_sets", None)
    rs_names = []
    if result_sets:
        try:
            rs_names = [rs.get("name", "?") for rs in result_sets]
        except Exception:
            rs_names = ["<unable to parse>"]

    # Try nba_response attribute
    headers_attr = getattr(cls, "headers", None)

    print(f"\n{'='*65}")
    print(f"ENDPOINT: {name}")
    print(f"PARAMS ({len(params)}): {', '.join(params[:8])}{'...' if len(params) > 8 else ''}")
    if rs_names:
        print(f"RESULT SETS: {rs_names}")
