# Database Setup Guide

Quick guide to set up the database for the DigiTwin Live System.

## Prerequisites

- PostgreSQL 15+ installed and running
- Node.js 20+
- pnpm 8+

## Quick Setup

### 1. Install PostgreSQL (if not installed)

**macOS (Homebrew):**

```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**

```bash
sudo apt-get install postgresql-15
sudo systemctl start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Create database
createdb digitwinlive-db

# Or using psql
psql -U postgres
CREATE DATABASE digitwinlive-db;
\q
```

### 3. Configure Environment

```bash
# Copy environment template
cp packages/database/.env.example packages/database/.env

# Edit .env and set DATABASE_URL
# Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/digitwinlive-db?schema=public"
```

### 4. Install Dependencies

```bash
# From project root
pnpm install

# Or from database package
cd packages/database
pnpm install
```

### 5. Run Migrations

```bash
cd packages/database

# Generate Prisma client
pnpm prisma:generate

# Create and apply initial migration
pnpm prisma migrate dev --name init

# Seed database with test data (optional)
pnpm prisma:seed
```

## Verify Setup

### Check Database Connection

```bash
cd packages/database
pnpm prisma db pull
```

If successful, you should see: "Introspected X models and wrote them into prisma/schema.prisma"

### View Data with Prisma Studio

```bash
cd packages/database
pnpm prisma:studio
```

This opens a web interface at http://localhost:5555 to view and edit data.

### Run a Test Query

Create a test file `test-db.ts`:

```typescript
import { DatabaseConnection, RepositoryFactory } from '@clone/database';

async function test() {
  await DatabaseConnection.connect();

  const prisma = DatabaseConnection.getInstance();
  const factory = new RepositoryFactory(prisma);
  const userRepo = factory.getUserRepository();

  // Create a test user
  const user = await userRepo.create({
    email: 'test@example.com',
    name: 'Test User',
    personalityTraits: ['friendly'],
    subscriptionTier: 'free',
    settings: {},
  });

  console.log('Created user:', user);

  // Find the user
  const found = await userRepo.findByEmail('test@example.com');
  console.log('Found user:', found);

  await DatabaseConnection.disconnect();
}

test().catch(console.error);
```

Run it:

```bash
tsx test-db.ts
```

## Common Issues

### Connection Refused

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**

```bash
# Check if PostgreSQL is running
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Start PostgreSQL
brew services start postgresql@15  # macOS
sudo systemctl start postgresql  # Linux
```

### Authentication Failed

**Problem:** `Error: password authentication failed for user "postgres"`

**Solution:**
Update your DATABASE_URL with correct credentials:

```bash
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/digitwinlive-db"
```

### Database Does Not Exist

**Problem:** `Error: database "digitwinlive-db" does not exist`

**Solution:**

```bash
createdb digitwinlive-db
```

### Migration Conflicts

**Problem:** Migration fails due to existing tables

**Solution:**

```bash
# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset

# Or drop and recreate database
dropdb digitwinlive-db
createdb digitwinlive-db
pnpm prisma migrate dev
```

## Production Setup

### Cloud SQL (Google Cloud Platform)

1. Create Cloud SQL instance:

```bash
gcloud sql instances create clone-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-4-16384 \
  --region=us-central1
```

2. Create database:

```bash
gcloud sql databases create digitwinline_prod \
  --instance=clone-db
```

3. Set up connection:

```bash
# For Cloud Run (Unix socket)
DATABASE_URL="postgresql://USER:PASSWORD@/digitwinline_prod?host=/cloudsql/PROJECT:REGION:INSTANCE"

# For external connection
DATABASE_URL="postgresql://USER:PASSWORD@INSTANCE_IP:5432/digitwinline_prod"
```

4. Run migrations:

```bash
pnpm prisma migrate deploy
```

### Connection Pooling

For production, configure connection pooling:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public&connection_limit=10&pool_timeout=10"
```

## Next Steps

- Read [Database Architecture](../../docs/DATABASE-ARCHITECTURE.md) for schema details
- Review [Repository Pattern](./README.md#using-repositories) for usage examples
- Check [Prisma Documentation](https://www.prisma.io/docs) for advanced features

## Useful Commands

```bash
# Generate Prisma client
pnpm prisma:generate

# Create migration
pnpm prisma migrate dev --name migration_name

# Apply migrations (production)
pnpm prisma migrate deploy

# Reset database (development only)
pnpm prisma migrate reset

# Open Prisma Studio
pnpm prisma:studio

# Seed database
pnpm prisma:seed

# Pull schema from database
pnpm prisma db pull

# Push schema to database (development only)
pnpm prisma db push
```

## Support

For issues:

- Check [Troubleshooting](#common-issues) section
- Review [Prisma Documentation](https://www.prisma.io/docs)
- Open an issue on GitHub
