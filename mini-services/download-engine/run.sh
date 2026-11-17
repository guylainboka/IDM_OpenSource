#!/bin/bash
# Auto-restart wrapper for the guymadown download engine.
# Runs the engine under Node.js (more stable than Bun for HTTP/file workloads).
# If it crashes, restarts within 2s. Download state is recovered from the
# SQLite DB on each restart (incomplete downloads are marked paused).
cd "$(dirname "$0")"

LOG=/home/z/my-project/engine.log
RESTART_COUNT=0

# Use bun (the engine uses Node-compatible APIs via node:https, node:fs).
ENGINE_CMD="bun index.ts"

while true; do
  echo "[wrapper] starting engine (attempt $((RESTART_COUNT + 1))) with: $ENGINE_CMD" >> "$LOG"
  $ENGINE_CMD >> "$LOG" 2>&1
  EXIT_CODE=$?
  echo "[wrapper] engine exited with code $EXIT_CODE, restarting in 2s..." >> "$LOG"
  RESTART_COUNT=$((RESTART_COUNT + 1))
  sleep 2
done
