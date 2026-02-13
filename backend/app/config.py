import os
import secrets
from pathlib import Path
from typing import List, Optional
from functools import lru_cache

from pydantic import BaseModel, Field, ConfigDict


class Settings(BaseModel):
    """Runtime configuration for the backend service."""

    model_config = ConfigDict(
        env_prefix="YTDL_",
        env_file=".env",
        arbitrary_types_allowed=True,
    )

    app_name: str = "Onyx API"
    downloads_dir: Path = Field(
        default=Path.home() / "Downloads" / "YouTube_Downloads",
        description="Location where completed files are stored.",
    )
    temp_dir: Path = Field(
        default=Path.home() / ".cache" / "youtube_downloader" / "tmp",
        description="Directory for temporary download artifacts.",
    )
    ffmpeg_bin_path: Optional[Path] = Field(
        default=None,
        description="Optional path to a FFmpeg bin directory to append to PATH.",
    )
    allowed_origins: List[str] = Field(
        default=["*"],
        description="CORS allow list for the API.",
    )
    browser_for_cookies: str = Field(
        default="brave",
        description="Browser to extract cookies from (e.g., 'brave', 'chrome', 'edge', 'firefox').",
    )
    
    # Auth settings
    jwt_secret: str = Field(
        default_factory=lambda: os.getenv("JWT_SECRET", secrets.token_hex(32)),
        description="Secret key for JWT token signing.",
    )
    jwt_access_token_expire_hours: int = Field(
        default=24,
        description="Hours until access token expires.",
    )
    jwt_refresh_token_expire_days: int = Field(
        default=30,
        description="Days until refresh token expires.",
    )
    debug: bool = Field(
        default=True,
        description="Enable debug logging.",
    )
    proxy_url: Optional[str] = Field(
        default=os.getenv("YTDL_PROXY_URL"),
        description="Optional proxy URL (e.g., http://user:pass@proxy:port) for yt-dlp.",
    )


settings = Settings()

settings.downloads_dir.mkdir(parents=True, exist_ok=True)
settings.temp_dir.mkdir(parents=True, exist_ok=True)

if settings.ffmpeg_bin_path and settings.ffmpeg_bin_path.exists():
    os.environ["PATH"] += os.pathsep + str(settings.ffmpeg_bin_path)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return settings
