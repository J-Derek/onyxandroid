# YouTube Downloader Rebuild

Modernized rewrite of the YouTube audio/video downloader using FastAPI for the backend and a forthcoming React/Tailwind front-end.

## Project Layout

```
backend/        # FastAPI service (yt-dlp + FFmpeg orchestration)
frontend/       # React/Tailwind app (to be scaffolded next)
REBUILD_PLAN.md # Architectural context and migration notes
```

## Backend Quickstart

```powershell
cd backend
python -m venv .venv
.\\.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Environment overrides can be placed in `backend/.env` (see `app/config.py` for supported keys).

## Frontend Quickstart

```powershell
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:8080`.

## Roadmap

1. [x] Flesh out FastAPI routes with full parity to the legacy feature set.
2. [ ] Introduce SQLite-backed task history and metrics.
3. [x] Scaffold the React/Tailwind front-end and wire it to the new API.
4. [ ] Add automated tests (pytest + Playwright) and CI checks.


