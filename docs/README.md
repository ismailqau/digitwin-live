# 📚 DigitWin Live Documentation

Complete documentation for the DigitWin Live platform.

---

## 🎯 Quick Navigation

### New to the Project?
1. **[Getting Started](./GETTING-STARTED.md)** - 5-step quick setup
2. **[Tool Installation](./TOOL-INSTALLATION.md)** - Install prerequisites
3. **[Environment Setup](./ENVIRONMENT-SETUP.md)** - Configure your environment

### Need Help?
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[ENV Quick Reference](./ENV-QUICK-REFERENCE.md)** - Environment variables cheat sheet
- **[Documentation Index](./INDEX.md)** - Complete documentation map

---

## 📖 Documentation by Category

### 🚀 Setup & Configuration

| Document | Description |
|----------|-------------|
| [Getting Started](./GETTING-STARTED.md) | Quick 5-step setup guide |
| [Tool Installation](./TOOL-INSTALLATION.md) | Install Node.js, PostgreSQL, Docker, etc. |
| [Environment Setup](./ENVIRONMENT-SETUP.md) | Complete configuration guide |
| [ENV Quick Reference](./ENV-QUICK-REFERENCE.md) | Environment variables cheat sheet |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and solutions |

### ☁️ GCP & Infrastructure

| Document | Description |
|----------|-------------|
| [GCP Management](./GCP-MANAGEMENT.md) | Complete GCP resource management guide |
| [GCP Quick Reference](./GCP-QUICK-REFERENCE.md) | Command cheat sheet for daily operations |
| [GCP Cleanup Guide](./GCP-CLEANUP-GUIDE.md) | Delete and manage GCP resources |
| [GCP Infrastructure](./GCP-INFRASTRUCTURE.md) | Infrastructure architecture and setup |

### 🗄️ Database & Storage

| Document | Description |
|----------|-------------|
| [Vector Database](./VECTOR-DATABASE.md) | PostgreSQL + pgvector / Weaviate setup |
| [Database Architecture](./DATABASE-ARCHITECTURE.md) | Schema and repository pattern |
| [Caching Architecture](./CACHING-ARCHITECTURE.md) | PostgreSQL-based caching system |
| [Caching Summary](./CACHING-SUMMARY.md) | Why PostgreSQL instead of Redis |

### 🔐 Security & Authentication

| Document | Description |
|----------|-------------|
| [Authentication Flow](../apps/api-gateway/docs/authentication-flow.md) | JWT & OAuth implementation |
| [RBAC Guide](../apps/api-gateway/docs/RBAC-GUIDE.md) | Role-based access control |

### 🏗️ Architecture

| Document | Description |
|----------|-------------|
| [Design Document](../.kiro/specs/real-time-digitwinlive/design.md) | Complete system design |
| [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md) | Event bus and event sourcing |
| [CQRS Architecture](./CQRS-ARCHITECTURE.md) | Command Query Responsibility Segregation |
| [Microservices Communication](./microservices-communication.md) | gRPC and service discovery |

### 🛠️ Development

| Document | Description |
|----------|-------------|
| [Monorepo Development](./MONOREPO-DEVELOPMENT.md) | Turborepo & pnpm guide |
| [Scripts Documentation](../scripts/README.md) | Utility scripts reference |

---

## 🔍 Find What You Need

### "I want to set up the project"
1. [Tool Installation](./TOOL-INSTALLATION.md)
2. [Getting Started](./GETTING-STARTED.md)
3. [Environment Setup](./ENVIRONMENT-SETUP.md)

### "I need to configure GCP"
1. [GCP Management](./GCP-MANAGEMENT.md)
2. [GCP Quick Reference](./GCP-QUICK-REFERENCE.md)
3. [GCP Infrastructure](./GCP-INFRASTRUCTURE.md)

### "I need to clean up GCP resources"
1. [GCP Cleanup Guide](./GCP-CLEANUP-GUIDE.md)
2. [GCP Management](./GCP-MANAGEMENT.md)

### "I want to understand the architecture"
1. [Design Document](../.kiro/specs/real-time-digitwinlive/design.md)
2. [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md)
3. [Database Architecture](./DATABASE-ARCHITECTURE.md)

### "I'm having issues"
1. [Troubleshooting](./TROUBLESHOOTING.md)
2. [ENV Quick Reference](./ENV-QUICK-REFERENCE.md)
3. Run `node scripts/validate-env.js`

---

## 📊 Documentation Stats

- **Total Documents**: 20+
- **Setup Guides**: 3
- **GCP Guides**: 4
- **Architecture Docs**: 6
- **Development Docs**: 3

---

## 🆘 Getting Help

Can't find what you need?

1. Check the [Documentation Index](./INDEX.md)
2. Search documentation: `grep -r "search term" docs/`
3. Review [Troubleshooting](./TROUBLESHOOTING.md)
4. Check [Getting Started](./GETTING-STARTED.md)

---

## 📝 Documentation Standards

All documentation follows these principles:

- **Clear and concise** - Get to the point quickly
- **Practical examples** - Show, don't just tell
- **Up-to-date** - Regularly reviewed and updated
- **Well-organized** - Easy to navigate and find information
- **Comprehensive** - Cover all aspects of the system

---

## 🔗 External Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Google Cloud Documentation](https://cloud.google.com/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Documentation](https://pnpm.io/)

---

**📖 Complete Index**: [Documentation Index](./INDEX.md)
