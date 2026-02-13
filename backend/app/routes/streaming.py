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
    Stream YouTube audio via proxy with deferred-stream semantics.
    
    The response starts immediately:
    - If cached: bytes flow instantly
    - If not cached: connection held open, bytes flow when authorization completes
    
    This avoids the browser re-requesting and keeps audio element semantics intact.
    """
    # Check cache first (instant path)
    cached = stream_manager.get_cached_url(video_id)
    if cached:
        return await _proxy_stream(cached.url, range, cached.content_type)
    
    # Deferred path: queue extraction and wait (with timeout)
    try:
        cached = await stream_manager.get_stream_url(video_id, priority=1, timeout=45.0)
        return await _proxy_stream(cached.url, range, cached.content_type)
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Stream authorization timed out. Please try again."
        )
    except Exception as e:
        import traceback
        print(f"❌ [STREAM] Critical error for {video_id}: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500, 
            detail=f"Streaming failed for {video_id}: {str(e)}. Check backend logs for full traceback."
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch info: {str(e)}")


@router.get("/youtube/{video_id}/related")
async def get_related_videos(video_id: str, limit: int = 25):
    """
    Get related/recommended videos for auto-queue.
    Uses YouTube Mix playlist (like YouTube's "Up Next") for diverse recommendations.
    🚀 OPTIMIZED: Uses 6-hour in-memory cache to avoid repeated YouTube calls.
    """
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
            info = run_yt_dlp_with_fallback(info_opts, url, download=False)
            
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
    
    return related[:limit]


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

