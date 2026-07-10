@echo off
REM ============================================================
REM  XD Drawing System - stop servers (kill listeners on 8000/8001/5173)
REM ============================================================
setlocal enabledelayedexpansion
echo [XD] Stopping servers on ports 8000, 8001, 5173 ...
set "FOUND="
for %%P in (8000 8001 5173) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    echo   port %%P  -^>  kill PID %%I
    taskkill /F /PID %%I >nul 2>&1
    set "FOUND=1"
  )
)
if not defined FOUND echo   No running servers found.
echo [XD] Done.
endlocal
