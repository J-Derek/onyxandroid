from __future__ import annotations

import gc
import json
import re
import shutil
import tempfile
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


import yt_dlp
from fastapi import HTTPException

from ..schemas import DownloadRequest, LibraryFile, ProgressPayload
from ..config import settings
from .cookie_helper import get_yt_dlp_cookie_opts, run_yt_dlp_with_fallback
from .formatting import format_speed



class DownloadManager:
    """Thread-based download orchestrator with concurrent job management."""

    MAX_CONCURRENT_DOWNLOADS = 3  # Maximum simultaneous downloads

    def __init__(self, downloads_dir: Path) -> None:
        self.downloads_dir = downloads_dir
        self.progress: Dict[str, ProgressPayload] = {}
        self.stop_signals: Dict[str, threading.Event] = {}
        self.lock = threading.Lock()
        self._active_downloads: Dict[str, threading.Thread] = {}

    @property
    def active_download_count(self) -> int:
        """Return number of currently active downloads."""
        with self.lock:
            return len([t for t in self._active_downloads.values() if t.is_alive()])

    def start(self, request: DownloadRequest) -> str:
        task_id = str(uuid.uuid4())
        
        # Check if we're at the concurrent limit
        if self.active_download_count >= self.MAX_CONCURRENT_DOWNLOADS:
            self.progress[task_id] = ProgressPayload(
                status="starting", 
                percent=0.0, 
                message=f"Queued (waiting for slot, {self.active_download_count} active)"
            )
        else:
            self.progress[task_id] = ProgressPayload(status="starting", percent=0.0)
        
        stop_event = threading.Event()
        self.stop_signals[task_id] = stop_event

        thread = threading.Thread(
            target=self._run_download,
            args=(task_id, request, stop_event),
            daemon=True,
        )
        
        with self.lock:
            self._active_downloads[task_id] = thread
        
        thread.start()
        return task_id


    def cancel(self, task_id: str) -> None:
        stop_event = self.stop_signals.get(task_id)
        if not stop_event:
            raise HTTPException(status_code=404, detail="Task not found.")
        stop_event.set()

    def get_progress(self, task_id: str) -> ProgressPayload:
        progress = self.progress.get(task_id)
        if not progress:
            raise HTTPException(status_code=404, detail="Task not found.")
        return progress

    def list_files(self) -> List[LibraryFile]:
        files: List[LibraryFile] = []
        for path in self.downloads_dir.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".mp3", ".mp4", ".m4a", ".webm", ".opus", ".ogg"}:
                continue
            rel_path = path.relative_to(self.downloads_dir)
            size_mb = path.stat().st_size / (1024 * 1024)
            file_type = "audio" if path.suffix.lower() in {".mp3", ".m4a", ".opus", ".ogg"} else "video"
            
            # Try to read source URL and thumbnail from metadata file
            source_url = None
            thumbnail = None
            meta_path = path.with_suffix(path.suffix + ".meta.json")
            if meta_path.exists():
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                        source_url = metadata.get("source_url")
                        thumbnail = metadata.get("thumbnail")
                        title = metadata.get("title")
                        artist = metadata.get("artist")
                except Exception:
                    pass  # Ignore metadata read errors
            
            files.append(
                LibraryFile(
                    name=path.name,
                    path=rel_path,
                    size_mb=round(size_mb, 2),
                    type=file_type,
                    modified_at=datetime.fromtimestamp(path.stat().st_mtime),
                    source_url=source_url,
                    thumbnail=thumbnail,
                    title=title,
                    artist=artist,
                )
            )
        files.sort(key=lambda f: f.modified_at, reverse=True)
        return files



    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search YouTube for music tracks and return basic metadata."""
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": "in_playlist",
            "format": "bestaudio/best",
        }
        ydl_opts.update(get_yt_dlp_cookie_opts())
        
        # Add 'music audio' to help prioritize music results
        search_query = f"ytsearch{limit}:{query} music audio"
        try:
            results = run_yt_dlp_with_fallback(ydl_opts, search_query, download=False)

            if not results or "entries" not in results:
                return []
            
            entries = []
            for entry in results["entries"]:
                if not entry:
                    continue
                entries.append({
                    "id": entry.get("id"),
                    "title": entry.get("title"),
                    "artist": entry.get("uploader") or entry.get("channel"),
                    "thumbnail_url": entry.get("thumbnail"),
                    "duration": entry.get("duration"),
                    "url": f"https://www.youtube.com/watch?v={entry.get('id')}",
                    "source": "youtube"
                })
            return entries
        except Exception as e:
            print(f"Search failed: {e}")
            return []

    # Internal helpers
    def _run_download(
        self,
        task_id: str,
        request: DownloadRequest,
        stop_event: threading.Event,
    ) -> None:
        temp_dir = Path(tempfile.mkdtemp(prefix="ytdl-"))
        try:
            if not shutil.which("ffmpeg"):
                raise RuntimeError("FFmpeg not found in PATH.")

            def hook(d: Dict[str, Any]) -> None:
                if stop_event.is_set():
                    raise Exception("Download cancelled by user.")
                if d["status"] == "downloading":
                    percent_str = d.get("_percent_str", "0%")
                    # Strip ANSI codes, then whitespace, then %
                    percent_str = re.sub(r'\x1b\[[0-9;]*m', '', percent_str).strip().rstrip('%')
                    percent = float(percent_str or 0)
                    total_bytes = d.get("total_bytes") or d.get("total_bytes_estimate")
                    downloaded_bytes = d.get("downloaded_bytes", 0)
                    
                    size_mb = (total_bytes / (1024 * 1024)) if total_bytes else None
                    downloaded_mb = (downloaded_bytes / (1024 * 1024)) if downloaded_bytes else None
                    
                    self.progress[task_id] = ProgressPayload(
                        status="downloading",
                        percent=percent,
                        filename=d.get("filename"),
                        speed=format_speed(d.get("speed")),
                        eta=f"{d.get('eta')}s" if d.get("eta") else "Calculating...",
                        size_mb=round(size_mb, 2) if size_mb else None,
                        downloaded_mb=round(downloaded_mb, 2) if downloaded_mb else None,
                        url=str(request.url),
                    )
                elif d["status"] == "finished":
                    self.progress[task_id] = ProgressPayload(
                        status="processing",
                        percent=100.0,
                        message="Processing media...",
                        eta="0s",
                        url=str(request.url),
                    )

            # Determine output template
            def sanitize_filename(v):
                return re.sub(r'[\\/*?:"<>|]', "", v)

            ydl_opts = {
                "quiet": False,
                "no_warnings": False,
                "progress_hooks": [hook],
                "noplaylist": True,
                "socket_timeout": 30,
                "retries": 3,
            }

            if request.title:
                clean_title = sanitize_filename(request.title)
                if request.artist:
                    clean_artist = sanitize_filename(request.artist)
                    filename_tmpl = f"{clean_artist} - {clean_title}.%(ext)s"
                else:
                    filename_tmpl = f"{clean_title}.%(ext)s"
                ydl_opts["outtmpl"] = str(temp_dir / filename_tmpl)
            else:
                ydl_opts["outtmpl"] = str(temp_dir / "%(title)s.%(ext)s")

            ydl_opts.update(get_yt_dlp_cookie_opts())

            if request.format == "audio":
                # ============================================
                # OPTIMIZED AUDIO DOWNLOAD (No Video Fallback)
                # ============================================
                
                # Determine output format (default: opus for best quality/size)
                output_format = getattr(request, 'output_format', None) or "opus"
                
                # Parse quality for bitrate
                preferred_quality = "192"
                if request.quality.isdigit():
                    preferred_quality = request.quality
                elif "kbps" in request.quality.lower():
                    match = re.search(r"(\d+)", request.quality)
                    if match:
                        preferred_quality = match.group(1)
                elif request.quality == "best":
                    preferred_quality = "320"
                
                # Audio-only format selector with fallback to video for extraction
                # Priority: Opus > AAC > any audio codec > bestaudio > best (for HLS-only)
                # FFmpeg will extract audio from video if we fall back to 'best'
                audio_format_string = (
                    "bestaudio[acodec=opus]/bestaudio[acodec=aac]/"
                    "bestaudio[ext=webm]/bestaudio[ext=m4a]/"
                    "bestaudio[acodec!=none]/bestaudio/best"  # /best fallback for HLS-only videos
                )
                
                # If user consents to video fallback, add it as last resort
                allow_fallback = getattr(request, 'allow_video_fallback', False)
                if allow_fallback:
                    audio_format_string += "/best"
                
                # Always add /best fallback for HLS-only videos that only have muxed streams
                ydl_opts["format"] = audio_format_string + "/best"
                ydl_opts["postprocessors"] = []
                
                # CONDITIONAL POST-PROCESSING (convert to user's requested format)
                if output_format in ("opus", "webm"):
                    ydl_opts["postprocessors"].append({
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "opus",
                        "preferredquality": preferred_quality,
                    })
                    
                elif output_format == "mp3":
                    ydl_opts["postprocessors"].append({
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": preferred_quality,
                    })
                    
                elif output_format in ("m4a", "aac"):
                    ydl_opts["postprocessors"].append({
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "aac",
                        "preferredquality": preferred_quality,
                    })
                    
                elif output_format == "flac":
                    ydl_opts["postprocessors"].append({
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "flac",
                    })
                    
                else:
                    # Default: extract to opus (best quality for size)
                    ydl_opts["postprocessors"].append({
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "opus",
                        "preferredquality": preferred_quality,
                    })
                    
            else:
                # ============================================
                # OPTIMIZED VIDEO DOWNLOAD
                # ============================================
                output_container = getattr(request, 'output_format', None) or "mp4"
                
                if request.quality.isdigit():
                    height = request.quality
                    # Prefer H.264 for compatibility, with AV1/VP9 fallbacks
                    ydl_opts["format"] = (
                        f"bestvideo[height<={height}][vcodec^=avc1]+bestaudio[acodec=aac]/"
                        f"bestvideo[height<={height}][vcodec^=vp9]+bestaudio[acodec=opus]/"
                        f"bestvideo[height<={height}]+bestaudio/"
                        f"best[height<={height}]"
                    )
                else:
                    ydl_opts["format"] = "bestvideo+bestaudio/best"
                    
                ydl_opts["merge_output_format"] = output_container

            run_yt_dlp_with_fallback(ydl_opts, str(request.url), download=True)

            files = list(temp_dir.glob("*"))
            if not files:
                raise RuntimeError("Download finished but no file was produced.")
            temp_file = files[0]

            target_folder = self.downloads_dir
            if request.folder_name:
                target_folder = self.downloads_dir / request.folder_name
                target_folder.mkdir(parents=True, exist_ok=True)

            base_name = temp_file.stem
            final_path = target_folder / temp_file.name
            counter = 1
            while final_path.exists():
                final_path = target_folder / f"{base_name} ({counter}){temp_file.suffix}"
                counter += 1

            print(f"Moving file: {temp_file} -> {final_path}")
            # Ensure all file handles are released before moving
            gc.collect()
            time.sleep(1)  # Give FFmpeg time to fully release the file
            shutil.move(str(temp_file), final_path)
            file_size_mb = final_path.stat().st_size / (1024 * 1024)
            print(f"Download completed: {final_path} ({file_size_mb:.2f} MB)")
            
            # Save metadata for re-download capability
            meta_path = final_path.with_suffix(final_path.suffix + ".meta.json")
            metadata = {
                "source_url": str(request.url),
                "format": request.format,
                "quality": request.quality,
                "downloaded_at": datetime.now().isoformat(),
                "title": request.title,
                "artist": request.artist,
                "thumbnail": request.thumbnail if hasattr(request, 'thumbnail') else None
            }
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2)
            
            # Make the metadata file hidden on Windows
            try:
                import ctypes
                FILE_ATTRIBUTE_HIDDEN = 0x02
                ctypes.windll.kernel32.SetFileAttributesW(str(meta_path), FILE_ATTRIBUTE_HIDDEN)
            except Exception:
                pass  # Ignore errors on non-Windows systems

            
            self.progress[task_id] = ProgressPayload(
                status="completed",
                percent=100.0,
                filename=final_path.name,
                size_mb=round(file_size_mb, 2),
                location=str(final_path),
                url=str(request.url),
            )

        except Exception as exc:  # noqa: BLE001
            self.progress[task_id] = ProgressPayload(
                status="error",
                percent=0.0,
                error=str(exc),
            )
        finally:
            if task_id in self.stop_signals:
                self.stop_signals.pop(task_id, None)
            shutil.rmtree(temp_dir, ignore_errors=True)


