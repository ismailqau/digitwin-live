#!/bin/bash

# Database Migration Initialization Script
# This script initializes the database with the first migration

set -e

echo "🔧 Initializing database migrations..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo "Please set DATABASE_URL in your .env file"
  exit 1
fi

# Check if database is accessible
echo "📡 Checking database connection..."
if ! pnpm prisma db pull --force 2>/dev/null; then
  echo "⚠️  Warning: Could not connect to database. Make sure PostgreSQL is running."
  echo "   You can start PostgreSQL with: brew services start postgresql"
  exit 1
fi

echo "✅ Database connection successful"

# Create initial migration
echo "📝 Creating initial migration..."
pnpm prisma migrate dev --name init

# Generate Prisma client
echo "🔨 Generating Prisma client..."
pnpm prisma:generate

# Run seed (optional)
read -p "Do you want to seed the database with test data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🌱 Seeding database..."
  pnpm prisma:seed
fi

echo "✅ Database initialization complete!"
echo ""
echo "Next steps:"
echo "  - Review the migration in prisma/migrations/"
echo "  - Start using the database with: import { DatabaseConnection } from '@clone/database'"
echo "  - View data with Prisma Studio: pnpm prisma:studio"
