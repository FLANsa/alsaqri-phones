#!/bin/bash

# بصمة سوداء - نظام إدارة متجر الهواتف
# Render Deployment Script

echo "🚀 Starting بصمة سوداء Phone Store Management System..."

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "✅ Python3 found, starting server..."
    python3 -m http.server ${PORT:-8000}
elif command -v python &> /dev/null; then
    echo "✅ Python found, starting server..."
    python -m http.server ${PORT:-8000}
else
    echo "❌ Python not found, trying Node.js..."
    if command -v node &> /dev/null; then
        echo "✅ Node.js found, starting server..."
        npx http-server -p ${PORT:-8000} -c-1
    else
        echo "❌ Neither Python nor Node.js found!"
        exit 1
    fi
fi
