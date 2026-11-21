@echo off
setlocal

cd /d "%~dp0"

if exist "venv\Scripts\python.exe" (
    set "PYTHON=venv\Scripts\python.exe"
) else if exist ".venv\Scripts\python.exe" (
    set "PYTHON=.venv\Scripts\python.exe"
) else (
    where py >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON=py -3"
    ) else (
        set "PYTHON=python"
    )
)

%PYTHON% -c "import fastapi, uvicorn, sqlalchemy, pydantic, multipart, jsonschema" >nul 2>&1
if errorlevel 1 (
    echo Installing backend dependencies...
    %PYTHON% -c "import sys; sys.exit(0 if sys.version_info >= (3, 14) else 1)" >nul 2>&1
    if not errorlevel 1 (
        %PYTHON% -m pip install --upgrade fastapi uvicorn sqlalchemy pydantic python-multipart jsonschema
    ) else (
        %PYTHON% -m pip install -r requirements.txt
    )
    if errorlevel 1 (
        echo.
        echo Failed to install backend dependencies.
        endlocal
        exit /b 1
    )
)

%PYTHON% -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

if errorlevel 1 (
    echo.
    echo Backend failed to start. Make sure dependencies are installed:
    echo   %PYTHON% -m pip install -r requirements.txt
)

endlocal
