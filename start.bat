@echo off
REM ============================================================
REM  XD Drawing System - start 3 servers
REM   1) Backend  FastAPI  127.0.0.1:8000  (XD_STORE=json, no TypeDB needed)
REM   2) AI sidecar        127.0.0.1:8001  (backend\ai\.venv)
REM   3) Frontend Vite     127.0.0.1:5173
REM  Each server opens in its own window. To stop: stop.bat
REM ============================================================
setlocal
set "ROOT=%~dp0"

echo [XD] 1/3 Backend  (:8000, XD_STORE=json)
start "XD Backend :8000" /D "%ROOT%backend" cmd /k "set XD_STORE=json&& .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo [XD] 2/3 AI sidecar (:8001)
start "XD AI Sidecar :8001" /D "%ROOT%backend\ai" cmd /k ".venv\Scripts\python.exe -m uvicorn main_ai:app --host 127.0.0.1 --port 8001"

echo [XD] 3/3 Frontend  (:5173)
start "XD Frontend :5173" /D "%ROOT%" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173"

echo.
echo [XD] 3 server windows opened.
echo      App    : http://127.0.0.1:5173
echo      Health : http://127.0.0.1:8000/health  /  http://127.0.0.1:8001/health
echo      Stop   : stop.bat
echo.
echo  (AI sidecar falls back to mock if backend\ai\.env has no OPENAI_API_KEY)
endlocal
