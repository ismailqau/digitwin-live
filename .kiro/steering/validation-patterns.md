---
inclusion: always
---

# Validation Patterns

## Validation Library

This project uses **Zod** for runtime validation. Schemas are defined in `@clone/validation`.

## Schema Definition

```typescript
import { z } from 'zod';

// Define schema
const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  age: z.number().min(0).max(150).optional(),
});

// Infer TypeScript type
type UserInput = z.infer<typeof userSchema>;
```

## Common Schemas

Import from `@clone/validation`:

```typescript
import {
  userProfileSchema,
  audioChunkSchema,
  documentUploadSchema,
  documentSearchSchema,
  faqCreateSchema,
  voiceConfigSchema,
  userSettingsSchema,
} from '@clone/validation';
```

## Validation Usage

### Parse (throws on error)

```typescript
try {
  const data = userSchema.parse(input);
  // data is typed and validated
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation errors
    const messages = error.errors.map((e) => e.message);
  }
}
```

### SafeParse (returns result)

```typescript
const result = userSchema.safeParse(input);

if (result.success) {
  const data = result.data;
} else {
  const errors = result.error.errors;
}
```

## API Request Validation

```typescript
import { z } from 'zod';
import { ValidationError } from '@clone/errors';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(8),
});

app.post('/users', async (req, res) => {
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }

  const userData = result.data;
  // Process validated data
});
```

## Common Patterns

### Optional with Default

```typescript
const schema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
```

### Enum Values

```typescript
const statusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
```

### UUID Validation

```typescript
const idSchema = z.string().uuid();
```

### Date Validation

```typescript
const dateSchema = z.string().datetime();
```

### File Size Validation

```typescript
const uploadSchema = z.object({
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024), // 50MB max
});
```

### Nested Objects

```typescript
const configSchema = z.object({
  voice: z.object({
    provider: z.enum(['xtts-v2', 'google-cloud-tts', 'openai-tts']),
    speed: z.number().min(0.5).max(2.0).default(1.0),
  }),
});
```

## Input Sanitization

Use sanitization utilities from `@clone/validation`:

```typescript
import { sanitizeInput, sanitizeHtml } from '@clone/validation';

const cleanText = sanitizeInput(userInput);
const cleanHtml = sanitizeHtml(htmlContent);
```

## Content Safety

```typescript
import { checkContentSafety } from '@clone/validation';

const result = await checkContentSafety(content);
if (!result.safe) {
  throw new ValidationError('Content violates policy');
}
```
