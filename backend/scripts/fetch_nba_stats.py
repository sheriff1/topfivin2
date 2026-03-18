#!/usr/bin/env python3
"""
NBA Stats Data Fetcher
Fetches game-by-game box scores from nba_api and aggregates them into season averages.
Stores data in PostgreSQL database.
"""

import os
import json
import sys
import time
import re
import random
from datetime import datetime
from collections import defaultdict
import warnings

# Import shared configuration
from team_constants import TEAM_ABBR_TO_ID
import psycopg2
from psycopg2.extras import Json
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from nba_api.stats.endpoints import boxscoretraditionalv3
from nba_api.stats.endpoints import boxscoresummaryv3
from nba_api.stats.endpoints import boxscoreadvancedv3
from nba_api.stats.static import teams as nba_teams
from nba_api.stats.endpoints import leaguegamelog

# Suppress deprecation warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)

import pandas as pd

# ============ CRITICAL: Patch nba_api with proper browser headers ============
# stats.nba.com now rejects bot-like requests without Origin/Referer headers
# This must be done BEFORE any nba_api requests are made
# Issue: https://github.com/swar/nba_api/issues/633

# Comprehensive browser-like headers that stats.nba.com expects
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

def patch_nba_api_headers():
    """Patch nba_api's HTTP client with proper browser headers"""
    try:
        from nba_api.stats.library import http as stats_http
        from nba_api.library import http as base_http
        
        # Update global headers constant
        stats_http.STATS_HEADERS = NBA_STATS_HEADERS
        
        # Update class-level headers 
        stats_http.NBAStatsHTTP.headers = NBA_STATS_HEADERS
        
        # Reset existing sessions to drop stale connections
        if hasattr(stats_http.NBAStatsHTTP, '_session'):
            stats_http.NBAStatsHTTP._session = None
        if hasattr(base_http.NBAHTTP, '_session'):
            base_http.NBAHTTP._session = None
        
        print("✅ Successfully patched nba_api with browser headers")
    except Exception as e:
        print(f"⚠️  Warning: Could not patch nba_api: {e}")

# Apply the patch immediately before importing endpoints
patch_nba_api_headers()

# NOW safe to import nba_api endpoints
from nba_api.stats.endpoints import boxscoretraditionalv3
from nba_api.stats.endpoints import boxscoresummaryv3
from nba_api.stats.endpoints import boxscoreadvancedv3
from nba_api.stats.static import teams as nba_teams
from nba_api.stats.endpoints import leaguegamelog


# Database configuration from environment variables
DATABASE_URL = os.getenv('DATABASE_URL', '')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'nba_stats')
CURRENT_SEASON = os.getenv('CURRENT_SEASON', '2025')

# API pacing configuration (V3 endpoint is more efficient)
REQUEST_DELAY = 2.0  # 2 second delay to balance speed with rate-limit avoidance
REQUEST_JITTER = 0.3  # ±300ms random jitter

# Retry configuration - handles hard IP blocks from stats.nba.com on cloud IPs
# NOTE: stats.nba.com blocks all cloud hosting providers (AWS/GCP/Azure).
# Retries help during intermittent blocks or non-peak hours.
# See: https://github.com/swar/nba_api/issues/176
RETRY_ATTEMPTS = 3  # General retry attempts for BoxScore V3 endpoints (increased from 2)
SEASON_RETRY_ATTEMPTS = 4  # More aggressive retries for LeagueGameLog (season fetch) - this endpoint is most vulnerable
RETRY_DELAY = 5  # seconds between retries
REQUEST_TIMEOUT = 60  # Increased from 30s to 60s globally for all NBA API endpoints
                       # Double timeout helps with cloud IP throttling, though retries are primary mitigation

# Connection pooling with advanced retry strategy
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (NBA Stats Fetcher)'
})

# Configure retry strategy with exponential backoff + longer timeouts
retry_strategy = Retry(
    total=2,
    backoff_factor=1.0,  # Exponential: 1, 2, 4...
    status_forcelist=[429, 500, 502, 503, 504],  # Retry on these HTTP codes
    allowed_methods=["GET"],  # Only retry GET requests
)

# Mount HTTPAdapter with retry strategy to both http and https
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)

def apply_request_delay():
    """Apply delay with random jitter to avoid synchronized requests"""
    jitter = random.uniform(-REQUEST_JITTER, REQUEST_JITTER)
    actual_delay = REQUEST_DELAY + jitter
    time.sleep(max(0.2, actual_delay))  # Never sleep less than 200ms

# Configure urllib3 for longer timeouts (nba_api uses this internally)
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
# Set default timeout for connection pooling (60s for all endpoints)
urllib3.util.timeout.Timeout.DEFAULT = urllib3.util.timeout.Timeout(connect=30, read=REQUEST_TIMEOUT)

# All stats we'll track - from traditional and advanced V3 endpoints
STAT_CATEGORIES = {
    # Traditional Stats (from BoxScoreTraditionalV3)
    'PTS': 'Points Per Game',
    'FGM': 'Field Goals Made',
    'FGA': 'Field Goals Attempted',
    'FG_PCT': 'Field Goal %',
    'FG3M': '3-Pointers Made',
    'FG3A': '3-Pointers Attempted',
    'FG3_PCT': '3-Point %',
    'FTM': 'Free Throws Made',
    'FTA': 'Free Throws Attempted',
    'FT_PCT': 'Free Throw %',
    'REB': 'Total Rebounds',
    'OREB': 'Offensive Rebounds',
    'DREB': 'Defensive Rebounds',
    'AST': 'Assists',
    'STL': 'Steals',
    'BLK': 'Blocks',
    'TO': 'Turnovers',
    'PF': 'Personal Fouls',
    'PLUS_MINUS': 'Plus/Minus',
    
    # Advanced Stats (from BoxScoreMiscV3)
    'ORB_PCT': 'Offensive Rebound %',
    'DRB_PCT': 'Defensive Rebound %',
    'TRB_PCT': 'Total Rebound %',
    'AST_PCT': 'Assist %',
    'TOV_PCT': 'Turnover %',
    'USG_PCT': 'Usage %',
    'TS_PCT': 'True Shooting %',
}

def connect_db():
    """Connect to PostgreSQL database"""
    try:
        if DATABASE_URL:
            # Debug: Print database host being used
            match = re.search(r'@([^:/]+)', DATABASE_URL)
            db_host = match.group(1) if match else 'unknown'
            print(f"  🔌 Connecting to database: {db_host}")
            conn = psycopg2.connect(DATABASE_URL)
        else:
            print(f"  🔌 Connecting to database: {DB_HOST}")
            conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME
            )
        return conn
    except psycopg2.Error as e:
        print(f"❌ Database connection error: {e}")
        sys.exit(1)

def get_team_mapping():
    """Get NBA team ID to team name mapping"""
    teams_data = nba_teams.get_teams()
    return {team['id']: team['full_name'] for team in teams_data}

def fetch_season_games(season=CURRENT_SEASON):
    """
    Fetch all games for the season using LeagueGameLog.
    Season is controlled via the CURRENT_SEASON env var (default: '2025').
    Returns list of game details with team info
    
    NOTE: This endpoint is most vulnerable to hard IP blocks from stats.nba.com.
    Implements aggressive retry logic (SEASON_RETRY_ATTEMPTS) with exponential backoff.
    See: https://github.com/swar/nba_api/issues/176
    """
    print(f"📅 Fetching games for season {season}...")
    
    for attempt in range(SEASON_RETRY_ATTEMPTS):
        try:
            game_log = leaguegamelog.LeagueGameLog(season=season, season_type_all_star='Regular Season')
            games = game_log.get_data_frames()[0]
            
            # Extract game details with team info
            game_details = []
            for _, row in games.iterrows():
                game_details.append({
                    'game_id': row['GAME_ID'],
                    'game_date': row['GAME_DATE'],
                    'team_id': row['TEAM_ID'],
                    'matchup': row['MATCHUP']  # Format: "LAL @ BOS" or "LAL vs BOS"
                })
            
            # Get unique games (each game appears twice, once per team)
            unique_games = {}
            for game in game_details:
                if game['game_id'] not in unique_games:
                    unique_games[game['game_id']] = game
            
            game_ids = list(unique_games.keys())
            print(f"✓ Found {len(game_ids)} games for season {season}")
            if games['GAME_DATE'].notna().any():
                print(f"  Date range: {games['GAME_DATE'].min()} to {games['GAME_DATE'].max()}")
            
            return game_details, season  # Return game details with team info
        
        except Exception as e:
            error_msg = str(e)
            if attempt < SEASON_RETRY_ATTEMPTS - 1:
                wait_time = RETRY_DELAY * (2 ** attempt)  # Exponential backoff: 5s, 10s, 20s, 40s
                print(f"  ⚠ Attempt {attempt + 1} failed: {error_msg}")
                print(f"  ⏳ Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            else:
                print(f"❌ Error fetching games after {SEASON_RETRY_ATTEMPTS} attempts: {error_msg}")
                return [], None

def extract_team_stats(game_id, game_date, team_mapping):
    """
    Fetch all stats for a specific game using multiple V3 endpoints:
    - BoxScoreTraditionalV3: Traditional box score stats
    - BoxScoreAdvancedV3: Advanced statistics (TS%, ORB%, etc.)
    
    Implements retry logic with exponential backoff (RETRY_ATTEMPTS, increased to 3).
    Handles hard IP blocks from stats.nba.com on cloud IPs.
    See: https://github.com/swar/nba_api/issues/176
    
    Returns dict of team_id -> stats for the game
    """
    game_stats = defaultdict(dict)
    
    for attempt in range(RETRY_ATTEMPTS):
        try:
            # Apply smart delay with jitter before each request
            apply_request_delay()
            
            # 1. Fetch Traditional Stats from BoxScoreTraditionalV3
            # Returns: [player_stats, team_breakdown, team_totals]
            v3 = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id)
            dfs = v3.get_data_frames()
            
            # DataFrame 2 contains team totals (one row per team)
            if len(dfs) < 3:
                raise ValueError(f"V3 returned {len(dfs)} DataFrames, expected 3")
            
            trad_df = dfs[2]  # team_totals
            
            for _, row in trad_df.iterrows():
                team_id = int(row['teamId'])
                game_stats[team_id].update({
                    'PTS': float(row['points']) if pd.notna(row['points']) else 0,
                    'FGM': float(row['fieldGoalsMade']) if pd.notna(row['fieldGoalsMade']) else 0,
                    'FGA': float(row['fieldGoalsAttempted']) if pd.notna(row['fieldGoalsAttempted']) else 0,
                    'FG_PCT': float(row['fieldGoalsPercentage']) if pd.notna(row['fieldGoalsPercentage']) else 0,
                    'FG3M': float(row['threePointersMade']) if pd.notna(row['threePointersMade']) else 0,
                    'FG3A': float(row['threePointersAttempted']) if pd.notna(row['threePointersAttempted']) else 0,
                    'FG3_PCT': float(row['threePointersPercentage']) if pd.notna(row['threePointersPercentage']) else 0,
                    'FTM': float(row['freeThrowsMade']) if pd.notna(row['freeThrowsMade']) else 0,
                    'FTA': float(row['freeThrowsAttempted']) if pd.notna(row['freeThrowsAttempted']) else 0,
                    'FT_PCT': float(row['freeThrowsPercentage']) if pd.notna(row['freeThrowsPercentage']) else 0,
                    'REB': float(row['reboundsTotal']) if pd.notna(row['reboundsTotal']) else 0,
                    'OREB': float(row['reboundsOffensive']) if pd.notna(row['reboundsOffensive']) else 0,
                    'DREB': float(row['reboundsDefensive']) if pd.notna(row['reboundsDefensive']) else 0,
                    'AST': float(row['assists']) if pd.notna(row['assists']) else 0,
                    'STL': float(row['steals']) if pd.notna(row['steals']) else 0,
                    'BLK': float(row['blocks']) if pd.notna(row['blocks']) else 0,
                    'TO': float(row['turnovers']) if pd.notna(row['turnovers']) else 0,
                    'PF': float(row['foulsPersonal']) if pd.notna(row['foulsPersonal']) else 0,
                    'PLUS_MINUS': 0.0,  # V3 doesn't include plus/minus
                })
            
            # 2. Fetch Advanced Stats from BoxScoreAdvancedV3
            # Apply delay before second endpoint call
            apply_request_delay()
            
            advanced = boxscoreadvancedv3.BoxScoreAdvancedV3(game_id=game_id)
            adv_dfs = advanced.get_data_frames()
            
            # BoxScoreAdvancedV3 returns [player_advanced, team_advanced]
            if len(adv_dfs) >= 2:
                adv_df = adv_dfs[1]  # team_advanced stats
                
                for _, row in adv_df.iterrows():
                    team_id = int(row['teamId']) if pd.notna(row.get('teamId')) else None
                    
                    if team_id and team_id in game_stats:
                        # Map advanced stat columns to our categories
                        stats_map = {
                            'offensiveReboundPercentage': 'ORB_PCT',
                            'defensiveReboundPercentage': 'DRB_PCT', 
                            'reboundPercentage': 'TRB_PCT',
                            'assistPercentage': 'AST_PCT',
                            'estimatedTeamTurnoverPercentage': 'TOV_PCT',
                            'estimatedUsagePercentage': 'USG_PCT',  # Changed from 'usagePercentage' (always 1.0) to 'estimatedUsagePercentage' (actual values)
                            'trueShootingPercentage': 'TS_PCT',
                        }
                        
                        for col_name, stat_key in stats_map.items():
                            if col_name in row and pd.notna(row[col_name]):
                                game_stats[team_id][stat_key] = float(row[col_name])
                            else:
                                game_stats[team_id][stat_key] = 0.0
            
            return game_stats
        
        except Exception as e:
            error_msg = str(e)
            if attempt < RETRY_ATTEMPTS - 1:
                wait_time = RETRY_DELAY * (2 ** attempt)  # Exponential backoff
                print(f"    ⚠ Attempt {attempt + 1} failed: {error_msg}")
                print(f"    ⏳ Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            else:
                print(f"    ❌ Failed after {RETRY_ATTEMPTS} attempts: {error_msg}")
                return None

def insert_game_stats_to_db(conn, game_id, game_date, team_stats):
    """
    Insert extracted game stats directly into game_stats table.
    team_stats: Dict of team_id -> {stat: value}
    """
    cur = conn.cursor()
    try:
        for team_id, stats in team_stats.items():
            cur.execute("""
                INSERT INTO game_stats (
                    game_id, team_id, game_date, season,
                    fg, fga, fg_pct, three_p, three_pa, three_p_pct,
                    ft, fta, ft_pct, oreb, dreb, reb,
                    ast, tov, stl, blk, pf, pts, plus_minus,
                    orb_pct, drb_pct, trb_pct, ast_pct, tov_pct, usg_pct, ts_pct
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (game_id, team_id) DO UPDATE SET
                    fg = EXCLUDED.fg, fga = EXCLUDED.fga, fg_pct = EXCLUDED.fg_pct,
                    three_p = EXCLUDED.three_p, three_pa = EXCLUDED.three_pa, three_p_pct = EXCLUDED.three_p_pct,
                    ft = EXCLUDED.ft, fta = EXCLUDED.fta, ft_pct = EXCLUDED.ft_pct,
                    oreb = EXCLUDED.oreb, dreb = EXCLUDED.dreb, reb = EXCLUDED.reb,
                    ast = EXCLUDED.ast, tov = EXCLUDED.tov, stl = EXCLUDED.stl, 
                    blk = EXCLUDED.blk, pf = EXCLUDED.pf, pts = EXCLUDED.pts,
                    plus_minus = EXCLUDED.plus_minus,
                    orb_pct = EXCLUDED.orb_pct, drb_pct = EXCLUDED.drb_pct, 
                    trb_pct = EXCLUDED.trb_pct, ast_pct = EXCLUDED.ast_pct,
                    tov_pct = EXCLUDED.tov_pct, usg_pct = EXCLUDED.usg_pct, 
                    ts_pct = EXCLUDED.ts_pct
            """, (
                game_id, team_id, game_date, '2025',
                int(stats.get('FGM', 0)), int(stats.get('FGA', 0)), stats.get('FG_PCT', 0),
                int(stats.get('FG3M', 0)), int(stats.get('FG3A', 0)), stats.get('FG3_PCT', 0),
                int(stats.get('FTM', 0)), int(stats.get('FTA', 0)), stats.get('FT_PCT', 0),
                int(stats.get('OREB', 0)), int(stats.get('DREB', 0)), int(stats.get('REB', 0)),
                int(stats.get('AST', 0)), int(stats.get('TO', 0)), int(stats.get('STL', 0)),
                int(stats.get('BLK', 0)), int(stats.get('PF', 0)), int(stats.get('PTS', 0)),
                stats.get('PLUS_MINUS', 0),
                stats.get('ORB_PCT', 0), stats.get('DRB_PCT', 0),
                stats.get('TRB_PCT', 0), stats.get('AST_PCT', 0),
                stats.get('TOV_PCT', 0), stats.get('USG_PCT', 0),
                stats.get('TS_PCT', 0)
            ))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"      ⚠️  Could not insert game_stats: {e}")

def aggregate_season_stats(game_stats_list):
    """
    Aggregate game-by-game stats into season averages.
    game_stats_list: List of dicts from extract_team_stats
    Returns: Dict of team_id -> {stat: average_value}
    """
    # Initialize accumulators
    team_accumulators = defaultdict(lambda: defaultdict(float))
    game_counts = defaultdict(int)
    
    # Sum up all stats across games
    for game_stats in game_stats_list:
        for team_id, stats in game_stats.items():
            for stat_name, stat_value in stats.items():
                if stat_value is not None:
                    team_accumulators[team_id][stat_name] += float(stat_value)
            game_counts[team_id] += 1
    
    # Calculate averages
    season_avg = {}
    for team_id, stats in team_accumulators.items():
        games = game_counts[team_id]
        season_avg[team_id] = {
            stat: value / games for stat, value in stats.items()
        }
    
    return season_avg, game_counts

def clear_season_data(conn, season):
    """Clear all data for the current season before fresh load (replace-on-run)"""
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM team_stats WHERE season = %s", (season,))
        cur.execute("DELETE FROM stat_rankings WHERE season = %s", (season,))
        # Keep games table for auditing - don't delete it
        conn.commit()
        print(f"🗑️  Cleared old data for season {season}")
    except Exception as e:
        print(f"⚠️  Could not clear old season data: {e}")
        conn.rollback()
    finally:
        cur.close()


def parse_matchup(matchup_str):
    """
    Parse MATCHUP string from LeagueGameLog API to extract home and away team IDs.
    Examples: "NYK @ UTA" (away @ home), "UTA vs. NYK" (home vs away)
    Returns: (away_team_id, home_team_id) or (None, None) if parsing fails
    """
    if not matchup_str:
        return None, None
    
    try:
        if ' @ ' in matchup_str:
            # Format: "AWAY @ HOME"
            parts = matchup_str.split(' @ ')
            away_abbr = parts[0].strip()
            home_abbr = parts[1].strip()
        elif ' vs. ' in matchup_str or ' vs ' in matchup_str:
            # Format: "HOME vs AWAY" or "HOME vs. AWAY"
            parts = matchup_str.replace(' vs. ', '|').replace(' vs ', '|').split('|')
            home_abbr = parts[0].strip()
            away_abbr = parts[1].strip()
        else:
            return None, None
        
        away_team_id = TEAM_ABBR_TO_ID.get(away_abbr)
        home_team_id = TEAM_ABBR_TO_ID.get(home_abbr)
        
        return away_team_id, home_team_id
    except Exception as e:
        print(f"    Warning: Could not parse matchup '{matchup_str}': {e}")
        return None, None

def record_games(conn, game_details, season):
    """Record all game details in the games table for auditing with real team IDs from LeagueGameLog API.
    
    This function extracts home/away teams from the MATCHUP field of actual game data,
    ensuring 100% real data sourcing with no mathematical generation.
    """
    cur = conn.cursor()
    try:
        processed = 0
        missing_dates = 0
        missing_teams = 0
        
        # Create a dict to track unique games (avoid duplicate processing)
        processed_games = {}
        
        for game in game_details:
            game_id = game['game_id']
            game_date = game['game_date']
            matchup = game.get('matchup', '')
            
            # Skip if we've already processed this game_id
            if game_id in processed_games:
                continue
            
            # Parse date - use actual game date if available
            if not game_date or game_date == '' or pd.isna(game_date):
                missing_dates += 1
                # If no date, skip for now (would need to handle missing dates differently)
                continue
            
            # Parse matchup to get team IDs from LeagueGameLog API MATCHUP field
            away_team_id, home_team_id = parse_matchup(matchup)
            
            if not away_team_id or not home_team_id:
                missing_teams += 1
            
            # Convert date to string if it's a datetime
            if hasattr(game_date, 'date'):
                game_date = game_date.date()
            
            # Insert game record
            cur.execute(
                """
                INSERT INTO games (game_id, game_date, home_team_id, away_team_id, season, collected)
                VALUES (%s, %s, %s, %s, %s, false)
                ON CONFLICT (game_id) DO UPDATE SET
                    home_team_id = EXCLUDED.home_team_id,
                    away_team_id = EXCLUDED.away_team_id,
                    game_date = EXCLUDED.game_date
                """,
                (game_id, game_date, home_team_id, away_team_id, season)
            )
            processed_games[game_id] = True
            processed += 1
        
        conn.commit()
        print(f"📋 Recorded {processed} games in audit table")
        if missing_dates > 0:
            print(f"  ⚠️  {missing_dates} games with missing dates (skipped)")
        if missing_teams > 0:
            print(f"  ⚠️  {missing_teams} games with unresolved team info")
    except Exception as e:
        print(f"⚠️  Could not record games: {e}")
        conn.rollback()
    finally:
        cur.close()

def mark_game_collected(conn, game_id):
    """Mark a game as successfully collected"""
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE games SET collected = true, updated_at = CURRENT_TIMESTAMP WHERE game_id = %s",
            (game_id,)
        )
        conn.commit()
        cur.close()
    except Exception as e:
        # Don't fail the whole process if audit fails
        pass

def store_season_stats(conn, season_avg, game_counts, team_mapping, season):
    """Store aggregated season averages to database"""
    cur = conn.cursor()
    
    try:
        # First, ensure all teams exist in the database
        for nba_id, team_name in team_mapping.items():
            cur.execute(
                "INSERT INTO teams (team_id, team_name) VALUES (%s, %s) ON CONFLICT (team_id) DO NOTHING",
                (nba_id, team_name)
            )
        conn.commit()
        
        # NOTE: team_stats should be populated by derive_team_stats.py, not here
        # This function only ensures teams exist for FK constraints
        print(f"✅ Ensured {len(team_mapping)} teams exist in database")
        
    except Exception as e:
        print(f"❌ Error storing stats: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()

def main():
    print("🏀 NBA Stats Data Fetcher - Full Season")
    print("=" * 50)
    
    # Get team mapping
    team_mapping = get_team_mapping()
    print(f"✓ Loaded {len(team_mapping)} NBA teams")
    
    # Connect to database
    conn = connect_db()
    print(f"✓ Connected to database {DB_NAME}")
    
    # Fetch season games
    game_details, season = fetch_season_games()
    if not game_details or not season:
        print("❌ No games found")
        conn.close()
        return
    
    # Record all games for audit trail (uses real API data from LeagueGameLog)
    record_games(conn, game_details, season)

    # Build deduplicated list of game IDs, skipping already-collected games
    cur = conn.cursor()
    cur.execute("SELECT game_id FROM games WHERE season = %s AND collected = true", (season,))
    already_collected = {row[0] for row in cur.fetchall()}
    cur.close()

    game_ids = list(dict.fromkeys(
        g['game_id'] for g in game_details
        if g['game_id'] not in already_collected
    ))

    skipped = len(set(g['game_id'] for g in game_details)) - len(game_ids)
    print(f"\n📊 Starting full season fetch for {season}...")
    print(f"   Unique games total: {len(set(g['game_id'] for g in game_details))}")
    print(f"   Already collected (skipping): {skipped}")
    print(f"   Games to process: {len(game_ids)}")
    print(f"   (This may take 1-2 hours with API pacing)")
    
    # Extract stats from each game
    all_game_stats = []
    failed_games = 0
    start_time = datetime.now()
    
    for i, game_id in enumerate(game_ids, 1):
        elapsed = (datetime.now() - start_time).total_seconds()
        if i % 10 == 0 or i == 1:
            print(f"\n  [{i}/{len(game_ids)}] Game ID: {game_id}")
            print(f"    Progress: {i/len(game_ids)*100:.1f}% | Elapsed: {elapsed/60:.1f}m")
        
        game_stats = extract_team_stats(game_id, None, team_mapping)
        if game_stats:
            all_game_stats.append(game_stats)
            # Insert game_stats directly into database
            game_date = next((g['game_date'] for g in game_details if g['game_id'] == game_id), datetime.now().date())
            insert_game_stats_to_db(conn, game_id, game_date, game_stats)
            mark_game_collected(conn, game_id)  # Mark as collected
            if i % 25 == 0:
                print(f"    ✓ Successfully processed {i} games")
        else:
            failed_games += 1
        
        # Save intermediate results every 100 games to avoid losing progress
        if i % 100 == 0 and all_game_stats:
            print(f"\n    💾 Saving intermediate data ({i} games processed)...")
            season_avg, game_counts = aggregate_season_stats(all_game_stats)
            store_season_stats(conn, season_avg, game_counts, team_mapping, season)
            print(f"    ✓ Checkpoint saved: {len(season_avg)} teams")
    
    print(f"\n  ✓ Completed {len(all_game_stats)}/{len(game_ids)} games (failed: {failed_games})")
    
    if not all_game_stats:
        print("❌ No stats extracted")
        conn.close()
        return
    
    # Aggregate into final season averages
    print("\n📈 Aggregating final season averages...")
    season_avg, game_counts = aggregate_season_stats(all_game_stats)
    print(f"✓ Aggregated stats for {len(season_avg)} teams across {sum(game_counts.values())} total games")
    
    print("\n📊 Games per team:")
    for team_id in sorted(game_counts.keys()):
        team_name = team_mapping.get(team_id, f"Team {team_id}")
        count = game_counts[team_id]
        ppg = season_avg[team_id].get('PTS', 0)
        print(f"  {team_name:30} {count:3} games | PPG: {ppg:.1f}")
    
    # Store final results in database
    print("\n💾 Storing final results in database...")
    store_season_stats(conn, season_avg, game_counts, team_mapping, season)
    
    elapsed = (datetime.now() - start_time).total_seconds()
    print(f"\n✅ Data fetch complete!")
    print(f"   Total time: {elapsed/3600:.1f} hours")
    print(f"   Status: {len(season_avg)} teams with season averages")
    
    conn.close()

if __name__ == '__main__':
    main()
