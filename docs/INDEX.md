# Documentation Index

Complete index of all documentation for the Conversational Clone platform.

## 📁 Documentation Structure

```
docs/
├── GETTING-STARTED.md           # Quick setup guide
├── ENVIRONMENT-SETUP.md         # Comprehensive configuration
├── ENV-QUICK-REFERENCE.md       # Environment variables cheat sheet
├── CACHING-ARCHITECTURE.md      # PostgreSQL caching design
├── DATABASE-ARCHITECTURE.md     # Database schema and repository pattern
└── README.md                    # Documentation hub

apps/api-gateway/docs/
├── authentication-flow.md       # JWT & OAuth guide
├── RBAC-GUIDE.md               # Role-based access control
└── IMPLEMENTATION-SUMMARY.md    # Auth implementation details

packages/database/
├── README.md                    # Database package documentation
└── prisma/schema.prisma         # Database schema

scripts/
└── README.md                    # Utility scripts documentation

Root:
└── README.md                    # Project README
```

## 📚 By Topic

### Setup & Configuration

- [Getting Started](./GETTING-STARTED.md) - 5-step quick setup
- [Environment Setup](./ENVIRONMENT-SETUP.md) - Detailed setup guide
- [Quick Reference](./ENV-QUICK-REFERENCE.md) - Variables cheat sheet

### Authentication & Security

- [Authentication Flow](../apps/api-gateway/docs/authentication-flow.md) - JWT & OAuth
- [RBAC Guide](../apps/api-gateway/docs/RBAC-GUIDE.md) - Access control
- [Implementation Summary](../apps/api-gateway/docs/IMPLEMENTATION-SUMMARY.md) - What's implemented

### Architecture & Design

- [Caching Architecture](./CACHING-ARCHITECTURE.md) - PostgreSQL caching
- [Database Architecture](./DATABASE-ARCHITECTURE.md) - Database schema and repository pattern
- [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md) - Event bus and event sourcing
- [Design Document](../.kiro/specs/real-time-digitwin-live/design.md) - System design
- [Requirements](../.kiro/specs/real-time-digitwin-live/requirements.md) - Requirements
- [Tasks](../.kiro/specs/real-time-digitwin-live/tasks.md) - Implementation tasks

### Development Tools

- [Monorepo Development](./MONOREPO-DEVELOPMENT.md) - Turborepo & pnpm guide
- [Scripts Documentation](../scripts/README.md) - Utility scripts
- [API Documentation](http://localhost:3000/api-docs) - OpenAPI (when running)

## 🔍 By Use Case

### "I want to set up the project"

1. [Getting Started](./GETTING-STARTED.md)
2. [Environment Setup](./ENVIRONMENT-SETUP.md)
3. [Scripts Documentation](../scripts/README.md)

### "I need to configure authentication"

1. [Authentication Flow](../apps/api-gateway/docs/authentication-flow.md)
2. [RBAC Guide](../apps/api-gateway/docs/RBAC-GUIDE.md)
3. [Environment Setup](./ENVIRONMENT-SETUP.md#oauth-configuration)

### "I want to understand the architecture"

1. [Design Document](../.kiro/specs/real-time-digitwin-live/design.md)
2. [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md)
3. [Caching Architecture](./CACHING-ARCHITECTURE.md)
4. [Requirements](../.kiro/specs/real-time-digitwin-live/requirements.md)

### "I'm having configuration issues"

1. [Quick Reference](./ENV-QUICK-REFERENCE.md)
2. [Environment Setup - Troubleshooting](./ENVIRONMENT-SETUP.md#troubleshooting)
3. Run `node scripts/validate-env.js`

## 📊 Documentation Stats

- **Total Documents**: 16
- **Setup Guides**: 2
- **Configuration Docs**: 2
- **Development Docs**: 3
- **Security Docs**: 3
- **Architecture Docs**: 6

## 🔗 External Resources

- [12-Factor App - Config](https://12factor.net/config)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## 📝 Contributing to Documentation

When adding new documentation:

1. Place in appropriate directory (`docs/` or `apps/*/docs/`)
2. Update this index
3. Add links to relevant READMEs
4. Follow existing formatting style
5. Include code examples where helpful

## 🆘 Getting Help

Can't find what you need?

1. Check this index
2. Search documentation with `grep -r "search term" docs/`
3. Review [Getting Started](./GETTING-STARTED.md)
4. Check [Troubleshooting](./ENVIRONMENT-SETUP.md#troubleshooting)
