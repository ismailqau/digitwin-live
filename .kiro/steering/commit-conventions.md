---
inclusion: always
---

# Commit Conventions

## Format

```
<type>(<scope>): <subject>
```

## Types

feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert

## Scopes

auth | api | websocket | rag | llm | tts | asr | db | deps

## Examples

```bash
git commit -m "feat(auth): add JWT refresh"
git commit -m "fix(api): handle null response"
```

## Branches

`feature/` | `fix/` | `docs/` | `refactor/` | `test/` | `chore/`
