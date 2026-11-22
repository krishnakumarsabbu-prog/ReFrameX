@echo off
setlocal

set "PORT=8000"
echo [ReFrameX] Looking for active backend process on port %PORT%...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":%PORT% .*LISTENING"') do (
    echo [ReFrameX] Stopping process with PID: %%a
    taskkill /f /pid %%a >nul 2>&1
    set FOUND=1
)

if exist "%~dp0backend.pid" (
    del "%~dp0backend.pid" >nul 2>&1
)

if "%FOUND%"=="1" (
    echo [ReFrameX] Backend stopped successfully.
) else (
    echo [ReFrameX] No running backend instance found on port %PORT%.
)

endlocal
