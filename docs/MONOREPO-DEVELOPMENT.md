# Monorepo Development Guide

Guide for working with the Conversational Clone monorepo using Turborepo and pnpm workspaces.

## 📁 Directory Structure

### Apps (`apps/`)
Deployable applications that run independently:
- **api-gateway** - REST API with OpenAPI docs
- **websocket-server** - Real-time WebSocket server
- **mobile-app** - React Native app (iOS/Android)

### Services (`services/`)
Backend microservices deployed as containers:
- **asr-service** - Speech recognition (Google Chirp)
- **rag-service** - Retrieval-Augmented Generation
- **llm-service** - LLM integration (multi-provider)
- **tts-service** - Text-to-Speech with voice cloning
- **lipsync-service** - Lip-sync video generation
- **face-processing-service** - Face detection and models

### Packages (`packages/`)
Shared internal libraries:
- **shared-types** - TypeScript types and interfaces
- **config** - Environment configuration
- **logger** - Structured logging (Winston)
- **validation** - Zod validation schemas
- **errors** - Custom error classes
- **utils** - Common utilities
- **constants** - Shared constants
- **api-client** - REST and WebSocket client

## 🏷️ Package Naming

All internal packages use the `@clone/` scope:
```json
{
  "name": "@clone/shared-types",
  "name": "@clone/api-client",
  "name": "@clone/websocket-server"
}
```

## 🔗 Workspace Dependencies

Use `workspace:*` protocol to link local packages:

```json
{
  "dependencies": {
    "@clone/shared-types": "workspace:*",
    "@clone/logger": "workspace:*"
  }
}
```

## 🛠️ Common Commands

### Install Dependencies
```bash
# Install all dependencies
pnpm install

# Install in specific package
pnpm --filter @clone/websocket-server install
```

### Build
```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @clone/shared-types build

# Build with dependencies
pnpm --filter @clone/api-gateway... build
```

### Development
```bash
# Run all dev servers
pnpm dev

# Run specific service
pnpm --filter @clone/websocket-server dev
pnpm --filter @clone/api-gateway dev
```

### Testing
```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @clone/shared-types test

# Test in watch mode
pnpm --filter @clone/utils test --watch
```

### Linting & Formatting
```bash
# Lint all code
pnpm lint

# Format all code
pnpm format

# Type check all packages
pnpm type-check
```

### Add Dependencies
```bash
# Add to specific package
pnpm --filter @clone/api-gateway add express

# Add dev dependency
pnpm --filter @clone/shared-types add -D jest

# Add to multiple packages
pnpm --filter "@clone/*" add lodash
```

## 🏗️ Build Order

Turborepo automatically handles build order based on dependencies:

1. Base packages: `shared-types`, `constants`, `errors`
2. Utility packages: `utils`, `config`, `logger`
3. Feature packages: `validation`, `api-client`
4. Apps and services (parallel)

## 📝 Adding a New Package

### 1. Create Directory Structure
```bash
mkdir -p packages/my-package/src
cd packages/my-package
```

### 2. Create `package.json`
```json
{
  "name": "@clone/my-package",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest",
    "lint": "eslint . --ext .ts"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

### 3. Create `tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 4. Add Path Alias (in root `tsconfig.base.json`)
```json
{
  "paths": {
    "@clone/my-package": ["./packages/my-package/src"]
  }
}
```

### 5. Create Source Files
```bash
# Create main file
echo "export const hello = () => 'Hello';" > src/index.ts
```

### 6. Install and Build
```bash
# From root
pnpm install
pnpm --filter @clone/my-package build
```

## ⚡ Turborepo Caching

Turborepo caches build outputs for faster subsequent builds.

### Cache Location
```bash
.turbo/          # Cache directory
```

### Clear Cache
```bash
rm -rf .turbo
pnpm clean
```

### Force Rebuild (Skip Cache)
```bash
turbo run build --force
```

### Cache Configuration
Cache settings are in `turbo.json`:
```json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**"],
      "dependsOn": ["^build"]
    }
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
Place tests alongside source files:
```
src/
├── utils.ts
└── utils.test.ts
```

### Integration Tests
Create dedicated test directories:
```
tests/
├── integration/
└── e2e/
```

### Run Tests
```bash
# All tests
pnpm test

# Specific package
pnpm --filter @clone/shared-types test

# Watch mode
pnpm --filter @clone/utils test --watch

# Coverage
pnpm test --coverage
```

## 🎯 Best Practices

### 1. Keep Packages Focused
Each package should have a single, well-defined purpose.

### 2. Minimize Dependencies
Only add necessary dependencies. Prefer shared packages over duplication.

### 3. Use TypeScript Strictly
```typescript
// ✅ Good
export function add(a: number, b: number): number {
  return a + b;
}

// ❌ Bad
export function add(a: any, b: any): any {
  return a + b;
}
```

### 4. Document Public APIs
```typescript
/**
 * Adds two numbers together
 * @param a - First number
 * @param b - Second number
 * @returns Sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

### 5. Handle Errors Properly
```typescript
import { AppError } from '@clone/errors';

throw new AppError('Invalid input', 400);
```

### 6. Log Consistently
```typescript
import { logger } from '@clone/logger';

logger.info('Processing request', { userId: '123' });
```

### 7. Validate Input
```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0)
});

const data = schema.parse(input);
```

## 🐛 Troubleshooting

### Build Errors

**TypeScript can't find shared package**
```bash
# Build dependencies first
pnpm --filter @clone/shared-types build
```

**Module resolution errors**
```bash
# Check path aliases in tsconfig.base.json
# Ensure package names match
```

### Dependency Issues

**Dependency not found**
```bash
# Reinstall all dependencies
rm -rf node_modules
pnpm install
```

**Version conflicts**
```bash
# Dedupe dependencies
pnpm dedupe
```

### Cache Issues

**Stale build outputs**
```bash
# Clear everything and rebuild
rm -rf .turbo
pnpm clean
pnpm build
```

**Turborepo not detecting changes**
```bash
# Force rebuild
turbo run build --force
```

## 📚 Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

## 🔗 Related Documentation

- [Getting Started](./GETTING-STARTED.md) - Initial setup
- [Environment Setup](./ENVIRONMENT-SETUP.md) - Configuration
- [Project README](../README.md) - Project overview
