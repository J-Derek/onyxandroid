import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "data", "onyx_streaming.db")
print(f"Updating database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check what columns exist in library_tracks
cursor.execute("PRAGMA table_info(library_tracks)")
existing_cols = [row[1] for row in cursor.fetchall()]
print(f"Existing columns: {existing_cols}")

# Add missing columns
added = []
if "is_offline" not in existing_cols:
    try:
        cursor.execute("ALTER TABLE library_tracks ADD COLUMN is_offline INTEGER DEFAULT 0")
        added.append("is_offline")
        print("Added is_offline column")
    except Exception as e:
        print(f"Error adding is_offline: {e}")

if "local_path" not in existing_cols:
    try:
        cursor.execute("ALTER TABLE library_tracks ADD COLUMN local_path TEXT")
        added.append("local_path")
        print("Added local_path column")
    except Exception as e:
        print(f"Error adding local_path: {e}")

# Also add profile_queues table if missing
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='profile_queues'")
if not cursor.fetchone():
    print("Creating profile_queues table...")
    cursor.execute("""
        CREATE TABLE profile_queues (
            id INTEGER PRIMARY KEY,
            profile_id INTEGER UNIQUE NOT NULL,
            tracks_json TEXT DEFAULT '[]',
            current_index INTEGER DEFAULT -1,
            current_time_sec REAL DEFAULT 0.0,
            repeat_mode VARCHAR(10) DEFAULT 'none',
            is_shuffle INTEGER DEFAULT 0,
            updated_at TIMESTAMP,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        )
    """)
    added.append("profile_queues table")

conn.commit()
conn.close()

if added:
    print(f"\nSuccess! Added: {added}")
else:
    print("\nNo changes needed - all columns/tables exist")
