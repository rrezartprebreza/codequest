#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "🎮 CodeQuest — Starting up"
echo "================================"

# Check Java version (project requires 17+)
JAVA_BIN="java"
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  JAVA_BIN="$JAVA_HOME/bin/java"
fi
JAVA_VERSION_RAW="$($JAVA_BIN -version 2>&1 | head -n1)"
JAVA_MAJOR="$(echo "$JAVA_VERSION_RAW" | sed -E 's/.*version "([0-9]+).*/\1/')"
if [ -z "$JAVA_MAJOR" ] || [ "$JAVA_MAJOR" -lt 17 ]; then
  echo ""
  echo "❌ Java 17+ is required."
  echo "   Detected: $JAVA_VERSION_RAW"
  echo "   Install Java 17+, then run ./start.sh again."
  exit 1
fi

# AI config (local default = Ollama)
AI_BASE_URL="${AI_BASE_URL:-http://localhost:11434}"
AI_API_KEY="${AI_API_KEY:-${GROQ_API_KEY:-ollama}}"
AI_MODEL="${AI_MODEL:-llama3.2:3b}"
BACKEND_PORT="${PORT:-9090}"
DETACH_SERVICES="${DETACH_SERVICES:-false}"
RUN_DIR="$SCRIPT_DIR/.run"
export AI_BASE_URL AI_API_KEY AI_MODEL

# Groq requires a real API key, Ollama does not.
if [[ "$AI_BASE_URL" == *"groq.com"* ]] && [ -z "$AI_API_KEY" ]; then
  echo ""
  echo "❌ AI_API_KEY is required when using Groq."
  echo "   Example: export AI_BASE_URL=https://api.groq.com/openai"
  echo "            export AI_API_KEY=your_groq_api_key"
  exit 1
fi

if [[ "$AI_BASE_URL" == *"groq.com"* ]]; then
  echo "✅ Groq mode"
else
  echo "✅ Local Ollama mode"
fi

mkdir -p "$RUN_DIR"

# Start infra
echo ""
echo "🐳 Starting PostgreSQL + Redis + Ollama..."
cd "$SCRIPT_DIR/backend"
docker-compose up -d
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec codequest-postgres pg_isready -U codequest -q 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL ready"

if [[ "$AI_BASE_URL" == *"localhost:11434"* ]] || [[ "$AI_BASE_URL" == *"127.0.0.1:11434"* ]]; then
  echo "⏳ Waiting for Ollama endpoint..."
  until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 1
  done
  echo "✅ Ollama ready"
fi

# Start backend
echo ""
echo "☕ Starting Spring Boot backend..."
if [ "$DETACH_SERVICES" = "true" ]; then
  nohup ./mvnw spring-boot:run -q > "$RUN_DIR/backend.log" 2>&1 &
else
  ./mvnw spring-boot:run -q &
fi
BACKEND_PID=$!
echo "$BACKEND_PID" > "$RUN_DIR/backend.pid"
echo "   PID: $BACKEND_PID"
echo "⏳ Waiting for backend to be ready (connectivity check)..."
until curl -s "http://localhost:${BACKEND_PORT}" > /dev/null 2>&1; do
  sleep 2
  # Exit if backend process died
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend process died. Check logs above."
    exit 1
  fi
done
echo "✅ Backend ready"

# Start frontend
echo ""
echo "⚛️  Starting React frontend..."
cd "$SCRIPT_DIR/frontend"
npm install --silent
if [ "$DETACH_SERVICES" = "true" ]; then
  nohup npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > "$RUN_DIR/frontend.log" 2>&1 &
else
  npm run dev -- --host 0.0.0.0 --port 5173 --strictPort &
fi
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$RUN_DIR/frontend.pid"

echo ""
echo "================================"
echo "✅ CodeQuest is running!"
echo ""
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:${BACKEND_PORT}"
echo ""
if [ "$DETACH_SERVICES" = "true" ]; then
  echo "   Detached mode: services will keep running after this shell exits"
  echo "   Backend log: $RUN_DIR/backend.log"
  echo "   Frontend log: $RUN_DIR/frontend.log"
else
  echo "   Press Ctrl+C to stop all services"
fi
echo "================================"
echo ""

if [ "$DETACH_SERVICES" = "true" ]; then
  disown "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
fi

# Cleanup on exit
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; cd \"$SCRIPT_DIR/backend\" && docker-compose down; echo 'Done.'" EXIT

wait
