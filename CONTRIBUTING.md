# Contributing to DigitWin Live

Thank you for your interest in contributing to DigitWin Live! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **pnpm** 8+ ([Install](https://pnpm.io/installation))
- **Git** ([Download](https://git-scm.com/))
- **PostgreSQL** 15+ (optional, for local development)

### Setup Development Environment

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/digitwinlive.git
   cd digitwinlive
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Setup Environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run Setup Script**

   ```bash
   ./scripts/setup-all.sh
   ```

5. **Verify Setup**
   ```bash
   pnpm verify:setup
   pnpm test
   pnpm build
   ```

**📖 Detailed Setup**: See [docs/SETUP.md](./docs/SETUP.md)

## 🔄 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes
- `chore/` - Maintenance tasks

### 2. Make Changes

- Write clean, maintainable code
- Follow the project's code style
- Add tests for new features
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run tests
pnpm test

# Run linting
pnpm lint

# Run type checking
pnpm type-check

# Run all checks
pnpm validate
```

### 4. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

```bash
git add .
git commit -m "feat(scope): add new feature"
```

**Commit Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements
- `ci:` - CI/CD changes

**Examples:**

```bash
git commit -m "feat(api): add user authentication endpoint"
git commit -m "fix(websocket): resolve connection timeout issue"
git commit -m "docs(readme): update installation instructions"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## 📏 Code Standards

### Code Quality

We enforce code quality through automated tools:

- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **TypeScript** - Type safety
- **Husky** - Git hooks for pre-commit checks

### Pre-commit Hooks

Pre-commit hooks automatically run when you commit:

- ✅ ESLint with auto-fix
- ✅ Prettier formatting
- ✅ Commit message validation

### Pre-push Hooks

Pre-push hooks run before pushing:

- ✅ Type checking
- ✅ All tests
- ✅ Build verification
- ✅ Security audit

### Code Style Guidelines

1. **TypeScript**
   - Use strict mode
   - Avoid `any` types
   - Provide explicit return types for functions
   - Use interfaces for object shapes

2. **Naming Conventions**
   - `camelCase` for variables and functions
   - `PascalCase` for classes and types
   - `UPPER_SNAKE_CASE` for constants
   - Descriptive names (avoid abbreviations)

3. **File Organization**
   - One component/class per file
   - Group related files in directories
   - Use index files for exports

**📖 Complete Guide**: See [docs/CODE-QUALITY-GUIDE.md](./docs/CODE-QUALITY-GUIDE.md)

## 🧪 Testing

### Test Requirements

- All new features must include tests
- Bug fixes should include regression tests
- Maintain minimum 80% code coverage

### Writing Tests

```typescript
// Unit test example
describe('UserService', () => {
  it('should create a new user', async () => {
    const user = await userService.create({ email: 'test@example.com' });
    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @clone/api-gateway test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

**📖 Testing Guide**: See [docs/TESTING-GUIDE.md](./docs/TESTING-GUIDE.md)

## 🔍 Pull Request Process

### Before Submitting

1. ✅ All tests pass
2. ✅ Code is linted and formatted
3. ✅ Type checking passes
4. ✅ Documentation is updated
5. ✅ Commit messages follow conventions
6. ✅ Branch is up to date with main

### PR Guidelines

1. **Title**: Use conventional commit format

   ```
   feat(api): add user authentication
   ```

2. **Description**: Include:
   - What changes were made
   - Why the changes were necessary
   - How to test the changes
   - Related issues (if any)

3. **Size**: Keep PRs focused and reasonably sized

4. **Documentation**: Update relevant documentation

### Review Process

1. Automated checks must pass (CI/CD)
2. At least one approval required
3. Address review feedback
4. Squash and merge when approved

## 📁 Project Structure

```
digitwinlive/
├── apps/                      # Deployable applications
│   ├── mobile-app/           # React Native app
│   ├── api-gateway/          # REST API
│   └── websocket-server/     # WebSocket server
├── services/                  # Backend microservices
│   ├── asr-service/          # Speech recognition
│   ├── rag-service/          # RAG pipeline
│   ├── llm-service/          # LLM integration
│   ├── tts-service/          # Text-to-speech
│   ├── lipsync-service/      # Lip-sync generation
│   └── face-processing-service/  # Face processing
├── packages/                  # Shared libraries
│   ├── shared-types/         # TypeScript types
│   ├── database/             # Database layer
│   ├── logger/               # Logging
│   ├── config/               # Configuration
│   └── ...                   # Other shared packages
├── docs/                      # Documentation
├── scripts/                   # Automation scripts
└── infrastructure/            # Terraform configs
```

### Adding New Packages

1. Create package directory in appropriate location
2. Add `package.json` with `@clone/` scope
3. Add to workspace in root `package.json`
4. Add build configuration
5. Add tests
6. Update documentation

## 🐛 Reporting Bugs

### Before Reporting

1. Check existing issues
2. Verify it's reproducible
3. Test on latest version

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**

1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**

- OS: [e.g., macOS 14.0]
- Node.js: [e.g., 20.10.0]
- pnpm: [e.g., 8.15.0]

**Additional Context**
Any other relevant information
```

## 💡 Feature Requests

We welcome feature requests! Please:

1. Check if it already exists
2. Describe the feature clearly
3. Explain the use case
4. Provide examples if possible

## 📚 Documentation

### Documentation Standards

- Clear and concise
- Include code examples
- Keep up to date
- Use proper markdown formatting

### Documentation Structure

- **Root README.md** - Project overview
- **docs/** - Detailed guides
- **Package READMEs** - Package-specific docs
- **Inline comments** - Code documentation

## 🤝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## 📞 Getting Help

- **Documentation**: [docs/](./docs/)
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

## 🙏 Thank You

Thank you for contributing to DigitWin Live! Your contributions help make this project better for everyone.

---

**Questions?** Check our [documentation](./docs/) or open an issue.
