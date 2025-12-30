---
inclusion: manual
---

# Creating Packages

## Structure

```
packages/my-package/
├── src/index.ts
├── package.json    # name: "@clone/my-package"
├── tsconfig.json   # extends: "../../tsconfig.base.json"
└── jest.config.js  # extends: require('../../jest.config.base')
```

## Add Dependencies

```bash
pnpm --filter @clone/my-package add lodash
pnpm --filter @clone/my-package add @clone/logger@workspace:*
```
