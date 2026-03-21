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
            
            # Generate ranking SQL dynamically
            ranking_sql = f"""
            INSERT INTO stat_rankings (team_id, stat_category, rank, value, season)
            SELECT 
                team_id,
                %s as stat_category,
                ROW_NUMBER() OVER (ORDER BY {stat_column} {sort_order}) as rank,
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
