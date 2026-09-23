@echo off
REM ============================================================
REM  ResearchPilot AI - one-click launcher
REM  Runs the two commands from how-to-run.md:
REM    1. Backend : uvicorn app.main:app --port 8000   (FastAPI)
REM    2. Frontend: Vite dev server on port 5173       (React)
REM ============================================================

echo Starting ResearchPilot AI...

REM --- Backend: FastAPI on http://localhost:8000 (docs at /docs) ---
start "RP-Backend (port 8000)" /D "%~dp0backend" cmd /k python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

REM --- Frontend: React + Vite on http://localhost:5173 ---
REM PORT and BASE_PATH are required by vite.config.ts (Replit-origin config)
start "RP-Frontend (port 5173)" /D "%~dp0artifacts\researchpilot" cmd /k "set PORT=5173&& set BASE_PATH=/&& node node_modules\vite\bin\vite.js --config vite.config.ts"

echo.
echo Two windows opened:
echo   [RP-Backend]  - FastAPI  - http://localhost:8000  (API docs: /docs)
echo   [RP-Frontend] - Vite     - http://localhost:5173
echo.
echo Wait ~10-20 seconds (first backend start loads the ML models), then open:
echo   http://localhost:5173
echo.
echo Keep both windows open while using the app. Close them to stop.
pause
