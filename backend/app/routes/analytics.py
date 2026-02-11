from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ..database import get_db
from ..models.library import LibraryTrack
from ..models.user import User, Profile, ListeningHistory
from ..routes.auth import get_current_profile, get_optional_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

class ReportPlayRequest(BaseModel):
    track_id: Optional[int] = None
    youtube_id: Optional[str] = None
    title: str
    artist: str
    thumbnail_url: Optional[str] = None
    duration_listened: int = 0  # seconds

@router.post("/report-play")
async def report_play(
    request: ReportPlayRequest,
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)  # 🔒 SECURITY: Now requires profile
):
    """Report that a track has been played. Records to profile's listening history."""
    track = None
    
    # 1. Try to find by track_id
    if request.track_id:
        result = await db.execute(select(LibraryTrack).where(LibraryTrack.id == request.track_id))
        track = result.scalar_one_or_none()
    
    # 2. Try to find by youtube_id if not found or id was missing
    if not track and request.youtube_id:
        result = await db.execute(select(LibraryTrack).where(LibraryTrack.youtube_id == request.youtube_id))
        track = result.scalar_one_or_none()
    
    if not track:
        # Create a new library entry for this track
        track = LibraryTrack(
            title=request.title,
            artist=request.artist,
            youtube_id=request.youtube_id,
            path=f"youtube://{request.youtube_id}" if request.youtube_id else "unknown://play",
            thumbnail_url=request.thumbnail_url,
            source="youtube" if request.youtube_id else "local",
            play_count=0,
        )
        db.add(track)
        await db.commit()
        await db.refresh(track)
    
    # Update track play count
    track.play_count += 1
    track.last_played = datetime.utcnow()
    
    # 🔒 SECURITY: Record to profile's listening history (scoped by profile_id)
    history_entry = ListeningHistory(
        profile_id=profile.id,
        track_id=track.id,
        duration_listened=request.duration_listened,
        completed=request.duration_listened > 30  # Consider "completed" if listened > 30s
    )
    db.add(history_entry)
    await db.commit()
    
    return {"status": "recorded", "id": track.id}

@router.get("/recent")
async def get_recent_plays(
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)  # 🔒 SECURITY: Now requires profile
):
    """Get recently played tracks for the current profile."""
    # 🔒 SECURITY: Query profile's listening history, not global LibraryTrack
    query = (
        select(ListeningHistory, LibraryTrack)
        .join(LibraryTrack, ListeningHistory.track_id == LibraryTrack.id)
        .where(ListeningHistory.profile_id == profile.id)
        .order_by(ListeningHistory.played_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()
    
    # 🚀 Deduplicate by track.id to avoid duplicate cards in UI (preserving latest first)
    unique_rows = []
    seen_ids = set()
    for history, track in rows:
        if track.id not in seen_ids:
            unique_rows.append((history, track))
            seen_ids.add(track.id)
    
    return [
        {
            "id": track.id,
            "title": track.title,
            "artist": track.artist,
            "thumbnail_url": track.thumbnail_url,
            "youtube_id": track.youtube_id,
            "last_played": history.played_at.isoformat() if history.played_at else None,
            "play_count": track.play_count,
            "source": track.source,
            "duration_listened": history.duration_listened
        }
        for history, track in unique_rows
    ]


