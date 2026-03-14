#!/usr/bin/env python3
"""Quick verification of fetch status and data"""

import psycopg2
import os

# Connect to database
conn = psycopg2.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    port=int(os.getenv('DB_PORT', 5432)),
    user=os.getenv('DB_USER', 'postgres'),
    password=os.getenv('DB_PASSWORD', ''),
    database=os.getenv('DB_NAME', 'nba_stats'),
)
cur = conn.cursor()

# Check games table status
cur.execute("SELECT COUNT(*) FROM games WHERE season = '2025'")
game_count = cur.fetchone()[0]

# Check if any games have been recorded with real team IDs
cur.execute("SELECT COUNT(*) FROM games WHERE season = '2025' AND home_team_id IS NOT NULL")
games_with_teams = cur.fetchone()[0]

# Show a few sample games
cur.execute("""
    SELECT game_id, game_date, home_team_id, away_team_id 
    FROM games WHERE season = '2025' LIMIT 5
""")
samples = cur.fetchall()

print(f"✓ Total games in table: {game_count}")
print(f"✓ Games with team IDs: {games_with_teams}")
print(f"\nTeam stat records:")

cur.execute("SELECT COUNT(*) FROM team_stats WHERE season = '2025'")
print(f"  Team stat records: {cur.fetchone()[0]}")

print(f"\nSample games:")
for game_id, date, home_id, away_id in samples:
    print(f"  {game_id}: home={home_id}, away={away_id}, date={date}")

cur.close()
conn.close()
