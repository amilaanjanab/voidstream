@echo off
title VoidStream Launcher
mode con: cols=50 lines=10

echo [SYSTEM] Initializing VoidStream Protocol...

:: 1. Start Backend (Hidden/Minimized)
echo [1/3] Booting Core Server...
start /min "VoidStream Backend" cmd /c "cd backend && venv\Scripts\activate && uvicorn main:app --reload --host 0.0.0.0 --port 8001"

:: 2. Start Frontend (Hidden/Minimized)
echo [2/3] Energizing Interface...
cd frontend
if not exist "node_modules" call npm install > nul 2>&1
start /min "VoidStream Frontend" cmd /c "npm run dev"

:: 3. Launch UI in App Mode (Frameless)
echo [3/3] Launching Visual Interface...
timeout /t 5 /nobreak > nul
start msedge --app=http://localhost:5173 --window-size=1280,720 --app-shell-host-window-size=1280,720 --new-window

:: Close this launcher window
exit
