# Vector Database Migration Checklist

This checklist helps you verify that the Pinecone to PostgreSQL/Weaviate migration is complete and working correctly.

## ✅ Pre-Migration Verification

- [ ] **Backup existing data** (if any Pinecone data exists)
- [ ] **Document current Pinecone configuration** for reference
- [ ] **Ensure PostgreSQL is running** and accessible
- [ ] **Have Docker available** (for Weaviate option)

## ✅ Environment Configuration

- [ ] **Removed Pinecone variables** from all environment files:
  - [ ] `PINECONE_API_KEY` removed
  - [ ] `PINECONE_ENVIRONMENT` removed  
  - [ ] `PINECONE_INDEX_NAME` removed

- [ ] **Added new vector database variables**:
  - [ ] `VECTOR_DIMENSIONS=768`
  - [ ] `VECTOR_INDEX_LISTS=100`
  - [ ] `WEAVIATE_URL=http://localhost:8080`
  - [ ] `WEAVIATE_ENABLED=true/false`

- [ ] **Updated all environment files**:
  - [ ] `.env`
  - [ ] `.env.development`
  - [ ] `.env.production`
  - [ ] `.env.example`

## ✅ Database Setup

- [ ] **Database created**: `digitwinline_dev` exists
- [ ] **Prisma migrations applied**: `pnpm db:migrate` completed successfully
- [ ] **Prisma client generated**: `pnpm db:generate` completed successfully
- [ ] **DocumentChunk table exists** in database schema

## ✅ Vector Database Choice

### Option A: PostgreSQL with pgvector
- [ ] **pgvector extension installed** for your PostgreSQL version
- [ ] **Extension enabled**: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] **Vector indexes created** (run setup script)
- [ ] **Environment configured**: `WEAVIATE_ENABLED=false`

### Option B: Weaviate (Currently Configured)
- [ ] **Docker running** and accessible
- [ ] **Weaviate container started**: `docker run -d --name weaviate...`
- [ ] **Weaviate accessible**: `curl http://localhost:8080/v1/meta`
- [ ] **Environment configured**: `WEAVIATE_ENABLED=true`

## ✅ Dependencies Updated

- [ ] **Pinecone dependency removed**: `@pinecone-database/pinecone` uninstalled
- [ ] **PostgreSQL dependencies added**: `pg` and `@types/pg` installed
- [ ] **Package.json updated** in RAG service
- [ ] **Lock file updated**: `pnpm install` completed

## ✅ Code Configuration

- [ ] **Config package updated**: `packages/config/src/index.ts` has new vector config
- [ ] **Database scripts added**: `pnpm db:*` commands work
- [ ] **Setup scripts executable**: `chmod +x scripts/setup-vector-db.sh`

## ✅ Documentation Updated

- [ ] **README.md updated** with new vector database info
- [ ] **Getting Started guide updated** with vector setup steps
- [ ] **Environment setup guide updated** with pgvector/Weaviate instructions
- [ ] **Quick reference updated** with new environment variables
- [ ] **Migration guide created** and accessible
- [ ] **Setup guide created** with detailed instructions
- [ ] **Troubleshooting updated** with vector database issues

## ✅ Testing & Verification

- [ ] **Environment validation passes**: `node scripts/validate-env.js`
- [ ] **Database connection works**: `pnpm db:studio` opens successfully
- [ ] **Application starts**: `pnpm dev` runs without vector database errors
- [ ] **Vector database accessible**:
  - [ ] PostgreSQL: Can query DocumentChunk table
  - [ ] Weaviate: `curl http://localhost:8080/v1/meta` returns data

## ✅ Production Readiness

- [ ] **Production environment updated** with new variables
- [ ] **Secret management configured** for production vector database
- [ ] **Backup strategy updated** to include vector data
- [ ] **Monitoring configured** for vector database performance
- [ ] **Documentation deployed** and accessible to team

## 🚨 Rollback Plan (If Needed)

If issues arise, you can rollback by:

1. **Restore Pinecone configuration**:
   ```bash
   # Add back to .env
   PINECONE_API_KEY=your-key
   PINECONE_ENVIRONMENT=us-west1-gcp
   PINECONE_INDEX_NAME=your-index
   ```

2. **Restore Pinecone dependency**:
   ```bash
   cd services/rag-service
   pnpm add @pinecone-database/pinecone@^1.1.0
   pnpm remove pg @types/pg
   ```

3. **Revert config changes** in `packages/config/src/index.ts`

## 📊 Migration Status

**Current Status**: ✅ **COMPLETE**

- **Vector Database**: Weaviate (configured and ready)
- **Fallback Option**: PostgreSQL with pgvector (documented)
- **Environment**: Development environment fully configured
- **Documentation**: Complete setup and troubleshooting guides available

## 🎯 Next Steps

1. **Start Weaviate** when ready to test vector operations:
   ```bash
   docker run -d --name weaviate -p 8080:8080 \
     -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
     semitechnologies/weaviate:latest
   ```

2. **Test vector operations** in your application

3. **Consider upgrading to PostgreSQL 15+** for native pgvector support in production

4. **Monitor performance** and optimize as needed

## 📞 Support

If you encounter issues:

1. Check [Vector Database Setup Guide](./VECTOR-DATABASE-SETUP.md)
2. Review [Troubleshooting Guide](./TROUBLESHOOTING.md)  
3. Check [Migration Guide](./VECTOR-DATABASE-MIGRATION.md)
4. Open an issue with detailed error messages and environment info