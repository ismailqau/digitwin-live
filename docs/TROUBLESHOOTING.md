# Troubleshooting Guide

Common issues and their solutions for the Conversational Clone System.

## Environment Variables

### Issue: Validation Script Not Reading .env File

**Symptoms:**

```bash
node scripts/validate-env.js

❌ Errors:
• Missing required variable: NODE_ENV
• Missing required variable: JWT_SECRET
• Missing required variable: REFRESH_SECRET
```

**Cause:** The validation script wasn't loading the `.env` file into `process.env`.

**Solution:** This has been fixed in the latest version. The script now automatically loads `.env` file contents.

**Verification:**

```bash
node scripts/validate-env.js
# Should show: ✅ Environment validation passed!
```

### Issue: Duplicate Environment Variables

**Symptoms:**

- Unexpected behavior
- Variables not having expected values
- Last occurrence takes precedence

**Solution:**

```bash
# Find duplicates
grep -n "VARIABLE_NAME" .env

# Remove duplicates, keeping only the first occurrence
```

**Example:**

```bash
# Find duplicate ENABLE_CACHING
grep -n "ENABLE_CACHING" .env
# Output: 51:ENABLE_CACHING=true
#         186:ENABLE_CACHING=false

# Keep only line 51, remove line 186
```

### Issue: Missing Required Variables

**Symptoms:**

```bash
❌ Errors:
• Missing required variable: DATABASE_URL
```

**Solution:**

1. Check `.env.example` for the variable format
2. Add the missing variable to your `.env` file
3. Run validation again

**Example:**

```bash
# Add to .env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Validate
node scripts/validate-env.js
```

## Installation Issues

### Issue: pnpm Not Found

**Symptoms:**

```bash
pnpm: command not found
```

**Solution:**

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

### Issue: Node Version Mismatch

**Symptoms:**

```bash
Error: The engine "node" is incompatible with this module
```

**Solution:**

```bash
# Check required version
cat .nvmrc

# Install and use correct version
nvm install
nvm use

# Or install Node.js 18+
```

### Issue: PostgreSQL Connection Failed

**Symptoms:**

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS)
brew services start postgresql@15

# Start PostgreSQL (Linux)
sudo systemctl start postgresql

# Verify connection
psql -U postgres -c "SELECT version();"
```

## Directory Structure

### Issue: Directory Not Found

**Symptoms:**

```bash
Error: ENOENT: no such file or directory, open './logs/app.log'
```

**Solution:**

```bash
# Verify directory structure
./scripts/verify-directory-structure.sh

# If directories are missing, they should be created automatically
# If not, create manually:
mkdir -p logs cache uploads tmp

# Ensure .gitkeep files exist
ls -la logs/.gitkeep
```

### Issue: Permission Denied on Scripts

**Symptoms:**

```bash
bash: ./scripts/validate-env.js: Permission denied
```

**Solution:**

```bash
# Make scripts executable
chmod +x scripts/*.js
chmod +x scripts/*.sh
chmod +x infrastructure/scripts/*.sh

# Verify permissions
ls -la scripts/
```

## Build Issues

### Issue: TypeScript Compilation Errors

**Symptoms:**

```bash
error TS2307: Cannot find module '@clone/shared-types'
```

**Solution:**

```bash
# Build all packages first
pnpm build

# Or build specific package
pnpm --filter @clone/shared-types build

# Clean and rebuild
pnpm clean
pnpm build
```

### Issue: Turbo Cache Issues

**Symptoms:**

- Stale builds
- Changes not reflected
- Inconsistent behavior

**Solution:**

```bash
# Clear Turbo cache
rm -rf .turbo

# Force rebuild
pnpm build --force

# Or use clean command
pnpm clean
pnpm build
```

## Database Issues

### Issue: Database Does Not Exist

**Symptoms:**

```bash
error: database "conversational_clone_dev" does not exist
```

**Solution:**

```bash
# Create database
createdb conversational_clone_dev

# Or using psql
psql -U postgres -c "CREATE DATABASE conversational_clone_dev;"

# Verify
psql -U postgres -l | grep conversational_clone
```

### Issue: Migration Failed

**Symptoms:**

```bash
Error: Migration failed to apply
```

**Solution:**

```bash
# Reset database (development only!)
dropdb conversational_clone_dev
createdb conversational_clone_dev

# Run migrations
cd packages/database
pnpm prisma migrate dev

# Or reset Prisma
pnpm prisma migrate reset
```

## Infrastructure Issues

### Issue: Terraform Init Failed

**Symptoms:**

```bash
Error: Failed to initialize backend
```

**Solution:**

```bash
# Clear Terraform state
rm -rf infrastructure/terraform/.terraform

# Re-initialize
./infrastructure/scripts/init-terraform.sh dev

# Verify backend bucket exists
gsutil ls gs://conversational-clone-dev-tfstate
```

### Issue: GCP Authentication Failed

**Symptoms:**

```bash
Error: google: could not find default credentials
```

**Solution:**

```bash
# Set credentials
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"

# Or authenticate with gcloud
gcloud auth application-default login

# Verify authentication
gcloud auth list
```

## Runtime Issues

### Issue: Port Already in Use

**Symptoms:**

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
API_GATEWAY_PORT=3001
```

### Issue: WebSocket Connection Failed

**Symptoms:**

```bash
WebSocket connection failed: Error during WebSocket handshake
```

**Solution:**

1. Check WebSocket server is running
2. Verify CORS settings
3. Check firewall rules
4. Verify WebSocket URL in client

```bash
# Test WebSocket server
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:3001
```

## Testing Issues

### Issue: Tests Failing

**Symptoms:**

```bash
FAIL tests/unit/example.test.ts
```

**Solution:**

```bash
# Run tests with verbose output
pnpm test -- --verbose

# Run specific test file
pnpm test -- tests/unit/example.test.ts

# Update snapshots if needed
pnpm test -- -u
```

### Issue: Test Database Connection Failed

**Symptoms:**

```bash
Error: connect ECONNREFUSED (test database)
```

**Solution:**

```bash
# Create test database
createdb conversational_clone_test

# Set test database URL
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/conversational_clone_test"

# Run migrations on test database
cd packages/database
pnpm prisma migrate deploy --schema=./prisma/schema.prisma
```

## Getting Help

### Check Logs

```bash
# Application logs
tail -f logs/dev.log

# Error logs
tail -f logs/dev-error.log

# Service logs
tail -f services/*/logs/*.log
```

### Verify Configuration

```bash
# Validate environment
node scripts/validate-env.js

# Verify directory structure
./scripts/verify-directory-structure.sh

# Check package versions
pnpm list --depth=0
```

### Common Commands

```bash
# Full reset (development only!)
pnpm clean
rm -rf node_modules
pnpm install
pnpm build

# Restart services
pnpm dev

# Check health
curl http://localhost:3000/health
```

### Documentation

- [Getting Started](./GETTING-STARTED.md)
- [Environment Setup](./ENVIRONMENT-SETUP.md)
- [Monorepo Development](./MONOREPO-DEVELOPMENT.md)
- [GCP Infrastructure](./GCP-INFRASTRUCTURE.md)

### Support Channels

- GitHub Issues: [repository-url]/issues
- Documentation: [docs-url]
- Team Chat: [slack/discord-url]

## Contributing Fixes

Found a solution to a common problem? Please:

1. Document the issue and solution
2. Add it to this guide
3. Submit a pull request
4. Help others facing the same issue

## Preventive Measures

### Before Starting Development

```bash
# 1. Verify environment
node scripts/validate-env.js

# 2. Verify directory structure
./scripts/verify-directory-structure.sh

# 3. Build all packages
pnpm build

# 4. Run tests
pnpm test
```

### Before Committing

```bash
# 1. Lint code
pnpm lint

# 2. Format code
pnpm format

# 3. Type check
pnpm type-check

# 4. Run tests
pnpm test
```

### Before Deploying

```bash
# 1. Validate environment
node scripts/validate-env.js

# 2. Build production
pnpm build

# 3. Run integration tests
pnpm test:integration

# 4. Verify infrastructure
./infrastructure/scripts/verify-deployment.sh <env> <project-id>
```
