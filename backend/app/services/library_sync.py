import json
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.library import LibraryTrack
from ..config import settings

logger = logging.getLogger(__name__)

class LibrarySyncService:
    def __init__(self, downloads_dir: Path):
        self.downloads_dir = downloads_dir
        self.supported_extensions = {'.mp3', '.m4a', '.opus', '.flac', '.wav', '.mp4', '.mkv', '.webm'}

    async def sync_library(self, db: AsyncSession) -> dict:
        """
        Scans the downloads directory and ensures all files are in the library_tracks table.
        """
        if not self.downloads_dir.exists():
            return {"status": "error", "message": "Downloads directory does not exist"}

        found_files = []
        for path in self.downloads_dir.rglob("*"):
            if path.is_file() and path.suffix.lower() in self.supported_extensions:
                found_files.append(path)

        new_tracks_count = 0
        updated_tracks_count = 0
        
        for file_path in found_files:
            # Calculate relative path from downloads_dir
            try:
                rel_path = str(file_path.relative_to(self.downloads_dir))
            except ValueError:
                continue

            # Check if already in DB (by path)
            query = select(LibraryTrack).where(LibraryTrack.path == rel_path)
            result = await db.execute(query)
            track = result.scalar_one_or_none()

            # Try to load metadata
            metadata = self._load_metadata(file_path)
            
            title = metadata.get("title") or file_path.stem
            artist = metadata.get("artist") or "Unknown Artist"
            youtube_id = metadata.get("youtube_id") or metadata.get("id") # ytdlp often uses id
            thumbnail = metadata.get("thumbnail")
            duration = metadata.get("duration", 0)
            source = metadata.get("source", "local")

            if not track:
                # Create new entry
                track = LibraryTrack(
                    title=title,
                    artist=artist,
                    path=rel_path,
                    youtube_id=youtube_id,
                    thumbnail_url=thumbnail,
                    duration_sec=duration,
                    source=source,
                    is_offline=True,
                    local_path=str(file_path.absolute())
                )
                db.add(track)
                new_tracks_count += 1
            else:
                # Update existing entry if metadata found and it was missing
                updated = False
                if not track.youtube_id and youtube_id:
                    track.youtube_id = youtube_id
                    updated = True
                if not track.thumbnail_url and thumbnail:
                    track.thumbnail_url = thumbnail
                    updated = True
                if track.title == file_path.stem and title != file_path.stem:
                    track.title = title
                    updated = True
                
                if updated:
                    updated_tracks_count += 1

        await db.commit()
        return {
            "status": "success",
            "files_scanned": len(found_files),
            "new_tracks_added": new_tracks_count,
            "tracks_updated": updated_tracks_count
        }

    def _load_metadata(self, file_path: Path) -> dict:
        """Attempts to load metadata from a .meta.json file."""
        meta_path = file_path.with_suffix(file_path.suffix + ".meta.json")
        if not meta_path.exists():
            # Try without double extension (some versions might just use .meta.json)
            meta_path = file_path.with_suffix(".meta.json")
            if not meta_path.exists():
                return {}

        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load metadata for {file_path}: {e}")
            return {}

# Singleton instance
library_sync_service = LibrarySyncService(Path(settings.downloads_dir))
