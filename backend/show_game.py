#!/usr/bin/env python3
"""
Fetch LeagueGameLog and show game 0022500949
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from nba_api.stats.endpoints import leaguegamelog
import pandas as pd

print("🔄 Fetching LeagueGameLog for season 2025...\n")

try:
    game_log = leaguegamelog.LeagueGameLog(season='2025', season_type_all_star='Regular Season')
    games_df = game_log.get_data_frames()[0]
    
    # Filter for the specific game
    game_id = '0022500949'
    game_data = games_df[games_df['GAME_ID'] == game_id]
    
    if len(game_data) == 0:
        print(f"❌ Game ID {game_id} not found in data")
        print(f"\nAvailable game IDs sample: {games_df['GAME_ID'].unique()[:10]}")
    else:
        print(f"✓ Found Game ID {game_id}")
        print("\n" + "="*120)
        
        # Show all columns
        pd.set_option('display.max_columns', None)
        pd.set_option('display.max_rows', None)
        pd.set_option('display.width', None)
        pd.set_option('display.max_colwidth', None)
        
        print("\nGameLog rows for this game:")
        print(game_data.to_string())
        
        print("\n" + "="*120)
        print("\nColumn names:")
        for i, col in enumerate(games_df.columns, 1):
            print(f"{i:2d}. {col}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
