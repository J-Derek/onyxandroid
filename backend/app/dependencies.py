from __future__ import annotations

from .config import settings
from .services.download_manager import DownloadManager

download_manager = DownloadManager(settings.downloads_dir)


def get_download_manager() -> DownloadManager:
    return download_manager


