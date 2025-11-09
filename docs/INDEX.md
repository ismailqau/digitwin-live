# Documentation Index

Complete index of all documentation for the DigitWin Live platform.

## 📁 Documentation Structure

```
docs/
├── GETTING-STARTED.md           # Quick setup guide
├── TOOL-INSTALLATION.md         # Tool installation guide (Node, PostgreSQL, Terraform, etc.)
├── ENVIRONMENT-SETUP.md         # Comprehensive configuration
├── ENV-QUICK-REFERENCE.md       # Environment variables cheat sheet
├── TROUBLESHOOTING.md           # Common issues and solutions
├── GCP-INFRASTRUCTURE.md        # GCP infrastructure documentation
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

- [Tool Installation](./TOOL-INSTALLATION.md) - Install Node.js, PostgreSQL, Terraform, and more
- [Getting Started](./GETTING-STARTED.md) - 5-step quick setup
- [Environment Setup](./ENVIRONMENT-SETUP.md) - Detailed setup guide
- [Quick Reference](./ENV-QUICK-REFERENCE.md) - Variables cheat sheet
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Vector Database](./VECTOR-DATABASE.md) - Complete guide: setup, migration, and verification

### Authentication & Security

- [Authentication Flow](../apps/api-gateway/docs/authentication-flow.md) - JWT & OAuth
- [RBAC Guide](../apps/api-gateway/docs/RBAC-GUIDE.md) - Access control
- [Implementation Summary](../apps/api-gateway/docs/IMPLEMENTATION-SUMMARY.md) - What's implemented

### Infrastructure & Deployment

- [GCP Management](./GCP-MANAGEMENT.md) - Complete GCP resource management guide
- [GCP Quick Reference](./GCP-QUICK-REFERENCE.md) - Command cheat sheet for daily operations
- [GCP Cleanup Guide](./GCP-CLEANUP-GUIDE.md) - Delete and manage GCP resources
- [GCP Infrastructure](./GCP-INFRASTRUCTURE.md) - Infrastructure setup and architecture
- [Infrastructure Setup](../infrastructure/SETUP-GUIDE.md) - Step-by-step Terraform deployment
- [Infrastructure Quick Reference](../infrastructure/QUICK-REFERENCE.md) - Common commands
- [Directory Structure](../infrastructure/DIRECTORY-STRUCTURE.md) - Directory preservation guide

### Architecture & Design

- [Caching Summary](./CACHING-SUMMARY.md) - Why PostgreSQL instead of Redis
- [Caching Architecture](./CACHING-ARCHITECTURE.md) - PostgreSQL caching implementation
- [Database Architecture](./DATABASE-ARCHITECTURE.md) - Database schema and repository pattern
- [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md) - Event bus and event sourcing
- [CQRS Architecture](./CQRS-ARCHITECTURE.md) - Command Query Responsibility Segregation
- [Microservices Communication](./microservices-communication.md) - gRPC and service discovery
- [Design Document](../.kiro/specs/real-time-digitwinlive/design.md) - System design
- [Requirements](../.kiro/specs/real-time-digitwinlive/requirements.md) - Requirements
- [Tasks](../.kiro/specs/real-time-digitwinlive/tasks.md) - Implementation tasks

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

1. [Design Document](../.kiro/specs/real-time-digitwinlive/design.md)
2. [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md)
3. [Caching Architecture](./CACHING-ARCHITECTURE.md)
4. [Requirements](../.kiro/specs/real-time-digitwinlive/requirements.md)

### "I'm having configuration issues"

1. [Quick Reference](./ENV-QUICK-REFERENCE.md)
2. [Environment Setup - Troubleshooting](./ENVIRONMENT-SETUP.md#troubleshooting)
3. Run `node scripts/validate-env.js`

### "I need to clean up GCP resources"

1. [GCP Cleanup Guide](./GCP-CLEANUP-GUIDE.md) - Delete specific resources
2. [GCP Management](./GCP-MANAGEMENT.md) - Full resource management guide
3. [GCP Quick Reference](./GCP-QUICK-REFERENCE.md) - Quick commands

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
