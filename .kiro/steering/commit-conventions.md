---
inclusion: always
---

# Commit Conventions

## Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Commit Types

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

## Examples

```bash
# Good commits
git commit -m "feat(auth): add JWT token refresh"
git commit -m "fix(api): handle null response in user endpoint"
git commit -m "docs: update GCP setup guide"
git commit -m "refactor(rag): extract embedding service"
git commit -m "test(websocket): add connection timeout tests"
git commit -m "chore(deps): update typescript to 5.9.3"

# Bad commits (will be rejected)
git commit -m "fixed bug"
git commit -m "WIP"
git commit -m "updates"
git commit -m "misc changes"
```

## Scope Guidelines

Use the package or feature name as scope:

- `auth` - Authentication related
- `api` - API gateway
- `websocket` - WebSocket server
- `rag` - RAG service
- `llm` - LLM service
- `tts` - TTS service
- `asr` - ASR service
- `db` - Database related
- `deps` - Dependencies

## Pre-commit Hooks

The following checks run automatically on commit:

- ✅ ESLint (with auto-fix)
- ✅ Prettier (formatting)
- ✅ TypeScript type checking
- ✅ Commit message validation

## Pre-push Hooks

The following checks run before push:

- ✅ Type checking
- ✅ All tests
- ✅ Build verification
- ✅ Security audit

## Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes
- `chore/` - Maintenance tasks

Examples:

```bash
git checkout -b feature/voice-model-training
git checkout -b fix/websocket-timeout
git checkout -b docs/api-documentation
```
