
import httpx
import time
import sys

BASE_URL = "http://localhost:8000"
TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ" # Never Gonna Give You Up
VIDEO_ID = "dQw4w9WgXcQ"

def test_download():
    print(f"Testing Download for: {TEST_URL}")
    with httpx.Client(timeout=30.0) as client:
        # Start download
        payload = {"url": TEST_URL, "format": "audio", "quality": "best"}
        response = client.post(f"{BASE_URL}/api/download", json=payload)
        if response.status_code != 200:
            print(f"FAILED to start download: {response.status_code} - {response.text}")
            return False
        
        task_id = response.json().get("task_id")
        print(f"Download started. Task ID: {task_id}")
        
        # Poll for progress
        for _ in range(30): # 30 attempts, 5s each = 2.5 minutes
            time.sleep(5)
            progress_resp = client.get(f"{BASE_URL}/api/download/{task_id}/progress")
            if progress_resp.status_code != 200:
                print(f"FAILED to get progress: {progress_resp.status_code}")
                continue
            
            status = progress_resp.json()
            print(f"Progress: {status.get('status')} - {status.get('progress')}%")
            
            if status.get("status") == "completed":
                print("Download SUCCESSFUL!")
                return True
            if status.get("status") == "failed":
                print(f"Download FAILED: {status.get('error')}")
                return False
        
        print("Download check TIMED OUT")
        return False

def test_streaming():
    print(f"\nTesting Streaming for Video ID: {VIDEO_ID}")
    # Note: Stream authorization can take time, so we use a long timeout
    with httpx.Client(timeout=60.0) as client:
        # YouTube streaming via proxy
        # We use a stream request to check if headers and first bytes are returned
        try:
            with client.stream("GET", f"{BASE_URL}/api/streaming/youtube/{VIDEO_ID}") as response:
                print(f"Streaming Response Status: {response.status_code}")
                print(f"Content-Type: {response.headers.get('Content-Type')}")
                
                if response.status_code in [200, 206]:
                    # Read first chunk to verify data flow
                    for chunk in response.iter_bytes(chunk_size=1024):
                        if chunk:
                            print("Successfully received audio data chunk!")
                            return True
                        break
                else:
                    print(f"Streaming FAILED: {response.status_code}")
        except Exception as e:
            print(f"Streaming ERROR: {str(e)}")
            
    return False

if __name__ == "__main__":
    download_ok = test_download()
    stream_ok = test_streaming()
    
    if download_ok and stream_ok:
        print("\nALL TESTS PASSED! ✅")
        sys.exit(0)
    else:
        print("\nSOME TESTS FAILED ❌")
        sys.exit(1)
