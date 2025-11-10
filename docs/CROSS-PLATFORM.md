# Cross-Platform Compatibility Guide

## Overview

This project is designed to work on **Windows**, **macOS**, and **Linux**. We use cross-platform tools to ensure compatibility.

## Cross-Platform Tools

### Installed Tools

- **`cross-env`** - Set environment variables across platforms
- **`rimraf`** - Cross-platform `rm -rf`
- **`shx`** - Cross-platform shell commands
- **`node`** - JavaScript scripts work everywhere

### Usage in Scripts

```json
{
  "scripts": {
    // ✅ Cross-platform
    "clean": "rimraf dist",
    "build": "cross-env NODE_ENV=production tsc",
    "copy": "shx cp -r src dist",

    // ❌ Not cross-platform (Unix only)
    "clean-bad": "rm -rf dist",
    "build-bad": "NODE_ENV=production tsc"
  }
}
```

## Platform-Specific Scripts

### Shell Scripts (`.sh`)

Shell scripts are **Unix-only** (macOS/Linux) and won't run on Windows without WSL or Git Bash.

**Current Shell Scripts:**

- `scripts/gcp-*.sh` - GCP management (Unix-only, requires `gcloud` CLI)
- `scripts/setup-*.sh` - Setup scripts (Unix-only)
- `scripts/verify-*.sh` - Verification scripts (Unix-only)

**Windows Users:**

- Use **WSL (Windows Subsystem for Linux)** - Recommended
- Use **Git Bash** - Alternative
- Use **Node.js alternatives** - See below

### Node.js Alternatives

For critical functionality, we provide Node.js alternatives that work on all platforms:

| Shell Script       | Node.js Alternative           | Platform |
| ------------------ | ----------------------------- | -------- |
| `gcp-setup.sh`     | Use GCP Console               | All      |
| `verify-docs.sh`   | `node scripts/verify-docs.js` | All      |
| `quality-check.sh` | `pnpm validate`               | All      |

## Cross-Platform Commands

### File Operations

```bash
# ✅ Cross-platform
pnpm clean              # Uses rimraf
shx rm -rf dist         # Uses shx
shx mkdir -p dist       # Uses shx
shx cp -r src dist      # Uses shx

# ❌ Unix-only
rm -rf dist
mkdir -p dist
cp -r src dist
```

### Environment Variables

```bash
# ✅ Cross-platform
cross-env NODE_ENV=production node app.js

# ❌ Unix-only
NODE_ENV=production node app.js

# ❌ Windows CMD only
set NODE_ENV=production && node app.js
```

### Path Separators

```javascript
// ✅ Cross-platform
const path = require('path');
const filePath = path.join('src', 'index.ts');

// ❌ Unix-only
const filePath = 'src/index.ts';

// ❌ Windows-only
const filePath = 'src\\index.ts';
```

## Package.json Scripts

### Cross-Platform Scripts

These scripts work on all platforms:

```bash
# Development
pnpm dev                # Start development servers
pnpm build              # Build all packages
pnpm test               # Run tests

# Code Quality
pnpm fix                # Auto-fix all issues
pnpm lint               # Check linting
pnpm format             # Format code
pnpm type-check         # Check types

# Database
pnpm db:generate        # Generate Prisma client
pnpm db:migrate         # Run migrations
pnpm db:studio          # Open Prisma Studio

# Validation
pnpm validate           # Run all checks
```

### Platform-Specific Scripts

These scripts require Unix (macOS/Linux) or WSL on Windows:

```bash
# GCP Management (requires gcloud CLI)
pnpm gcp:setup          # Setup GCP resources
pnpm gcp:status         # Check GCP status
pnpm gcp:cleanup        # Cleanup GCP resources

# Setup Scripts
pnpm setup:all          # Complete setup
pnpm setup:quality      # Setup quality gates
```

## Windows Setup

### Option 1: WSL (Recommended)

1. Install WSL:

   ```powershell
   wsl --install
   ```

2. Install Node.js in WSL:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. Install pnpm:

   ```bash
   npm install -g pnpm
   ```

4. Clone and run:
   ```bash
   git clone <repo>
   cd digitwinlive
   pnpm install
   pnpm dev
   ```

### Option 2: Git Bash

1. Install [Git for Windows](https://git-scm.com/download/win) (includes Git Bash)
2. Install [Node.js](https://nodejs.org/)
3. Install pnpm:
   ```bash
   npm install -g pnpm
   ```
4. Use Git Bash terminal for all commands

### Option 3: PowerShell (Limited)

Works for most commands except shell scripts:

```powershell
# Install pnpm
npm install -g pnpm

# Clone and install
git clone <repo>
cd digitwinlive
pnpm install

# Development (works)
pnpm dev
pnpm test
pnpm build

# GCP scripts (won't work - use GCP Console instead)
# pnpm gcp:setup  # ❌ Won't work
```

## macOS/Linux Setup

All scripts work natively:

```bash
# Install pnpm
npm install -g pnpm

# Clone and run
git clone <repo>
cd digitwinlive
pnpm install
pnpm dev
```

## CI/CD Compatibility

### GitHub Actions

Uses Ubuntu runners by default - all scripts work:

```yaml
runs-on: ubuntu-latest # ✅ All scripts work
```

### GitLab CI

Uses Docker containers - all scripts work:

```yaml
image: node:20 # ✅ All scripts work
```

## Troubleshooting

### Windows: "command not found"

**Problem**: Shell script won't run

```
'./scripts/setup.sh' is not recognized as an internal or external command
```

**Solution**: Use WSL or Git Bash, or use Node.js alternative

### Windows: Path issues

**Problem**: Paths with backslashes

```
Error: Cannot find module 'src\index.ts'
```

**Solution**: Use `path.join()` in Node.js scripts

### Windows: Permission denied

**Problem**: Script not executable

```
Permission denied: ./scripts/setup.sh
```

**Solution**: In Git Bash:

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

## Best Practices

### For Script Authors

1. **Use Node.js for new scripts** - Works everywhere
2. **Use cross-platform tools** - `rimraf`, `shx`, `cross-env`
3. **Avoid shell-specific syntax** - No `&&`, `||`, `;` in package.json
4. **Use `path.join()`** - Never hardcode path separators
5. **Test on multiple platforms** - Windows, macOS, Linux

### For Contributors

1. **Check platform compatibility** - Before adding scripts
2. **Document platform requirements** - In script comments
3. **Provide alternatives** - Node.js versions of shell scripts
4. **Test your changes** - On your platform

## Related Documentation

- [Setup Guide](./SETUP.md)
- [Development Guide](./DEVELOPMENT.md)
- [GCP Management](./GCP-MANAGEMENT.md)
