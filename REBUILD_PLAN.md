
# YouTube Downloader Rebuild Plan

## 1. Current Application Snapshot
- **Backend stack**: Flask monolith (`app.py`) with `yt_dlp`, FFmpeg path bootstrapping, thread-based download worker, and global dictionaries for progress/cancellation.
- **Endpoints**: `/`, `/get_video_info`, `/trending`, `/suggestions`, `/search`, `/get_playlist_info`, `/download`, `/stop_download/<id>`, `/progress/<id>`, `/files`, `/files/<path>`. Features include playlist detection, format list assembly, trending fallback, autosuggestions, threaded downloads with FFmpeg post-processing, library listing, and file serving.
- **Frontend stack**: Single-page Tailwind layout (`static/index.html`) plus supporting JS/CSS. Provides dark-mode UI, search bar with live suggestions, hero/CTA, trending grid, playlist inspector, format picker, queue cards with progress + cancel, local library view, and toast notifications.
- **Supporting files**: Multiple backup versions of static assets, pytest helpers (`backend_test.py`, `test_mix*.py`), PowerShell fix script, and a repo-level `.gitconfig`.

## 2. Why We Are Cleaning It Up
- **Stability issues**: Frequent runtime errors tied to tightly coupled Flask logic, brittle global state, and shallow error handling around FFmpeg/yt_dlp.
- **Maintainability**: Single large `app.py` and an all-in-one HTML file make it hard to test, extend, or reason about individual features.
- **Scalability limits**: Ad-hoc threads and missing validation/logging prevent confident growth (batch downloads, metrics, background workers, etc.).
- **UX constraints**: Static DOM manipulations hinder richer queue/library interactions and offline support.
  
To move faster and reduce bug surface area, we’re archiving the current implementation and rebuilding with clearer modules, modern tooling, and forward-looking architecture.

## 3. New System Vision
- **Backend platform**: FastAPI (or modular Flask if required) with Pydantic schemas, async-ready endpoints, and automatic documentation.
- **Service layout**: Separate modules for info/search, playlist handling, download orchestration, and library/file management. Configurable settings (env-based) for FFmpeg, download roots, and rate limits.
- **Task execution**: Download manager abstraction with pluggable executors (threads now, Celery/RQ ready later), structured progress tracking, cancellation hooks, and SQLite-backed history/audit log.
- **Observability**: Structured JSON logging, health checks (FFmpeg status, disk usage), and clearer error propagation to the UI.
- **Frontend refresh**: Componentized React (or Svelte) SPA consuming the new API, with stateful tabs for Home, Queue, and Library, skeleton loaders, enhanced playlist explorer, smart format presets, and offline history via IndexedDB.
- **User experience improvements**: Drag-to-reorder queue, per-task ETA/speed snapshots, batch playlist selection, FFmpeg/health panel, open-in-folder shortcuts, and configurable notification settings.
- **Tooling & QA**: Updated `requirements.txt`, formatter/linter (e.g., Black + Ruff), pytest suite for API + downloader services, and automated smoke tests for ffmpeg detection and job lifecycle.

## 4. Safeguard
This document must remain in the repo during cleanup/rebuild so we retain context on the legacy system and the agreed-upon target architecture.


