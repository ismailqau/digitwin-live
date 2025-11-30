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

---

## 📖 Documentation by Category

### 🚀 Setup & Configuration

| Document                                        | Description                               |
| ----------------------------------------------- | ----------------------------------------- |
| [Setup Guide](./SETUP.md)                       | Complete setup guide                      |
| [Getting Started](./GETTING-STARTED.md)         | Quick 5-step setup guide                  |
| [Tool Installation](./TOOL-INSTALLATION.md)     | Install Node.js, PostgreSQL, Docker, etc. |
| [Environment Setup](./ENVIRONMENT-SETUP.md)     | Complete configuration guide              |
| [ENV Quick Reference](./ENV-QUICK-REFERENCE.md) | Environment variables cheat sheet         |
| [Troubleshooting](./TROUBLESHOOTING.md)         | Common issues and solutions               |

### ☁️ GCP & Infrastructure

| Document                                        | Description                              |
| ----------------------------------------------- | ---------------------------------------- |
| [GCP Management](./GCP-MANAGEMENT.md)           | Complete GCP resource management guide   |
| [GCP Quick Reference](./GCP-QUICK-REFERENCE.md) | Command cheat sheet for daily operations |
| [GCP Cleanup Guide](./GCP-CLEANUP-GUIDE.md)     | Delete and manage GCP resources          |
| [GCP Infrastructure](./GCP-INFRASTRUCTURE.md)   | Infrastructure architecture and setup    |

### 🗄️ Database & Storage

| Document                                            | Description                            |
| --------------------------------------------------- | -------------------------------------- |
| [Vector Database](./VECTOR-DATABASE.md)             | PostgreSQL + pgvector / Weaviate setup |
| [Database Architecture](./DATABASE-ARCHITECTURE.md) | Schema and repository pattern          |
| [Caching Architecture](./CACHING-ARCHITECTURE.md)   | PostgreSQL-based caching system        |
| [Caching Summary](./CACHING-SUMMARY.md)             | Why PostgreSQL instead of Redis        |

### 🔐 Security & Authentication

| Document                                                               | Description                |
| ---------------------------------------------------------------------- | -------------------------- |
| [Authentication Flow](../apps/api-gateway/docs/authentication-flow.md) | JWT & OAuth implementation |
| [RBAC Guide](../apps/api-gateway/docs/RBAC-GUIDE.md)                   | Role-based access control  |

### 🏗️ Architecture

| Document                                                                   | Description                              |
| -------------------------------------------------------------------------- | ---------------------------------------- |
| [Design Document](../.kiro/specs/real-time-conversational-clone/design.md) | Complete system design                   |
| [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md)                | Event bus and event sourcing             |
| [CQRS Architecture](./CQRS-ARCHITECTURE.md)                                | Command Query Responsibility Segregation |
| [Microservices Communication](./microservices-communication.md)            | gRPC and service discovery               |

### 🛠️ Development & Quality

| Document                                          | Description                        |
| ------------------------------------------------- | ---------------------------------- |
| [Code Quality Guide](./CODE-QUALITY-GUIDE.md)     | Linting, formatting, and standards |
| [Testing Guide](./TESTING-GUIDE.md)               | Comprehensive testing guide        |
| [Quality Gates Setup](./QUALITY-GATES-SETUP.md)   | Pre-commit hooks and CI/CD         |
| [Monorepo Development](./MONOREPO-DEVELOPMENT.md) | Turborepo & pnpm guide             |
| [Scripts Documentation](../scripts/README.md)     | Utility scripts reference          |

### 🎤 Audio & Speech Processing

| Document                                              | Description                                   |
| ----------------------------------------------------- | --------------------------------------------- |
| [Audio Processing](./AUDIO-PROCESSING.md)             | Audio capture, streaming, and ASR integration |
| [Audio Preprocessing](./AUDIO-PREPROCESSING.md)       | Audio enhancement and quality optimization    |
| [Audio Caching & Storage](./AUDIO-CACHING-STORAGE.md) | Audio chunk caching and GCS archival          |
| [ASR Service](./ASR-SERVICE.md)                       | Google Chirp speech-to-text integration       |

### 🎙️ Text-to-Speech & Voice

| Document                                                    | Description                                        |
| ----------------------------------------------------------- | -------------------------------------------------- |
| [XTTS Service](./XTTS-SERVICE.md)                           | Self-hosted XTTS-v2 Docker service setup           |
| [Multi-Provider TTS](./TTS-MULTI-PROVIDER.md)               | TTS with XTTS-v2, OpenAI, Google Cloud, ElevenLabs |
| [TTS Optimization & Caching](./TTS-OPTIMIZATION-CACHING.md) | Performance optimization and caching               |
| [Voice Sample Recording](./VOICE-SAMPLE-RECORDING.md)       | Voice sample recording and validation              |
| [Voice Model Training](./VOICE-MODEL-TRAINING.md)           | Voice model training pipeline                      |
| [Voice Model Management](./VOICE-MODEL-MANAGEMENT.md)       | CRUD operations and lifecycle management           |

### 👤 Face Processing & Cloning

| Document                                | Description                                        |
| --------------------------------------- | -------------------------------------------------- |
| [Face Processing](./FACE-PROCESSING.md) | Face detection, embedding, and identity management |

---

## 🔍 Find What You Need

### "I want to set up the project"

1. [Setup Guide](./SETUP.md) - Complete automated setup
2. [Getting Started](./GETTING-STARTED.md) - Quick 5-step guide
3. [Tool Installation](./TOOL-INSTALLATION.md) - Install prerequisites
4. [Environment Setup](./ENVIRONMENT-SETUP.md) - Configuration details

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

## 🔍 By Use Case

### "I want to set up the project"

1. [Setup Guide](./SETUP.md) - Complete automated setup
2. [Getting Started](./GETTING-STARTED.md) - Quick 5-step guide
3. [Tool Installation](./TOOL-INSTALLATION.md) - Install prerequisites
4. [Environment Setup](./ENVIRONMENT-SETUP.md) - Configuration details

### "I need to configure GCP"

1. [GCP Management](./GCP-MANAGEMENT.md) - Complete resource management
2. [GCP Quick Reference](./GCP-QUICK-REFERENCE.md) - Command cheat sheet
3. [GCP Infrastructure](./GCP-INFRASTRUCTURE.md) - Architecture details

### "I need to clean up GCP resources"

1. [GCP Cleanup Guide](./GCP-CLEANUP-GUIDE.md) - Delete specific resources
2. [GCP Management](./GCP-MANAGEMENT.md) - Full management guide

### "I want to understand the architecture"

1. [Design Document](../.kiro/specs/real-time-conversational-clone/design.md) - System design
2. [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md) - Event bus
3. [Database Architecture](./DATABASE-ARCHITECTURE.md) - Schema and patterns
4. [Caching Architecture](./CACHING-ARCHITECTURE.md) - PostgreSQL caching

### "I want to set up voice synthesis"

1. [XTTS Service](./XTTS-SERVICE.md) - Self-hosted XTTS-v2 setup
2. [Multi-Provider TTS](./TTS-MULTI-PROVIDER.md) - TTS provider integration
3. [Voice Model Training](./VOICE-MODEL-TRAINING.md) - Train custom voices
4. [Voice Sample Recording](./VOICE-SAMPLE-RECORDING.md) - Record voice samples

### "I want to set up face processing"

1. [Face Processing](./FACE-PROCESSING.md) - Face detection and embedding
2. [Database Architecture](./DATABASE-ARCHITECTURE.md) - Face model storage
3. [GCP Infrastructure](./GCP-INFRASTRUCTURE.md) - GPU worker setup

### "I'm having issues"

1. [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
2. [ENV Quick Reference](./ENV-QUICK-REFERENCE.md) - Environment variables
3. Run `node scripts/validate-env.js` - Validate configuration

---

## 📊 Documentation Stats

- **Total Documents**: 20+
- **Setup Guides**: 4
- **GCP Guides**: 4
- **Architecture Docs**: 6
- **Development & Quality Docs**: 5
- **Security Docs**: 3

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

## 🆘 Getting Help

Can't find what you need?

1. Search documentation: `grep -r "search term" docs/`
2. Review [Troubleshooting](./TROUBLESHOOTING.md)
3. Check [Getting Started](./GETTING-STARTED.md)
4. Review use cases above
