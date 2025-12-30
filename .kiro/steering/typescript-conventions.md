---
inclusion: always
---

# TypeScript & Validation

## Strict Mode Required

```json
{ "strict": true, "noImplicitAny": true, "strictNullChecks": true }
```

## Naming

- Classes/Interfaces/Types: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case`

## Import Order

1. Node built-ins → 2. External deps → 3. `@clone/*` → 4. Relative

## Rules

- Explicit return types on functions
- async/await over raw promises
- Optional chaining: `user?.profile?.name ?? 'Unknown'`

## Validation (Zod)

```typescript
import { z } from 'zod';
const schema = z.object({ email: z.string().email() });
const result = schema.safeParse(input);
if (!result.success) throw new ValidationError(result.error.errors[0].message);
```

Common: `z.string().uuid()`, `z.coerce.number().default(1)`, `z.enum([...])`, `z.string().datetime()`
