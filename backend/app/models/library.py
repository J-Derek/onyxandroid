"""
Onyx Streaming - Library Models
Track definitions for the local music library
"""
from sqlalchemy import Column, Integer, String, DateTime, Enum, Float, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

from app.database import Base

class TrackSource(str, enum.Enum):
    LOCAL = "local"
    YOUTUBE = "youtube"
    SPOTIFY = "spotify"
    CACHED = "cached"  # YouTube tracks cached locally

class LibraryTrack(Base):
    """A track in the central library"""
    __tablename__ = "library_tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    artist = Column(String(255), nullable=False, index=True)
    album = Column(String(255), nullable=True)
    album_artist = Column(String(255), nullable=True)
    genre = Column(String(100), nullable=True)
    year = Column(Integer, nullable=True)
    track_number = Column(Integer, nullable=True)
    
    # Path to local file (or ID for remote)
    path = Column(String(500), nullable=False)
    source = Column(String(50), default="local")  # Use String instead of Enum for flexibility
    source_url = Column(String(500), nullable=True)
    youtube_id = Column(String(50), nullable=True)
    type = Column(String(20), default="audio")  # audio or video
    
    # Offline storage tracking
    is_offline = Column(Boolean, default=False)  # If track is available for in-app offline play
    local_path = Column(String(500), nullable=True)  # Absolute path if downloaded to device
    
    # Duration and size
    duration_sec = Column(Integer, default=0)  # Duration in seconds
    size_mb = Column(Float, default=0)
    
    thumbnail_url = Column(String(500), nullable=True)
    waveform_data = Column(String, nullable=True)  # JSON waveform for visualization
    
    # Timestamps and usage
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_played = Column(DateTime, nullable=True)
    play_count = Column(Integer, default=0)
    added_by_user_id = Column(Integer, nullable=True)

    # Convenience properties
    @property
    def duration(self):
        """Alias for duration_sec for backward compatibility"""
        return self.duration_sec or 0
    
    @property
    def thumbnail(self):
        """Alias for thumbnail_url for backward compatibility"""
        return self.thumbnail_url


# =============================================================================
# PLAYLIST MODELS
# =============================================================================

class Playlist(Base):
    """User-created playlist containing track references"""
    __tablename__ = "playlists"
    
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    cover_image = Column(String(500), nullable=True)  # URL or local path
    
    is_system = Column(Boolean, default=False)  # For "Liked Songs", "Recently Played" etc.
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner = relationship("app.models.user.Profile", back_populates="playlists")
    tracks = relationship(
        "PlaylistTrack",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="PlaylistTrack.position"
    )
    
    @property
    def track_count(self):
        """Number of tracks in playlist"""
        return len(self.tracks) if self.tracks else 0


class PlaylistTrack(Base):
    """Junction table linking playlists to tracks with position ordering"""
    __tablename__ = "playlist_tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    
    playlist_id = Column(
        Integer,
        ForeignKey("playlists.id", ondelete="CASCADE"),
        nullable=False
    )
    
    track_id = Column(
        Integer,
        ForeignKey("library_tracks.id", ondelete="CASCADE"),
        nullable=False
    )
    
    position = Column(Integer, nullable=False)  # Order within playlist
    added_at = Column(DateTime, default=datetime.utcnow)
    
    # Unique constraint - no duplicate tracks in same playlist
    __table_args__ = (
        UniqueConstraint("playlist_id", "track_id", name="uq_playlist_track"),
    )
    
    # Relationships
    playlist = relationship("Playlist", back_populates="tracks")
    track = relationship("LibraryTrack")
