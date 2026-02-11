from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_healthcheck():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_trending_endpoint_exists():
    # We don't want to actually call YouTube in tests if possible, 
    # but at least check if the route is registered and responds (even if it 500s due to no internet/yt-dlp issues in CI)
    response = client.get("/api/trending")
    # If internet is available and yt-dlp works, it might be 200.
    # For a basic test, we just ensure it's not a 404.
    assert response.status_code != 404

def test_search_endpoint_exists():
    response = client.post("/api/search", json={"query": "test"})
    assert response.status_code != 404

def test_info_endpoint_exists():
    response = client.post("/api/info", json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
    assert response.status_code != 404
