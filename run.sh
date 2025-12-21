#!/bin/bash
# EMS Dashboard - Run both backend and frontend

echo "Starting EMS Dashboard..."

# Start backend in background
echo "Starting backend on http://localhost:8000..."
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting frontend on http://localhost:5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "EMS Dashboard is running!"
echo "  - Backend API: http://localhost:8000"
echo "  - Frontend:    http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
