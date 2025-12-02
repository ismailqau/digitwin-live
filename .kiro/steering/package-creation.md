---
inclusion: manual
---

# Creating New Packages

## Package Structure

When creating a new shared package in `packages/`:

```
packages/my-package/
├── src/
│   └── index.ts           # Main exports
├── jest.config.js
├── jest.setup.ts
├── package.json
└── tsconfig.json
```

## package.json Template

```json
{
  "name": "@clone/my-package",
  "version": "1.0.0",
  "description": "Description of the package",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "dev": "tsc --watch",
    "lint": "eslint . --ext .ts",
    "test": "jest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^24.9.2",
    "typescript": "^5.9.3"
  }
}
```

## tsconfig.json Template

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

## jest.config.js Template

```javascript
const baseConfig = require('../../jest.config.base');

module.exports = {
  ...baseConfig,
  displayName: 'my-package',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
```

## jest.setup.ts Template

```typescript
import '../../jest.setup.base';

// Package-specific setup
```

## src/index.ts Template

```typescript
// Export all public APIs
export * from './my-feature';
export * from './types';
```

## Adding Dependencies

```bash
# Add to specific package
pnpm --filter @clone/my-package add lodash

# Add dev dependency
pnpm --filter @clone/my-package add -D @types/lodash

# Add workspace dependency
pnpm --filter @clone/my-package add @clone/logger@workspace:*
```

## Using the Package

After creating, other packages can use it:

```json
{
  "dependencies": {
    "@clone/my-package": "workspace:*"
  }
}
```

```typescript
import { myFeature } from '@clone/my-package';
```

## Build Order

Turborepo handles build order automatically based on dependencies. Ensure your package's dependencies are correctly specified in `package.json`.

## Checklist

- [ ] Create directory structure
- [ ] Add package.json with @clone/ scope
- [ ] Add tsconfig.json extending base
- [ ] Add jest.config.js
- [ ] Add jest.setup.ts
- [ ] Create src/index.ts with exports
- [ ] Run `pnpm install` from root
- [ ] Run `pnpm --filter @clone/my-package build`
- [ ] Add tests
