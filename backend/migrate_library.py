"""
Migration script to add missing columns to library_tracks table.
Run this once to fix the schema.
"""
import sqlite3
import os

# Find the database
db_path = os.path.join(os.path.dirname(__file__), "data", "onyx_streaming.db")

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

print(f"Migrating database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing columns
cursor.execute("PRAGMA table_info(library_tracks)")
existing_columns = {row[1] for row in cursor.fetchall()}
print(f"Existing columns: {existing_columns}")

# Columns that should exist (from the model)
required_columns = {
    "id": "INTEGER PRIMARY KEY",
    "title": "VARCHAR(255) NOT NULL",
    "artist": "VARCHAR(255) NOT NULL",
    "album": "VARCHAR(255)",
    "path": "VARCHAR(500) NOT NULL",
    "source": "VARCHAR(10) DEFAULT 'local'",
    "duration": "INTEGER DEFAULT 0",
    "thumbnail": "VARCHAR(500)",
    "added_at": "DATETIME",
    "last_played": "DATETIME",
    "play_count": "INTEGER DEFAULT 0"
}

# Add missing columns
for col_name, col_type in required_columns.items():
    if col_name not in existing_columns:
        try:
            # SQLite doesn't support full ALTER TABLE, so we use a simple ADD COLUMN
            simple_type = col_type.split()[0]  # Get just the first word (type)
            default = "DEFAULT 0" if "INTEGER" in col_type else "DEFAULT NULL"
            sql = f"ALTER TABLE library_tracks ADD COLUMN {col_name} {simple_type} {default}"
            print(f"  Adding column: {col_name}")
            cursor.execute(sql)
        except sqlite3.OperationalError as e:
            print(f"  Could not add {col_name}: {e}")

conn.commit()
conn.close()

print("Migration complete!")
