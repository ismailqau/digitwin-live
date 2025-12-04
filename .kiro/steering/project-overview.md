---
inclusion: always
---

# Project Overview

## DigiTwin Live - Real-Time Conversational AI System

This is a monorepo for a real-time conversational AI system that enables natural voice conversations with personalized digital twins, featuring voice cloning, face animation, and knowledge-based responses.

### Technology Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm 8+ with workspaces
- **Build Tool**: Turborepo
- **Database**: PostgreSQL 15+ with pgvector extension
- **ORM**: Prisma
- **Cloud**: Google Cloud Platform (Cloud Run, Cloud SQL)
- **Testing**: Jest
- **Linting**: ESLint + Prettier

### Monorepo Structure

```
digitwinlive/
├── apps/                      # Deployable applications
│   ├── mobile-app/           # React Native mobile app
│   ├── websocket-server/     # WebSocket server for real-time communication
│   └── api-gateway/          # REST API gateway with OpenAPI docs
├── services/                  # Backend microservices
│   ├── asr-service/          # Automatic Speech Recognition
│   ├── rag-service/          # Retrieval-Augmented Generation
│   ├── llm-service/          # LLM service (Gemini, OpenAI, Groq)
│   ├── tts-service/          # Text-to-Speech with voice cloning
│   ├── xtts-service/         # XTTS-v2 Docker service
│   ├── lipsync-service/      # Lip-sync video generation
│   └── face-processing-service/  # Face detection and model creation
├── packages/                  # Shared libraries (@clone/* scope)
│   ├── shared-types/         # TypeScript types and interfaces
│   ├── database/             # Prisma ORM and repository pattern
│   ├── validation/           # Zod validation schemas
│   ├── logger/               # Winston structured logging
│   ├── errors/               # Custom error classes
│   ├── config/               # Environment configuration
│   ├── security/             # Access control and audit logging
│   └── ...                   # Other shared packages
├── infrastructure/            # Terraform and deployment configs
├── docs/                      # Documentation
└── scripts/                   # Automation scripts
```

### Package Naming Convention

All internal packages use the `@clone/` scope:

- `@clone/shared-types`
- `@clone/logger`
- `@clone/database`
- `@clone/validation`

### Workspace Dependencies

Use `workspace:*` protocol for local packages:

```json
{
  "dependencies": {
    "@clone/shared-types": "workspace:*",
    "@clone/logger": "workspace:*"
  }
}
```

### Common Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all code
pnpm format           # Format all code
pnpm type-check       # Type check all packages
pnpm validate         # Run all checks
pnpm dev              # Start development servers
```

### Filter Commands

```bash
pnpm --filter @clone/api-gateway dev      # Run specific package
pnpm --filter @clone/shared-types build   # Build specific package
pnpm --filter @clone/utils test           # Test specific package
```
