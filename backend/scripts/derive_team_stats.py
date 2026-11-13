#!/usr/bin/env python3
"""
Phase 5: Derive TEAM_STATS from GAME_STATS
- Aggregate all game stats by team
- Calculate totals and averages
- Populate TEAM_STATS table
"""
import os
import re
import psycopg2
from datetime import datetime

# ── Load .env configuration ───────────────────────────────────────────────────
def load_env():
    try:
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        key, val = line.split('=', 1)
                        os.environ.setdefault(key, val)
    except Exception as e:
        print(f"⚠️  .env load failed: {e}")

load_env()

# SQL to aggregate game_stats into team_stats. Averages skip NULLs (AVG ignores them;
# COALESCE(AVG, 0) only covers a team with no data at all); totals keep SUM(COALESCE).
INSERT_STATS_SQL = """
        INSERT INTO team_stats (
            team_id, season,
            games_played,
            fg, fga, fg_pct,
            three_p, three_pa, three_p_pct,
            ft, fta, ft_pct,
            oreb, dreb, reb,
            ast, tov, stl, blk, pf, pts,
            fg_avg, fga_avg, three_p_avg,
            reb_avg, ast_avg, tov_avg, stl_avg, blk_avg, pts_avg,
            orb_pct, drb_pct, trb_pct, ast_pct, tov_pct, usg_pct, ts_pct,
            ortg, drtg, net_rtg, efg_pct, pace, possessions, pie,
            e_ortg, e_drtg, e_net_rtg, e_pace,
            biggest_lead, bench_points, lead_changes, times_tied, biggest_scoring_run,
            pts_paint, pts_fast_break, pts_second_chance, pts_off_to,
            opp_pts_paint, opp_pts_fast_break,
            opp_pts_off_to, opp_pts_second_chance, blk_against, fouls_drawn,
            contested_shots, deflections, screen_assists, screen_assist_pts,
            box_outs, loose_balls_recovered,
            contested_shots_2pt, contested_shots_3pt, charges_drawn,
            loose_balls_off, loose_balls_def, box_outs_off, box_outs_def,
            tov_team, tov_total, reb_team,
            ast_to_tov, ast_ratio, tov_ratio,
            pace_per40, box_out_team_reb, box_out_player_reb,
            oreb_avg, dreb_avg, pf_avg, pm_avg,
            -- Starters/bench split stats (migration 007)
            starters_fg, starters_fga, starters_fg_pct,
            starters_three_p, starters_three_pa, starters_three_p_pct,
            starters_ft, starters_fta, starters_ft_pct,
            starters_oreb, starters_dreb, starters_reb,
            starters_ast, starters_stl, starters_blk, starters_tov,
            starters_pf, starters_pts, starters_pm,
            bench_fg, bench_fga, bench_fg_pct,
            bench_three_p, bench_three_pa, bench_three_p_pct,
            bench_ft, bench_fta, bench_ft_pct,
            bench_oreb, bench_dreb, bench_reb,
            bench_ast, bench_stl, bench_blk, bench_tov,
            bench_pf, bench_pts, bench_pm,
            -- Game context (migration 007)
            attendance, duration_mins,
            q1_pts, q2_pts, q3_pts, q4_pts,
            -- BoxScoreAdvancedV3 extras (migration 009)
            dreb_pct, reb_pct, e_tov_pct, e_usage_pct,
            -- BoxScoreFourFactorsV3 (migration 009)
            ft_rate, tm_tov_pct, oreb_pct, opp_efg_pct, opp_ft_rate, opp_tov_pct, opp_oreb_pct,
            -- BoxScoreSummaryV3 extra (migration 009)
            pts_from_tov,
            -- BoxScoreScoringV3 scoring % distribution (migration 009)
            pct_fga_2pt, pct_fga_3pt,
            pct_pts_2pt, pct_pts_2pt_mr, pct_pts_3pt, pct_pts_fb, pct_pts_ft, pct_pts_off_tov, pct_pts_paint,
            pct_ast_2pm, pct_uast_2pm, pct_ast_3pm, pct_uast_3pm, pct_ast_fgm, pct_uast_fgm,
            -- PlayerTrack stats (BoxScorePlayerTrackV3 - migration 009)
            distance, reb_chances_off, reb_chances_def, reb_chances_total,
            touches, secondary_ast, ft_ast, passes,
            contested_fgm, contested_fga, contested_fg_pct,
            uncontested_fgm, uncontested_fga, uncontested_fg_pct,
            dar_fgm, dar_fga, dar_fg_pct,
            -- Wins/losses (migration 011)
            wins, losses, win_pct
        )
        SELECT 
            team_id, season,
            COUNT(*) as games_played,
            SUM(COALESCE(fg, 0)) as fg,
            SUM(COALESCE(fga, 0)) as fga,
            CASE WHEN SUM(COALESCE(fga, 0)) > 0 
                 THEN ROUND(100.0 * SUM(COALESCE(fg, 0)) / SUM(COALESCE(fga, 0)), 1)
                 ELSE 0 END as fg_pct,
            SUM(COALESCE(three_p, 0)) as three_p,
            SUM(COALESCE(three_pa, 0)) as three_pa,
            CASE WHEN SUM(COALESCE(three_pa, 0)) > 0
                 THEN ROUND(100.0 * SUM(COALESCE(three_p, 0)) / SUM(COALESCE(three_pa, 0)), 1)
                 ELSE 0 END as three_p_pct,
            SUM(COALESCE(ft, 0)) as ft,
            SUM(COALESCE(fta, 0)) as fta,
            CASE WHEN SUM(COALESCE(fta, 0)) > 0
                 THEN ROUND(100.0 * SUM(COALESCE(ft, 0)) / SUM(COALESCE(fta, 0)), 1)
                 ELSE 0 END as ft_pct,
            SUM(COALESCE(oreb, 0)) as oreb,
            SUM(COALESCE(dreb, 0)) as dreb,
            SUM(COALESCE(reb, 0)) as reb,
            SUM(COALESCE(ast, 0)) as ast,
            SUM(COALESCE(tov, 0)) as tov,
            SUM(COALESCE(stl, 0)) as stl,
            SUM(COALESCE(blk, 0)) as blk,
            SUM(COALESCE(pf, 0)) as pf,
            SUM(COALESCE(pts, 0)) as pts,
            ROUND(COALESCE(AVG(fg), 0)::numeric, 1) as fg_avg,
            ROUND(COALESCE(AVG(fga), 0)::numeric, 1) as fga_avg,
            ROUND(COALESCE(AVG(three_p), 0)::numeric, 1) as three_p_avg,
            ROUND(COALESCE(AVG(reb), 0)::numeric, 1) as reb_avg,
            ROUND(COALESCE(AVG(ast), 0)::numeric, 1) as ast_avg,
            ROUND(COALESCE(AVG(tov), 0)::numeric, 1) as tov_avg,
            ROUND(COALESCE(AVG(stl), 0)::numeric, 1) as stl_avg,
            ROUND(COALESCE(AVG(blk), 0)::numeric, 1) as blk_avg,
            ROUND(COALESCE(AVG(pts), 0)::numeric, 1) as pts_avg,
            ROUND(COALESCE(AVG(orb_pct), 0)::numeric, 4) as orb_pct,
            ROUND(COALESCE(AVG(drb_pct), 0)::numeric, 4) as drb_pct,
            ROUND(COALESCE(AVG(trb_pct), 0)::numeric, 4) as trb_pct,
            ROUND(COALESCE(AVG(ast_pct), 0)::numeric, 4) as ast_pct,
            ROUND(COALESCE(AVG(tov_pct), 0)::numeric, 1) as tov_pct,
            ROUND(COALESCE(AVG(usg_pct), 0)::numeric, 4) as usg_pct,
            ROUND(COALESCE(AVG(ts_pct), 0)::numeric, 4) as ts_pct,
            -- BoxScoreAdvancedV3 extras
            ROUND(COALESCE(AVG(ortg), 0)::numeric, 4) as ortg,
            ROUND(COALESCE(AVG(drtg), 0)::numeric, 4) as drtg,
            ROUND(COALESCE(AVG(net_rtg), 0)::numeric, 4) as net_rtg,
            ROUND(COALESCE(AVG(efg_pct), 0)::numeric, 4) as efg_pct,
            ROUND(COALESCE(AVG(pace), 0)::numeric, 4) as pace,
            ROUND(COALESCE(AVG(possessions), 0)::numeric, 4) as possessions,
            ROUND(COALESCE(AVG(pie), 0)::numeric, 4) as pie,
            -- BoxScoreAdvancedV3 estimated variants (migration 008)
            ROUND(COALESCE(AVG(e_ortg), 0)::numeric, 4) as e_ortg,
            ROUND(COALESCE(AVG(e_drtg), 0)::numeric, 4) as e_drtg,
            ROUND(COALESCE(AVG(e_net_rtg), 0)::numeric, 4) as e_net_rtg,
            ROUND(COALESCE(AVG(e_pace), 0)::numeric, 4) as e_pace,
            -- BoxScoreSummaryV3 DF7 extras
            ROUND(COALESCE(AVG(biggest_lead), 0)::numeric, 1) as biggest_lead,
            ROUND(COALESCE(AVG(bench_points), 0)::numeric, 1) as bench_points,
            ROUND(COALESCE(AVG(lead_changes), 0)::numeric, 1) as lead_changes,
            ROUND(COALESCE(AVG(times_tied), 0)::numeric, 1) as times_tied,
            ROUND(COALESCE(AVG(biggest_scoring_run), 0)::numeric, 1) as biggest_scoring_run,
            -- BoxScoreMiscV3
            ROUND(COALESCE(AVG(pts_paint), 0)::numeric, 1) as pts_paint,
            ROUND(COALESCE(AVG(pts_fast_break), 0)::numeric, 1) as pts_fast_break,
            ROUND(COALESCE(AVG(pts_second_chance), 0)::numeric, 1) as pts_second_chance,
            ROUND(COALESCE(AVG(pts_off_to), 0)::numeric, 1) as pts_off_to,
            ROUND(COALESCE(AVG(opp_pts_paint), 0)::numeric, 1) as opp_pts_paint,
            ROUND(COALESCE(AVG(opp_pts_fast_break), 0)::numeric, 1) as opp_pts_fast_break,
            -- BoxScoreMiscV3 new extras
            ROUND(COALESCE(AVG(opp_pts_off_to), 0)::numeric, 1) as opp_pts_off_to,
            ROUND(COALESCE(AVG(opp_pts_second_chance), 0)::numeric, 1) as opp_pts_second_chance,
            ROUND(COALESCE(AVG(blk_against), 0)::numeric, 1) as blk_against,
            ROUND(COALESCE(AVG(fouls_drawn), 0)::numeric, 1) as fouls_drawn,
            -- BoxScoreHustleV2
            ROUND(COALESCE(AVG(contested_shots), 0)::numeric, 1) as contested_shots,
            ROUND(COALESCE(AVG(deflections), 0)::numeric, 1) as deflections,
            ROUND(COALESCE(AVG(screen_assists), 0)::numeric, 1) as screen_assists,
            ROUND(COALESCE(AVG(screen_assist_pts), 0)::numeric, 1) as screen_assist_pts,
            ROUND(COALESCE(AVG(box_outs), 0)::numeric, 1) as box_outs,
            ROUND(COALESCE(AVG(loose_balls_recovered), 0)::numeric, 1) as loose_balls_recovered,
            -- BoxScoreHustleV2 new extras
            ROUND(COALESCE(AVG(contested_shots_2pt), 0)::numeric, 1) as contested_shots_2pt,
            ROUND(COALESCE(AVG(contested_shots_3pt), 0)::numeric, 1) as contested_shots_3pt,
            ROUND(COALESCE(AVG(charges_drawn), 0)::numeric, 1) as charges_drawn,
            ROUND(COALESCE(AVG(loose_balls_off), 0)::numeric, 1) as loose_balls_off,
            ROUND(COALESCE(AVG(loose_balls_def), 0)::numeric, 1) as loose_balls_def,
            ROUND(COALESCE(AVG(box_outs_off), 0)::numeric, 1) as box_outs_off,
            ROUND(COALESCE(AVG(box_outs_def), 0)::numeric, 1) as box_outs_def,
            -- BoxScoreSummaryV3 new extras
            ROUND(COALESCE(AVG(tov_team), 0)::numeric, 1) as tov_team,
            ROUND(COALESCE(AVG(tov_total), 0)::numeric, 1) as tov_total,
            ROUND(COALESCE(AVG(reb_team), 0)::numeric, 1) as reb_team,
            -- BoxScoreAdvancedV3 new extras
            ROUND(COALESCE(AVG(ast_to_tov), 0)::numeric, 4) as ast_to_tov,
            ROUND(COALESCE(AVG(ast_ratio), 0)::numeric, 4) as ast_ratio,
            ROUND(COALESCE(AVG(tov_ratio), 0)::numeric, 4) as tov_ratio,
            ROUND(COALESCE(AVG(pace_per40), 0)::numeric, 4) as pace_per40,
            ROUND(COALESCE(AVG(box_out_team_reb), 0)::numeric, 1) as box_out_team_reb,
            ROUND(COALESCE(AVG(box_out_player_reb), 0)::numeric, 1) as box_out_player_reb,
            -- Per-game averages for traditional counting stats
            ROUND(COALESCE(AVG(oreb), 0)::numeric, 1) as oreb_avg,
            ROUND(COALESCE(AVG(dreb), 0)::numeric, 1) as dreb_avg,
            ROUND(COALESCE(AVG(pf), 0)::numeric, 1) as pf_avg,
            ROUND(COALESCE(AVG(plus_minus), 0)::numeric, 1) as pm_avg,
            -- Starters/bench split stats
            ROUND(COALESCE(AVG(starters_fg), 0)::numeric, 1)   as starters_fg,
            ROUND(COALESCE(AVG(starters_fga), 0)::numeric, 1)  as starters_fga,
            CASE WHEN SUM(COALESCE(starters_fga, 0)) > 0
                 THEN ROUND(100.0 * SUM(COALESCE(starters_fg, 0)) / SUM(COALESCE(starters_fga, 0)), 1)
                 ELSE 0 END as starters_fg_pct,
            ROUND(COALESCE(AVG(starters_three_p), 0)::numeric, 1)  as starters_three_p,
            ROUND(COALESCE(AVG(starters_three_pa), 0)::numeric, 1) as starters_three_pa,
            CASE WHEN SUM(COALESCE(starters_three_pa, 0)) > 0
                 THEN ROUND(100.0 * SUM(COALESCE(starters_three_p, 0)) / SUM(COALESCE(starters_three_pa, 0)), 1)
                 ELSE 0 END as starters_three_p_pct,
            ROUND(COALESCE(AVG(starters_ft), 0)::numeric, 1)   as starters_ft,
            ROUND(COALESCE(AVG(starters_fta), 0)::numeric, 1)  as starters_fta,
            CASE WHEN SUM(COALESCE(starters_fta, 0)) > 0
                 THEN ROUND(100.0 * SUM(COALESCE(starters_ft, 0)) / SUM(COALESCE(starters_fta, 0)), 1)
                 ELSE 0 END as starters_ft_pct,
            ROUND(COALESCE(AVG(starters_oreb), 0)::numeric, 1) as starters_oreb,
            ROUND(COALESCE(AVG(starters_dreb), 0)::numeric, 1) as starters_dreb,
            ROUND(COALESCE(AVG(starters_reb), 0)::numeric, 1)  as starters_reb,
            ROUND(COALESCE(AVG(starters_ast), 0)::numeric, 1)  as starters_ast,
            ROUND(COALESCE(AVG(starters_stl), 0)::numeric, 1)  as starters_stl,
            ROUND(COALESCE(AVG(starters_blk), 0)::numeric, 1)  as starters_blk,
            ROUND(COALESCE(AVG(starters_tov), 0)::numeric, 1)  as starters_tov,
            ROUND(COALESCE(AVG(starters_pf), 0)::numeric, 1)   as starters_pf,
            ROUND(COALESCE(AVG(starters_pts), 0)::numeric, 1)  as starters_pts,
            ROUND(COALESCE(AVG(starters_pm), 0)::numeric, 1)   as starters_pm,
            ROUND(COALESCE(AVG(bench_fg), 0)::numeric, 1)      as bench_fg,
            ROUND(COALESCE(AVG(bench_fga), 0)::numeric, 1)     as bench_fga,
            CASE WHEN SUM(COALESCE(bench_fga, 0)) > 0
                 THEN ROUND(100.0 * SUM(COALESCE(bench_fg, 0)) / SUM(COALESCE(bench_fga, 0)), 1)
                 ELSE 0 END as bench_fg_pct,
            ROUND(COALESCE(AVG(bench_three_p), 0)::numeric, 1)  as bench_three_p,
            ROUND(COALESCE(AVG(bench_three_pa), 0)::numeric, 1) as bench_three_pa,
            CASE WHEN SUM(COALESCE(bench_three_pa, 0)) > 0
                 THEN ROUND(100.0 * SUM(COALESCE(bench_three_p, 0)) / SUM(COALESCE(bench_three_pa, 0)), 1)
                 ELSE 0 END as bench_three_p_pct,
            ROUND(COALESCE(AVG(bench_ft), 0)::numeric, 1)      as bench_ft,
            ROUND(COALESCE(AVG(bench_fta), 0)::numeric, 1)     as bench_fta,
            CASE WHEN SUM(COALESCE(bench_fta, 0)) > 0
                 THEN ROUND(100.0 * SUM(COALESCE(bench_ft, 0)) / SUM(COALESCE(bench_fta, 0)), 1)
                 ELSE 0 END as bench_ft_pct,
            ROUND(COALESCE(AVG(bench_oreb), 0)::numeric, 1)    as bench_oreb,
            ROUND(COALESCE(AVG(bench_dreb), 0)::numeric, 1)    as bench_dreb,
            ROUND(COALESCE(AVG(bench_reb), 0)::numeric, 1)     as bench_reb,
            ROUND(COALESCE(AVG(bench_ast), 0)::numeric, 1)     as bench_ast,
            ROUND(COALESCE(AVG(bench_stl), 0)::numeric, 1)     as bench_stl,
            ROUND(COALESCE(AVG(bench_blk), 0)::numeric, 1)     as bench_blk,
            ROUND(COALESCE(AVG(bench_tov), 0)::numeric, 1)     as bench_tov,
            ROUND(COALESCE(AVG(bench_pf), 0)::numeric, 1)      as bench_pf,
            ROUND(COALESCE(AVG(bench_pts), 0)::numeric, 1)     as bench_pts,
            ROUND(COALESCE(AVG(bench_pm), 0)::numeric, 1)      as bench_pm,
            -- Game context
            ROUND(COALESCE(AVG(attendance), 0)::numeric, 0)    as attendance,
            ROUND(COALESCE(AVG(duration_mins), 0)::numeric, 2) as duration_mins,
            ROUND(COALESCE(AVG(q1_pts), 0)::numeric, 1)        as q1_pts,
            ROUND(COALESCE(AVG(q2_pts), 0)::numeric, 1)        as q2_pts,
            ROUND(COALESCE(AVG(q3_pts), 0)::numeric, 1)        as q3_pts,
            ROUND(COALESCE(AVG(q4_pts), 0)::numeric, 1)        as q4_pts,
            -- BoxScoreAdvancedV3 extras (migration 009)
            ROUND(COALESCE(AVG(dreb_pct), 0)::numeric, 4)      as dreb_pct,
            ROUND(COALESCE(AVG(reb_pct), 0)::numeric, 4)       as reb_pct,
            ROUND(COALESCE(AVG(e_tov_pct), 0)::numeric, 1)     as e_tov_pct,
            ROUND(COALESCE(AVG(e_usage_pct), 0)::numeric, 4)   as e_usage_pct,
            -- BoxScoreFourFactorsV3 (migration 009)
            ROUND(COALESCE(AVG(ft_rate), 0)::numeric, 4)       as ft_rate,
            ROUND(COALESCE(AVG(tm_tov_pct), 0)::numeric, 1)    as tm_tov_pct,
            ROUND(COALESCE(AVG(oreb_pct), 0)::numeric, 4)      as oreb_pct,
            ROUND(COALESCE(AVG(opp_efg_pct), 0)::numeric, 4)   as opp_efg_pct,
            ROUND(COALESCE(AVG(opp_ft_rate), 0)::numeric, 4)   as opp_ft_rate,
            ROUND(COALESCE(AVG(opp_tov_pct), 0)::numeric, 1)   as opp_tov_pct,
            ROUND(COALESCE(AVG(opp_oreb_pct), 0)::numeric, 4)  as opp_oreb_pct,
            -- BoxScoreSummaryV3 extra (migration 009)
            ROUND(COALESCE(AVG(pts_from_tov), 0)::numeric, 1)  as pts_from_tov,
            -- BoxScoreScoringV3 scoring % distribution (migration 009)
            ROUND(COALESCE(AVG(pct_fga_2pt), 0)::numeric, 4)   as pct_fga_2pt,
            ROUND(COALESCE(AVG(pct_fga_3pt), 0)::numeric, 4)   as pct_fga_3pt,
            ROUND(COALESCE(AVG(pct_pts_2pt), 0)::numeric, 4)   as pct_pts_2pt,
            ROUND(COALESCE(AVG(pct_pts_2pt_mr), 0)::numeric, 4) as pct_pts_2pt_mr,
            ROUND(COALESCE(AVG(pct_pts_3pt), 0)::numeric, 4)   as pct_pts_3pt,
            ROUND(COALESCE(AVG(pct_pts_fb), 0)::numeric, 4)    as pct_pts_fb,
            ROUND(COALESCE(AVG(pct_pts_ft), 0)::numeric, 4)    as pct_pts_ft,
            ROUND(COALESCE(AVG(pct_pts_off_tov), 0)::numeric, 4) as pct_pts_off_tov,
            ROUND(COALESCE(AVG(pct_pts_paint), 0)::numeric, 4) as pct_pts_paint,
            ROUND(COALESCE(AVG(pct_ast_2pm), 0)::numeric, 4)   as pct_ast_2pm,
            ROUND(COALESCE(AVG(pct_uast_2pm), 0)::numeric, 4)  as pct_uast_2pm,
            ROUND(COALESCE(AVG(pct_ast_3pm), 0)::numeric, 4)   as pct_ast_3pm,
            ROUND(COALESCE(AVG(pct_uast_3pm), 0)::numeric, 4)  as pct_uast_3pm,
            ROUND(COALESCE(AVG(pct_ast_fgm), 0)::numeric, 4)   as pct_ast_fgm,
            ROUND(COALESCE(AVG(pct_uast_fgm), 0)::numeric, 4)  as pct_uast_fgm,
            -- PlayerTrack stats aggregations
            ROUND(COALESCE(AVG(distance), 0)::numeric, 2)      as distance,
            ROUND(COALESCE(AVG(reb_chances_off), 0)::numeric, 1) as reb_chances_off,
            ROUND(COALESCE(AVG(reb_chances_def), 0)::numeric, 1) as reb_chances_def,
            ROUND(COALESCE(AVG(reb_chances_total), 0)::numeric, 1) as reb_chances_total,
            ROUND(COALESCE(AVG(touches), 0)::numeric, 1)       as touches,
            ROUND(COALESCE(AVG(secondary_ast), 0)::numeric, 1) as secondary_ast,
            ROUND(COALESCE(AVG(ft_ast), 0)::numeric, 1)        as ft_ast,
            ROUND(COALESCE(AVG(passes), 0)::numeric, 1)        as passes,
            ROUND(COALESCE(AVG(contested_fgm), 0)::numeric, 1) as contested_fgm,
            ROUND(COALESCE(AVG(contested_fga), 0)::numeric, 1) as contested_fga,
            ROUND(COALESCE(AVG(contested_fg_pct), 0)::numeric, 3) as contested_fg_pct,
            ROUND(COALESCE(AVG(uncontested_fgm), 0)::numeric, 1) as uncontested_fgm,
            ROUND(COALESCE(AVG(uncontested_fga), 0)::numeric, 1) as uncontested_fga,
            ROUND(COALESCE(AVG(uncontested_fg_pct), 0)::numeric, 3) as uncontested_fg_pct,
            ROUND(COALESCE(AVG(dar_fgm), 0)::numeric, 1)       as dar_fgm,
            ROUND(COALESCE(AVG(dar_fga), 0)::numeric, 1)       as dar_fga,
            ROUND(COALESCE(AVG(dar_fg_pct), 0)::numeric, 3)    as dar_fg_pct,
            -- Wins/losses derived from game_stats.win column
            SUM(COALESCE(win, 0))                               as wins,
            COUNT(*) - SUM(COALESCE(win, 0))                    as losses,
            ROUND(SUM(COALESCE(win, 0))::numeric / NULLIF(COUNT(*), 0), 3) as win_pct
        FROM game_stats
        GROUP BY team_id, season
        ON CONFLICT (team_id, season) DO UPDATE SET
            games_played = EXCLUDED.games_played,
            fg = EXCLUDED.fg,
            fga = EXCLUDED.fga,
            fg_pct = EXCLUDED.fg_pct,
            three_p = EXCLUDED.three_p,
            three_pa = EXCLUDED.three_pa,
            three_p_pct = EXCLUDED.three_p_pct,
            ft = EXCLUDED.ft,
            fta = EXCLUDED.fta,
            ft_pct = EXCLUDED.ft_pct,
            oreb = EXCLUDED.oreb,
            dreb = EXCLUDED.dreb,
            reb = EXCLUDED.reb,
            ast = EXCLUDED.ast,
            tov = EXCLUDED.tov,
            stl = EXCLUDED.stl,
            blk = EXCLUDED.blk,
            pf = EXCLUDED.pf,
            pts = EXCLUDED.pts,
            fg_avg = EXCLUDED.fg_avg,
            fga_avg = EXCLUDED.fga_avg,
            three_p_avg = EXCLUDED.three_p_avg,
            reb_avg = EXCLUDED.reb_avg,
            ast_avg = EXCLUDED.ast_avg,
            tov_avg = EXCLUDED.tov_avg,
            stl_avg = EXCLUDED.stl_avg,
            blk_avg = EXCLUDED.blk_avg,
            pts_avg = EXCLUDED.pts_avg,
            orb_pct = EXCLUDED.orb_pct,
            drb_pct = EXCLUDED.drb_pct,
            trb_pct = EXCLUDED.trb_pct,
            ast_pct = EXCLUDED.ast_pct,
            tov_pct = EXCLUDED.tov_pct,
            usg_pct = EXCLUDED.usg_pct,
            ts_pct = EXCLUDED.ts_pct,
            ortg = EXCLUDED.ortg,
            drtg = EXCLUDED.drtg,
            net_rtg = EXCLUDED.net_rtg,
            efg_pct = EXCLUDED.efg_pct,
            pace = EXCLUDED.pace,
            possessions = EXCLUDED.possessions,
            pie = EXCLUDED.pie,
            e_ortg = EXCLUDED.e_ortg,
            e_drtg = EXCLUDED.e_drtg,
            e_net_rtg = EXCLUDED.e_net_rtg,
            e_pace = EXCLUDED.e_pace,
            biggest_lead = EXCLUDED.biggest_lead,
            bench_points = EXCLUDED.bench_points,
            lead_changes = EXCLUDED.lead_changes,
            times_tied = EXCLUDED.times_tied,
            biggest_scoring_run = EXCLUDED.biggest_scoring_run,
            pts_paint = EXCLUDED.pts_paint,
            pts_fast_break = EXCLUDED.pts_fast_break,
            pts_second_chance = EXCLUDED.pts_second_chance,
            pts_off_to = EXCLUDED.pts_off_to,
            opp_pts_paint = EXCLUDED.opp_pts_paint,
            opp_pts_fast_break = EXCLUDED.opp_pts_fast_break,
            opp_pts_off_to = EXCLUDED.opp_pts_off_to,
            opp_pts_second_chance = EXCLUDED.opp_pts_second_chance,
            blk_against = EXCLUDED.blk_against,
            fouls_drawn = EXCLUDED.fouls_drawn,
            contested_shots = EXCLUDED.contested_shots,
            deflections = EXCLUDED.deflections,
            screen_assists = EXCLUDED.screen_assists,
            screen_assist_pts = EXCLUDED.screen_assist_pts,
            box_outs = EXCLUDED.box_outs,
            loose_balls_recovered = EXCLUDED.loose_balls_recovered,
            contested_shots_2pt = EXCLUDED.contested_shots_2pt,
            contested_shots_3pt = EXCLUDED.contested_shots_3pt,
            charges_drawn = EXCLUDED.charges_drawn,
            loose_balls_off = EXCLUDED.loose_balls_off,
            loose_balls_def = EXCLUDED.loose_balls_def,
            box_outs_off = EXCLUDED.box_outs_off,
            box_outs_def = EXCLUDED.box_outs_def,
            tov_team = EXCLUDED.tov_team,
            tov_total = EXCLUDED.tov_total,
            reb_team = EXCLUDED.reb_team,
            ast_to_tov = EXCLUDED.ast_to_tov,
            ast_ratio = EXCLUDED.ast_ratio,
            tov_ratio = EXCLUDED.tov_ratio,
            pace_per40 = EXCLUDED.pace_per40,
            box_out_team_reb = EXCLUDED.box_out_team_reb,
            box_out_player_reb = EXCLUDED.box_out_player_reb,
            oreb_avg = EXCLUDED.oreb_avg,
            dreb_avg = EXCLUDED.dreb_avg,
            pf_avg = EXCLUDED.pf_avg,
            pm_avg = EXCLUDED.pm_avg,
            starters_fg = EXCLUDED.starters_fg,
            starters_fga = EXCLUDED.starters_fga,
            starters_fg_pct = EXCLUDED.starters_fg_pct,
            starters_three_p = EXCLUDED.starters_three_p,
            starters_three_pa = EXCLUDED.starters_three_pa,
            starters_three_p_pct = EXCLUDED.starters_three_p_pct,
            starters_ft = EXCLUDED.starters_ft,
            starters_fta = EXCLUDED.starters_fta,
            starters_ft_pct = EXCLUDED.starters_ft_pct,
            starters_oreb = EXCLUDED.starters_oreb,
            starters_dreb = EXCLUDED.starters_dreb,
            starters_reb = EXCLUDED.starters_reb,
            starters_ast = EXCLUDED.starters_ast,
            starters_stl = EXCLUDED.starters_stl,
            starters_blk = EXCLUDED.starters_blk,
            starters_tov = EXCLUDED.starters_tov,
            starters_pf = EXCLUDED.starters_pf,
            starters_pts = EXCLUDED.starters_pts,
            starters_pm = EXCLUDED.starters_pm,
            bench_fg = EXCLUDED.bench_fg,
            bench_fga = EXCLUDED.bench_fga,
            bench_fg_pct = EXCLUDED.bench_fg_pct,
            bench_three_p = EXCLUDED.bench_three_p,
            bench_three_pa = EXCLUDED.bench_three_pa,
            bench_three_p_pct = EXCLUDED.bench_three_p_pct,
            bench_ft = EXCLUDED.bench_ft,
            bench_fta = EXCLUDED.bench_fta,
            bench_ft_pct = EXCLUDED.bench_ft_pct,
            bench_oreb = EXCLUDED.bench_oreb,
            bench_dreb = EXCLUDED.bench_dreb,
            bench_reb = EXCLUDED.bench_reb,
            bench_ast = EXCLUDED.bench_ast,
            bench_stl = EXCLUDED.bench_stl,
            bench_blk = EXCLUDED.bench_blk,
            bench_tov = EXCLUDED.bench_tov,
            bench_pf = EXCLUDED.bench_pf,
            bench_pts = EXCLUDED.bench_pts,
            bench_pm = EXCLUDED.bench_pm,
            attendance = EXCLUDED.attendance,
            duration_mins = EXCLUDED.duration_mins,
            q1_pts = EXCLUDED.q1_pts,
            q2_pts = EXCLUDED.q2_pts,
            q3_pts = EXCLUDED.q3_pts,
            q4_pts = EXCLUDED.q4_pts,
            dreb_pct = EXCLUDED.dreb_pct,
            reb_pct = EXCLUDED.reb_pct,
            e_tov_pct = EXCLUDED.e_tov_pct,
            e_usage_pct = EXCLUDED.e_usage_pct,
            ft_rate = EXCLUDED.ft_rate,
            tm_tov_pct = EXCLUDED.tm_tov_pct,
            oreb_pct = EXCLUDED.oreb_pct,
            opp_efg_pct = EXCLUDED.opp_efg_pct,
            opp_ft_rate = EXCLUDED.opp_ft_rate,
            opp_tov_pct = EXCLUDED.opp_tov_pct,
            opp_oreb_pct = EXCLUDED.opp_oreb_pct,
            pts_from_tov = EXCLUDED.pts_from_tov,
            pct_fga_2pt = EXCLUDED.pct_fga_2pt,
            pct_fga_3pt = EXCLUDED.pct_fga_3pt,
            pct_pts_2pt = EXCLUDED.pct_pts_2pt,
            pct_pts_2pt_mr = EXCLUDED.pct_pts_2pt_mr,
            pct_pts_3pt = EXCLUDED.pct_pts_3pt,
            pct_pts_fb = EXCLUDED.pct_pts_fb,
            pct_pts_ft = EXCLUDED.pct_pts_ft,
            pct_pts_off_tov = EXCLUDED.pct_pts_off_tov,
            pct_pts_paint = EXCLUDED.pct_pts_paint,
            pct_ast_2pm = EXCLUDED.pct_ast_2pm,
            pct_uast_2pm = EXCLUDED.pct_uast_2pm,
            pct_ast_3pm = EXCLUDED.pct_ast_3pm,
            pct_uast_3pm = EXCLUDED.pct_uast_3pm,
            pct_ast_fgm = EXCLUDED.pct_ast_fgm,
            pct_uast_fgm = EXCLUDED.pct_uast_fgm,
            distance = EXCLUDED.distance,
            reb_chances_off = EXCLUDED.reb_chances_off,
            reb_chances_def = EXCLUDED.reb_chances_def,
            reb_chances_total = EXCLUDED.reb_chances_total,
            touches = EXCLUDED.touches,
            secondary_ast = EXCLUDED.secondary_ast,
            ft_ast = EXCLUDED.ft_ast,
            passes = EXCLUDED.passes,
            contested_fgm = EXCLUDED.contested_fgm,
            contested_fga = EXCLUDED.contested_fga,
            contested_fg_pct = EXCLUDED.contested_fg_pct,
            uncontested_fgm = EXCLUDED.uncontested_fgm,
            uncontested_fga = EXCLUDED.uncontested_fga,
            uncontested_fg_pct = EXCLUDED.uncontested_fg_pct,
            dar_fgm = EXCLUDED.dar_fgm,
            dar_fga = EXCLUDED.dar_fga,
            dar_fg_pct = EXCLUDED.dar_fg_pct,
            wins = EXCLUDED.wins,
            losses = EXCLUDED.losses,
            win_pct = EXCLUDED.win_pct,
            updated_at = CURRENT_TIMESTAMP
"""


def derive_team_stats():
    """Derive aggregated team stats from game stats"""
    print("\n" + "=" * 60)
    print("PHASE 5: DERIVE TEAM_STATS FROM GAME_STATS")
    print("=" * 60)
    
    database_url = os.getenv('DATABASE_URL', '')
    if database_url:
        conn = psycopg2.connect(database_url)
    else:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'nba_stats'),
        )
    cursor = conn.cursor()
    
    # Debug: Print database host being used
    if database_url:
        match = re.search(r'@([^:/]+)', database_url)
        db_host = match.group(1) if match else 'unknown'
        print(f"  🔌 Connecting to database: {db_host}")
    
    try:
        print("\n🔄 Deriving team stats from game stats...")
        
        
        # Precompute win column: 1 if team scored more than opponent in same game
        update_wins_sql = """
        UPDATE game_stats gs1
        SET win = CASE WHEN gs1.pts > gs2.pts THEN 1 ELSE 0 END
        FROM game_stats gs2
        WHERE gs1.game_id = gs2.game_id
          AND gs1.team_id != gs2.team_id
          AND gs1.pts IS NOT NULL
          AND gs2.pts IS NOT NULL
        """
        cursor.execute(update_wins_sql)
        conn.commit()
        cursor.execute("SELECT COUNT(*) FROM game_stats WHERE win IS NOT NULL")
        win_count = cursor.fetchone()[0]
        print(f"  ✓ Precomputed win column for {win_count} game rows")

        cursor.execute(INSERT_STATS_SQL)
        conn.commit()
        
        # Verify results
        cursor.execute("SELECT COUNT(*) FROM team_stats")
        count = cursor.fetchone()[0]
        print(f"  ✓ Created/updated {count} team_stats records")
        
        # Count games in database
        cursor.execute("SELECT COUNT(*) FROM games")
        games_count = cursor.fetchone()[0]
        print(f"  📊 Total games in database: {games_count}")
        
        # Show sample
        cursor.execute("SELECT MAX(season) FROM team_stats")
        sample_season = cursor.fetchone()[0]
        print(f"\n📋 Sample TEAM_STATS (season {sample_season}, top 5 by PPG):")
        cursor.execute("""
            SELECT ts.team_id, t.team_name, ts.games_played, ts.pts_avg, ts.reb_avg, ts.ast_avg, ts.fg_pct, ts.three_p_pct, ts.ft_pct
            FROM team_stats ts
            JOIN teams t ON t.team_id = ts.team_id
            WHERE ts.season = %s
            ORDER BY ts.pts_avg DESC
            LIMIT 5
        """, (sample_season,))
        
        for team_id, team_name, games, ppg, rpg, apg, fg_pct, three_p_pct, ft_pct in cursor.fetchall():
            print(f"  {team_name}: {games} games | {ppg:.1f} PPG, {rpg:.1f} RPG, {apg:.1f} APG | {fg_pct:.1f}% FG, {three_p_pct:.1f}% 3P, {ft_pct:.1f}% FT")
        
        print(f"\n✅ TEAM_STATS derivation complete!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        conn.rollback()
        raise
    
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    derive_team_stats()
