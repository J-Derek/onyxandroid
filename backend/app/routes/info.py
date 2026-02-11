import asyncio
from fastapi import APIRouter, HTTPException

from ..schemas import (
    PlaylistRequest,
    SearchRequest,
    SuggestionRequest,
    VideoInfoRequest,
)
from ..services.yt_client import YTDLClient

router = APIRouter(prefix="/api", tags=["info"])
client = YTDLClient()


@router.post("/info")
async def video_info(payload: VideoInfoRequest):
    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, client.get_video_info, str(payload.url), payload.force_single
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Trending cache for faster loading
_trending_cache = {
    "data": None,
    "timestamp": 0,
}
_TRENDING_CACHE_TTL = 600  # 10 minutes

# Suggestions cache for FAST repeat queries
_suggestions_cache: dict = {}  # {query: {"data": [...], "timestamp": float}}
_SUGGESTIONS_CACHE_TTL = 60  # 60 seconds - short TTL for freshness


def _clean_old_suggestions():
    """Remove expired cache entries to prevent memory bloat."""
    import time
    now = time.time()
    expired = [k for k, v in _suggestions_cache.items() if now - v["timestamp"] > _SUGGESTIONS_CACHE_TTL * 2]
    for k in expired:
        del _suggestions_cache[k]


@router.get("/trending")
async def trending(refresh: bool = False):
    import time
    
    # Check cache first (skip if refresh requested)
    now = time.time()
    if not refresh and _trending_cache["data"] and (now - _trending_cache["timestamp"]) < _TRENDING_CACHE_TTL:
        return _trending_cache["data"]
    
    try:
        loop = asyncio.get_event_loop()
        videos = await loop.run_in_executor(None, client.get_trending)
        if not videos:
            raise RuntimeError("No trending videos returned.")
        
        # Update cache
        _trending_cache["data"] = videos
        _trending_cache["timestamp"] = now
        
        return videos
    except Exception as exc:  # noqa: BLE001
        # If we have stale cache, return it on error
        if _trending_cache["data"]:
            return _trending_cache["data"]
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/suggestions")
async def suggestions(payload: SuggestionRequest):
    import time
    now = time.time()
    cache_key = payload.query.strip().lower()
    
    # Check cache first - INSTANT return if hit
    if cache_key in _suggestions_cache:
        entry = _suggestions_cache[cache_key]
        if now - entry["timestamp"] < _SUGGESTIONS_CACHE_TTL:
            return entry["data"]  # Cache hit! Return immediately
    
    # Cache miss - fetch from YouTube (slow)
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, client.get_suggestions, payload.query)
        
        # Store in cache for next time
        _suggestions_cache[cache_key] = {"data": results, "timestamp": now}
        
        # Async cleanup of old entries
        _clean_old_suggestions()
        
        return results
    except Exception as exc:  # noqa: BLE001
        # On error, return stale cache if available
        if cache_key in _suggestions_cache:
            return _suggestions_cache[cache_key]["data"]
        raise HTTPException(status_code=500, detail=str(exc)) from exc



@router.post("/playlists")
async def playlist(payload: PlaylistRequest):
    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, client.get_playlist, str(payload.url), payload.limit
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/search")
async def search(payload: SearchRequest):
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, client.search, payload.query)
        return {"success": True, "results": results}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


