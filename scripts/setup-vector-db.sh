#!/bin/bash

# Setup Vector Database (PostgreSQL with pgvector)
# This script sets up the vector database after the main database migration

set -e

echo "🚀 Setting up Vector Database (PostgreSQL with pgvector)..."

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL in your .env file"
    exit 1
fi

echo "📦 Installing pgvector extension..."

# Run the pgvector setup migration
psql "$DATABASE_URL" -f packages/database/migrations/001_setup_pgvector.sql

echo "🔧 Creating vector indexes..."

# Create vector indexes (run after Prisma migration)
psql "$DATABASE_URL" -c "SELECT create_vector_indexes();"

echo "✅ Vector database setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run 'pnpm db:migrate' to apply Prisma migrations"
echo "2. Run 'pnpm db:generate' to generate Prisma client"
echo "3. Your PostgreSQL database is now ready for vector operations!"
echo ""
echo "🔍 Vector Database Configuration:"
echo "- Extension: pgvector"
echo "- Vector Dimensions: ${VECTOR_DIMENSIONS:-768}"
echo "- Index Type: IVFFlat"
echo "- Index Lists: ${VECTOR_INDEX_LISTS:-100}"