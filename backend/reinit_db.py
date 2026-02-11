import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "data", "onyx_streaming.db")

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

print(f"Repairing tables in: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Drop the tables so they can be recreated by init_db() on next startup
    # We do this because schema changes in SQLite are painful and this is a dev DB
    print("Dropping playlists and playlist_tracks tables...")
    cursor.execute("DROP TABLE IF EXISTS playlist_tracks")
    cursor.execute("DROP TABLE IF EXISTS playlists")
    
    conn.commit()
    print("Success! Tables dropped. They will be recreated correctly when you start the backend.")
except Exception as e:
    print(f"Error during repair: {e}")
finally:
    conn.close()
