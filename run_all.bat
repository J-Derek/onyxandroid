@echo off
setlocal
:: Ensure we are in the script's directory
cd /d "%~dp0"

echo Starting YouTube Audio Converter...

:: Start Backend
start "Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && .\.venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

:: Start Frontend
start "Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Backend and Frontend are starting in separate windows...
echo Local Access:
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo.
echo Network Access (for Android):
echo   Scan for your IP above or use:
ipconfig | findstr /i "ipv4"
echo.
echo Make sure your phone is on the same Wi-Fi!
pause
