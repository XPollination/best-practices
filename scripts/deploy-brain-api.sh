#!/bin/bash
#===============================================================================
# deploy-brain-api.sh — Restart brain API with latest code
#
# Brain API runs as tsx from TypeScript source (no build step).
# This script: finds running instance, kills it, restarts, verifies health.
#
# Usage: bash scripts/deploy-brain-api.sh
#===============================================================================

set -uo pipefail

API_DIR="/home/developer/workspaces/github/PichlerThomas/best-practices"
LOG_FILE="/tmp/brain-api.log"
HEALTH_URL="http://localhost:3200/api/v1/health"

echo "=== Brain API Deployment ==="

# 1. Pull latest code
echo "[1/5] Pulling latest code..."
cd "$API_DIR"
git pull

# 2. Find and kill existing brain API process
echo "[2/5] Stopping existing brain API..."
PID=$(lsof -ti:3200 2>/dev/null || echo "")
if [ -n "$PID" ]; then
  echo "  Killing PID $PID (port 3200)"
  kill "$PID" 2>/dev/null
  sleep 2
  # Force kill if still running
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" 2>/dev/null
    sleep 1
  fi
else
  echo "  No process found on port 3200"
fi

# 3. Start new instance
echo "[3/5] Starting brain API..."
cd "$API_DIR"
nohup npx tsx api/src/index.ts > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "  Started PID $NEW_PID"

# 4. Wait for health check
echo "[4/5] Waiting for health check..."
for i in $(seq 1 15); do
  sleep 2
  HEALTH=$(curl -s --max-time 3 "$HEALTH_URL" 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"ok"'; then
    echo "  Health check passed!"
    echo "  Response: $HEALTH"
    echo "[5/5] Deployment complete."
    echo ""
    echo "Brain API running at http://localhost:3200"
    echo "PID: $NEW_PID"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  echo "  Attempt $i/15 - waiting..."
done

echo "[FAIL] Health check did not pass after 30 seconds."
echo "Check logs: tail -50 $LOG_FILE"
exit 1
