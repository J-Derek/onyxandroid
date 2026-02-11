"""
Onyx - Downloads Routes
Handles download operations and local library management
"""
import subprocess
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import FileResponse
from typing import Optional
import mimetypes

from ..schemas import DownloadRequest
from ..services.download_manager import DownloadManager
from ..config import settings

router = APIRouter(prefix="/api", tags=["downloads"])

# Initialize download manager with downloads directory
downloads_dir = Path(settings.downloads_dir)
downloads_dir.mkdir(parents=True, exist_ok=True)
download_manager = DownloadManager(downloads_dir)


@router.post("/download")
@router.post("/downloads")
async def start_download(request: DownloadRequest):
    """Start a new download task."""
    try:
        task_id = download_manager.start(request)
        return {"task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


from pydantic import BaseModel
from typing import List

class BatchDownloadRequest(BaseModel):
    urls: List[str]
    format: str = "audio"
    quality: str = "best"
    folder_name: Optional[str] = None


@router.post("/downloads/batch")
async def start_batch_download(request: BatchDownloadRequest):
    """Start multiple download tasks at once (for playlists)."""
    try:
        task_ids = []
        for url in request.urls:
            # Create a download request for each URL
            single_request = DownloadRequest(
                url=url,
                format=request.format,
                quality=request.quality,
                folder_name=request.folder_name
            )
            task_id = download_manager.start(single_request)
            task_ids.append(task_id)
        return {"task_ids": task_ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Static route MUST come before dynamic routes with {task_id}
@router.get("/downloads/ytdlp-version")
async def ytdlp_version():
    """Get the installed yt-dlp version."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        version = result.stdout.strip() if result.returncode == 0 else "unknown"
        return {"version": version}
    except Exception:
        return {"version": "unknown"}


@router.get("/download/{task_id}/progress")
@router.get("/downloads/{task_id}")
async def get_progress(task_id: str):
    """Get the progress of a download task."""
    return download_manager.get_progress(task_id)


@router.delete("/download/{task_id}")
@router.post("/downloads/{task_id}/stop")
async def cancel_download(task_id: str):
    """Cancel an ongoing download."""
    download_manager.cancel(task_id)
    return {"status": "cancelled"}


@router.get("/library")
async def list_library():
    """List all downloaded files in the library."""
    try:
        files = download_manager.list_files()
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/library/stream/{file_path:path}")
async def stream_library_file(file_path: str, range: Optional[str] = Header(None)):
    """
    Stream a downloaded file from the library.
    Supports audio and video files with byte-range requests for seeking.
    """
    # Decode the file path and find the file
    # file_path could be just the filename or a relative path
    
    # Search for the file in downloads directory
    target_file = None
    
    # First try exact match in downloads dir
    candidate = downloads_dir / file_path
    if candidate.exists() and candidate.is_file():
        target_file = candidate
    else:
        # Search recursively for the filename
        search_name = Path(file_path).name
        for f in downloads_dir.rglob("*"):
            if f.is_file() and f.name == search_name:
                target_file = f
                break
    
    if not target_file or not target_file.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    
    # Ensure the file is within downloads directory (security check)
    try:
        target_file.resolve().relative_to(downloads_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine media type
    mime_type, _ = mimetypes.guess_type(str(target_file))
    if not mime_type:
        # Default based on extension
        ext = target_file.suffix.lower()
        mime_map = {
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".opus": "audio/opus",
            ".ogg": "audio/ogg",
            ".flac": "audio/flac",
            ".wav": "audio/wav",
            ".webm": "audio/webm",
            ".mp4": "video/mp4",
            ".mkv": "video/x-matroska",
            ".avi": "video/x-msvideo",
        }
        mime_type = mime_map.get(ext, "application/octet-stream")
    
    return FileResponse(
        path=str(target_file),
        media_type=mime_type,
        filename=target_file.name
    )


@router.get("/download/formats/{video_id}")
async def get_available_formats(video_id: str):
    """
    Probe available audio/video formats WITHOUT downloading.
    Returns format options with estimated file sizes.
    """
    import yt_dlp
    from ..services.cookie_helper import get_yt_dlp_cookie_opts
    
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    ydl_opts.update(get_yt_dlp_cookie_opts())
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f"https://youtube.com/watch?v={video_id}",
                download=False
            )
        
        # Filter audio-only formats (vcodec='none' means no video track)
        audio_formats = []
        for fmt in info.get("formats", []):
            if fmt.get("vcodec") == "none" and fmt.get("acodec") not in (None, "none"):
                filesize = fmt.get("filesize") or fmt.get("filesize_approx", 0)
                audio_formats.append({
                    "format_id": fmt.get("format_id"),
                    "ext": fmt.get("ext"),
                    "codec": fmt.get("acodec", "unknown"),
                    "bitrate": fmt.get("abr", 0),
                    "filesize_bytes": filesize,
                    "filesize_mb": round(filesize / 1_000_000, 2) if filesize else None,
                })
        
        # Filter video formats
        video_formats = []
        for fmt in info.get("formats", []):
            if fmt.get("vcodec") not in (None, "none") and fmt.get("height"):
                filesize = fmt.get("filesize") or fmt.get("filesize_approx", 0)
                video_formats.append({
                    "format_id": fmt.get("format_id"),
                    "resolution": f"{fmt.get('height')}p",
                    "ext": fmt.get("ext"),
                    "codec": fmt.get("vcodec", "unknown"),
                    "fps": fmt.get("fps", 0),
                    "filesize_bytes": filesize,
                    "filesize_mb": round(filesize / 1_000_000, 2) if filesize else None,
                })
        
        # Sort by quality (highest first)
        audio_formats.sort(key=lambda x: x.get("bitrate") or 0, reverse=True)
        video_formats.sort(key=lambda x: int(x["resolution"].replace("p", "") or 0), reverse=True)
        
        # Determine if audio-only is available
        audio_only_available = len(audio_formats) > 0
        
        # Estimate download size (audio if available, else video)
        estimated_size_mb = None
        if audio_formats and audio_formats[0].get("filesize_mb"):
            estimated_size_mb = audio_formats[0]["filesize_mb"]
        elif video_formats and video_formats[0].get("filesize_mb"):
            estimated_size_mb = video_formats[0]["filesize_mb"]
        
        return {
            "title": info.get("title"),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail"),
            "audio_only_available": audio_only_available,
            "estimated_size_mb": estimated_size_mb,
            "audio_formats": audio_formats[:5],  # Top 5 audio options
            "video_formats": video_formats[:8],  # Top 8 video options
            "best_audio": audio_formats[0] if audio_formats else None,
            "best_video": video_formats[0] if video_formats else None,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/search-music")
async def search_music(query: str, limit: int = 10):
    """Search YouTube for music tracks."""
    try:
        results = download_manager.search(query, limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/open-folder")
async def open_folder():
    """Open the downloads folder in file explorer."""
    try:
        folder_path = str(downloads_dir.absolute())
        if os.name == 'nt':  # Windows
            os.startfile(folder_path)
        elif os.name == 'posix':  # macOS/Linux
            subprocess.run(['open' if 'darwin' in os.sys.platform else 'xdg-open', folder_path])
        return {"status": "opened", "path": folder_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
