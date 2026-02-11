from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

from .config import settings
from .routes import info, auth, profiles, streaming, downloads, library, playlists, analytics, queue, party
from .database import init_db, get_db
from .services.stream_manager import stream_manager


import asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # 1. Initialize database (Must be done before starting)
    await init_db()
    
    
    # 3. Start Persistent Stream Manager (Warms up yt-dlp)
    asyncio.create_task(stream_manager.start())
        
    yield
    # Shutdown: cleanup if needed


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name, 
        version="0.1.0",
        lifespan=lifespan
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


    # Download mode routes
    app.include_router(info.router)
    app.include_router(downloads.router)
    
    # Streaming mode routes (auth)
    app.include_router(auth.router)
    app.include_router(profiles.router)
    app.include_router(streaming.router)
    app.include_router(library.router)
    app.include_router(playlists.router)
    app.include_router(analytics.router)
    app.include_router(queue.router)
    app.include_router(party.router)

    @app.get("/healthz", tags=["meta"])
    async def healthcheck():
        return {"status": "ok"}

    # --- Termux/Production Optimization ---
    # Serve Frontend Static Files (from built dist directory)
    # The 'frontend/dist' folder should be at the root of the project structure
    frontend_path = Path(__file__).parent.parent.parent / "frontend" / "dist"
    
    if frontend_path.exists():
        app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="static")
        
        # SPA Catch-all: If a route is not found in API, serve index.html
        # This allows React Router (Client-side) to handle the paths
        @app.exception_handler(404)
        async def spa_catch_all(request, exc):
            index_file = frontend_path / "index.html"
            if index_file.exists():
                from fastapi.responses import FileResponse
                return FileResponse(index_file)
            return {"detail": "Not Found"}
    else:
        # Development mode without static files
        @app.get("/")
        async def root():
            return {"message": "Onyx API is running. Build the frontend and place it in 'frontend/dist' to serve the UI."}

    return app


app = create_app()
