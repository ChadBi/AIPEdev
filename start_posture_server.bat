@echo off
cd /d E:\DDesktop\aisport\bjf1\AIPEdev

echo Killing existing processes on port 9999...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9999') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

timeout /t 2 /nobreak

echo Starting new server with updated code...
uv run uvicorn main:app --host 0.0.0.0 --port 9999 --reload >> server_posture.log 2>&1

pause