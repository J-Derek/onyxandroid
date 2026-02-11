"""
Onyx Streaming - Queue Routes
Persisted playback queue management per profile
"""
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.database import get_db
from app.models.user import Profile, ProfileQueue
from app.routes.auth import get_current_profile
from app.schemas import QueueStateRequest, QueueStateResponse, QueueTrack, AddTrackRequest

router = APIRouter(prefix="/api/queue", tags=["Queue"])


def parse_tracks_json(tracks_json: str) -> List[dict]:
    """Parse tracks JSON safely"""
    try:
        return json.loads(tracks_json) if tracks_json else []
    except json.JSONDecodeError:
        return []


def serialize_tracks(tracks: List[QueueTrack]) -> str:
    """Serialize tracks list to JSON"""
    return json.dumps([t.model_dump() for t in tracks])


@router.get("", response_model=QueueStateResponse)
async def get_queue(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
):
    """Get current queue state for profile (creates row lazily if not exists)"""
    result = await db.execute(
        select(ProfileQueue).where(ProfileQueue.profile_id == profile.id)
    )
    queue = result.scalar_one_or_none()
    
    if not queue:
        # Lazily create queue row for this profile (avoids migration fragility)
        queue = ProfileQueue(
            profile_id=profile.id,
            tracks_json="[]",
            current_index=-1,
            current_time_sec=0.0,
            repeat_mode="none",
            is_shuffle=False
        )
        db.add(queue)
        await db.commit()
        await db.refresh(queue)
    
    tracks_data = parse_tracks_json(queue.tracks_json)
    tracks = [QueueTrack(**t) for t in tracks_data]
    
    return QueueStateResponse(
        tracks=tracks,
        current_index=queue.current_index,
        current_time_sec=queue.current_time_sec,
        repeat_mode=queue.repeat_mode,
        is_shuffle=queue.is_shuffle,
        updated_at=queue.updated_at
    )


@router.put("", response_model=QueueStateResponse)
async def update_queue(
    request: QueueStateRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
):
    """Update entire queue state (debounced sync from frontend)"""
    result = await db.execute(
        select(ProfileQueue).where(ProfileQueue.profile_id == profile.id)
    )
    queue = result.scalar_one_or_none()
    
    if not queue:
        # Create new queue for profile
        queue = ProfileQueue(
            profile_id=profile.id,
            tracks_json=serialize_tracks(request.tracks),
            current_index=request.current_index,
            current_time_sec=request.current_time_sec,
            repeat_mode=request.repeat_mode,
            is_shuffle=request.is_shuffle
        )
        db.add(queue)
    else:
        # Update existing queue
        queue.tracks_json = serialize_tracks(request.tracks)
        queue.current_index = request.current_index
        queue.current_time_sec = request.current_time_sec
        queue.repeat_mode = request.repeat_mode
        queue.is_shuffle = request.is_shuffle
        queue.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(queue)
    
    tracks_data = parse_tracks_json(queue.tracks_json)
    tracks = [QueueTrack(**t) for t in tracks_data]
    
    return QueueStateResponse(
        tracks=tracks,
        current_index=queue.current_index,
        current_time_sec=queue.current_time_sec,
        repeat_mode=queue.repeat_mode,
        is_shuffle=queue.is_shuffle,
        updated_at=queue.updated_at
    )


@router.post("/track", response_model=QueueStateResponse)
async def add_track_to_queue(
    request: AddTrackRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
):
    """Add a single track to the queue"""
    result = await db.execute(
        select(ProfileQueue).where(ProfileQueue.profile_id == profile.id)
    )
    queue = result.scalar_one_or_none()
    
    if not queue:
        # Create new queue with single track
        queue = ProfileQueue(
            profile_id=profile.id,
            tracks_json=serialize_tracks([request.track]),
            current_index=0
        )
        db.add(queue)
    else:
        # Parse existing tracks
        tracks_data = parse_tracks_json(queue.tracks_json)
        new_track = request.track.model_dump()
        
        if request.position is not None and 0 <= request.position <= len(tracks_data):
            tracks_data.insert(request.position, new_track)
            # Adjust current index if needed
            if request.position <= queue.current_index:
                queue.current_index += 1
        else:
            tracks_data.append(new_track)
        
        queue.tracks_json = json.dumps(tracks_data)
        queue.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(queue)
    
    tracks_data = parse_tracks_json(queue.tracks_json)
    tracks = [QueueTrack(**t) for t in tracks_data]
    
    return QueueStateResponse(
        tracks=tracks,
        current_index=queue.current_index,
        current_time_sec=queue.current_time_sec,
        repeat_mode=queue.repeat_mode,
        is_shuffle=queue.is_shuffle,
        updated_at=queue.updated_at
    )


@router.delete("")
async def clear_queue(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
):
    """Clear the queue for profile"""
    result = await db.execute(
        select(ProfileQueue).where(ProfileQueue.profile_id == profile.id)
    )
    queue = result.scalar_one_or_none()
    
    if queue:
        queue.tracks_json = "[]"
        queue.current_index = -1
        queue.current_time_sec = 0.0
        queue.updated_at = datetime.utcnow()
        await db.commit()
    
    return {"message": "Queue cleared"}
