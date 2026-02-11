from __future__ import annotations
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from ..schemas import QueueTrack, PartySessionState

class PartySession:
    def __init__(self, session_id: str, host_id: str):
        self.session_id = session_id
        self.host_id = host_id
        self.queue: List[QueueTrack] = []
        self.current_index: int = -1
        self.is_playing: bool = False
        self.is_locked: bool = False
        self.votes: set[str] = set()  # Set of user_ids who voted to skip
        self.active_users: set[str] = set() # Set of unique user_ids seen this session
        self.last_updated = datetime.utcnow()
        self.lock = asyncio.Lock()

    def to_state(self) -> PartySessionState:
        return PartySessionState(
            session_id=self.session_id,
            host_id=self.host_id,
            queue=self.queue,
            current_index=self.current_index,
            is_playing=self.is_playing,
            is_locked=self.is_locked,
            updated_at=self.last_updated
        )

class PartyManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.sessions: Dict[str, PartySession] = {}
        self._global_lock = asyncio.Lock()
        self._initialized = True
        print("🎉 [PARTY] PartyManager Initialized")

    async def create_session(self, session_id: str, host_id: str) -> PartySession:
        async with self._global_lock:
            # Cleanup old sessions if needed (simple TTL could be added)
            session = PartySession(session_id, host_id)
            self.sessions[session_id] = session
            return session

    async def get_session(self, session_id: str) -> Optional[PartySession]:
        return self.sessions.get(session_id)

    async def end_session(self, session_id: str, host_id: str):
        async with self._global_lock:
            if session_id in self.sessions:
                if self.sessions[session_id].host_id == host_id:
                    del self.sessions[session_id]
                    return True
            return False

    async def update_state(self, session_id: str, host_id: str, data: Dict[str, Any]):
        session = self.sessions.get(session_id)
        if not session or session.host_id != host_id:
            return None
        
        async with session.lock:
            if "queue" in data:
                session.queue = [QueueTrack(**t) if isinstance(t, dict) else t for t in data["queue"]]
            if "current_index" in data:
                # If current index changes, clear votes for new track
                if session.current_index != data["current_index"]:
                    session.votes.clear()
                session.current_index = data["current_index"]
            if "is_playing" in data:
                session.is_playing = data["is_playing"]
            if "is_locked" in data:
                session.is_locked = data["is_locked"]
            
            session.last_updated = datetime.utcnow()
            return session.to_state()

    async def cast_vote(self, session_id: str, user_id: str):
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        async with session.lock:
            session.active_users.add(user_id)
            session.votes.add(user_id)
            
            # Simple threshold: 50% of active users (min 2 for skip)
            # If only 1 user, skip immediately if they vote? 
            # Or always require majority of at least 2 for "vibe" protection
            threshold = max(1, (len(session.active_users) + 1) // 2)
            
            should_skip = len(session.votes) >= threshold
            
            if should_skip:
                # Backend doesn't advance index automatically to avoid sync issues with host
                # Instead it returns skipped=True and let the host advance or use a signal
                pass
            
            session.last_updated = datetime.utcnow()
            return {
                "votes": len(session.votes),
                "threshold": threshold,
                "should_skip": should_skip
            }

    async def add_track(self, session_id: str, track: QueueTrack, position: Optional[int] = None):
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        async with session.lock:
            if position is not None:
                session.queue.insert(position, track)
            else:
                session.queue.append(track)
            
            session.last_updated = datetime.utcnow()
            return session.to_state()

party_manager = PartyManager()
