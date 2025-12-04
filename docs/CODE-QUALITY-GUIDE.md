# 🎯 Code Quality Guide

Complete guide for maintaining code quality in the DigiTwin Live project.

---

## 📋 Quality Gates

### Pre-commit Checks

Automatically run on every commit:

- ✅ ESLint (with auto-fix)
- ✅ Prettier (formatting)
- ✅ TypeScript type checking
- ✅ Tests for changed files
- ✅ Markdownlint (documentation)

### Pre-push Checks

Run before pushing to remote:

- ✅ All tests
- ✅ Full build
- ✅ Security audit
- ✅ Dependency check

### CI/CD Checks

Run on pull requests and merges:

- ✅ ESLint
- ✅ TypeScript
- ✅ Prettier
- ✅ Tests + Coverage
- ✅ Build
- ✅ Security audit
- ✅ Circular dependency check
- ✅ Commit message validation

---

## 🚀 Quick Start

### Initial Setup

```bash
# Install dependencies
pnpm install

# Setup git hooks
pnpm prepare

# Verify setup
pnpm validate
```

### Daily Workflow

```bash
# Before starting work
pnpm install  # Update dependencies

# During development
pnpm dev      # Start development server
pnpm lint:fix # Fix linting issues
pnpm format   # Format code

# Before committing
pnpm validate # Run all checks
```

---

## 🛠️ Available Commands

### Linting

```bash
# Run ESLint
pnpm lint

# Fix ESLint issues automatically
pnpm lint:fix

# Check specific files
pnpm eslint "apps/**/*.ts"
```

### Formatting

```bash
# Format all files
pnpm format

# Check formatting without changes
pnpm format:check

# Format specific files
pnpm prettier --write "apps/**/*.ts"
```

### Type Checking

```bash
# Check all TypeScript files
pnpm type-check

# Check specific workspace
pnpm --filter @clone/api-gateway type-check
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for changed files only
pnpm test:changed

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Check coverage thresholds
pnpm coverage:check
```

### Quality Checks

```bash
# Run comprehensive quality check
pnpm quality:check

# Run security audit
pnpm audit:check

# Check for circular dependencies
pnpm complexity:check

# Check for outdated dependencies
pnpm outdated:check

# Verify documentation
pnpm docs:verify

# Run all validation
pnpm validate
```

---

## 📝 Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system changes
- **ci**: CI/CD changes
- **chore**: Other changes (dependencies, etc.)
- **revert**: Revert previous commit

### Examples

```bash
# Good commits
git commit -m "feat(auth): add JWT token refresh"
git commit -m "fix(api): handle null response in user endpoint"
git commit -m "docs: update GCP setup guide"
git commit -m "refactor(rag): extract embedding service"

# Bad commits (will be rejected)
git commit -m "fixed bug"
git commit -m "WIP"
git commit -m "updates"
```

---

## 🎨 Code Style

### TypeScript

```typescript
// ✅ Good
export const getUserById = async (id: string): Promise<User> => {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
};

// ❌ Bad
export const getUserById = async (id: any) => {
  const user = await userRepository.findById(id);
  if (!user) throw new Error('User not found');
  return user;
};
```

### Import Order

```typescript
// 1. Node built-ins
import { readFile } from 'fs/promises';

// 2. External dependencies
import express from 'express';
import { z } from 'zod';

// 3. Internal packages
import { logger } from '@clone/logger';
import { UserDto } from '@clone/shared-types';

// 4. Relative imports
import { userService } from '../services/user.service';
import { validateRequest } from './middleware';
```

### Naming Conventions

```typescript
// Classes: PascalCase
class UserService {}

// Interfaces: PascalCase with 'I' prefix (optional)
interface IUserRepository {}

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

---

## 🔒 Security Best Practices

### 1. No Hardcoded Secrets

```typescript
// ❌ Bad
const apiKey = 'sk-1234567890abcdef';

// ✅ Good
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
```

### 2. Input Validation

```typescript
// ✅ Good
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
});

const validateUser = (data: unknown) => {
  return userSchema.parse(data);
};
```

### 3. SQL Injection Prevention

```typescript
// ❌ Bad
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Good (using Prisma)
const user = await prisma.user.findUnique({
  where: { id: userId },
});
```

---

## 🧪 Testing Standards

### Test Structure

```typescript
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';
      const expectedUser = { id: userId, name: 'John' };
      jest.spyOn(userRepository, 'findById').mockResolvedValue(expectedUser);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toEqual(expectedUser);
    });

    it('should throw NotFoundError when user not found', async () => {
      // Arrange
      const userId = '999';
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getUserById(userId)).rejects.toThrow(NotFoundError);
    });
  });
});
```

### Coverage Requirements

- **Minimum**: 80% line coverage
- **Target**: 90% line coverage
- **Critical paths**: 100% coverage

---

## 📊 Static Analysis

### ESLint Rules

Key rules enforced:

- No `any` types
- Explicit return types for functions
- No floating promises
- No unused variables
- Import order enforcement
- No console.log (use logger)

### TypeScript Strict Mode

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## 🔄 Continuous Integration

### GitHub Actions Workflow

On every pull request:

1. Install dependencies
2. Run linting
3. Run type checking
4. Check formatting
5. Run tests with coverage
6. Build project
7. Security audit
8. Circular dependency check
9. Documentation verification

### Quality Gates

Pull requests must pass:

- ✅ All tests passing
- ✅ No linting errors
- ✅ No type errors
- ✅ Code coverage ≥ 80%
- ✅ Build successful
- ✅ No high/critical security vulnerabilities

---

## 🚨 Common Issues

### Issue: Pre-commit hook fails

```bash
# Fix linting issues
pnpm lint:fix

# Fix formatting
pnpm format

# Fix type errors
pnpm type-check

# Run tests
pnpm test
```

### Issue: Commit message rejected

```bash
# Use conventional commit format
git commit -m "feat(scope): description"

# Or use interactive commit
git commit
# Then write proper message in editor
```

### Issue: Tests failing in CI but passing locally

```bash
# Clear cache and reinstall
pnpm clean
pnpm install

# Run tests with same config as CI
CI=true pnpm test
```

---

## 📚 Resources

### Documentation

- [ESLint Rules](https://eslint.org/docs/rules/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Testing Best Practices](https://testingjavascript.com/)

### Tools

- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)
- [Husky](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)
- [commitlint](https://commitlint.js.org/)

---

## ✅ Checklist

Before submitting a pull request:

- [ ] Code follows style guide
- [ ] All tests passing
- [ ] Test coverage ≥ 80%
- [ ] No linting errors
- [ ] No type errors
- [ ] Code formatted with Prettier
- [ ] Commit messages follow convention
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Build successful

---

**Need help?** Check [Troubleshooting](./TROUBLESHOOTING.md) or ask in the team chat.
