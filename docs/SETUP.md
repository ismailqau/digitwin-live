# 🚀 Complete Setup Guide

Complete guide to set up the DigitWin Live development environment.

---

## 📋 Prerequisites

### Required

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **pnpm** 8+ ([Install](https://pnpm.io/installation))
- **Git** ([Download](https://git-scm.com/))

### Optional (for full functionality)

- **Docker** ([Download](https://www.docker.com/))
- **PostgreSQL** 15+ ([Download](https://www.postgresql.org/))
- **Google Cloud SDK** ([Install](https://cloud.google.com/sdk/docs/install))

---

## 🎯 Quick Setup (Automated)

### One-Command Setup

```bash
# Clone repository
git clone <repository-url>
cd digitwinlive

# Run master setup script
./scripts/setup-all.sh
```

This will:

1. ✅ Install all dependencies
2. ✅ Configure quality gates and pre-commit hooks
3. ✅ Set up test infrastructure
4. ✅ Verify everything is working

---

## 🔧 Manual Setup (Step by Step)

### 1. Install Dependencies

```bash
# Install Node.js dependencies
pnpm install
```

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Generate secrets
node scripts/generate-secrets.js

# Edit .env with your configuration
nano .env
```

### 3. Setup Quality Gates

```bash
# Install git hooks and configure linting
pnpm setup:quality
```

This sets up:

- Pre-commit hooks (linting, formatting, type checking)
- Commit message validation
- Pre-push hooks (tests, build, security audit)

### 4. Setup Tests

```bash
# Configure test infrastructure
pnpm setup:tests
```

This creates:

- Jest configurations for all 45 workspaces (including mobile-app with jest-expo)
- Test setup files
- Sample tests
- Test utilities package

### 5. Setup Database

```bash
# Create database
createdb digitwinlive_dev

# Run migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate
```

### 6. Setup Vector Database

Choose one option:

**Option A: PostgreSQL with pgvector (Recommended)**

```bash
# Install pgvector extension
# See docs/VECTOR-DATABASE.md for instructions

# Configure in .env
WEAVIATE_ENABLED=false
```

**Option B: Weaviate (Free, Self-hosted)**

```bash
# Start Weaviate with Docker
docker run -d --name weaviate -p 8080:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  semitechnologies/weaviate:latest

# Configure in .env
WEAVIATE_ENABLED=true
WEAVIATE_URL=http://localhost:8080
```

### 7. Verify Setup

```bash
# Run verification script
pnpm verify:setup

# Run all quality checks
pnpm validate
```

---

## 🧪 Verify Everything Works

### Run Tests

```bash
# Run all tests (45 workspaces)
pnpm test

# Run with coverage
pnpm test:coverage

# All tests should pass
# Expected: Tasks: 45 successful, 45 total
```

### Run Linting

```bash
# Check code quality
pnpm lint

# Fix issues automatically
pnpm lint:fix
```

### Build Project

```bash
# Build all packages
pnpm build
```

### Start Development

```bash
# Start all development servers
pnpm dev
```

---

## 🎨 IDE Setup

### VS Code (Recommended)

1. **Install Extensions**
   - ESLint
   - Prettier
   - EditorConfig
   - Jest Runner

2. **Configure Settings**
   ```json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

### Other IDEs

- Ensure EditorConfig support
- Enable ESLint and Prettier
- Configure format on save

---

## 🔐 GCP Setup (Optional)

### 1. Install Google Cloud SDK

```bash
# macOS
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Setup GCP Infrastructure

```bash
# Run setup script
pnpm gcp:setup

# Or create SQL instance only
pnpm gcp:create-sql
```

### 4. Verify GCP Setup

```bash
# Check status
pnpm gcp:status

# Run GCP tests
pnpm test:gcp
```

**📖 Detailed Guide**: See [docs/GCP-MANAGEMENT.md](./docs/GCP-MANAGEMENT.md)

---

## 📚 Documentation

### Essential Reading

- **[Getting Started](./GETTING-STARTED.md)** - Quick 5-step setup
- **[Code Quality Guide](./CODE-QUALITY-GUIDE.md)** - Linting and best practices
- **[Testing Guide](./TESTING-GUIDE.md)** - Writing and running tests (45 workspaces)
- **[Quality Gates Setup](./QUALITY-GATES-SETUP.md)** - Pre-commit hooks and CI/CD
- **[GCP Management](./GCP-MANAGEMENT.md)** - GCP infrastructure

### Complete Documentation

- **[Documentation Index](./INDEX.md)** - All documentation
- **[Documentation Hub](./README.md)** - Documentation overview

---

## 🚨 Troubleshooting

### Issue: pnpm not found

```bash
# Install pnpm
npm install -g pnpm

# Or use corepack (Node.js 16+)
corepack enable
corepack prepare pnpm@latest --activate
```

### Issue: Pre-commit hooks not working

```bash
# Reinstall hooks
pnpm prepare

# Make hooks executable
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
```

### Issue: Tests failing

```bash
# Clear cache and reinstall
pnpm clean
pnpm install

# Regenerate test configs
pnpm setup:tests
```

### Issue: Database connection error

```bash
# Check PostgreSQL is running
psql -l

# Verify DATABASE_URL in .env
echo $DATABASE_URL

# Create database if missing
createdb digitwinlive_dev
```

### Issue: Build errors

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

---

## ✅ Setup Checklist

### Environment

- [ ] Node.js 20+ installed
- [ ] pnpm 8+ installed
- [ ] Git installed
- [ ] Repository cloned

### Dependencies

- [ ] `pnpm install` completed
- [ ] All dependencies installed
- [ ] No installation errors

### Configuration

- [ ] `.env` file created
- [ ] Secrets generated
- [ ] Environment variables configured

### Quality Gates

- [ ] Git hooks installed
- [ ] Pre-commit hooks working
- [ ] Commit message validation working
- [ ] ESLint configured
- [ ] Prettier configured

### Tests

- [ ] Jest configured
- [ ] Test utilities available
- [ ] Sample tests passing
- [ ] Coverage thresholds set

### Database

- [ ] PostgreSQL installed
- [ ] Database created
- [ ] Migrations run
- [ ] Prisma client generated

### Vector Database

- [ ] PostgreSQL + pgvector OR Weaviate
- [ ] Vector database configured
- [ ] Connection verified

### Verification

- [ ] `pnpm verify:setup` passes
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm validate` passes

---

## 🎯 Next Steps

### Start Developing

```bash
# Start development servers
pnpm dev

# Open in browser
open http://localhost:3000
```

### Write Code

1. Create a new branch
2. Write code
3. Write tests
4. Commit (hooks run automatically)
5. Push (hooks run automatically)
6. Create pull request

### Deploy

```bash
# Build for production
pnpm build

# Run production checks
pnpm validate

# Deploy (see deployment docs)
```

---

## 📖 Additional Resources

### Documentation

- [Monorepo Development](./docs/MONOREPO-DEVELOPMENT.md)
- [Vector Database Guide](./docs/VECTOR-DATABASE.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)

### External Links

- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Docs](https://pnpm.io/)
- [Jest Docs](https://jestjs.io/)
- [ESLint Docs](https://eslint.org/)

---

## 🆘 Getting Help

### Can't find what you need?

1. Check [Documentation Index](./docs/INDEX.md)
2. Search documentation: `grep -r "search term" docs/`
3. Review [Troubleshooting](./docs/TROUBLESHOOTING.md)
4. Ask in team chat

---

## 🎉 You're Ready!

Your development environment is now set up and ready to use.

**Quick Commands:**

```bash
pnpm dev        # Start development
pnpm test       # Run tests
pnpm lint       # Check code quality
pnpm validate   # Run all checks
```

**Happy coding! 🚀**
