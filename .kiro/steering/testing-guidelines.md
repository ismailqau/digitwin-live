---
inclusion: always
---

# Testing Guidelines

## Test Framework

This project uses Jest for testing. Each workspace has its own `jest.config.js` that extends the base configuration.

## Test Structure

Follow the AAA pattern (Arrange, Act, Assert):

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
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getUserById('999')).rejects.toThrow(NotFoundError);
    });
  });
});
```

## File Naming

- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

## Coverage Requirements

- **Minimum**: 80% line coverage
- **Target**: 90% line coverage
- **Critical paths**: 100% coverage

## Test Commands

```bash
pnpm test                                    # Run all tests
pnpm --filter @clone/api-gateway test        # Test specific package
pnpm test:watch                              # Watch mode
pnpm test:coverage                           # With coverage
pnpm test:changed                            # Only changed files
```

## Mocking

### Mock External Services

```typescript
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

mockedAxios.get.mockResolvedValue({ data: 'test' });
```

### Mock Internal Packages

```typescript
jest.mock('@clone/database');
import { prisma } from '@clone/database';
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
```

### Mock Logger

```typescript
jest.mock('@clone/logger');
import { logger } from '@clone/logger';
const mockedLogger = logger as jest.Mocked<typeof logger>;

mockedLogger.info.mockImplementation(() => {});
```

## Test Utilities

Use `@clone/test-utils` for common test helpers:

```typescript
import {
  createMockUser,
  createMockConversation,
  mockLogger,
  waitFor,
  sleep,
} from '@clone/test-utils';

const user = createMockUser({ email: 'custom@example.com' });
await waitFor(() => someCondition === true);
```

## Best Practices

### DO ✅

- Write tests before or alongside code
- Test behavior, not implementation
- Use descriptive test names
- Mock external dependencies
- Clean up after tests
- Test edge cases and error conditions

### DON'T ❌

- Test implementation details
- Write flaky tests
- Share state between tests
- Test third-party libraries
- Use real external services
- Skip cleanup
