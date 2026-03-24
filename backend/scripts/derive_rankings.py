#!/usr/bin/env python3
"""
Phase 6: Derive STAT_RANKINGS from TEAM_STATS
- Calculate rankings for 15 stat categories
- Traditional: PPG, RPG, APG, FG%, 3P%, FT%, SPG, BPG
- Advanced: TS%, ORB%, DRB%, TRB%, AST%, USG%, TOV%
- Store in STAT_RANKINGS table with rank 1-30
- Clear Redis cache after rankings are updated
"""
import os
import psycopg2
import redis
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

# Define the stat categories to rank (traditional + advanced)
STAT_CATEGORIES = [
    # Traditional Stats
    ('PPG', 'pts_avg', 'DESC'),        # Points Per Game - higher is better
    ('RPG', 'reb_avg', 'DESC'),        # Rebounds Per Game - higher is better
    ('APG', 'ast_avg', 'DESC'),        # Assists Per Game - higher is better
    ('FG%', 'fg_pct', 'DESC'),         # Field Goal % - higher is better
    ('3P%', 'three_p_pct', 'DESC'),    # 3-Point % - higher is better
    ('FT%', 'ft_pct', 'DESC'),         # Free Throw % - higher is better
    ('SPG', 'stl_avg', 'DESC'),        # Steals Per Game - higher is better
    ('BPG', 'blk_avg', 'DESC'),        # Blocks Per Game - higher is better
    
    # Advanced Stats
    ('TS%', 'ts_pct', 'DESC'),         # True Shooting % - higher is better
    ('ORB%', 'orb_pct', 'DESC'),       # Offensive Rebound % - higher is better
    ('DRB%', 'drb_pct', 'DESC'),       # Defensive Rebound % - higher is better
    ('TRB%', 'trb_pct', 'DESC'),       # Total Rebound % - higher is better
    ('AST%', 'ast_pct', 'DESC'),       # Assist % - higher is better  
    ('USG%', 'usg_pct', 'DESC'),       # Usage % - higher is better
    ('TOV%', 'tov_pct', 'ASC'),        # Turnover % - lower is better

    # V3 Advanced extras (OffRtg / DefRtg / Net)
    ('ORTG',     'ortg',               'DESC'),  # Offensive Rating - higher is better
    ('DRTG',     'drtg',               'ASC'),   # Defensive Rating - lower is better
    ('NET_RTG',  'net_rtg',            'DESC'),  # Net Rating - higher is better
    ('EFG%',     'efg_pct',            'DESC'),  # Effective FG% - higher is better
    ('PACE',     'pace',               'DESC'),  # Pace - higher is better

    # Misc scoring breakdown
    ('PTS_PAINT', 'pts_paint',         'DESC'),  # Points in Paint - higher is better
    ('OPP_PAINT', 'opp_pts_paint',     'ASC'),   # Opp Points in Paint - lower is better
    ('FAST_BRK',  'pts_fast_break',    'DESC'),  # Fast Break Points - higher is better
    ('OPP_FBRK',  'opp_pts_fast_break','ASC'),   # Opp Fast Break Pts - lower is better

    # Hustle stats
    ('DEFLECT',   'deflections',       'DESC'),  # Deflections - higher is better
    ('CONTESTED', 'contested_shots',   'DESC'),  # Contested Shots - higher is better
    ('SCR_AST',   'screen_assists',    'DESC'),  # Screen Assists - higher is better
    ('CONTESTED_2PT', 'contested_shots_2pt', 'DESC'),  # Contested 2PT shots - higher is better
    ('CONTESTED_3PT', 'contested_shots_3pt', 'DESC'),  # Contested 3PT shots - higher is better
    ('CHARGES',   'charges_drawn',     'DESC'),  # Charges Drawn - higher is better
    ('BOX_OUTS',  'box_outs',          'DESC'),  # Box Outs - higher is better

    # Misc new extras
    ('OPP_PTS_OFF_TO',  'opp_pts_off_to',       'ASC'),   # Opp Pts Off Turnovers - lower is better
    ('OPP_2ND_CHC',     'opp_pts_second_chance', 'ASC'),   # Opp 2nd Chance Pts - lower is better
    ('BLK_AGT',         'blk_against',           'ASC'),   # Blocks Against - lower is better
    ('FOULS_DRAWN',     'fouls_drawn',            'DESC'),  # Fouls Drawn - higher is better

    # Advanced new extras
    ('AST_TOV',       'ast_to_tov',        'DESC'),  # Assist-to-Turnover ratio - higher is better
    ('PACE40',        'pace_per40',        'DESC'),  # Pace per 40 min - higher is better
    ('BOX_OUT_TREB',  'box_out_team_reb',  'DESC'),  # Box Out Team Rebounds - higher is better
    ('BOX_OUT_PREB',  'box_out_player_reb','DESC'),  # Box Out Player Rebounds - higher is better

    # Traditional per-game averages (not yet exposed)
    ('ORPG',    'oreb_avg',    'DESC'),  # Offensive Rebounds Per Game - higher is better
    ('DRPG',    'dreb_avg',    'DESC'),  # Defensive Rebounds Per Game - higher is better
    ('TPG',     'tov_avg',     'ASC'),   # Turnovers Per Game - lower is better
    ('PFPG',    'pf_avg',      'ASC'),   # Personal Fouls Per Game - lower is better
    ('PM',      'pm_avg',      'DESC'),  # Plus/Minus Per Game - higher is better
    ('FG_PG',   'fg_avg',      'DESC'),  # Field Goals Made Per Game - higher is better
    ('FGA_PG',  'fga_avg',     'DESC'),  # Field Goal Attempts Per Game - higher is better
    ('THREE_PG','three_p_avg', 'DESC'),  # 3-Pointers Made Per Game - higher is better

    # BoxScoreAdvancedV3 extras
    ('POSS',      'possessions',  'DESC'),  # Possessions Per Game - higher is better
    ('PIE',       'pie',          'DESC'),  # Player Impact Estimate - higher is better
    ('AST_RATIO', 'ast_ratio',    'DESC'),  # Assist Ratio - higher is better
    ('TOV_RATIO', 'tov_ratio',    'ASC'),   # Turnover Ratio - lower is better

    # BoxScoreSummaryV3 extras
    ('BIG_LEAD',   'biggest_lead',        'DESC'),  # Biggest Lead (avg) - higher is better
    ('LEAD_CHG',   'lead_changes',        'DESC'),  # Lead Changes Per Game - higher is better
    ('TIMES_TIED', 'times_tied',          'DESC'),  # Times Tied Per Game
    ('BIG_RUN',    'biggest_scoring_run', 'DESC'),  # Biggest Scoring Run (avg) - higher is better
    ('TOV_TEAM',   'tov_team',            'ASC'),   # Team Turnovers Per Game - lower is better
    ('TOV_TOTAL',  'tov_total',           'ASC'),   # Total Turnovers Per Game - lower is better
    ('REB_TEAM',   'reb_team',            'DESC'),  # Team Rebounds Per Game - higher is better

    # BoxScoreMiscV3 extras
    ('PTS_2ND_CHC', 'pts_second_chance', 'DESC'),  # 2nd Chance Points - higher is better
    ('PTS_OFF_TO',  'pts_off_to',        'DESC'),  # Points Off Turnovers - higher is better

    # BoxScoreHustleV2 extras
    ('SCR_AST_PTS',  'screen_assist_pts',    'DESC'),  # Screen Assist Points - higher is better
    ('LOOSE_BALLS',  'loose_balls_recovered', 'DESC'),  # Loose Balls Recovered - higher is better
    ('LOOSE_BALLS_O','loose_balls_off',       'DESC'),  # Offensive Loose Balls - higher is better
    ('LOOSE_BALLS_D','loose_balls_def',       'DESC'),  # Defensive Loose Balls - higher is better
    ('BOX_OUTS_O',  'box_outs_off',          'DESC'),  # Offensive Box Outs - higher is better
    ('BOX_OUTS_D',  'box_outs_def',          'DESC'),  # Defensive Box Outs - higher is better

    # Starters group stats (BoxScoreTraditionalV3 DF1)
    ('STARTERS_PPG',   'starters_pts',         'DESC'),  # Starter Points Per Game - higher is better
    ('STARTERS_RPG',   'starters_reb',         'DESC'),  # Starter Rebounds Per Game - higher is better
    ('STARTERS_APG',   'starters_ast',         'DESC'),  # Starter Assists Per Game - higher is better
    ('STARTERS_SPG',   'starters_stl',         'DESC'),  # Starter Steals Per Game - higher is better
    ('STARTERS_BPG',   'starters_blk',         'DESC'),  # Starter Blocks Per Game - higher is better
    ('STARTERS_FG%',   'starters_fg_pct',      'DESC'),  # Starter FG% - higher is better
    ('STARTERS_3P%',   'starters_three_p_pct', 'DESC'),  # Starter 3P% - higher is better
    ('STARTERS_FT%',   'starters_ft_pct',      'DESC'),  # Starter FT% - higher is better
    ('STARTERS_FG',    'starters_fg',          'DESC'),  # Starter FG Made Per Game - higher is better
    ('STARTERS_FGA',   'starters_fga',         'DESC'),  # Starter FGA Per Game - higher is better
    ('STARTERS_3P',    'starters_three_p',     'DESC'),  # Starter 3P Made Per Game - higher is better
    ('STARTERS_3PA',   'starters_three_pa',    'DESC'),  # Starter 3PA Per Game - higher is better
    ('STARTERS_OREB',  'starters_oreb',        'DESC'),  # Starter OffReb Per Game - higher is better
    ('STARTERS_DREB',  'starters_dreb',        'DESC'),  # Starter DefReb Per Game - higher is better
    ('STARTERS_FT',    'starters_ft',          'DESC'),  # Starter FT Made Per Game - higher is better
    ('STARTERS_FTA',   'starters_fta',         'DESC'),  # Starter FTA Per Game - higher is better
    ('STARTERS_TOV',   'starters_tov',         'ASC'),   # Starter Turnovers Per Game - lower is better
    ('STARTERS_PF',    'starters_pf',          'ASC'),   # Starter Fouls Per Game - lower is better

    # Bench group stats (BoxScoreTraditionalV3 DF1)
    ('BENCH_PPG',   'bench_pts',         'DESC'),  # Bench Points Per Game - higher is better
    ('BENCH_RPG',   'bench_reb',         'DESC'),  # Bench Rebounds Per Game - higher is better
    ('BENCH_APG',   'bench_ast',         'DESC'),  # Bench Assists Per Game - higher is better
    ('BENCH_SPG',   'bench_stl',         'DESC'),  # Bench Steals Per Game - higher is better
    ('BENCH_BPG',   'bench_blk',         'DESC'),  # Bench Blocks Per Game - higher is better
    ('BENCH_FG%',   'bench_fg_pct',      'DESC'),  # Bench FG% - higher is better
    ('BENCH_3P%',   'bench_three_p_pct', 'DESC'),  # Bench 3P% - higher is better
    ('BENCH_FT%',   'bench_ft_pct',      'DESC'),  # Bench FT% - higher is better
    ('BENCH_FG',    'bench_fg',          'DESC'),  # Bench FG Made Per Game - higher is better
    ('BENCH_FGA',   'bench_fga',         'DESC'),  # Bench FGA Per Game - higher is better
    ('BENCH_3P',    'bench_three_p',     'DESC'),  # Bench 3P Made Per Game - higher is better
    ('BENCH_3PA',   'bench_three_pa',    'DESC'),  # Bench 3PA Per Game - higher is better
    ('BENCH_OREB',  'bench_oreb',        'DESC'),  # Bench OffReb Per Game - higher is better
    ('BENCH_DREB',  'bench_dreb',        'DESC'),  # Bench DefReb Per Game - higher is better
    ('BENCH_FT',    'bench_ft',          'DESC'),  # Bench FT Made Per Game - higher is better
    ('BENCH_FTA',   'bench_fta',         'DESC'),  # Bench FTA Per Game - higher is better
    ('BENCH_TOV',   'bench_tov',         'ASC'),   # Bench Turnovers Per Game - lower is better
    ('BENCH_PF',    'bench_pf',          'ASC'),   # Bench Fouls Per Game - lower is better

    # Game context stats (BoxScoreSummaryV3 DF0 + DF4)
    ('ATTEND',    'attendance',    'DESC'),  # Average Attendance - higher is better (curiosity)
    ('DURATION',  'duration_mins', 'DESC'),  # Average Game Duration - higher is better
    ('Q1_PTS',    'q1_pts',        'DESC'),  # Q1 Points Per Game - higher is better
    ('Q2_PTS',    'q2_pts',        'DESC'),  # Q2 Points Per Game - higher is better
    ('Q3_PTS',    'q3_pts',        'DESC'),  # Q3 Points Per Game - higher is better
    ('Q4_PTS',    'q4_pts',        'DESC'),  # Q4 Points Per Game - higher is better

    # Estimated advanced ratings (BoxScoreAdvancedV3 DF1, migration 008)
    ('E_ORTG',    'e_ortg',        'DESC'),  # Estimated Offensive Rating - higher is better
    ('E_DRTG',    'e_drtg',        'ASC'),   # Estimated Defensive Rating - lower is better
    ('E_NET_RTG', 'e_net_rtg',     'DESC'),  # Estimated Net Rating - higher is better
    ('E_PACE',    'e_pace',        'DESC'),  # Estimated Pace - higher is better

    # PlayerTrack stats (BoxScorePlayerTrackV3 DF1)
    ('DISTANCE',         'distance',              'DESC'),  # Distance Traveled (miles) - higher is better
    ('TOUCHES',          'touches',               'DESC'),  # Touches Per Game - higher is better
    ('REB_CHANCES_OFF',  'reb_chances_off',      'DESC'),  # Offensive Rebound Chances - higher is better
    ('REB_CHANCES_DEF',  'reb_chances_def',      'DESC'),  # Defensive Rebound Chances - higher is better
    ('REB_CHANCES_TOT',  'reb_chances_total',    'DESC'),  # Total Rebound Chances - higher is better
    ('SECONDARY_AST',    'secondary_ast',        'DESC'),  # Secondary Assists - higher is better
    ('FT_AST',           'ft_ast',               'DESC'),  # Free Throw Assists - higher is better
    ('PASSES',           'passes',               'DESC'),  # Passes Per Game - higher is better
    ('CONTESTED_FGM',    'contested_fgm',        'DESC'),  # Contested FG Made - higher is better
    ('CONTESTED_FGA',    'contested_fga',        'DESC'),  # Contested FG Attempted - higher is better
    ('CONTESTED_FG%',    'contested_fg_pct',     'DESC'),  # Contested FG% - higher is better
    ('UNCONTESTED_FGM',  'uncontested_fgm',      'DESC'),  # Uncontested FG Made - higher is better
    ('UNCONTESTED_FGA',  'uncontested_fga',      'DESC'),  # Uncontested FG Attempted - higher is better
    ('UNCONTESTED_FG%',  'uncontested_fg_pct',   'DESC'),  # Uncontested FG% - higher is better
    ('DAR_FGM',          'dar_fgm',              'DESC'),  # Defended At Rim FG Made - higher is better
    ('DAR_FGA',          'dar_fga',              'DESC'),  # Defended At Rim FG Attempted - higher is better
    ('DAR_FG%',          'dar_fg_pct',          'DESC'),  # Defended At Rim FG% - higher is better

    # Scoring breakdown percentages (BoxScoreScoringV3 DF1)
    ('PCT_FGA_2PT',     'pct_fga_2pt',       'DESC'),  # % of FGA from 2PT - higher is better
    ('PCT_FGA_3PT',     'pct_fga_3pt',       'DESC'),  # % of FGA from 3PT - higher is better
    ('PCT_PTS_2PT',     'pct_pts_2pt',       'DESC'),  # % of PTS from 2PT - higher is better
    ('PCT_PTS_2PT_MR',  'pct_pts_2pt_mr',    'DESC'),  # % of PTS from 2PT midrange - higher is better
    ('PCT_PTS_3PT',     'pct_pts_3pt',       'DESC'),  # % of PTS from 3PT - higher is better
    ('PCT_PTS_FB',      'pct_pts_fb',        'DESC'),  # % of PTS from fast break - higher is better
    ('PCT_PTS_FT',      'pct_pts_ft',        'DESC'),  # % of PTS from free throws - higher is better
    ('PCT_PTS_OFF_TOV', 'pct_pts_off_tov',   'DESC'),  # % of PTS from turnovers - higher is better
    ('PCT_PTS_PAINT',   'pct_pts_paint',     'DESC'),  # % of PTS from paint - higher is better
    ('PCT_AST_2PM',     'pct_ast_2pm',       'DESC'),  # % of 2PM assisted - higher is better
    ('PCT_UAST_2PM',    'pct_uast_2pm',      'DESC'),  # % of 2PM unassisted - higher is better
    ('PCT_AST_3PM',     'pct_ast_3pm',       'DESC'),  # % of 3PM assisted - higher is better
    ('PCT_UAST_3PM',    'pct_uast_3pm',      'DESC'),  # % of 3PM unassisted - higher is better
    ('PCT_AST_FGM',     'pct_ast_fgm',       'DESC'),  # % of FGM assisted - higher is better
    ('PCT_UAST_FGM',    'pct_uast_fgm',      'DESC'),  # % of FGM unassisted - higher is better
]

def clear_cache():
    """Clear Redis cache to ensure fresh data is served"""
    try:
        redis_url = os.getenv('REDIS_URL', '')
        if redis_url:
            r = redis.from_url(redis_url, decode_responses=True)
        else:
            r = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                db=0,
                decode_responses=True
            )
        r.flushall()
        print("\n💾 Redis cache cleared successfully")
    except Exception as e:
        print(f"\n⚠️  Warning: Could not clear Redis cache: {e}")
        # Don't raise - cache clearing is non-critical

def derive_rankings():
    """Generate stat rankings for all 8 categories"""
    print("\n" + "=" * 60)
    print("PHASE 6: DERIVE STAT_RANKINGS FROM TEAM_STATS")
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
    
    try:
        print(f"\n🔄 Deriving rankings for {len(STAT_CATEGORIES)} stat categories...\n")
        
        total_inserted = 0
        
        for stat_name, stat_column, sort_order in STAT_CATEGORIES:
            print(f"  📊 Ranking by {stat_name} ({stat_column})...")
            
            # Generate ranking SQL dynamically using RANK() for competition ranking
            # RANK() gives tied items the same rank and skips subsequent ranks
            ranking_sql = f"""
            INSERT INTO stat_rankings (team_id, stat_category, rank, value, season)
            SELECT 
                team_id,
                %s as stat_category,
                RANK() OVER (ORDER BY {stat_column} {sort_order}) as rank,
                {stat_column} as value,
                season
            FROM team_stats
            WHERE season = '2025'
            ON CONFLICT (team_id, stat_category, season) DO UPDATE SET
                rank = EXCLUDED.rank,
                value = EXCLUDED.value,
                updated_at = CURRENT_TIMESTAMP
            """
            
            cursor.execute(ranking_sql, (stat_name,))
            conn.commit()
            
            # Get ranking count
            cursor.execute("SELECT COUNT(*) FROM stat_rankings WHERE stat_category = %s", (stat_name,))
            count = cursor.fetchone()[0]
            total_inserted += count
            print(f"    ✓ Created {count} rankings for {stat_name}")
        
        print(f"\n  ✅ Total rankings created: {total_inserted}")
        
        # Show sample rankings
        print(f"\n📋 Sample Rankings (by PPG):")
        cursor.execute("""
            SELECT sr.rank, t.team_name, sr.value
            FROM stat_rankings sr
            JOIN teams t ON t.team_id = sr.team_id
            WHERE sr.stat_category = 'PPG'
            ORDER BY sr.rank
            LIMIT 10
        """)
        
        for rank, team_name, value in cursor.fetchall():
            print(f"  {rank:2}. {team_name:30} {value:.1f}")
        
        print(f"\n✅ STAT_RANKINGS derivation complete!")
        
        # Clear Redis cache so frontend gets fresh data
        clear_cache()
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        conn.rollback()
        raise
    
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    derive_rankings()
