#!/bin/bash

set -e

echo "🚀 Starting development servers..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please update .env with your credentials before continuing."
    exit 1
fi

# Start all services in development mode
pnpm dev
