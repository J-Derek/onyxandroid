from __future__ import annotations

import random
from typing import Any, Dict, List

import yt_dlp

from ..config import settings
from .cookie_helper import get_yt_dlp_cookie_opts, run_yt_dlp_with_fallback
from .formatting import format_duration, format_views


class YTDLClient:
    """Thin wrapper around yt_dlp to keep extraction code organized."""

    def __init__(self) -> None:
        self.base_opts: Dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }
        # Update base_opts with cookie options
        self.base_opts.update(get_yt_dlp_cookie_opts())

    def get_video_info(self, url: str, force_single: bool = False) -> Dict[str, Any]:
        opts = dict(self.base_opts)
        try:
            info = run_yt_dlp_with_fallback(opts, url, download=False)
        except yt_dlp.utils.DownloadError:
            if "playlist" in url and not force_single:
                return {"success": True, "is_playlist": True, "url": url}
            raise

        if info.get("_type") == "playlist":
            if force_single and info.get("entries"):
                info = info["entries"][0]
            elif not force_single:
                return {"success": True, "is_playlist": True, "url": url}

        combined_formats, audio_formats = self._collect_formats(info)

        return {
            "success": True,
            "id": info.get("id"),
            "title": info.get("title", "Unknown Title"),
            "thumbnail": info.get("thumbnail"),
            "duration": format_duration(info.get("duration")),
            "uploader": info.get("uploader", "Unknown"),
            "views": format_views(info.get("view_count")),
            "description": info.get("description", ""),
            "is_playlist": False,
            "formats": combined_formats,
            "audio_formats": audio_formats,
            "tags": info.get("tags", []),
            "categories": info.get("categories", []),
            "artist": info.get("artist"),
            "track": info.get("track") or info.get("track_song"),
        }

    def get_trending(self) -> List[Dict[str, Any]]:
        opts = dict(self.base_opts)
        opts.update({"extract_flat": True, "playlistend": 20})  # Fetch more to shuffle from
        
        # Varied search queries for different content each time
        search_queries = [
            "ytsearch15:trending music 2024",
            "ytsearch15:new music releases",
            "ytsearch15:popular songs today",
            "ytsearch15:top hits music",
            "ytsearch15:best new music",
            "ytsearch15:viral music videos",
            "ytsearch15:hot music charts",
            "ytsearch15:latest music hits",
        ]
        
        # Pick a random search query for variety
        source_url = random.choice(search_queries)
        
        videos = []
        try:
            info = run_yt_dlp_with_fallback(opts, source_url, download=False)
            
            for entry in info.get("entries", [])[:20]:
                if not entry:
                    continue
                video_id = entry.get("id")
                if not video_id:
                    continue
                videos.append(
                    {
                        "id": video_id,
                        "title": entry.get("title", "Unknown Title"),
                        "uploader": entry.get("uploader", "Unknown"),
                        "thumbnail": entry.get("thumbnail")
                        or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                        "views": format_views(entry.get("view_count")),
                        "duration": format_duration(entry.get("duration")),
                    }
                )
        except Exception as e:
            print(f"Failed to get trending: {e}")
            # Fallback to a basic search
            try:
                info = run_yt_dlp_with_fallback(opts, "ytsearch12:music 2024", download=False)
                for entry in info.get("entries", [])[:12]:
                    if not entry:
                        continue
                    video_id = entry.get("id")
                    if not video_id:
                        continue
                    videos.append(
                        {
                            "id": video_id,
                            "title": entry.get("title", "Unknown Title"),
                            "uploader": entry.get("uploader", "Unknown"),
                            "thumbnail": entry.get("thumbnail")
                            or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                            "views": format_views(entry.get("view_count")),
                            "duration": format_duration(entry.get("duration")),
                        }
                    )
            except Exception:
                raise RuntimeError("Failed to fetch trending videos from all sources")
        
        if not videos:
            raise RuntimeError("Failed to fetch trending videos")
        
        # Randomize to show different videos each time
        random.shuffle(videos)
        
        # Return top 8 after shuffling
        return videos[:8]


    def get_suggestions(self, query: str) -> List[Dict[str, Any]]:
        """
        Get search suggestions INSTANTLY using YouTube's autocomplete API.
        This is much faster than running yt-dlp for suggestions.
        """
        import httpx
        import json
        
        try:
            # YouTube Suggest API (used by search bar)
            url = f"http://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q={query}"
            
            # Using proxies if available to avoid rate limiting
            proxy = settings.proxy_url if hasattr(settings, 'proxy_url') else None
            proxies = {"http://": proxy, "https://": proxy} if proxy else None
            
            with httpx.Client(proxies=proxies, timeout=3.0) as client:
                response = client.get(url)
                
                if response.status_code == 200:
                    # Format is: window.google.ac.h(["query",[["sug1",0],["sug2",0]]])
                    # Or sometimes just a raw list depending on client param
                    text = response.text
                    start = text.find("(")
                    end = text.rfind(")")
                    if start != -1 and end != -1:
                        data = json.loads(text[start+1:end])
                        suggestions_list = data[1]
                        
                        results = []
                        for sug in suggestions_list:
                            if isinstance(sug, list) and len(sug) > 0:
                                results.append({"title": sug[0]})
                            elif isinstance(sug, str):
                                results.append({"title": sug})
                        
                        return results[:10]
            
            # Fallback to search-based suggestions if autocomplete fails
            return self._get_suggestions_fallback(query)
            
        except Exception as e:
            print(f"Suggestions fetch failed: {e}")
            return self._get_suggestions_fallback(query)

    def _get_suggestions_fallback(self, query: str) -> List[Dict[str, Any]]:
        """Standard search fallback for suggestions."""
        search_query = self._build_search_query(query)
        opts = dict(self.base_opts)
        opts.update({"extract_flat": True, "playlistend": 10})
        
        try:
            info = run_yt_dlp_with_fallback(opts, f"ytsearch10:{search_query}", download=False)
            entries = info.get("entries", [])
            
            suggestions = []
            for entry in entries:
                if not entry: continue
                video_id = entry.get("id")
                if not video_id: continue
                
                suggestions.append({
                    "title": entry.get("title", ""),
                    "uploader": entry.get("uploader", "Unknown"),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "thumbnail": entry.get("thumbnail") or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                    "duration": format_duration(entry.get("duration")),
                    "id": video_id
                })
            return suggestions
        except Exception:
            return []

    def get_playlist(self, url: str, limit: int) -> Dict[str, Any]:
        opts = dict(self.base_opts)
        opts.update(
            {
                "extract_flat": "in_playlist",
                "noplaylist": False,
                "playlistend": limit,
                "ignoreerrors": True,
            }
        )
        info = run_yt_dlp_with_fallback(opts, url, download=False)

        entries = info.get("entries") or []
        videos = []
        for entry in entries:
            if not entry:
                continue
            video_id = entry.get("id")
            if not video_id:
                continue
            videos.append(
                {
                    "id": video_id,
                    "title": entry.get("title", "Unknown Title"),
                    "url": entry.get("url") or f"https://www.youtube.com/watch?v={video_id}",
                    "thumbnail": entry.get("thumbnail")
                    or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                    "duration": format_duration(entry.get("duration")),
                    "uploader": entry.get("uploader", "Unknown"),
                }
            )

        if not videos:
            raise ValueError("No valid videos found in playlist.")

        return {
            "success": True,
            "title": info.get("title", "Playlist"),
            "videos": videos,
            "count": len(videos),
        }

    def search(self, query: str) -> List[Dict[str, Any]]:
        search_query = self._build_search_query(query)
        opts = dict(self.base_opts)
        opts.update({"extract_flat": True, "playlistend": 15})
        
        try:
            info = run_yt_dlp_with_fallback(opts, f"ytsearch15:{search_query}", download=False)
            entries = info.get("entries", [])
            
            scored = []
            for entry in entries:
                if not entry: continue
                score = self._score_result_relevance(entry, query)
                scored.append((entry, score))
            
            scored.sort(key=lambda x: x[1], reverse=True)
            
            results = []
            for entry, score in scored[:10]:
                video_id = entry.get("id")
                results.append(
                    {
                        "id": video_id,
                        "title": entry.get("title", "Unknown"),
                        "uploader": entry.get("uploader"),
                        "duration": format_duration(entry.get("duration")),
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                        "thumbnail": entry.get("thumbnail") or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                    }
                )
            return results
        except Exception as e:
            print(f"Search failed: {e}")
            return []

    def _build_search_query(self, user_input: str) -> str:
        """Build optimized search query based on input analysis."""
        query = user_input.strip()
        # Detect if user is already searching for music formats
        has_format_keywords = any(
            kw in query.lower() 
            for kw in ["official", "audio", "music video", "lyrics", "album", "remix"]
        )
        if has_format_keywords:
            return query
        # Silently append official audio for music-first intent
        return f"{query} official audio"

    def _score_result_relevance(self, result: Dict[str, Any], query: str) -> float:
        """Score results to prioritize high-quality music content."""
        score = 1.0
        title_lower = result.get("title", "").lower()
        uploader_lower = result.get("uploader", "").lower()
        
        # Boost official content
        if "vevo" in uploader_lower or "official" in uploader_lower:
            score += 2.0
        
        # Boost music keywords
        music_keywords = ["official audio", "official video", "music video", "lyric", "full album"]
        for keyword in music_keywords:
            if keyword in title_lower:
                score += 1.0
        
        # Penalize non-music noise
        noise_keywords = ["tutorial", "how to", "review", "reaction", "unboxing", "vlog"]
        for keyword in noise_keywords:
            if keyword in title_lower:
                score -= 2.0
        
        # Duration scoring (Music is usually 2-7 minutes)
        duration = result.get("duration")
        if duration:
            if 120 <= duration <= 420:  # 2-7 mins
                score += 0.5
            elif duration < 60:  # Snippet
                score -= 1.0
            elif duration > 600:  # Long podcast/mix
                score -= 0.5
                
        return score

    @staticmethod
    def _collect_formats(info: Dict[str, Any]) -> tuple[list[Dict[str, Any]], list[Dict[str, Any]]]:
        combined_formats: List[Dict[str, Any]] = []
        audio_formats: List[Dict[str, Any]] = []
        seen_heights, seen_abrs = set(), set()

        for fmt in info.get("formats", []):
            vcodec = fmt.get("vcodec")
            if vcodec != "none":
                height = fmt.get("height")
                if height and height not in seen_heights:
                    combined_formats.append(
                        {
                            "height": height,
                            "ext": fmt.get("ext"),
                            "note": fmt.get("format_note"),
                        }
                    )
                    seen_heights.add(height)

            if vcodec == "none" and fmt.get("acodec") != "none":
                abr = fmt.get("abr")
                if abr and abr not in seen_abrs:
                    audio_formats.append({"abr": abr, "ext": fmt.get("ext")})
                    seen_abrs.add(abr)

        combined_formats.sort(key=lambda x: x.get("height") or 0, reverse=True)
        audio_formats.sort(key=lambda x: x.get("abr") or 0, reverse=True)
        return combined_formats, audio_formats


