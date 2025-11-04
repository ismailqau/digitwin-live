# Vector Database Setup Guide

This guide helps you set up the vector database for the DigitWin Live project. You have two options:

## Option 1: PostgreSQL with pgvector (Recommended for Production)

### Requirements
- PostgreSQL 15+ with pgvector extension

### Setup Steps

1. **Install PostgreSQL 15+**:
   ```bash
   # macOS with Homebrew
   brew install postgresql@15
   brew services start postgresql@15
   
   # Ubuntu/Debian
   sudo apt install postgresql-15 postgresql-15-dev
   
   # CentOS/RHEL
   sudo yum install postgresql15-server postgresql15-devel
   ```

2. **Install pgvector**:
   ```bash
   # macOS with Homebrew
   brew install pgvector
   
   # Ubuntu/Debian
   sudo apt install postgresql-15-pgvector
   
   # From source (if package not available)
   git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git
   cd pgvector
   make
   sudo make install
   ```

3. **Create database and enable extension**:
   ```sql
   CREATE DATABASE digitwinline_dev;
   \c digitwinline_dev
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. **Update environment variables**:
   ```bash
   DATABASE_URL=postgresql://username:password@localhost:5432/digitwinline_dev
   VECTOR_DIMENSIONS=768
   VECTOR_INDEX_LISTS=100
   WEAVIATE_ENABLED=false
   ```

5. **Run migrations**:
   ```bash
   pnpm db:migrate
   pnpm db:generate
   ```

## Option 2: Weaviate (Free Self-hosted Alternative)

### Requirements
- Docker

### Setup Steps

1. **Start Weaviate with Docker**:
   ```bash
   docker run -d \
     --name weaviate \
     -p 8080:8080 \
     -e QUERY_DEFAULTS_LIMIT=25 \
     -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
     -e PERSISTENCE_DATA_PATH='/var/lib/weaviate' \
     -v weaviate_data:/var/lib/weaviate \
     semitechnologies/weaviate:latest
   ```

2. **Update environment variables**:
   ```bash
   WEAVIATE_URL=http://localhost:8080
   WEAVIATE_API_KEY=  # Leave empty for anonymous access
   WEAVIATE_ENABLED=true
   ```

3. **Verify Weaviate is running**:
   ```bash
   curl http://localhost:8080/v1/meta
   ```

4. **Run database migrations** (for other tables):
   ```bash
   pnpm db:migrate
   pnpm db:generate
   ```

## Option 3: PostgreSQL Arrays (Fallback)

If neither pgvector nor Weaviate work, you can use PostgreSQL arrays as a simple fallback:

1. **Update environment variables**:
   ```bash
   WEAVIATE_ENABLED=false
   VECTOR_FALLBACK_MODE=true
   ```

2. **Run migrations**:
   ```bash
   pnpm db:migrate
   pnpm db:generate
   ```

Note: This option will be slower for large datasets but works with any PostgreSQL installation.

## Performance Comparison

| Option | Setup Complexity | Query Speed | Scalability | Cost |
|--------|------------------|-------------|-------------|------|
| PostgreSQL + pgvector | Medium | Very Fast (2-10ms) | Excellent | Low |
| Weaviate | Low | Fast (5-20ms) | Very Good | Free |
| PostgreSQL Arrays | Very Low | Slow (50-200ms) | Limited | Low |

## Troubleshooting

### PostgreSQL + pgvector Issues

1. **Extension not found**: Ensure pgvector is installed for your PostgreSQL version
2. **Permission denied**: Check PostgreSQL user permissions
3. **Symbol not found**: Version mismatch between pgvector and PostgreSQL

### Weaviate Issues

1. **Connection refused**: Ensure Docker is running and port 8080 is available
2. **Container exits**: Check Docker logs with `docker logs weaviate`

### General Issues

1. **Migration fails**: Ensure DATABASE_URL is correct and database exists
2. **Slow queries**: Check if proper indexes are created
3. **Memory issues**: Increase PostgreSQL `work_mem` setting

## Next Steps

After setting up your vector database:

1. **Test the setup**:
   ```bash
   # Test database connection
   pnpm db:studio
   
   # Test vector operations (if using Weaviate)
   curl http://localhost:8080/v1/meta
   ```

2. **Configure your application**:
   - Update `.env` with correct settings
   - Restart your development server
   - Test vector search functionality

3. **Monitor performance**:
   - Check query execution times
   - Monitor memory usage
   - Set up proper indexes for production

## Production Recommendations

- **Use PostgreSQL + pgvector** for production deployments
- **Set up proper backups** for your vector data
- **Monitor query performance** and optimize indexes
- **Use connection pooling** for better performance
- **Consider read replicas** for high-traffic applications