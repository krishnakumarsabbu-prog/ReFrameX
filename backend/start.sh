#!/usr/bin/env bash
# ==============================================================================
# ReFrameX Backend — Start Script
# Starts the FastAPI backend with uvicorn (background by default, or foreground)
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="$SCRIPT_DIR/backend.pid"
LOG_FILE="$SCRIPT_DIR/backend.log"
HOST="127.0.0.1"
PORT="8000"

# Check if already running via PID file
if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "[ReFrameX] Backend is already running (PID: $PID) at http://$HOST:$PORT"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

# Locate Python executable
PYTHON=""
if [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/venv/bin/python"
elif [ -f "$SCRIPT_DIR/.venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/.venv/bin/python"
elif [ -f "$SCRIPT_DIR/venv/Scripts/python.exe" ]; then
    PYTHON="$SCRIPT_DIR/venv/Scripts/python.exe"
elif [ -f "$SCRIPT_DIR/.venv/Scripts/python.exe" ]; then
    PYTHON="$SCRIPT_DIR/.venv/Scripts/python.exe"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON="python3"
elif command -v py >/dev/null 2>&1; then
    PYTHON="py -3"
elif command -v python >/dev/null 2>&1; then
    PYTHON="python"
else
    echo "[ERROR] Python not found. Please install Python 3.10+ and ensure it is in your PATH."
    exit 1
fi

echo "[ReFrameX] Using Python: $PYTHON"

# Verify dependencies
if ! $PYTHON -c "import fastapi, uvicorn, sqlalchemy, pydantic, multipart, jsonschema" >/dev/null 2>&1; then
    echo "[ReFrameX] Missing dependencies. Installing..."
    $PYTHON -m pip install -r requirements.txt || {
        echo "[ERROR] Failed to install backend dependencies."
        exit 1
    }
fi

# Check for --foreground / -f argument
FOREGROUND=false
for arg in "$@"; do
    if [ "$arg" = "--foreground" ] || [ "$arg" = "-f" ]; then
        FOREGROUND=true
        break
    fi
done

if [ "$FOREGROUND" = true ]; then
    echo "[ReFrameX] Starting FastAPI backend in foreground at http://$HOST:$PORT ..."
    exec $PYTHON -m uvicorn app.main:app --reload --host "$HOST" --port "$PORT"
else
    echo "[ReFrameX] Starting FastAPI backend in background..."
    nohup $PYTHON -m uvicorn app.main:app --reload --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 &
    NEW_PID=$!
    echo "$NEW_PID" > "$PID_FILE"

    # Wait up to 5 seconds to verify startup
    echo -n "[ReFrameX] Waiting for server to initialize..."
    SUCCESS=false
    for _ in {1..10}; do
        if kill -0 "$NEW_PID" 2>/dev/null; then
            if command -v curl >/dev/null 2>&1; then
                if curl -s "http://$HOST:$PORT/health" >/dev/null 2>&1 || curl -s "http://$HOST:$PORT/docs" >/dev/null 2>&1; then
                    SUCCESS=true
                    break
                fi
            else
                SUCCESS=true
                break
            fi
        else
            break
        fi
        sleep 0.5
        echo -n "."
    done
    echo ""

    if kill -0 "$NEW_PID" 2>/dev/null; then
        echo "[ReFrameX] Backend successfully started!"
        echo "  - Process ID (PID): $NEW_PID"
        echo "  - API Endpoint:     http://$HOST:$PORT"
        echo "  - Interactive Docs: http://$HOST:$PORT/docs"
        echo "  - Output Log:       $LOG_FILE"
        echo "  - Stop Command:     ./stop.sh"
    else
        echo "[ERROR] Backend failed to start. Last log lines:"
        tail -n 20 "$LOG_FILE" 2>/dev/null || true
        rm -f "$PID_FILE"
        exit 1
    fi
fi
