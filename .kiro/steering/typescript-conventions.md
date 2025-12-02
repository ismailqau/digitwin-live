---
inclusion: always
---

# TypeScript Conventions

## Strict Mode

This project uses TypeScript strict mode. All code must comply with:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Naming Conventions

```typescript
// Classes: PascalCase
class UserService {}

// Interfaces: PascalCase
interface UserRepository {}

// Types: PascalCase
type UserRole = 'admin' | 'user';

// Functions/Variables: camelCase
const getUserById = () => {};
const isAuthenticated = true;

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = 'https://api.example.com';

// Files: kebab-case
// user-service.ts
// auth-middleware.ts
```

## Import Order

```typescript
// 1. Node built-ins
import { readFile } from 'fs/promises';

// 2. External dependencies
import express from 'express';
import { z } from 'zod';

// 3. Internal packages (@clone/*)
import { logger } from '@clone/logger';
import { UserDto } from '@clone/shared-types';

// 4. Relative imports
import { userService } from '../services/user.service';
import { validateRequest } from './middleware';
```

## Function Signatures

Always provide explicit return types:

```typescript
// ✅ Good
export const getUserById = async (id: string): Promise<User> => {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
};

// ❌ Bad - no return type, uses any
export const getUserById = async (id: any) => {
  const user = await userRepository.findById(id);
  if (!user) throw new Error('User not found');
  return user;
};
```

## Error Handling

Use custom error classes from `@clone/errors`:

```typescript
import { AppError, NotFoundError, ValidationError } from '@clone/errors';

// Throw specific errors
throw new NotFoundError('User not found');
throw new ValidationError('Invalid email format');
throw new AppError('Something went wrong', 500);
```

## Logging

Use structured logging from `@clone/logger`:

```typescript
import { logger } from '@clone/logger';

// ✅ Good - structured logging
logger.info('Processing request', { userId: '123', action: 'create' });
logger.error('Failed to process', { error: err.message, stack: err.stack });

// ❌ Bad - console.log
console.log('Processing request for user 123');
```

## Validation

Use Zod schemas from `@clone/validation`:

```typescript
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  age: z.number().min(0).max(150),
});

// Validate input
const data = userSchema.parse(input);
```

## Async/Await

Always use async/await over raw promises:

```typescript
// ✅ Good
const result = await fetchData();
const processed = await processData(result);

// ❌ Bad
fetchData().then(result => processData(result)).then(processed => ...);
```

## Null Checks

Use optional chaining and nullish coalescing:

```typescript
// ✅ Good
const name = user?.profile?.name ?? 'Unknown';

// ❌ Bad
const name = user && user.profile && user.profile.name ? user.profile.name : 'Unknown';
```
