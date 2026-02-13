"""
Cookie Helper v2 - Pre-extracted Cookie Cache
Extracts browser cookies ONCE at startup and caches to a file.
This eliminates the 5-10 second cookie scan on every extraction.
"""
import yt_dlp
import tempfile
import os
from pathlib import Path
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
from ..config import settings

BROWSERS = ["brave", "chrome", "edge", "firefox", "opera", "vivaldi", "safari"]

# Cookie file path - persists across process restarts
COOKIE_FILE = Path(tempfile.gettempdir()) / "onyx_youtube_cookies.txt"
COOKIE_LOCK_FILE = Path(tempfile.gettempdir()) / "onyx_cookie_lock"

# Manual cookie locations (checked first)
MANUAL_COOKIE_PATHS = [
    Path("cookies.txt"),
    Path("/app/backend/cookies.txt"),
    Path("/app/backend/data/cookies.txt"),
    Path("onyx_cookies.txt"),
]

# In-memory state
_cookie_state = {
    "file_path": None,
    "extracted_at": None,
    "browser": None,
}
COOKIE_FILE_TTL = timedelta(hours=4)  # Re-extract every 4 hours

# Optimized extraction options for SPEED
def get_yt_dlp_proxy_opt() -> Dict[str, Any]:
    """Returns proxy option if configured in settings."""
    if settings.proxy_url:
        return {"proxy": settings.proxy_url}
    return {}

FAST_EXTRACT_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "extract_flat": False,
    "skip_download": True,
    # Speed optimizations
    "no_playlist": True,
    "no_check_certificate": True,
    "prefer_insecure": True,
    "geo_bypass": True,
    # Resilient format fallback chain:
    # 1. Try m4a audio (best browser compat)
    # 2. Fall back to any best audio
    # 3. Last resort: any best format
    "format": "bestaudio[ext=m4a]/bestaudio/best",
    # Safety net: if even the fallback chain fails, return info dict
    # anyway so our select_progressive_audio() can pick by itag.
    "ignore_no_formats_error": True,
    # Use Android client to bypass PO Token requirement.
    # YouTube's web player requires a Proof of Origin token to serve
    # audio streams from datacenter IPs. Without it, only storyboard
    # formats are returned. Android/iOS clients don't need PO tokens.
    "extractor_args": {
        "youtube": {
            "player_client": ["android_music", "android", "web"]
        },
        "youtubetab": {
            "skip": ["authcheck"]
        }
    },
}


def is_cookie_file_valid() -> bool:
    """Check if the cached cookie file exists and is fresh."""
    import sys
    # Priority 1: Check manual cookie files
    for path in MANUAL_COOKIE_PATHS:
        if path.exists() and path.stat().st_size > 0:
            _cookie_state["file_path"] = str(path)
            _cookie_state["extracted_at"] = datetime.fromtimestamp(path.stat().st_mtime)
            print(f"🍪 [COOKIE] Found MANUAL cookie file: {path} ({path.stat().st_size} bytes)")
            sys.stdout.flush()
            return True

    if not COOKIE_FILE.exists():
        return False
    
    if _cookie_state["extracted_at"]:
        if datetime.now() - _cookie_state["extracted_at"] < COOKIE_FILE_TTL:
            return True
    
    # Check file modification time as fallback
    mtime = datetime.fromtimestamp(COOKIE_FILE.stat().st_mtime)
    if datetime.now() - mtime < COOKIE_FILE_TTL:
        _cookie_state["extracted_at"] = mtime
        _cookie_state["file_path"] = str(COOKIE_FILE)
        return True
    
    return False


def extract_cookies_to_file() -> Optional[str]:
    """
    Extract browser cookies to a Netscape cookie file ONCE.
    This is the slow operation - only called at startup or when cache expires.
    Returns the path to the cookie file, or None if extraction failed.
    """
    import sys
    # Check if already valid (manual cookie file takes priority)
    if is_cookie_file_valid():
        source = _cookie_state.get("file_path", "unknown") 
        print(f"🍪 [COOKIE] Using cookie file: {source} (extracted {_cookie_state['extracted_at']})")
        sys.stdout.flush()
        return _cookie_state["file_path"]
    
    # Lock to prevent concurrent extractions
    if COOKIE_LOCK_FILE.exists():
        print("🍪 [COOKIE] Another process is extracting cookies, waiting...")
        import time
        for _ in range(30):  # Wait up to 30 seconds
            time.sleep(1)
            if is_cookie_file_valid():
                return str(COOKIE_FILE)
        print("🍪 [COOKIE] Lock timeout, proceeding anyway")
    
    try:
        COOKIE_LOCK_FILE.touch()
        
        preferred = settings.browser_for_cookies or "brave"
        browsers_to_try = [preferred] + [b for b in BROWSERS if b != preferred]
        
        print(f"🍪 [COOKIE] Extracting cookies from browser (one-time operation)...")
        
        for browser in browsers_to_try:
            try:
                # Use yt-dlp to extract cookies from browser and write to file
                opts = {
                    "quiet": True,
                    "no_warnings": True,
                    "cookiesfrombrowser": (browser, None, None, None),
                    "cookiefile": str(COOKIE_FILE),  # Write cookies to file
                    "extract_flat": True,
                    "skip_download": True,
                }
                
                # Just extract info to trigger cookie extraction
                with yt_dlp.YoutubeDL(opts) as ydl:
                    # Do a quick extraction to force cookie file creation
                    ydl.extract_info("https://www.youtube.com/watch?v=dQw4w9WgXcQ", download=False)
                
                if COOKIE_FILE.exists() and COOKIE_FILE.stat().st_size > 0:
                    _cookie_state["file_path"] = str(COOKIE_FILE)
                    _cookie_state["extracted_at"] = datetime.now()
                    _cookie_state["browser"] = browser
                    print(f"✅ [COOKIE] Extracted cookies from {browser} to {COOKIE_FILE}")
                    return str(COOKIE_FILE)
                    
            except Exception as e:
                print(f"⚠️ [COOKIE] Failed to extract from {browser}: {str(e)[:80]}")
                continue
        
        print("❌ [COOKIE] All browser extractions failed. Proceeding without cookies.")
        return None
        
    finally:
        if COOKIE_LOCK_FILE.exists():
            COOKIE_LOCK_FILE.unlink()


def get_yt_dlp_cookie_opts() -> Dict[str, Any]:
    """
    Returns yt-dlp options using the PRE-EXTRACTED cookie file and proxy.
    This is O(1) - just returns a file path reference and proxy.
    """
    opts = get_yt_dlp_proxy_opt()
    
    # If we have a valid cookie file, use it
    if is_cookie_file_valid() and _cookie_state["file_path"]:
        opts["cookiefile"] = _cookie_state["file_path"]
    
    return opts


def get_cached_browser() -> Optional[str]:
    """Get the browser that was used for cookie extraction."""
    return _cookie_state.get("browser")


def run_yt_dlp_with_fallback(opts: Dict[str, Any], url: str, download: bool = False) -> Any:
    """
    Executes yt-dlp extraction/download using cached cookie file.
    Falls back to live browser extraction only if cookie file is missing.
    """
    # Always prefer the pre-extracted cookie file
    if is_cookie_file_valid() and _cookie_state["file_path"]:
        current_opts = dict(opts)
        # Remove any browser cookie options, use file instead
        current_opts.pop("cookiesfrombrowser", None)
        current_opts["cookiefile"] = _cookie_state["file_path"]
        
        # Inject proxy if available
        if settings.proxy_url:
            current_opts["proxy"] = settings.proxy_url
        
        try:
            with yt_dlp.YoutubeDL(current_opts) as ydl:
                if download:
                    return ydl.download([url])
                return ydl.extract_info(url, download=False)
        except Exception as e:
            if "cookies" in str(e).lower() or "bot" in str(e).lower():
                print("⚠️ [COOKIE] Cookie file may be stale, attempting refresh...")
                # Force refresh on next call
                _cookie_state["extracted_at"] = None
            raise
    
    # Fallback: live browser extraction (slow!)
    print("⚠️ [COOKIE] No cached cookies, falling back to live extraction...")
    
    preferred = settings.browser_for_cookies or "brave"
    browsers_to_try = [preferred] + [b for b in BROWSERS if b != preferred]
    
    last_exc = None
    for browser in browsers_to_try:
        try:
            current_opts = dict(opts)
            current_opts["cookiesfrombrowser"] = (browser, None, None, None)
            
            # Inject proxy if available
            if settings.proxy_url:
                current_opts["proxy"] = settings.proxy_url
            
            with yt_dlp.YoutubeDL(current_opts) as ydl:
                if download:
                    return ydl.download([url])
                return ydl.extract_info(url, download=False)
                
        except Exception as e:
            last_exc = e
            continue

    # Final fallback: No cookies
    fallback_opts = {k: v for k, v in opts.items() if k not in ["cookiesfrombrowser", "cookiefile"]}
    try:
        with yt_dlp.YoutubeDL(fallback_opts) as ydl:
            if download:
                return ydl.download([url])
            return ydl.extract_info(url, download=False)
    except Exception as e:
        if last_exc and "confirm you're not a bot" in str(e):
            raise last_exc
        raise e
