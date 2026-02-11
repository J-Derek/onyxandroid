"""
Onyx Stream Manager v2
Ultra-low-latency extraction engine with:
- Semaphore-guarded extractor pool (prevents concurrent mutation)
- Deferred stream support (bytes flow as authorization completes)
- TTL-pessimistic caching with safety margins
- One-time cookie loading at startup
"""
import yt_dlp
import asyncio
import time
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import OrderedDict
import anyio

from ..config import settings
from .cookie_helper import get_yt_dlp_cookie_opts, FAST_EXTRACT_OPTS


@dataclass(order=True)
class ExtractionTask:
    """Priority-ordered extraction task."""
    priority: int  # 1 = urgent (play), 2 = near (queue), 3 = visible (viewport)
    video_id: str = field(compare=False)
    timestamp: float = field(default_factory=time.time, compare=False)
    future: asyncio.Future = field(default_factory=asyncio.Future, compare=False)


@dataclass
class CachedURL:
    """Cached authorization artifact with pessimistic TTL."""
    url: str
    expires_at: datetime
    content_type: str = "audio/mp4"  # MIME type for proxy response
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    title: Optional[str] = None
    artist: Optional[str] = None
    
    @property
    def is_valid(self) -> bool:
        """Check if still valid with 90-second safety margin."""
        return self.expires_at > datetime.now() + timedelta(seconds=90)


# Browser-safe progressive format IDs (itags) in priority order
# These are ALWAYS progressive (https protocol), never HLS
# Source: Harmony-Music's proven selection logic
PROGRESSIVE_ITAGS = ["140", "251", "250", "249", "139"]

# MIME type mapping for browser playback
ITAG_MIME_TYPES = {
    "140": "audio/mp4",   # m4a AAC 128kbps
    "139": "audio/mp4",   # m4a AAC 48kbps
    "251": "audio/webm",  # webm Opus 128kbps
    "250": "audio/webm",  # webm Opus 64kbps
    "249": "audio/webm",  # webm Opus 48kbps
}


def select_progressive_audio(info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    DETERMINISTIC format selection - mirrors Harmony-Music's approach.
    
    RULES (NON-NEGOTIABLE):
    1. NEVER trust info["url"] - always extract from info["formats"]
    2. HARD-REJECT HLS: protocol must be "https", never "m3u8_native"
    3. Use itag-based priority: 140 > 251 > 250 > 249 > 139
    4. FAIL LOUDLY if no progressive format exists
    
    Returns format dict with guaranteed progressive URL, or None.
    """
    formats = info.get("formats", [])
    
    if not formats:
        print(f"[FORMAT] FATAL: No formats available in extraction result")
        return None
    
    # Debug: Log available formats
    print(f"[FORMAT] Analyzing {len(formats)} formats...")
    
    # Build lookup by format_id for O(1) access
    format_lookup: Dict[str, Dict[str, Any]] = {}
    for fmt in formats:
        fmt_id = str(fmt.get("format_id", ""))
        protocol = fmt.get("protocol", "")
        
        # HARD REJECT HLS - This is non-negotiable
        if protocol == "m3u8_native" or protocol == "m3u8":
            continue  # Skip HLS entirely
        
        # REQUIRE https protocol for browser compatibility
        if protocol != "https":
            continue
            
        # Must have audio codec
        if fmt.get("acodec") in (None, "none", ""):
            continue
            
        # Must have a URL
        if not fmt.get("url"):
            continue
            
        format_lookup[fmt_id] = fmt
    
    print(f"[FORMAT] Found {len(format_lookup)} progressive candidates: {list(format_lookup.keys())[:10]}")
    
    # ITAG-BASED PRIORITY SELECTION (Harmony pattern)
    selected = None
    for itag in PROGRESSIVE_ITAGS:
        if itag in format_lookup:
            selected = format_lookup[itag]
            print(f"[FORMAT] ✅ Selected itag {itag}: {selected.get('ext')}, "
                  f"{selected.get('acodec')}, {selected.get('abr') or selected.get('tbr')}kbps")
            break
    
    # Fallback: If no preferred itag found, try any progressive audio-only format
    if not selected:
        print(f"[FORMAT] Preferred itags not found, trying fallback...")
        for fmt_id, fmt in format_lookup.items():
            # Prefer audio-only (vcodec == none)
            vcodec = str(fmt.get("vcodec", "")).lower()
            if vcodec == "none":
                selected = fmt
                print(f"[FORMAT] ⚠️ Fallback selected: {fmt_id} ({fmt.get('ext')}, {fmt.get('acodec')})")
                break
    
    # Last resort: Any format with audio
    if not selected and format_lookup:
        fmt_id, fmt = next(iter(format_lookup.items()))
        selected = fmt
        print(f"[FORMAT] ⚠️ Last resort selected: {fmt_id} ({fmt.get('ext')}, {fmt.get('acodec')})")
    
    if not selected:
        # FAIL LOUDLY - Log all available formats for debugging
        print(f"[FORMAT] ❌ FATAL: No progressive audio format available!")
        print(f"[FORMAT] Available formats were:")
        for fmt in formats[:10]:
            print(f"  - {fmt.get('format_id')}: protocol={fmt.get('protocol')}, "
                  f"acodec={fmt.get('acodec')}, ext={fmt.get('ext')}")
        return None
    
    # Enrich with MIME type for browser
    fmt_id = str(selected.get("format_id", ""))
    if fmt_id in ITAG_MIME_TYPES:
        selected["_mime_type"] = ITAG_MIME_TYPES[fmt_id]
    else:
        ext = selected.get("ext", "m4a")
        selected["_mime_type"] = "audio/mp4" if ext == "m4a" else "audio/webm"
    
    return selected



class LRUCache(OrderedDict):
    """LRU cache with size limit."""
    def __init__(self, maxsize=300):
        super().__init__()
        self.maxsize = maxsize
    
    def __setitem__(self, key, value):
        if key in self:
            self.move_to_end(key)
        super().__setitem__(key, value)
        if len(self) > self.maxsize:
            oldest = next(iter(self))
            del self[oldest]
    
    def __getitem__(self, key):
        value = super().__getitem__(key)
        self.move_to_end(key)
        return value


class StreamManager:
    """
    Centralized extraction engine with isolation guarantees.
    
    Key invariants:
    - Only ONE extraction runs at a time (semaphore-guarded)
    - YoutubeDL instance is reused to retain player.js cache
    - Cookies are loaded ONCE at startup, never re-scanned
    - URL cache uses pessimistic TTL (90s safety margin)
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        # Core state
        self.cache: LRUCache = LRUCache(maxsize=300)
        self.queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.pending_tasks: Dict[str, asyncio.Future] = {}
        
        # Isolation mechanisms - TWO extractors:
        # 1. Background prefetch queue (lower priority)
        self._extraction_semaphore = asyncio.Semaphore(1)
        self._ydl_instance: Optional[yt_dlp.YoutubeDL] = None
        
        # 2. Urgent path for user clicks (priority 1) - never waits for queue
        self._urgent_semaphore = asyncio.Semaphore(1)
        self._urgent_ydl_instance: Optional[yt_dlp.YoutubeDL] = None
        
        self._cookie_opts: Dict = {}
        
        # Worker state
        self._worker_task: Optional[asyncio.Task] = None
        self._is_warmed = False
        
        self._initialized = True
        print("🎵 [STREAM] StreamManager v2 Initialized")

    async def start(self):
        """Start the extraction engine. Call once at server startup."""
        if self._worker_task:
            return
        
        print("🔥 [STREAM] Pre-warming YouTube extraction engine...")
        start = time.time()
        
        # 1. Extract cookies to file ONCE (the slow part - 5-10 seconds)
        # This creates a Netscape cookie file that yt-dlp can read instantly
        from .cookie_helper import extract_cookies_to_file
        cookie_file = await anyio.to_thread.run_sync(extract_cookies_to_file)
        
        # 2. Get cookie options (now just a file path reference, O(1))
        self._cookie_opts = get_yt_dlp_cookie_opts()
        
        # 3. Create BOTH extractor instances
        opts = FAST_EXTRACT_OPTS.copy()
        opts.update(self._cookie_opts)
        self._ydl_instance = yt_dlp.YoutubeDL(opts)
        self._urgent_ydl_instance = yt_dlp.YoutubeDL(opts.copy())  # Separate instance for urgent
        
        # 4. Warm the primary instance (forces player.js + signature caching)
        try:
            await anyio.to_thread.run_sync(
                lambda: self._ydl_instance.extract_info(
                    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    download=False
                )
            )
            self._is_warmed = True
        except Exception as e:
            print(f"⚠️ [STREAM] Warm-up extraction failed (non-fatal): {e}")
        
        # 5. Start the background worker
        self._worker_task = asyncio.create_task(self._worker_loop())
        
        elapsed = time.time() - start
        print(f"✅ [STREAM] Engine warmed in {elapsed:.1f}s, 2 extractors ready.")

    async def _worker_loop(self):
        """
        Background worker that processes the priority queue.
        Only ONE extraction runs at a time (semaphore-guarded).
        """
        while True:
            try:
                task: ExtractionTask = await self.queue.get()
                
                # Skip if already cached while waiting
                cached = self.get_cached_url(task.video_id)
                if cached:
                    if not task.future.done():
                        task.future.set_result(cached)
                    self.queue.task_done()
                    continue
                
                # Acquire semaphore (blocks if another extraction is running)
                async with self._extraction_semaphore:
                    # Double-check cache after acquiring lock
                    cached = self.get_cached_url(task.video_id)
                    if cached:
                        if not task.future.done():
                            task.future.set_result(cached)
                        self.queue.task_done()
                        continue
                    
                    await self._do_extraction(task)
                
                self.queue.task_done()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ [STREAM] Worker error: {e}")

    async def _do_extraction(self, task: ExtractionTask):
        """Perform the actual extraction. Called under semaphore lock."""
        video_id = task.video_id
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        print(f"⚙️ [EXTRACT] Processing {video_id} (Prio: {task.priority})")
        start = time.time()
        
        try:
            info = await anyio.to_thread.run_sync(
                lambda: self._ydl_instance.extract_info(url, download=False)
            )
            
            # CRITICAL: Manual format selection to avoid HLS
            # Do NOT trust info["url"] - it may be an HLS manifest
            fmt = select_progressive_audio(info)
            if not fmt:
                raise ValueError(f"No progressive audio format available for {video_id}")
            
            stream_url = fmt.get("url")
            if not stream_url:
                raise ValueError("Selected format has no URL")
            
            # Use MIME type determined by format selection (itag-based)
            content_type = fmt.get("_mime_type", "audio/mp4")
            
            # Calculate pessimistic expiry (5 hours with 90s margin built into is_valid)
            cached = CachedURL(
                url=stream_url,
                expires_at=datetime.now() + timedelta(hours=5),
                content_type=content_type,
                thumbnail=info.get("thumbnail"),
                duration=info.get("duration"),
                title=info.get("title"),
                artist=info.get("uploader") or info.get("channel")
            )
            self.cache[video_id] = cached
            
            elapsed = time.time() - start
            print(f"✅ [EXTRACT] {video_id} complete in {elapsed:.1f}s (format: {fmt.get('format_id')}, {content_type})")
            
            if not task.future.done():
                task.future.set_result(cached)
                
        except Exception as e:
            print(f"❌ [EXTRACT] Failed for {video_id}: {e}")
            if not task.future.done():
                task.future.set_exception(e)
        finally:
            # Clean up pending task reference
            if video_id in self.pending_tasks:
                del self.pending_tasks[video_id]

    def get_cached_url(self, video_id: str) -> Optional[CachedURL]:
        """Get cached URL if valid (with safety margin)."""
        try:
            cached = self.cache.get(video_id)
        except KeyError:
            return None
        
        if cached and cached.is_valid:
            return cached
        elif cached:
            # Expired - remove from cache
            try:
                del self.cache[video_id]
            except KeyError:
                pass
        return None

    async def get_stream_url(self, video_id: str, priority: int = 1, timeout: float = 30.0) -> CachedURL:
        """
        Get stream URL, queuing extraction if needed.
        
        For priority=1 (user clicked play), uses the URGENT path to bypass queue.
        Raises TimeoutError if extraction takes too long.
        """
        # 1. Fast path: cache hit
        cached = self.get_cached_url(video_id)
        if cached:
            return cached
        
        # 2. Priority 1 = URGENT PATH (bypasses queue entirely)
        if priority == 1:
            return await self._urgent_extract(video_id, timeout)
        
        # 3. Join existing task if already pending
        if video_id in self.pending_tasks:
            try:
                return await asyncio.wait_for(self.pending_tasks[video_id], timeout=timeout)
            except asyncio.TimeoutError:
                raise TimeoutError(f"Extraction for {video_id} timed out after {timeout}s")
        
        # 4. Create new extraction task (for non-urgent)
        task = ExtractionTask(priority=priority, video_id=video_id)
        self.pending_tasks[video_id] = task.future
        await self.queue.put(task)
        
        # 5. Await result
        try:
            return await asyncio.wait_for(task.future, timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Extraction for {video_id} timed out after {timeout}s")

    async def _urgent_extract(self, video_id: str, timeout: float = 30.0) -> CachedURL:
        """
        Urgent extraction path for user clicks.
        Uses a separate YoutubeDL instance and semaphore to never block on prefetch queue.
        """
        # Check cache again (might have been filled while waiting)
        cached = self.get_cached_url(video_id)
        if cached:
            return cached
        
        print(f"🚨 [URGENT] Bypassing queue for {video_id}")
        
        async with self._urgent_semaphore:
            # Double-check cache after acquiring lock
            cached = self.get_cached_url(video_id)
            if cached:
                return cached
            
            url = f"https://www.youtube.com/watch?v={video_id}"
            start = time.time()
            
            try:
                info = await asyncio.wait_for(
                    anyio.to_thread.run_sync(
                        lambda: self._urgent_ydl_instance.extract_info(url, download=False)
                    ),
                    timeout=timeout
                )
                
                # CRITICAL: Manual format selection to avoid HLS
                # Do NOT trust info["url"] - it may be an HLS manifest
                fmt = select_progressive_audio(info)
                if not fmt:
                    raise ValueError(f"No progressive audio format available for {video_id}")
                
                stream_url = fmt.get("url")
                if not stream_url:
                    raise ValueError("Selected format has no URL")
                
                # Use MIME type determined by format selection (itag-based)
                content_type = fmt.get("_mime_type", "audio/mp4")
                
                cached = CachedURL(
                    url=stream_url,
                    expires_at=datetime.now() + timedelta(hours=5),
                    content_type=content_type,
                    thumbnail=info.get("thumbnail"),
                    duration=info.get("duration"),
                    title=info.get("title"),
                    artist=info.get("uploader") or info.get("channel")
                )
                self.cache[video_id] = cached
                
                elapsed = time.time() - start
                print(f"✅ [URGENT] {video_id} complete in {elapsed:.1f}s (format: {fmt.get('format_id')}, {content_type})")
                
                return cached
                
            except asyncio.TimeoutError:
                raise TimeoutError(f"Urgent extraction for {video_id} timed out after {timeout}s")

    async def prefetch(self, video_id: str, priority: int = 3) -> bool:
        """
        Background prefetch. Returns immediately, extraction happens async.
        Returns True if queued, False if already cached/pending.
        """
        if self.get_cached_url(video_id) or video_id in self.pending_tasks:
            return False
        
        task = ExtractionTask(priority=priority, video_id=video_id)
        self.pending_tasks[video_id] = task.future
        await self.queue.put(task)
        return True

    async def get_or_queue(self, video_id: str, priority: int = 1) -> tuple[Optional[CachedURL], Optional[asyncio.Future]]:
        """
        Non-blocking get for deferred stream semantics.
        
        Returns:
            (cached, None) if URL is cached
            (None, future) if extraction is queued/pending
        """
        cached = self.get_cached_url(video_id)
        if cached:
            return (cached, None)
        
        if video_id in self.pending_tasks:
            return (None, self.pending_tasks[video_id])
        
        # Queue new task
        task = ExtractionTask(priority=priority, video_id=video_id)
        self.pending_tasks[video_id] = task.future
        await self.queue.put(task)
        
        return (None, task.future)

    def get_stats(self) -> Dict[str, Any]:
        """Get engine statistics for debugging."""
        now = datetime.now()
        valid = sum(1 for c in self.cache.values() if c.is_valid)
        return {
            "cache_size": len(self.cache),
            "cache_valid": valid,
            "pending_extractions": len(self.pending_tasks),
            "queue_size": self.queue.qsize(),
            "is_warmed": self._is_warmed,
        }


# Global singleton
stream_manager = StreamManager()
