#!/usr/bin/env python3
"""
Phase 5: Derive TEAM_STATS from GAME_STATS
- Aggregate all game stats by team
- Calculate totals and averages
- Populate TEAM_STATS table
"""
import os
import psycopg2
from datetime import datetime

def derive_team_stats():
    """Derive aggregated team stats from game stats"""
    print("\n" + "=" * 60)
    print("PHASE 5: DERIVE TEAM_STATS FROM GAME_STATS")
    print("=" * 60)
    
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'nba_stats'),
    )
    cursor = conn.cursor()
    
    try:
        print("\n🔄 Deriving team stats from game stats...")
        
        # SQL to aggregate game_stats into team_stats
        insert_stats_sql = """
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
            orb_pct, drb_pct, trb_pct, ast_pct, tov_pct, usg_pct, ts_pct
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
            ROUND(AVG(COALESCE(fg, 0))::numeric, 1) as fg_avg,
            ROUND(AVG(COALESCE(fga, 0))::numeric, 1) as fga_avg,
            ROUND(AVG(COALESCE(three_p, 0))::numeric, 1) as three_p_avg,
            ROUND(AVG(COALESCE(reb, 0))::numeric, 1) as reb_avg,
            ROUND(AVG(COALESCE(ast, 0))::numeric, 1) as ast_avg,
            ROUND(AVG(COALESCE(tov, 0))::numeric, 1) as tov_avg,
            ROUND(AVG(COALESCE(stl, 0))::numeric, 1) as stl_avg,
            ROUND(AVG(COALESCE(blk, 0))::numeric, 1) as blk_avg,
            ROUND(AVG(COALESCE(pts, 0))::numeric, 1) as pts_avg,
            ROUND(AVG(COALESCE(orb_pct, 0))::numeric, 4) as orb_pct,
            ROUND(AVG(COALESCE(drb_pct, 0))::numeric, 4) as drb_pct,
            ROUND(AVG(COALESCE(trb_pct, 0))::numeric, 4) as trb_pct,
            ROUND(AVG(COALESCE(ast_pct, 0))::numeric, 4) as ast_pct,
            ROUND(AVG(COALESCE(tov_pct, 0))::numeric, 1) as tov_pct,
            ROUND(AVG(COALESCE(usg_pct, 0))::numeric, 4) as usg_pct,
            ROUND(AVG(COALESCE(ts_pct, 0))::numeric, 4) as ts_pct
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
            updated_at = CURRENT_TIMESTAMP
        """
        
        cursor.execute(insert_stats_sql)
        conn.commit()
        
        # Verify results
        cursor.execute("SELECT COUNT(*) FROM team_stats")
        count = cursor.fetchone()[0]
        print(f"  ✓ Created/updated {count} team_stats records")
        
        # Show sample
        print(f"\n📋 Sample TEAM_STATS (top 5 by PPG):")
        cursor.execute("""
            SELECT ts.team_id, t.team_name, ts.games_played, ts.pts_avg, ts.reb_avg, ts.ast_avg, ts.fg_pct, ts.three_p_pct, ts.ft_pct
            FROM team_stats ts
            JOIN teams t ON t.team_id = ts.team_id
            ORDER BY ts.pts_avg DESC
            LIMIT 5
        """)
        
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
