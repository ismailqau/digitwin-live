#!/bin/bash

set -e

echo "🚀 Setting up Conversational Clone development environment..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm@8.10.0
fi

echo "✅ pnpm is installed"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version is compatible: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build shared packages first
echo "🔨 Building shared packages..."
pnpm --filter "@clone/shared-types" build
pnpm --filter "@clone/constants" build
pnpm --filter "@clone/errors" build
pnpm --filter "@clone/utils" build
pnpm --filter "@clone/config" build
pnpm --filter "@clone/logger" build
pnpm --filter "@clone/validation" build
pnpm --filter "@clone/api-client" build

echo "✅ Shared packages built successfully"

# Create .env.example files
echo "📝 Creating .env.example files..."

cat > .env.example << 'EOF'
# Google Cloud Platform
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1

# Authentication
JWT_SECRET=your-jwt-secret

# Caching (PostgreSQL-based)
ENABLE_CACHING=true
CACHE_TTL_SHORT=300
CACHE_TTL_MEDIUM=3600
CACHE_TTL_LONG=86400

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/clone_db

# AI Services
GOOGLE_CLOUD_API_KEY=your-google-api-key
OPENAI_API_KEY=your-openai-api-key
GROQ_API_KEY=your-groq-api-key

# Vector Database
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment

# Storage
CLOUD_STORAGE_BUCKET=your-storage-bucket
EOF

echo "✅ .env.example created"

# Health check
echo "🏥 Running health checks..."
pnpm type-check

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and fill in your credentials"
echo "  2. Run 'pnpm dev' to start development servers"
echo "  3. See docs/guides/getting-started.md for more information"
echo ""
