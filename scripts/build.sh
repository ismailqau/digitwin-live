#!/bin/bash

set -e

echo "🔨 Building all packages and services..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
pnpm clean

# Build all packages
echo "📦 Building packages..."
pnpm build

echo "✅ Build complete!"
