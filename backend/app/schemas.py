from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import List, Literal, Optional

from pydantic import BaseModel, HttpUrl, PositiveInt, field_validator


class VideoFormat(BaseModel):
    height: Optional[int] = None
    ext: Optional[str] = None
    note: Optional[str] = None


class AudioFormat(BaseModel):
    abr: Optional[int] = None
    ext: Optional[str] = None


class VideoInfo(BaseModel):
    id: str
    title: str
    uploader: Optional[str] = None
    duration: Optional[str] = None
    views: Optional[str] = None
    thumbnail: Optional[HttpUrl] = None
    is_playlist: bool = False
    formats: List[VideoFormat] = []
    audio_formats: List[AudioFormat] = []


class VideoInfoRequest(BaseModel):
    url: HttpUrl
    force_single: bool = False


class SuggestionRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Query must be at least 2 characters.")
        return value


class DownloadRequest(BaseModel):
    url: HttpUrl
    format: Literal["audio", "video"] = "video"
    quality: str = "best"
    folder_name: Optional[str] = None
    output_format: Optional[str] = None  # mp3, m4a, opus, flac for audio | mp4, mkv for video
    allow_video_fallback: bool = False  # If True, allow downloading video when audio-only unavailable
    title: Optional[str] = None
    artist: Optional[str] = None
    thumbnail: Optional[str] = None


class BatchDownloadRequest(BaseModel):
    urls: List[HttpUrl]
    format: Literal["audio", "video"] = "video"
    quality: str = "best"
    folder_name: Optional[str] = None


class QueueItem(BaseModel):
    id: str
    url: HttpUrl
    format: Literal["audio", "video"]
    quality: str
    folder_name: Optional[str] = None
    title: Optional[str] = None
    thumbnail: Optional[str] = None


class DownloadResponse(BaseModel):
    task_id: str
    status: str


class ProgressPayload(BaseModel):
    status: Literal["starting", "downloading", "processing", "completed", "error"]
    percent: float = 0.0
    filename: Optional[str] = None
    speed: Optional[str] = None
    eta: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None
    size_mb: Optional[float] = None
    downloaded_mb: Optional[float] = None
    location: Optional[str] = None
    url: Optional[str] = None


class PlaylistRequest(BaseModel):
    url: HttpUrl
    limit: PositiveInt = 100


class PlaylistVideo(BaseModel):
    id: str
    title: str
    url: HttpUrl
    thumbnail: Optional[HttpUrl] = None
    duration: Optional[str] = None
    uploader: Optional[str] = None


class YoutubePlaylistResponse(BaseModel):
    title: str
    count: int
    videos: List[PlaylistVideo]


class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image: Optional[str] = None


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None


class PlaylistTrackResponse(BaseModel):
    id: int
    title: str
    artist: str
    thumbnail_url: Optional[str] = None
    duration: int
    position: int
    added_at: datetime


class PlaylistResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    is_system: bool = False
    track_count: int
    created_at: datetime
    updated_at: datetime
    tracks: Optional[List[PlaylistTrackResponse]] = None


class SearchRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Query is required.")
        return value


class SearchResult(BaseModel):
    id: str
    title: str
    uploader: Optional[str] = None
    duration: Optional[str] = None
    url: HttpUrl
    thumbnail: Optional[HttpUrl] = None


class LibraryFile(BaseModel):
    name: str
    path: Path
    size_mb: float
    type: Literal["audio", "video"]
    modified_at: datetime
    source_url: Optional[str] = None  # Original YouTube URL for re-downloading
    thumbnail: Optional[str] = None   # Thumbnail URL from YouTube
    title: Optional[str] = None
    artist: Optional[str] = None


class AnalyticsRequest(BaseModel):
    track_id: Optional[int] = None
    youtube_id: Optional[str] = None
    duration_listened: int = 0
    completed: bool = False
    title: Optional[str] = None
    artist: Optional[str] = None
    thumbnail_url: Optional[str] = None
    skip_auto_cache: bool = False  # If True, skip auto-caching (user preference)




# =============================================================================
# QUEUE SCHEMAS
# =============================================================================

class QueueTrack(BaseModel):
    """Track representation for queue persistence"""
    id: str | int
    title: str
    artist: str
    album: Optional[str] = None
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    source: Literal["youtube", "local", "cached"]
    uri: str
    youtube_id: Optional[str] = None


class QueueStateRequest(BaseModel):
    """Request body for updating queue state"""
    tracks: List[QueueTrack]
    current_index: int = -1
    current_time_sec: float = 0.0
    repeat_mode: Literal["none", "one", "all"] = "none"
    is_shuffle: bool = False


class QueueStateResponse(BaseModel):
    """Response body for queue state"""
    tracks: List[QueueTrack]
    current_index: int
    current_time_sec: float
    repeat_mode: str
    is_shuffle: bool
    updated_at: Optional[datetime] = None


class AddTrackRequest(BaseModel):
    """Request body for adding a single track to queue"""
    track: QueueTrack
    position: Optional[int] = None  # None = append, int = insert at position
# =============================================================================
# PARTY MODE SCHEMAS
# =============================================================================

class PartyTrack(QueueTrack):
    """Alias for QueueTrack in Party Mode context"""
    pass


class PartySessionState(BaseModel):
    """Full state of a party session"""
    session_id: str
    host_id: str
    queue: List[QueueTrack]
    current_index: int = -1
    is_playing: bool = False
    is_locked: bool = False  # If True, only host can modify
    updated_at: datetime


class PartyJoinRequest(BaseModel):
    """Request to join a party session"""
    session_id: str


class PartyActionRequest(BaseModel):
    """Generic request for party actions (add, remove, skip, vote)"""
    action: Literal["add", "remove", "skip", "vote_skip", "play_next", "clear", "reorder"]
    track: Optional[QueueTrack] = None
    target_id: Optional[str | int] = None
    from_index: Optional[int] = None
    to_index: Optional[int] = None
    user_id: Optional[str] = None
