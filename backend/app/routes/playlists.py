from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.library import LibraryTrack, Playlist, PlaylistTrack
from app.models.user import User, Profile
from app.routes.auth import get_current_profile
from app.schemas import PlaylistCreate, PlaylistUpdate, PlaylistResponse, PlaylistTrackResponse

router = APIRouter(prefix="/api/playlists", tags=["Playlists"])

@router.get("/", response_model=List[PlaylistResponse])
async def list_playlists(
    db: AsyncSession = Depends(get_db),
    current_profile: Profile = Depends(get_current_profile)
):
    """List all playlists for the current profile."""
    # 🔧 FIX: Use subquery instead of lazy-loaded property to avoid async issues
    from sqlalchemy.orm import selectinload
    
    query = select(Playlist).where(Playlist.owner_id == current_profile.id).order_by(Playlist.created_at.desc())
    result = await db.execute(query)
    playlists = result.scalars().all()
    
    # Get track counts via separate query (avoids lazy loading issues)
    track_counts = {}
    for p in playlists:
        count_query = select(func.count(PlaylistTrack.id)).where(PlaylistTrack.playlist_id == p.id)
        count_result = await db.execute(count_query)
        track_counts[p.id] = count_result.scalar() or 0
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "cover_image": p.cover_image,
            "is_system": p.is_system,
            "track_count": track_counts.get(p.id, 0),
            "created_at": p.created_at,
            "updated_at": p.updated_at
        }
        for p in playlists
    ]

@router.post("/", response_model=PlaylistResponse)
async def create_playlist(
    playlist_in: PlaylistCreate,
    db: AsyncSession = Depends(get_db),
    current_profile: Profile = Depends(get_current_profile)
):
    """Create a new playlist."""
    playlist = Playlist(
        owner_id=current_profile.id,
        name=playlist_in.name,
        description=playlist_in.description,
        cover_image=playlist_in.cover_image
    )
    db.add(playlist)
    await db.commit()
    await db.refresh(playlist)
    return {**playlist.__dict__, "track_count": 0}

@router.get("/{playlist_id}", response_model=PlaylistResponse)
async def get_playlist(
    playlist_id: int,
    db: AsyncSession = Depends(get_db),
    current_profile: Profile = Depends(get_current_profile)
):
    """Get a specific playlist with its tracks."""
    query = select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_profile.id)
    result = await db.execute(query)
    playlist = result.scalar_one_or_none()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Fetch tracks for this playlist
    tracks_query = select(PlaylistTrack, LibraryTrack).join(
        LibraryTrack, PlaylistTrack.track_id == LibraryTrack.id
    ).where(PlaylistTrack.playlist_id == playlist_id).order_by(PlaylistTrack.position)
    
    tracks_result = await db.execute(tracks_query)
    playlist_tracks = tracks_result.all()
    
    tracks_data = []
    for pt, t in playlist_tracks:
        tracks_data.append({
            "id": t.id,
            "title": t.title,
            "artist": t.artist,
            "thumbnail_url": t.thumbnail_url,
            "duration": t.duration_sec,
            "position": pt.position,
            "added_at": pt.added_at
        })
    
    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "cover_image": playlist.cover_image,
        "is_system": playlist.is_system,
        "track_count": len(tracks_data),
        "created_at": playlist.created_at,
        "updated_at": playlist.updated_at,
        "tracks": tracks_data
    }

@router.put("/{playlist_id}", response_model=PlaylistResponse)
async def update_playlist(
    playlist_id: int,
    playlist_in: PlaylistUpdate,
    db: AsyncSession = Depends(get_db),
    current_profile: Profile = Depends(get_current_profile)
):
    """Update playlist metadata."""
    query = select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_profile.id)
    result = await db.execute(query)
    playlist = result.scalar_one_or_none()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist_in.name is not None:
        playlist.name = playlist_in.name
    if playlist_in.description is not None:
        playlist.description = playlist_in.description
    if playlist_in.cover_image is not None:
        playlist.cover_image = playlist_in.cover_image
        
    await db.commit()
    await db.refresh(playlist)
    return {**playlist.__dict__, "track_count": playlist.track_count}

@router.delete("/{playlist_id}")
async def delete_playlist(
    playlist_id: int,
    db: AsyncSession = Depends(get_db),
    current_profile: Profile = Depends(get_current_profile)
):
    """Delete a playlist."""
    query = select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_profile.id)
    result = await db.execute(query)
    playlist = result.scalar_one_or_none()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    await db.delete(playlist)
    await db.commit()
    return {"message": "Playlist deleted"}

@router.post("/{playlist_id}/tracks")
async def add_track_to_playlist(
    playlist_id: int,
    track_id: int,
    db: AsyncSession = Depends(get_db),
    current_profile: Profile = Depends(get_current_profile)
):
    """Add a track to a playlist."""
    # Verify ownership
    playlist_query = select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_profile.id)
    playlist_result = await db.execute(playlist_query)
    if not playlist_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Check if already exists
    existing_query = select(PlaylistTrack).where(
        PlaylistTrack.playlist_id == playlist_id,
        PlaylistTrack.track_id == track_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        return {"message": "Track already in playlist"}
    
    # Get max position
    pos_query = select(func.max(PlaylistTrack.position)).where(PlaylistTrack.playlist_id == playlist_id)
    pos_result = await db.execute(pos_query)
    max_pos = pos_result.scalar() or -1
    
    new_track = PlaylistTrack(
        playlist_id=playlist_id,
        track_id=track_id,
        position=max_pos + 1
    )
    db.add(new_track)
    await db.commit()
    return {"message": "Track added to playlist"}

@router.delete("/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(
    playlist_id: int,
    track_id: int,
    db: AsyncSession = Depends(get_db),
    current_profile: Profile = Depends(get_current_profile)
):
    """Remove a track from a playlist."""
    # Verify ownership
    playlist_query = select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_profile.id)
    playlist_result = await db.execute(playlist_query)
    if not playlist_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    delete_query = delete(PlaylistTrack).where(
        PlaylistTrack.playlist_id == playlist_id,
        PlaylistTrack.track_id == track_id
    )
    await db.execute(delete_query)
    await db.commit()
    return {"message": "Track removed from playlist"}

@router.put("/{playlist_id}/tracks/reorder")
async def reorder_playlist_tracks(
    playlist_id: int,
    track_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_profile: Profile = Depends(get_current_profile)
):
    """Reorder tracks in a playlist."""
    # Verify ownership
    playlist_query = select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_profile.id)
    playlist_result = await db.execute(playlist_query)
    if not playlist_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Simple bulk update of positions
    for idx, t_id in enumerate(track_ids):
        stmt = update(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == t_id
        ).values(position=idx)
        await db.execute(stmt)
        
    await db.commit()
    return {"message": "Tracks reordered"}
