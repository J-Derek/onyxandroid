"""
Diagnostic script to check what audio formats are available for a YouTube video.
This will help us understand why HLS is being selected instead of progressive formats.
"""
import yt_dlp

def check_formats(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        
        print(f"\n=== Formats for {video_id} ===")
        print(f"Title: {info.get('title', 'Unknown')}")
        print("\n--- Audio-only formats ---")
        
        for fmt in info.get("formats", []):
            # Only show audio formats
            if fmt.get("acodec") == "none":
                continue
                
            # Skip video-only formats
            if fmt.get("vcodec") not in ["none", None] and fmt.get("acodec") in ["none", None]:
                continue
            
            print(f"  {fmt.get('format_id'):>8}: "
                  f"ext={fmt.get('ext', 'N/A'):>5}, "
                  f"acodec={fmt.get('acodec', 'N/A'):>10}, "
                  f"abr={str(fmt.get('abr', 'N/A')):>6}kbps, "
                  f"protocol={fmt.get('protocol', 'N/A')}")

if __name__ == "__main__":
    # Test with the problematic video
    check_formats("BYUanZDnR-0")
