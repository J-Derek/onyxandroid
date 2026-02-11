"""
Onyx Streaming - Library Routes
Manages the music library for streaming mode
"""
import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from ..database import get_db
from ..models.library import LibraryTrack, TrackSource
from ..routes.auth import get_current_profile
from ..models.user import Profile
from ..services.library_sync import library_sync_service

router = APIRouter(prefix="/api/library", tags=["library"])


def _extract_youtube_id(path: Optional[str]) -> Optional[str]:
    """Extract YouTube video ID from path/filename if present."""
    if not path:
        return None
    # Common patterns: "[video_id].mp3", "...[video_id]...", etc.
    # YouTube IDs are 11 characters: letters, numbers, dashes, underscores
    match = re.search(r'([a-zA-Z0-9_-]{11})', path)
    return match.group(1) if match else None


@router.get("/tracks")
async def list_tracks(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    source: Optional[str] = None,
    sync: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)
):
    """List all tracks in the library."""
    if sync:
        await library_sync_service.sync_library(db)
    
    try:
        query = select(LibraryTrack).order_by(LibraryTrack.created_at.desc())
        
        if source:
            try:
                source_enum = TrackSource(source)
                query = query.where(LibraryTrack.source == source_enum)
            except ValueError:
                pass  # Ignore invalid source filter
        
        query = query.offset(offset).limit(limit)
        result = await db.execute(query)
        tracks = result.scalars().all()
        
        return [
            {
                "id": track.id,
                "title": track.title,
                "artist": track.artist,
                "album": track.album,
                "duration": track.duration,  # Uses property that maps to duration_sec
                "thumbnail_url": track.thumbnail,  # Uses property that maps to thumbnail_url
                "source": track.source or "local",  # source is now a String, not Enum
                "youtube_id": track.youtube_id or (_extract_youtube_id(track.path) if track.path and track.source and ("youtube" in str(track.source) or "cached" in str(track.source)) else None),
                "added_at": track.created_at.isoformat() if track.created_at else None,
                "play_count": track.play_count
            }
            for track in tracks
        ]
    except Exception as e:
        import traceback
        print(f"❌ [LIBRARY] Error fetching tracks: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/tracks/{track_id}")
async def get_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)
):
    """Get a specific track by ID."""
    result = await db.execute(
        select(LibraryTrack).where(LibraryTrack.id == track_id)
    )
    track = result.scalar_one_or_none()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "duration": track.duration,
        "thumbnail_url": track.thumbnail,
        "source": track.source or "local",
        "path": track.path,
        "added_at": track.created_at.isoformat() if track.created_at else None,
        "play_count": track.play_count
    }


@router.post("/sync")
async def sync_library(
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)
):
    """Synchronize library database with downloads folder."""
    result = await library_sync_service.sync_library(db)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/ensure", response_model=dict)
async def ensure_track(
    title: str,
    artist: str,
    youtube_id: str,
    thumbnail: Optional[str] = None,
    duration: int = 0,
    is_offline: bool = False,
    local_path: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)
):
    """
    Ensure a YouTube track exists in the library.
    Checks by youtube_id first. Creates if it doesn't exist.
    """
    # Check if exists
    query = select(LibraryTrack).where(LibraryTrack.youtube_id == youtube_id)
    result = await db.execute(query)
    track = result.scalar_one_or_none()
    
    if track:
        # Update status if provided
        updated = False
        if is_offline and not track.is_offline:
            track.is_offline = True
            updated = True
        if local_path and track.local_path != local_path:
            track.local_path = local_path
            updated = True
        
        if updated:
            await db.commit()
            return {"id": track.id, "message": "Track status updated"}
        return {"id": track.id, "message": "Track already exists"}
    
    # Create new track
    track = LibraryTrack(
        title=title,
        artist=artist,
        youtube_id=youtube_id,
        path=f"youtube://{youtube_id}", # Placeholder path for remote tracks
        thumbnail_url=thumbnail,
        duration_sec=duration,
        source="youtube",
        is_offline=is_offline,
        local_path=local_path
    )
    
    db.add(track)
    await db.commit()
    await db.refresh(track)
    
    return {"id": track.id, "message": "Track created in library"}


@router.post("/{track_id}/status", response_model=dict)
async def update_track_status(
    track_id: int,
    is_offline: Optional[bool] = None,
    local_path: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)
):
    """Update the offline/local status of a library track"""
    query = select(LibraryTrack).where(LibraryTrack.id == track_id)
    result = await db.execute(query)
    track = result.scalar_one_or_none()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    if is_offline is not None:
        track.is_offline = is_offline
    if local_path is not None:
        track.local_path = local_path
        
    await db.commit()
    return {"status": "success", "is_offline": track.is_offline}


@router.post("/tracks")
async def add_track(
    title: str,
    artist: str,
    path: str,
    album: Optional[str] = None,
    duration: int = 0,
    thumbnail: Optional[str] = None,
    source: str = "local",
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)
):
    """Add a new track to the library."""
    try:
        source_enum = TrackSource(source)
    except ValueError:
        source_enum = TrackSource.LOCAL
    
    track = LibraryTrack(
        title=title,
        artist=artist,
        album=album,
        path=path,
        duration=duration,
        thumbnail=thumbnail,
        source=source_enum
    )
    
    db.add(track)
    await db.commit()
    await db.refresh(track)
    
    return {"id": track.id, "message": "Track added successfully"}


@router.delete("/tracks/{track_id}")
async def delete_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)
):
    """Delete a track from the library."""
    result = await db.execute(
        select(LibraryTrack).where(LibraryTrack.id == track_id)
    )
    track = result.scalar_one_or_none()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    await db.execute(
        delete(LibraryTrack).where(LibraryTrack.id == track_id)
    )
    await db.commit()
    
    return {"message": "Track deleted successfully"}


