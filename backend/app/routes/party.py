from fastapi import APIRouter, HTTPException, Depends, status
from typing import Optional
from ..schemas import PartySessionState, PartyJoinRequest, PartyActionRequest, QueueTrack
from ..services.party_manager import party_manager

router = APIRouter(prefix="/api/party", tags=["Party"])

@router.post("/create", response_model=PartySessionState)
async def create_party(session_id: str, host_id: str):
    """Create a new ephemeral party session"""
    session = await party_manager.create_session(session_id, host_id)
    return session.to_state()

@router.get("/{session_id}", response_model=PartySessionState)
async def get_party(session_id: str):
    """Get the current state of a party session"""
    session = await party_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Party session not found"
        )
    return session.to_state()

@router.post("/{session_id}/sync", response_model=PartySessionState)
async def sync_party(session_id: str, host_id: str, state: PartySessionState):
    """Sync the full party state (Host only)"""
    # Note: We pass state as body, but PartyManager update_state expects a dict or specific fields
    updated = await party_manager.update_state(session_id, host_id, state.model_dump())
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session not found or not authorized as host"
        )
    return updated

@router.post("/{session_id}/add", response_model=PartySessionState)
async def add_to_party(session_id: str, request: PartyActionRequest):
    """Add a track to the party queue (Guest or Host contributing)"""
    if request.action != "add" or not request.track:
        raise HTTPException(status_code=400, detail="Invalid action or track missing")
    
    updated = await party_manager.add_track(session_id, request.track)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Party session not found"
        )
    return updated

@router.delete("/{session_id}")
async def end_party(session_id: str, host_id: str):
    """End a party session (Host only)"""
    success = await party_manager.end_session(session_id, host_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session not found or not authorized as host"
        )
    return {"message": "Session ended"}

@router.post("/{session_id}/vote")
async def vote_to_skip(session_id: str, user_id: str):
    """Cast a vote to skip the current track (Guest Only)"""
    result = await party_manager.cast_vote(session_id, user_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Party session not found"
        )
    return result
