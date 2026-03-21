# Spike: NBA API Box Score V3 Endpoint Findings

**Branch:** `spike/nba-api-v3-endpoints`  
**Game used for all live probes:** `0022501012` (LAC @ NOP, Final 106–105, 2026-03-19)  
**Status:** All 9 endpoints returned data successfully. No rate-limit errors.

---

## TL;DR — What's New vs. What We Already Use

| Endpoint                | Already Used?         | DataFrames | Key New Data                                                        |
| ----------------------- | --------------------- | ---------- | ------------------------------------------------------------------- |
| `BoxScoreTraditionalV3` | ✅ (via V2 currently) | 3          | Starters/bench split now in DF1                                     |
| `BoxScoreAdvancedV3`    | ❌                    | 2          | ORTG/DRTG/NET_RTG, eFG%, TS%, PIE, PACE, possessions                |
| `BoxScoreFourFactorsV3` | ❌                    | 2          | Dean Oliver four factors per player + opponent versions             |
| `BoxScoreHustleV2`      | ❌                    | 2          | Contested shots, deflections, charges, screen assists, box outs     |
| `BoxScoreMiscV3`        | ❌                    | 2          | Points off turnovers, second chance, fast break, paint — per player |
| `BoxScoreScoringV3`     | ❌                    | 2          | Scoring distribution %, assisted vs. unassisted %                   |
| `BoxScoreUsageV3`       | ❌                    | 2          | Player share of every team counting stat                            |
| `BoxScoreDefensiveV2`   | ❌                    | 2          | Matchup-level defense: FG% allowed, switches, partial possessions   |
| `BoxScoreSummaryV3`     | ✅                    | 9          | Already used; DF7 team game summary is the richest                  |

---

## Endpoint Details

### BoxScoreTraditionalV3 ✅ (currently used as V2 in `fetch_nba_stats.py`)

**3 DataFrames:**

- **DF0** — Player stats (26 rows × 34 cols)  
  `FGM, FGA, FG%, 3PM, 3PA, 3P%, FTM, FTA, FT%, OREB, DREB, REB, AST, STL, BLK, TOV, PF, PTS, plusMinusPoints`  
  _Same stat set we already collect. V3 column names are camelCase vs. V2 snake_case._

- **DF1** — Starters-vs-bench split (4 rows × 26 cols) — **NEW split not in V2**  
  One row per team per group. `startersBench` column = `"Starters"` or `"Bench"`.

- **DF2** — Team totals (2 rows × 26 cols)  
  `FGM, FGA, FG%, 3PM, …, PTS, plusMinusPoints` aggregated for each team.

**Migration note:** Current code already calls `BoxScoreTraditionalV3` in `fetch_nba_stats.py` (the import is there). V2 to V3 differences are cosmetic (camelCase keys, extra DF1 split).

---

### BoxScoreAdvancedV3 ❌ NEW

**2 DataFrames:**

- **DF0** — Player advanced (26 rows × 37 cols)

```
estimatedOffensiveRating, offensiveRating,
estimatedDefensiveRating, defensiveRating,
estimatedNetRating, netRating,
assistPercentage, assistToTurnover, assistRatio,
offensiveReboundPercentage, defensiveReboundPercentage, reboundPercentage,
turnoverRatio,
effectiveFieldGoalPercentage, trueShootingPercentage,
usagePercentage, estimatedUsagePercentage,
estimatedPace, pace, pacePer40,
possessions, PIE
```

- **DF1** — Team advanced (2 rows × 30 cols)  
  Same columns + `estimatedTeamTurnoverPercentage`, minus player identity cols.

**Sample values (Derrick Jones Jr., LAC, 33:39 min):**

```
offensiveRating: 108.6 | defensiveRating: 116.2 | netRating: -7.6
eFG%: 0.682 | TS%: 0.781 | USG%: 0.20 | PIE: 0.157 | pace: 98.42
```

**Recommendation: HIGH PRIORITY.** This is the single most impactful new endpoint. Every advanced stats ranking we could want is here — ORTG, DRTG, NET_RTG, eFG%, TS%, PIE. Currently we derive nothing like this.

---

### BoxScoreFourFactorsV3 ❌ NEW

**2 DataFrames:**

- **DF0** — Player four factors (26 rows × 23 cols)

```
effectiveFieldGoalPercentage, freeThrowAttemptRate, teamTurnoverPercentage,
offensiveReboundPercentage,
oppEffectiveFieldGoalPercentage, oppFreeThrowAttemptRate,
oppTeamTurnoverPercentage, oppOffensiveReboundPercentage
```

- **DF1** — Team four factors (2 rows × 15 cols) — same, no player ID cols

**Sample values (NOP team):**

```
eFG%: 0.558 | FTA_rate: 0.282 | TOV%: 0.163 | OREB%: 0.220
opp eFG%: 0.526 | opp FTA_rate: 0.421 | opp TOV%: 0.165 | opp OREB%: 0.229
```

**Recommendation: MEDIUM.** The "opponent" versions are interesting for defensive efficiency at the team level. Most of the player-level data overlaps with AdvancedV3. Best used for team-level stats derivation.

---

### BoxScoreHustleV2 ❌ NEW

**2 DataFrames:**

- **DF0** — Player hustle (18 rows × 31 cols — _only active players, no DNPs_)

```
contestedShots, contestedShots2pt, contestedShots3pt,
deflections, chargesDrawn,
screenAssists, screenAssistPoints,
looseBallsRecoveredOffensive, looseBallsRecoveredDefensive, looseBallsRecoveredTotal,
offensiveBoxOuts, defensiveBoxOuts,
boxOutPlayerTeamRebounds, boxOutPlayerRebounds, boxOuts
```

- **DF1** — Team hustle (2 rows × 23 cols)

**Sample values (NOP team totals):**

```
contestedShots: 34 (2pt: 20, 3pt: 14) | deflections: 22 | chargesDrawn: 0
screenAssists: 3 | screenAssistPoints: 7 | looseBallsTotal: 10 | boxOuts: 7
```

**Recommendation: HIGH PRIORITY.** First completely new stat category. Contested shots, deflections, and screen assists have no equivalent anywhere in the current DB. These map directly to new ranking dimensions (Best Defenders, Best Screeners, Disruptors).

**Note:** Only 18 player rows vs. 26 in other endpoints — players who didn't play are excluded (not just DNP-CD). This means JOIN logic differs from other box score endpoints.

---

### BoxScoreMiscV3 ❌ NEW

**2 DataFrames:**

- **DF0** — Player misc (26 rows × 27 cols)

```
pointsOffTurnovers, pointsSecondChance, pointsFastBreak, pointsPaint,
oppPointsOffTurnovers, oppPointsSecondChance, oppPointsFastBreak, oppPointsPaint,
blocks, blocksAgainst, foulsPersonal, foulsDrawn
```

- **DF1** — Team misc (2 rows × 19 cols)

**Sample values (NOP team):**

```
pointsOffTurnovers: 11 | secondChance: 6 | fastBreak: 0 | paint: 44
opp pointsOffTurnovers: 13 | opp secondChance: 10 | opp fastBreak: 8 | opp paint: 46
blocks: 2 | foulsPersonal: 19 | foulsDrawn: 21
```

**Recommendation: MEDIUM-HIGH.** Paint points, fast break points, and points off turnovers are intuitive for fans and currently missing from the DB. Opponent paint/fast break are good for defensive rankings.

---

### BoxScoreScoringV3 ❌ NEW

**2 DataFrames:**

- **DF0** — Player scoring breakdown (26 rows × 30 cols)

```
percentageFieldGoalsAttempted2pt, percentageFieldGoalsAttempted3pt,
percentagePoints2pt, percentagePointsMidrange2pt, percentagePoints3pt,
percentagePointsFastBreak, percentagePointsFreeThrow,
percentagePointsOffTurnovers, percentagePointsPaint,
percentageAssisted2pt, percentageUnassisted2pt,
percentageAssisted3pt, percentageUnassisted3pt,
percentageAssistedFGM, percentageUnassistedFGM
```

- **DF1** — Team scoring (2 rows × 22 cols)

**Sample values (NOP team):**

```
%FGA 2pt: 56.4% | %FGA 3pt: 43.6%
%pts from 2pt: 45.7% | %pts from 3pt: 37.1% | %pts from FT: 17.1%
%pts from paint: 41.9% | %pts from fast break: 0%
%assisted FGM: 56.8% | %unassisted FGM: 43.2%
```

**Recommendation: LOW-MEDIUM.** High-context data for shot profile analysis, but mostly percentage-of-percentage columns. More useful for visualization (shot charts, style profiles) than raw rankings. Interesting for "Team Playstyle" features down the line.

---

### BoxScoreUsageV3 ❌ NEW

**2 DataFrames:**

- **DF0** — Player usage share (26 rows × 33 cols)

```
usagePercentage,
percentageFieldGoalsMade, percentageFieldGoalsAttempted,
percentageThreePointersMade, percentageThreePointersAttempted,
percentageFreeThrowsMade, percentageFreeThrowsAttempted,
percentageReboundsOffensive, percentageReboundsDefensive, percentageReboundsTotal,
percentageAssists, percentageTurnovers, percentageSteals,
percentageBlocks, percentageBlocksAllowed,
percentagePersonalFouls, percentagePersonalFoulsDrawn, percentagePoints
```

- **DF1** — Team usage — _all values are 1.0 (meaningless at team level)_

**Note:** This is useful for understanding load distribution within a roster (who takes what share of the team's shots, rebounds, assists). Interesting at the player level but not for team rankings.

**Recommendation: LOW for current sprint.** Player-share stats require a player DB that doesn't exist yet.

---

### BoxScoreDefensiveV2 ❌ NEW

**2 DataFrames:**

- **DF0** — Player defensive matchups (18 rows × 29 cols — _active players only_)

```
matchupMinutes, partialPossessions, switchesOn,
playerPoints,           ← points scored *against* this defender
defensiveRebounds,
matchupAssists, matchupTurnovers, steals, blocks,
matchupFieldGoalsMade, matchupFieldGoalsAttempted, matchupFieldGoalPercentage,
matchupThreePointersMade, matchupThreePointersAttempted, matchupThreePointerPercentage
```

- **DF1** — Team (2 rows × 7 cols — only IDs + `minutes: None` — **no useful stats**)

**Sample values (Derrick Jones Jr., 13:33 matchup min):**

```
partialPossessions: 64.1 | switchesOn: 0 | playerPoints: 8 (allowed)
matchupFGM: 3 / matchupFGA: 3 → matchupFG%: 1.000
matchupFG%3pt: 1/1 → 100%
```

**Recommendation: HIGH PRIORITY for defensive features.** This is 1-on-1 matchup defense data. FG% allowed per defender, switches tracked, partial possessions. First-of-its-kind for this project. Enables "Best Defenders" rankings with real on-ball data. Caveat: 18 rows (not 26) — only players who actually logged matchup time.

---

### BoxScoreSummaryV3 ✅ (already used)

**9 DataFrames — full breakdown:**

| DF  | Shape | Contents                                                                                                                                                                      |
| --- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | 1×13  | Game metadata: code, status, period, clock, UTC time, team IDs, duration, attendance                                                                                          |
| 1   | 1×4   | Same game info (redundant with DF0)                                                                                                                                           |
| 2   | 1×7   | Arena: name, city, state, country, timezone                                                                                                                                   |
| 3   | 3×7   | Officials/referees: name, jersey number — **3 officials for this game**                                                                                                       |
| 4   | 2×13  | Team line scores: per-period scores, final score, W/L record                                                                                                                  |
| 5   | 10×6  | Leaders (likely, data not fully captured in spike)                                                                                                                            |
| 6   | 5×20  | Last 5 games for each team: scores, records — **recent form context**                                                                                                         |
| 7   | 2×26  | Team game summary (rich): pts, reb, ast, stl, blk, to, FG%, 3P%, FT%, paint pts, second chance, fast break, biggest lead, lead changes, times tied, biggest run, bench points |
| 8   | 1×7   | Availability flags: video, pt tracking, hustle, historical status                                                                                                             |

**DF7 columns of note not currently stored:**

```
biggestLead, leadChanges, timesTied, biggestScoringRun, benchPoints,
pointsInThePaint, pointsSecondChance, pointsFastBreak
```

---

## Extraction Plan: Recommended New Stat Columns

Based on what the endpoints actually return, here's a proposed priority order for new DB columns:

### Tier 1 — Implement next (high signal, low complexity)

**From `BoxScoreAdvancedV3`** (team-level, per game, aggregate to season):

- `ortg` (offensiveRating)
- `drtg` (defensiveRating)
- `net_rtg` (netRating)
- `efg_pct` (effectiveFieldGoalPercentage)
- `ts_pct` (trueShootingPercentage)
- `pace`
- `pie` (Player Impact Estimate — player level only, semantics differ at team level)

**From `BoxScoreMiscV3`** (team-level):

- `pts_off_to` (pointsOffTurnovers)
- `pts_second_chance` (pointsSecondChance)
- `pts_fast_break` (pointsFastBreak)
- `pts_paint` (pointsPaint)

**From `BoxScoreSummaryV3` DF7** (already called — just extract more columns):

- `biggest_lead`, `lead_changes`, `times_tied`, `biggest_scoring_run`, `bench_points`

### Tier 2 — Next sprint

**From `BoxScoreHustleV2`** (team-level, new table):

- `contested_shots`, `deflections`, `charges_drawn`, `screen_assists`, `box_outs`

**From `BoxScoreDefensiveV2`** (player-level, new table):

- `matchup_fg_pct`, `matchup_minutes`, `switches_on`, `player_points_allowed`

### Tier 3 — Future / visualization features

- `BoxScoreScoringV3` — shot profile percentages (useful for visual team identity pages)
- `BoxScoreUsageV3` — player load sharing (requires player DB first)
- `BoxScoreFourFactorsV3` — mostly covered by AdvancedV3 + MiscV3 combined

---

## Implementation Notes

1. **Sequential calls per game** — each game now requires up to 4 endpoints instead of 2. With 3s delay and ~1230 games/season, full season fetch time increases from ~1hr to ~3hrs. Consider batching async or reducing delay to 1.5s (V3 endpoints appear more reliable than V2).

2. **Row count mismatch warning** — `BoxScoreHustleV2` and `BoxScoreDefensiveV2` return 18 rows (active-only) vs. the standard 26 (all-rostered). JOINs need to use LEFT JOIN, not INNER JOIN.

3. **Column naming** — V3 endpoints use camelCase. Current DB snake_case columns. Transform layer needed in `fetch_nba_stats.py` → `derive_team_stats.py` pipeline.

4. **`BoxScoreDefensiveV2` DF1 is useless** — team-level defensive DF returns only IDs + `None` for minutes. Skip it; only aggregate from player rows.

5. **`BoxScoreTraditionalV3` has V3 available** — `fetch_nba_stats.py` already imports `boxscoretraditionalv3` but uses V2 for actual calls. This is a one-line cleanup.
