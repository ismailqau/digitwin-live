---
inclusion: always
---

# Project Overview

Real-time conversational AI monorepo with voice cloning, face animation, and knowledge-based responses.

## Stack

Node.js 20+ | TypeScript (strict) | pnpm 8+ | Turborepo | PostgreSQL 15+ (pgvector) | Prisma | GCP | Jest

## Structure

```
apps/           # mobile-app, websocket-server, api-gateway
services/       # asr, rag, llm, tts, xtts, lipsync, face-processing
packages/       # @clone/* shared libs (shared-types, database, validation, logger, errors, config, security)
infrastructure/ # Terraform
```

## Commands

```bash
pnpm install | build | test | lint | dev
pnpm --filter @clone/package-name <command>
```

## Dependencies

```json
{ "@clone/package": "workspace:*" }
```
