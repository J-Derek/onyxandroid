"""
Onyx Streaming - Streaming Routes
High-performance audio streaming with URL caching and optimization.
"""
from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.responses import FileResponse, StreamingResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path
import os
import anyio
import secrets
import sys
import asyncio
import subprocess
from typing import Dict, Optional, List, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import httpx

from app.database import get_db
from app.models.library import LibraryTrack
from app.config import settings
from app.services.cookie_helper import run_yt_dlp_with_fallback, get_yt_dlp_cookie_opts
from app.services.stream_manager import stream_manager

router = APIRouter(prefix="/api/streaming", tags=["Streaming"])

# Optimized yt-dlp options for FAST extraction
FAST_YDL_OPTS = {
    # Request best audio - we'll manually select progressive format in stream_manager
    # Do NOT use restrictive format strings here - they are advisory only
    "format": "bestaudio/best",
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "extract_flat": False,
    # Speed optimizations
    "no_playlist": True,
    "no_check_certificate": True,
    "prefer_insecure": True,
    "geo_bypass": True,
    # Skip unnecessary processing
    "writesubtitles": False,
    "writeautomaticsub": False,
    "writethumbnail": False,
    "postprocessors": [],
}

# =============================================================================
# 🚀 RECOMMENDATION CACHE - Avoid repeated YouTube calls
# =============================================================================

@dataclass
class CachedRecommendation:
    tracks: list
    cached_at: datetime
    ttl_hours: int = 6  # Cache for 6 hours
    
    def is_valid(self) -> bool:
        return datetime.now() - self.cached_at < timedelta(hours=self.ttl_hours)

# In-memory cache: video_id -> CachedRecommendation
_recommendation_cache: Dict[str, CachedRecommendation] = {}


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/track/{track_id}")
async def stream_track(
    track_id: int,
    range: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Stream a library track with byte-range support.
    This allows for instant seeking and better performance in web players.
    """
    # 1. Fetch track from DB
    result = await db.execute(
        select(LibraryTrack).where(LibraryTrack.id == track_id)
    )
    track = result.scalar_one_or_none()
    
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found in record"
        )
    
    if not track.path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Track session is not local. Stream from YouTube proxy."
        )

    # 2. Verify file exists
    file_path = Path(track.path)
    if not file_path.exists():
        potential_path = settings.downloads_dir / file_path.name
        if potential_path.exists():
            file_path = potential_path
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Audio file not found at {file_path}"
            )

    # 3. Return FileResponse
    return FileResponse(
        path=file_path,
        media_type="audio/mpeg" if file_path.suffix == ".mp3" else "audio/mp4",
        filename=file_path.name
    )


@router.get("/youtube/{video_id}")
async def stream_youtube(video_id: str, range: Optional[str] = Header(None)):
    """
    Stream YouTube audio with two strategies:
    1. URL extraction + proxy (fast, supports seeking)
    2. yt-dlp pipe fallback (works on datacenter IPs where URL extraction fails)
    """
    # Check cache first (instant path)
    cached = stream_manager.get_cached_url(video_id)
    if cached:
        return await _proxy_stream(cached.url, range, cached.content_type)
    
    # Strategy 1: Try URL extraction + proxy (supports byte-range seeking)
    try:
        cached = await stream_manager.get_stream_url(video_id, priority=1, timeout=45.0)
        return await _proxy_stream(cached.url, range, cached.content_type)
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Stream authorization timed out. Please try again."
        )
    except ValueError as e:
        # ValueError = "No progressive audio format available" (datacenter IP blocked)
        # Fall through to pipe-based streaming
        print(f"⚠️ [STREAM] URL extraction failed for {video_id}, falling back to yt-dlp pipe: {e}")
        sys.stdout.flush()
    except Exception as e:
        import traceback
        # Check if it's a format/extraction issue (fall through to pipe)
        err_msg = str(e).lower()
        if "format" in err_msg or "no progressive" in err_msg:
            print(f"⚠️ [STREAM] Extraction failed for {video_id}, falling back to yt-dlp pipe: {e}")
            sys.stdout.flush()
        else:
            print(f"❌ [STREAM] Critical error for {video_id}: {str(e)}")
            print(traceback.format_exc())
            sys.stdout.flush()
            raise HTTPException(
                status_code=502, 
                detail=f"Upstream extraction failed for {video_id}: {str(e)}"
            )
    
    # Strategy 2: yt-dlp pipe-based streaming (datacenter fallback)
    # yt-dlp handles PO tokens, signatures, and downloading internally
    return await _ytdlp_pipe_stream(video_id)


async def _ytdlp_pipe_stream(video_id: str):
    """
    Pipe-based streaming: spawns yt-dlp as a subprocess to download audio
    directly to stdout, then streams it to the client.
    
    This bypasses the URL extraction entirely — yt-dlp handles PO tokens,
    signatures, cookies, and the actual download internally. Works on
    datacenter IPs where extract_info returns 0 audio formats.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Get cookie path
    from app.services.cookie_helper import is_cookie_file_valid, _cookie_state
    cookie_path = None
    if is_cookie_file_valid() and _cookie_state.get("file_path"):
        cookie_path = str(_cookie_state["file_path"])
    
    # Step 1: Diagnostic - list what formats YouTube actually returns from this IP
    diag_cmd = [
        sys.executable, "-m", "yt_dlp",
        "--list-formats",
        "--no-playlist",
        "--no-check-certificate",
        "--extractor-args", "youtube:player_client=tv_embedded",
    ]
    if cookie_path:
        diag_cmd.extend(["--cookies", cookie_path])
    if settings.proxy_url:
        diag_cmd.extend(["--proxy", settings.proxy_url])
    diag_cmd.append(url)
    
    print(f"🔍 [PIPE] Listing available formats for {video_id}...")
    sys.stdout.flush()
    try:
        diag_proc = await asyncio.create_subprocess_exec(
            *diag_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        diag_stdout, diag_stderr = await asyncio.wait_for(
            diag_proc.communicate(), timeout=20.0
        )
        diag_output = (diag_stdout or b"").decode(errors="ignore")
        diag_errors = (diag_stderr or b"").decode(errors="ignore")
        print(f"📋 [PIPE] Available formats for {video_id}:")
        for line in diag_output.strip().split("\n")[-15:]:  # last 15 lines
            print(f"  {line}")
        if diag_errors.strip():
            print(f"  STDERR: {diag_errors.strip()[:200]}")
        sys.stdout.flush()
    except Exception as e:
        print(f"⚠️ [PIPE] Format listing failed: {e}")
        sys.stdout.flush()
    
    # Step 2: Try streaming with different strategies
    strategies = [
        {
            "name": "tv_embedded + cookies",
            "args": [
                "--extractor-args", "youtube:player_client=tv_embedded",
            ],
            "use_cookies": True,
        },
        {
            "name": "no cookies (anonymous)",
            "args": [],
            "use_cookies": False,
        },
        {
            "name": "tv_embedded + no format filter",
            "args": [
                "--extractor-args", "youtube:player_client=tv_embedded",
                "--ignore-no-formats-error",
            ],
            "use_cookies": True,
            "no_format": True,
        },
    ]
    
    last_error = "No strategies succeeded"
    
    for strategy in strategies:
        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--output", "-",  # pipe to stdout
            "--quiet",
            "--no-warnings",
            "--no-playlist",
            "--no-check-certificate",
            "--geo-bypass",
        ]
        
        # Add format only if not disabled
        if not strategy.get("no_format"):
            cmd.extend(["--format", "bestaudio/best"])
        
        # Add strategy-specific args
        cmd.extend(strategy["args"])
        
        # Add cookies if strategy uses them
        if strategy["use_cookies"] and cookie_path:
            cmd.extend(["--cookies", cookie_path])
        
        # Add proxy if configured
        if settings.proxy_url:
            cmd.extend(["--proxy", settings.proxy_url])
        
        cmd.append(url)
        
        print(f"🎵 [PIPE] Strategy: {strategy['name']} for {video_id}")
        sys.stdout.flush()
        
        try:
            # Start yt-dlp subprocess
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            
            # Check if process started and has stdout
            if process.stdout is None:
                raise RuntimeError("Failed to open yt-dlp stdout pipe")
            
            # Read a small chunk first to verify we're getting audio data
            first_chunk = await asyncio.wait_for(
                process.stdout.read(8192),
                timeout=30.0
            )
            
            if not first_chunk:
                # Process exited immediately — read stderr for error
                stderr_data = await process.stderr.read() if process.stderr else b""
                err_msg = stderr_data.decode(errors="ignore").strip()
                print(f"❌ [PIPE] Strategy '{strategy['name']}' failed: {err_msg[:200]}")
                sys.stdout.flush()
                last_error = err_msg[:200]
                # Clean up process
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
                await process.wait()
                continue  # Try next strategy
            
            print(f"✅ [PIPE] Strategy '{strategy['name']}' SUCCESS! First chunk: {len(first_chunk)} bytes")
            sys.stdout.flush()
            
            # Determine content type from first bytes
            content_type = "audio/mp4"  # default
            if first_chunk[:4] == b"OggS":
                content_type = "audio/ogg"
            elif first_chunk[:4] == b"\x1aE\xdf\xa3":
                content_type = "audio/webm"
            
            async def stream_generator():
                """Yield audio chunks from yt-dlp subprocess."""
                try:
                    yield first_chunk
                    while True:
                        chunk = await process.stdout.read(65536)  # 64KB chunks
                        if not chunk:
                            break
                        yield chunk
                finally:
                    # Ensure process is cleaned up
                    try:
                        process.kill()
                    except ProcessLookupError:
                        pass
                    await process.wait()
            
            return StreamingResponse(
                stream_generator(),
                media_type=content_type,
                headers={
                    "Accept-Ranges": "none",  # No seeking in pipe mode
                    "Cache-Control": "no-cache",
                    "X-Stream-Mode": "pipe",
                }
            )
            
        except asyncio.TimeoutError:
            print(f"⏱️ [PIPE] Strategy '{strategy['name']}' timed out")
            sys.stdout.flush()
            last_error = "timed out"
            continue  # Try next strategy
        except HTTPException:
            raise
        except Exception as e:
            print(f"⚠️ [PIPE] Strategy '{strategy['name']}' error: {e}")
            sys.stdout.flush()
            last_error = str(e)
            continue  # Try next strategy
    
    # All strategies exhausted
    print(f"❌ [PIPE] ALL strategies failed for {video_id}: {last_error}")
    sys.stdout.flush()
    raise HTTPException(
        status_code=502,
        detail=f"All streaming strategies failed for {video_id}. YouTube may block this server's IP from serving audio. Last error: {last_error}"
    )


async def _proxy_stream(stream_url: str, request_range: Optional[str] = None, known_content_type: str = "audio/mp4"):
    """
    Proxy audio stream with full byte-range support including header propagation.
    
    known_content_type: The MIME type determined during format selection.
                       This is more reliable than trusting the CDN response.
    """
    req_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    if request_range:
        req_headers["Range"] = request_range

    # Use a longer timeout for the initial connection
    # Use proxy if configured
    proxy = settings.proxy_url if settings.proxy_url else None
    
    # 🕵️‍♂️ Phase 22: Verbose Debug Logging for Proxy Issues
    print(f"DEBUG: [STREAM] Starting request for: {stream_url[:60]}...")
    print(f"DEBUG: [STREAM] Proxy used: {proxy}")
    print(f"DEBUG: [STREAM] Range Header: {request_range}")
    sys.stdout.flush()

    client = httpx.AsyncClient(
        proxy=proxy,
        timeout=httpx.Timeout(120.0, connect=15.0)
    )
    
    try:
        # Start the streaming request to YouTube
        response = await client.send(
            client.build_request("GET", stream_url, headers=req_headers),
            stream=True
        )
        
        # Capture the actual status code from YouTube
        status_code = response.status_code
        
        # If YouTube returns an error (403, 404, etc.), log it and fail early
        if status_code >= 400:
            error_body = await response.aread()
            error_msg = error_body.decode(errors="ignore")[:500]
            print(f"❌ [PROXY] Upstream error {status_code} for {stream_url[:50]}")
            print(f"        Response: {error_msg}")
            
            # Close resources since we aren't streaming
            await response.aclose()
            await client.aclose()
            
            detail = f"Upstream {status_code} from YouTube"
            if status_code == 403:
                detail += ". This likely means the streaming IP does not match the extraction IP (IP-Locking)."
            
            raise HTTPException(status_code=status_code, detail=detail)

        # Extract exact headers from YouTube to forward to the browser
        
        # We MUST forward these headers exactly for range-based media to work
        PASSTHROUGH_HEADERS = [
            "Content-Length",
            "Content-Range",
            "Accept-Ranges",
            "Last-Modified",
            "ETag",
        ]

        resp_headers = {
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type, Accept-Ranges",
        }
        
        # Forward requested headers if they exist in the YouTube response
        for header in PASSTHROUGH_HEADERS:
            if header in response.headers:
                resp_headers[header] = response.headers[header]

        # 🕵️‍♂️ Phase 22: Dynamic Content-Type forwarding
        # Use YouTube's content type if available, otherwise fallback to our guess
        content_type = response.headers.get("Content-Type", known_content_type)
        
        # Log final headers for diagnosis
        print(f"DEBUG: [STREAM] Upstream status {status_code}")
        print(f"DEBUG: [STREAM] Content-Type: {content_type}")
        print(f"DEBUG: [STREAM] Response Headers: {dict(resp_headers)}")
        sys.stdout.flush()

        async def stream_audio():
            try:
                # Use a smaller chunk size for more immediate streaming
                async for chunk in response.aiter_bytes(chunk_size=64 * 1024):
                    yield chunk
            except (httpx.ReadError, httpx.RemoteProtocolError):
                pass
            except Exception as e:
                print(f"Stream chunk error: {e}")
            finally:
                await response.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_audio(),
            status_code=status_code,
            media_type=content_type,
            headers=resp_headers
        )
    except Exception as e:
        await client.aclose()
        raise HTTPException(status_code=500, detail=f"Stream proxy error: {str(e)}")



@router.get("/youtube/{video_id}/prefetch")
async def prefetch_youtube_url(video_id: str, priority: int = 3):
    """
    Pre-fetch and cache a YouTube stream URL with priority.
    - priority 1: Immediate play (highest)
    - priority 2: Queue items (next up)
    - priority 3: Visible items (viewport)
    
    Returns immediately, extraction happens in background.
    """
    queued = await stream_manager.prefetch(video_id, priority=priority)
    cached = stream_manager.get_cached_url(video_id)
    return {
        "video_id": video_id,
        "queued": queued,
        "cached": cached is not None,
        "priority": priority
    }


@router.get("/youtube/{video_id}/info")
async def get_youtube_info(video_id: str):
    """Get YouTube video info including thumbnail."""
    # Check cache first
    cached = stream_manager.get_cached_url(video_id)
    if cached and cached.thumbnail:
        return {
            "id": video_id,
            "thumbnail": cached.thumbnail,
            "duration": cached.duration,
            "cached": True
        }
    
    ydl_opts = {"quiet": True, "no_warnings": True}
    ydl_opts.update(get_yt_dlp_cookie_opts())
    
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        # Use stream_manager's persistent instance for info too if possible
        # For now, keep it simple but run in threadpool
        info = await anyio.to_thread.run_sync(
            run_yt_dlp_with_fallback, ydl_opts, url, False
        )
        return {
            "id": video_id,
            "title": info.get("title"),
            "artist": info.get("uploader") or info.get("channel"),
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration"),
        }
    except Exception as e:
        import traceback
        print(f"❌ [INFO] Failed to fetch info for {video_id}: {str(e)}")
        print(traceback.format_exc())
        sys.stdout.flush()
        raise HTTPException(status_code=502, detail=f"Upstream info fetch failed: {str(e)}")


@router.get("/youtube/{video_id}/related")
async def get_related_videos(video_id: str, limit: int = 25):
    """
    Get related/recommended videos for auto-queue.
    Uses YouTube Mix playlist (like YouTube's "Up Next") for diverse recommendations.
    🚀 OPTIMIZED: Uses 6-hour in-memory cache to avoid repeated YouTube calls.
    """
    try:
        # 🚀 CHECK CACHE FIRST (instant return!)
        if video_id in _recommendation_cache:
            cached = _recommendation_cache[video_id]
            if cached.is_valid():
                print(f"[Cache HIT] Returning {len(cached.tracks)} cached tracks for {video_id}")
                return cached.tracks[:limit]
            else:
                # Cache expired, remove it
                del _recommendation_cache[video_id]

        print(f"[Cache MISS] Fetching related tracks for {video_id}...")
        sys.stdout.flush()

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": "in_playlist",
        }
        ydl_opts.update(get_yt_dlp_cookie_opts())

        related = []

        # Method 1: Try to get YouTube's Mix playlist (RD = Radio/Mix)
        mix_url = f"https://www.youtube.com/watch?v={video_id}&list=RD{video_id}"
        try:
            mix_info = await anyio.to_thread.run_sync(
                run_yt_dlp_with_fallback, ydl_opts, mix_url, False
            )

            if mix_info and "entries" in mix_info:
                for entry in mix_info["entries"]:
                    if entry and entry.get("id") and entry.get("id") != video_id:
                        if not any(r["id"] == entry["id"] for r in related):
                            related.append({
                                "id": entry.get("id"),
                                "title": entry.get("title", "Unknown"),
                                "artist": entry.get("uploader") or entry.get("channel") or "YouTube",
                                "thumbnail_url": entry.get("thumbnail") or f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg",
                                "duration": entry.get("duration"),
                                "source": "youtube"
                            })
                        if len(related) >= limit:
                            break
        except Exception as e:
            print(f"Mix playlist failed: {e}")

        # Method 2: Genre-based searches for diversity
        if len(related) < limit:
            try:
                info_opts = {"quiet": True, "no_warnings": True}
                info_opts.update(get_yt_dlp_cookie_opts())

                url = f"https://www.youtube.com/watch?v={video_id}"
                info = await anyio.to_thread.run_sync(
                    run_yt_dlp_with_fallback, info_opts, url, False
                )

                categories = info.get("categories", []) if info else []
                search_queries = []

                for cat in categories[:2]:
                    if "music" in cat.lower():
                        search_queries.append(f"{cat} 2024 hits")

                if not search_queries:
                    search_queries = [
                        "dancehall music 2024",
                        "afrobeats top hits",
                        "reggae vibes 2024",
                        "soca music latest"
                    ]

                search_opts = {
                    "quiet": True,
                    "no_warnings": True,
                    "extract_flat": "in_playlist",
                }
                search_opts.update(get_yt_dlp_cookie_opts())

                for query in search_queries[:2]:
                    if len(related) >= limit:
                        break

                    try:
                        needed = limit - len(related)
                        search_results = run_yt_dlp_with_fallback(
                            search_opts,
                            f"ytsearch{needed}:{query}",
                            download=False
                        )
                        if search_results and "entries" in search_results:
                            for entry in search_results["entries"]:
                                if entry and entry.get("id") and entry.get("id") != video_id:
                                    if not any(r["id"] == entry["id"] for r in related):
                                        related.append({
                                            "id": entry.get("id"),
                                            "title": entry.get("title", "Unknown"),
                                            "artist": entry.get("uploader") or entry.get("channel") or "YouTube",
                                            "thumbnail_url": entry.get("thumbnail") or f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg",
                                            "duration": entry.get("duration"),
                                            "source": "youtube"
                                        })
                                    if len(related) >= limit:
                                        break
                    except Exception:
                        pass
            except Exception:
                pass

        # 🚀 CACHE RESULTS for future requests (6 hour TTL)
        if related:
            _recommendation_cache[video_id] = CachedRecommendation(
                tracks=related,
                cached_at=datetime.now()
            )
            print(f"[Cache SAVE] Stored {len(related)} tracks for {video_id}")
            sys.stdout.flush()

        return related[:limit]
    except Exception as e:
        import traceback
        print(f"❌ [RELATED] Critical error for {video_id}: {str(e)}")
        print(traceback.format_exc())
        sys.stdout.flush()
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=502,
            content={"error": f"Upstream extraction failed: {str(e)}"}
        )


@router.get("/cache/stats")
async def cache_stats():
    """Get cache and engine statistics for debugging."""
    return stream_manager.get_stats()


@router.get("/trending")
async def get_trending_music(limit: int = 10):
    """
    Fetch trending music videos from YouTube.
    Uses multiple sources for diverse trending content.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
    }
    ydl_opts.update(get_yt_dlp_cookie_opts())
    
    trending = []
    
    # Search queries for trending music (mix of genres and charts)
    search_queries = [
        "trending music 2024",
        "top hits 2024",
        "new music this week",
        "viral songs 2024",
        "dancehall hits 2024",
        "afrobeats 2024",
    ]
    
    import random
    # Pick 2-3 random queries for variety
    selected_queries = random.sample(search_queries, min(3, len(search_queries)))
    
    for query in selected_queries:
        if len(trending) >= limit:
            break
            
        try:
            needed = limit - len(trending)
            search_opts = {
                "quiet": True,
                "no_warnings": True,
                "extract_flat": True,
            }
            search_opts.update(get_yt_dlp_cookie_opts())
            
            search_results = await anyio.to_thread.run_sync(
                run_yt_dlp_with_fallback,
                search_opts,
                f"ytsearch{needed + 5}:{query}",  # Get a few extra for filtering
                False
            )
            
            if search_results and "entries" in search_results:
                for entry in search_results["entries"]:
                    if not entry or not entry.get("id"):
                        continue
                    # Skip if already have this video
                    if any(t["id"] == entry["id"] for t in trending):
                        continue
                    # Skip if no title
                    if not entry.get("title"):
                        continue
                        
                    trending.append({
                        "id": entry.get("id"),
                        "title": entry.get("title", "Unknown"),
                        "artist": entry.get("uploader") or entry.get("channel") or "YouTube",
                        "thumbnail_url": entry.get("thumbnail") or f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg",
                        "duration": entry.get("duration") or 0,
                        "source": "youtube",
                        "youtube_id": entry.get("id")
                    })
                    
                    if len(trending) >= limit:
                        break
        except Exception as e:
            print(f"Trending search failed for '{query}': {e}")
            continue
    
    # Shuffle to mix content from different queries
    random.shuffle(trending)
    
    return trending[:limit]

