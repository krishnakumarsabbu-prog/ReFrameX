#!/usr/bin/env bash
# ==============================================================================
# ReFrameX Backend — Stop Script
# Stops the running FastAPI backend process
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/backend.pid"
PORT="8000"

STOPPED=false

# 1. Stop by PID file if present
if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$PID" ]; then
        if kill -0 "$PID" 2>/dev/null; then
            echo "[ReFrameX] Stopping backend process (PID: $PID)..."
            kill "$PID" 2>/dev/null || true

            # Wait up to 5 seconds for graceful shutdown
            for _ in {1..10}; do
                if ! kill -0 "$PID" 2>/dev/null; then
                    STOPPED=true
                    break
                fi
                sleep 0.5
            done

            # Force kill if still alive
            if kill -0 "$PID" 2>/dev/null; then
                echo "[ReFrameX] Process didn't terminate gracefully, sending SIGKILL..."
                kill -9 "$PID" 2>/dev/null || true
                STOPPED=true
            fi
        else
            echo "[ReFrameX] Stale PID file found (process $PID was not running)."
        fi
    fi
    rm -f "$PID_FILE"
fi

# 2. Check if anything is still listening on port 8000
PORT_PID=""
if command -v lsof >/dev/null 2>&1; then
    PORT_PID="$(lsof -ti :$PORT 2>/dev/null || true)"
elif command -v fuser >/dev/null 2>&1; then
    PORT_PID="$(fuser $PORT/tcp 2>/dev/null || true)"
fi

if [ -n "$PORT_PID" ]; then
    echo "[ReFrameX] Terminating process listening on port $PORT (PID: $PORT_PID)..."
    for p in $PORT_PID; do
        kill -9 "$p" 2>/dev/null || true
    done
    STOPPED=true
fi

# Windows / Git Bash fallback: check netstat / taskkill if on Windows/MSYS
if command -v netstat >/dev/null 2>&1 && command -v taskkill >/dev/null 2>&1; then
    WIN_PIDS=$(netstat -ano 2>/dev/null | grep ":$PORT" | grep "LISTENING" | awk '{print $NF}' | sort -u || true)
    for wpid in $WIN_PIDS; do
        if [ "$wpid" != "0" ] && [ -n "$wpid" ]; then
            echo "[ReFrameX] Stopping Windows process on port $PORT (PID: $wpid)..."
            taskkill //F //PID "$wpid" >/dev/null 2>&1 || true
            STOPPED=true
        fi
    done
fi

if [ "$STOPPED" = true ]; then
    echo "[ReFrameX] Backend successfully stopped."
else
    echo "[ReFrameX] No running backend instance found on port $PORT."
fi
