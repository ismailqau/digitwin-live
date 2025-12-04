# 🧪 Testing Guide

Comprehensive testing guide for DigiTwin Live.

---

## 📋 Testing Strategy

### Test Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /____\
     /      \    Integration Tests (30%)
    /________\
   /          \  Unit Tests (60%)
  /__________  \
```

- **Unit Tests (60%)**: Test individual functions and classes
- **Integration Tests (30%)**: Test interactions between components
- **E2E Tests (10%)**: Test complete user flows

---

## 🚀 Quick Start

### Setup Tests

```bash
# Setup test infrastructure
./scripts/setup-tests.sh

# Install dependencies
pnpm install
```

### Run Tests

```bash
# Run all tests (45 workspaces)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific workspace
pnpm --filter @clone/api-gateway test
pnpm --filter @clone/mobile-app test  # React Native with jest-expo

# Run tests for changed files only
pnpm test:changed
```

---

## 📁 Test Structure

### Directory Structure

```
workspace/
├── src/
│   ├── __tests__/          # Test files
│   │   ├── unit/           # Unit tests
│   │   ├── integration/    # Integration tests
│   │   └── e2e/            # End-to-end tests
│   ├── services/
│   │   └── user.service.ts
│   └── index.ts
├── jest.config.js          # Jest configuration
├── jest.setup.ts           # Test setup
└── package.json
```

### Naming Conventions

- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

---

## 🛠️ Writing Tests

### Unit Test Example

```typescript
// src/services/__tests__/user.service.test.ts
import { UserService } from '../user.service';
import { mockPrismaClient } from '@clone/test-utils';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService(mockPrismaClient);
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = 'test-user-id';
      const expectedUser = { id: userId, name: 'John Doe' };
      mockPrismaClient.user.findUnique.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should throw error when user not found', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getUserById('invalid-id')).rejects.toThrow('User not found');
    });
  });
});
```

### Integration Test Example

```typescript
// src/__tests__/integration/auth.integration.test.ts
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '@clone/database';

describe('Authentication Integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database
    await prisma.user.deleteMany();
  });

  it('should register and login user', async () => {
    // Register
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })
      .expect(201);

    expect(registerResponse.body).toHaveProperty('token');

    // Login
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('token');
  });
});
```

### E2E Test Example

```typescript
// src/__tests__/e2e/conversation.e2e.test.ts
import { io, Socket } from 'socket.io-client';
import { waitFor } from '@clone/test-utils';

describe('Conversation E2E', () => {
  let socket: Socket;

  beforeAll((done) => {
    socket = io('http://localhost:3001', {
      auth: { token: 'test-token' },
    });
    socket.on('connect', done);
  });

  afterAll(() => {
    socket.disconnect();
  });

  it('should complete full conversation flow', async () => {
    const responses: any[] = [];

    socket.on('transcript', (data) => responses.push(data));
    socket.on('llm-response', (data) => responses.push(data));
    socket.on('audio-chunk', (data) => responses.push(data));

    // Send audio
    socket.emit('audio-chunk', {
      data: Buffer.from('test-audio'),
      sequence: 1,
    });

    // Wait for responses
    await waitFor(() => responses.length >= 3, 10000);

    expect(responses).toContainEqual(expect.objectContaining({ type: 'transcript' }));
    expect(responses).toContainEqual(expect.objectContaining({ type: 'llm-response' }));
    expect(responses).toContainEqual(expect.objectContaining({ type: 'audio-chunk' }));
  });
});
```

---

## 🎯 Test Utilities

### Using Test Utils Package

```typescript
import {
  createMockUser,
  createMockConversation,
  mockLogger,
  waitFor,
  sleep,
} from '@clone/test-utils';

// Create mock data
const user = createMockUser({ email: 'custom@example.com' });
const conversation = createMockConversation({ userId: user.id });

// Use mock logger
mockLogger.info('Test log');
expect(mockLogger.info).toHaveBeenCalled();

// Wait for async conditions
await waitFor(() => someCondition === true);

// Sleep
await sleep(1000);
```

---

## 📊 Coverage Requirements

### Thresholds

```javascript
{
  global: {
    branches: 70,
    functions: 70,
    lines: 80,
    statements: 80,
  }
}
```

### Check Coverage

```bash
# Run tests with coverage
pnpm test:coverage

# Check coverage thresholds
pnpm coverage:check

# View coverage report
open coverage/lcov-report/index.html
```

---

## 🔧 Configuration

### Jest Configuration

Each workspace has its own `jest.config.js`:

```javascript
const baseConfig = require('../../jest.config.base');

module.exports = {
  ...baseConfig,
  displayName: 'workspace-name',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
```

### Test Setup

Each workspace has `jest.setup.ts`:

```typescript
import '../../jest.setup.base';

// Workspace-specific setup
process.env.WORKSPACE_VAR = 'test-value';

// Mock workspace-specific dependencies
jest.mock('./some-module');
```

---

## 🎭 Mocking

### Mock External Services

```typescript
// Mock HTTP requests
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

mockedAxios.get.mockResolvedValue({ data: 'test' });

// Mock database
jest.mock('@clone/database');
import { prisma } from '@clone/database';
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

mockedPrisma.user.findUnique.mockResolvedValue(mockUser);

// Mock logger
jest.mock('@clone/logger');
import { logger } from '@clone/logger';
const mockedLogger = logger as jest.Mocked<typeof logger>;

mockedLogger.info.mockImplementation(() => {});
```

### Mock Environment Variables

```typescript
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    TEST_VAR: 'test-value',
  };
});

afterAll(() => {
  process.env = originalEnv;
});
```

---

## 🚨 Common Patterns

### Testing Async Code

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

it('should handle promises', () => {
  return expect(promiseFunction()).resolves.toBe('expected');
});

it('should handle rejections', () => {
  return expect(promiseFunction()).rejects.toThrow('error');
});
```

### Testing Errors

```typescript
it('should throw error', () => {
  expect(() => functionThatThrows()).toThrow('Error message');
});

it('should throw specific error', () => {
  expect(() => functionThatThrows()).toThrow(CustomError);
});

it('should handle async errors', async () => {
  await expect(asyncFunctionThatThrows()).rejects.toThrow('Error');
});
```

### Testing Timers

```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('should handle setTimeout', () => {
  const callback = jest.fn();
  setTimeout(callback, 1000);

  jest.advanceTimersByTime(1000);
  expect(callback).toHaveBeenCalled();
});
```

---

## 🔍 Debugging Tests

### Run Single Test

```bash
# Run specific test file
pnpm test user.service.test.ts

# Run specific test case
pnpm test -t "should return user when found"

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

---

## 📚 Best Practices

### DO ✅

- Write tests before or alongside code (TDD)
- Test behavior, not implementation
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Clean up after tests
- Test edge cases and error conditions
- Keep tests fast and isolated

### DON'T ❌

- Test implementation details
- Write flaky tests
- Share state between tests
- Test third-party libraries
- Skip cleanup
- Use real external services
- Write tests that depend on execution order

---

## 🎯 Test Checklist

Before submitting code:

- [ ] All tests passing
- [ ] Coverage ≥ 80%
- [ ] No skipped tests
- [ ] No console.log in tests
- [ ] Mocks cleaned up
- [ ] Tests are fast (< 5s per file)
- [ ] Tests are isolated
- [ ] Edge cases covered
- [ ] Error cases covered

---

## 📖 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

---

**Need help?** Check [Troubleshooting](./TROUBLESHOOTING.md) or ask in the team chat.
