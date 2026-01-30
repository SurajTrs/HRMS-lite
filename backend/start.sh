#!/bin/bash

echo "🚀 Starting HRMS Lite Backend Server..."

# Activate virtual environment
source venv/bin/activate

# Start the server
echo "📡 Server starting at http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo "🔍 Health Check: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop the server"

python main.py