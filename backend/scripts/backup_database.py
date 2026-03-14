#!/usr/bin/env python3
"""
Backup current database to JSON files for safety before schema redesign
"""
import json
import os
import psycopg2
from datetime import datetime
from pathlib import Path

# Database connection
conn = psycopg2.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    database=os.getenv('DB_NAME', 'nba_stats'),
    user=os.getenv('DB_USER', 'postgres'),
    password=os.getenv('DB_PASSWORD', ''),
    port=int(os.getenv('DB_PORT', 5432)),
)
cursor = conn.cursor()

# Create backup directory
backup_dir = Path(__file__).resolve().parent.parent.parent / "backups"
backup_dir.mkdir(exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_file = backup_dir / f"nba_stats_backup_{timestamp}.json"

backup_data = {}

# Tables to backup
tables = ['teams', 'games', 'team_stats', 'stat_rankings', 'refresh_logs']

print(f"📦 Backing up database to {backup_file}")

for table in tables:
    try:
        # Get column names
        cursor.execute(f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = %s
        """, (table,))
        columns = [row[0] for row in cursor.fetchall()]
        
        # Get all data
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        
        # Convert to list of dicts
        data = []
        for row in rows:
            data.append(dict(zip(columns, row)))
        
        backup_data[table] = {
            'columns': columns,
            'row_count': len(data),
            'data': data
        }
        
        print(f"  ✓ {table}: {len(data)} rows")
    except Exception as e:
        print(f"  ✗ {table}: {e}")

cursor.close()
conn.close()

# Write backup file (with custom JSON encoder for datetime)
import datetime as dt

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, dt.date, dt.datetime)):
            return obj.isoformat()
        return super().default(obj)

with open(backup_file, 'w') as f:
    json.dump(backup_data, f, indent=2, cls=DateTimeEncoder)

print(f"\n✅ Backup complete! File saved: {backup_file}")
print(f"   Size: {backup_file.stat().st_size / 1024:.1f} KB")
