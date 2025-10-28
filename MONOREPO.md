# Monorepo Guide

This document describes the conventions and best practices for working with this monorepo.

## Directory Structure

### Apps (`apps/`)
Deployable applications that can run independently. Each app has its own `package.json` and can be deployed separately.

- **mobile-app**: React Native application for iOS and Android
- **websocket-server**: Real-time WebSocket server for conversation handling
- **api-gateway**: REST API with OpenAPI documentation

### Services (`services/`)
Backend microservices that provide specific functionality. These are typically deployed as separate containers or Cloud Run services.

- **asr-service**: Automatic Speech Recognition using Google Chirp
- **rag-service**: Retrieval-Augmented Generation pipeline
- **llm-service**: Large Language Model integration (multi-provider)
- **tts-service**: Text-to-Speech with voice cloning
- **lipsync-service**: Lip-sync video generation
- **face-processing-service**: Face detection and model creation

### Packages (`packages/`)
Shared libraries that can be used across apps and services. These are internal packages not published to npm.

- **shared-types**: TypeScript types and interfaces
- **api-client**: REST and WebSocket client library
- **validation**: Zod validation schemas
- **config**: Environment configuration management
- **logger**: Structured logging with Winston
- **errors**: Custom error classes
- **utils**: Common utility functions
- **constants**: Shared constants and enums

## Package Naming Convention

All internal packages use the `@clone/` scope:
- `@clone/shared-types`
- `@clone/api-client`
- `@clone/websocket-server`
- etc.

## Workspace Dependencies

To use a shared package in an app or service, add it to `dependencies` in `package.json`:

```json
{
  "dependencies": {
    "@clone/shared-types": "workspace:*",
    "@clone/logger": "workspace:*"
  }
}
```

The `workspace:*` protocol tells pnpm to link to the local workspace package.

## TypeScript Configuration

### Base Configuration
All packages extend from `tsconfig.base.json` at the root, which provides:
- Strict type checking
- Path aliases for all shared packages
- Common compiler options

### Package-Specific Configuration
Each package has its own `tsconfig.json` that extends the base:

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

## Build Order

Turborepo automatically handles build order based on dependencies. Shared packages are built before apps and services that depend on them.

Build order:
1. `@clone/shared-types`
2. `@clone/constants`
3. `@clone/errors`
4. `@clone/utils`
5. `@clone/config`
6. `@clone/logger`
7. `@clone/validation`
8. `@clone/api-client`
9. Apps and services (parallel)

## Development Workflow

### Adding a New Package

1. Create directory structure:
```bash
mkdir -p packages/my-package/src
```

2. Create `package.json`:
```json
{
  "name": "@clone/my-package",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint . --ext .ts"
  }
}
```

3. Create `tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

4. Add to path aliases in `tsconfig.base.json`:
```json
{
  "paths": {
    "@clone/my-package": ["./packages/my-package/src"]
  }
}
```

5. Create source files in `src/`

6. Install dependencies:
```bash
pnpm install
```

### Adding a New Service

Follow the same pattern as packages, but place in `services/` directory.

### Running Commands

#### Run in all packages
```bash
pnpm build
pnpm test
pnpm lint
```

#### Run in specific package
```bash
pnpm --filter @clone/websocket-server dev
pnpm --filter @clone/shared-types build
```

#### Run in multiple packages
```bash
pnpm --filter "@clone/*" build
pnpm --filter "./packages/*" test
```

## Turborepo Caching

Turborepo caches build outputs to speed up subsequent builds. Cache is stored in `.turbo/` directory.

### Clear cache
```bash
rm -rf .turbo
```

### Disable cache for a command
```bash
turbo run build --force
```

## Code Quality

### Linting
ESLint is configured at the root with TypeScript support. Run:
```bash
pnpm lint
```

### Formatting
Prettier is configured for consistent code formatting. Run:
```bash
pnpm format
```

### Type Checking
TypeScript type checking across all packages:
```bash
pnpm type-check
```

## Testing

### Unit Tests
Each package should have its own tests in `src/**/*.test.ts` files.

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @clone/shared-types test

# Run tests in watch mode
pnpm --filter @clone/utils test --watch
```

### Integration Tests
Integration tests should be placed in a dedicated test directory or in the relevant service.

## Versioning

Internal packages use `workspace:*` protocol and don't need version bumps for local development. For releases, consider using:
- [Changesets](https://github.com/changesets/changesets) for version management
- Semantic versioning (semver)

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:
1. Lint all code
2. Type check all packages
3. Run all tests
4. Build all packages
5. Upload build artifacts

## Best Practices

### 1. Keep Packages Focused
Each package should have a single, well-defined purpose.

### 2. Minimize Dependencies
Only add dependencies that are truly needed. Prefer shared packages over duplicating code.

### 3. Use TypeScript Strictly
Enable strict mode and avoid `any` types. Use proper type definitions.

### 4. Write Tests
Aim for good test coverage, especially for shared packages.

### 5. Document Public APIs
Add JSDoc comments for exported functions and types.

### 6. Follow Naming Conventions
- Use kebab-case for directory names
- Use PascalCase for type names
- Use camelCase for function names
- Use UPPER_SNAKE_CASE for constants

### 7. Keep Build Fast
- Minimize dependencies
- Use incremental builds
- Leverage Turborepo caching

### 8. Handle Errors Properly
Use custom error classes from `@clone/errors` package.

### 9. Log Consistently
Use the logger from `@clone/logger` package for all logging.

### 10. Validate Input
Use Zod schemas from `@clone/validation` package for input validation.

## Troubleshooting

### Build Errors

**Problem**: TypeScript can't find shared package
**Solution**: Make sure the package is built first:
```bash
pnpm --filter @clone/shared-types build
```

**Problem**: Module resolution errors
**Solution**: Check path aliases in `tsconfig.base.json` and ensure they match package names.

### Dependency Issues

**Problem**: Dependency not found
**Solution**: Run `pnpm install` at the root to install all dependencies.

**Problem**: Version conflicts
**Solution**: Use `pnpm dedupe` to resolve version conflicts.

### Cache Issues

**Problem**: Stale build outputs
**Solution**: Clear Turborepo cache:
```bash
rm -rf .turbo
pnpm clean
pnpm build
```

## Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
