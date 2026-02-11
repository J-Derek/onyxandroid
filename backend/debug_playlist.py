from app.services.yt_client import YTDLClient
import json

client = YTDLClient()
url = "https://www.youtube.com/playlist?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj"
try:
    result = client.get_playlist(url, limit=10)
    print(json.dumps(result, indent=2))
except Exception as e:
    print(f"Error: {e}")
