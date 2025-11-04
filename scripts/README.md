# Scripts Documentation

This directory contains utility scripts for managing the DigitWin Live platform.

## Available Scripts

### Database Scripts

#### Database Migration (`pnpm db:migrate`)
Runs Prisma database migrations to create/update database schema.

```bash
pnpm db:migrate
```

#### Generate Prisma Client (`pnpm db:generate`)
Generates the Prisma client based on the current schema.

```bash
pnpm db:generate
```

#### Database Studio (`pnpm db:studio`)
Opens Prisma Studio for visual database management.

```bash
pnpm db:studio
```

#### Vector Database Setup (`setup-vector-db.sh`)
Sets up pgvector extension and creates vector indexes.

```bash
./scripts/setup-vector-db.sh
```

**Prerequisites:**
- PostgreSQL running
- DATABASE_URL environment variable set
- pgvector extension installed

## Available Scripts

### 1. Generate Secrets (`generate-secrets.js`)

Generates cryptographically secure random secrets for environment variables.

**Usage:**

```bash
node scripts/generate-secrets.js
```

**What it generates:**

- JWT secrets (access and refresh tokens)
- Session management secrets
- CSRF protection secrets
- Webhook verification secrets
- Encryption keys
- Database passwords
- API keys

**Example output:**

```
🔐 Secure Secret Generator

JWT_SECRET:
  Used to sign access tokens (32 bytes, base64)
  xK9mP2vN8qR5tY7wE3aS6dF9gH1jL4nM...

REFRESH_SECRET:
  Used to sign refresh tokens (32 bytes, base64)
  aB3cD5eF7gH9iJ1kL3mN5oP7qR9sT1uV...
```

**Security Notes:**

- All secrets use `crypto.randomBytes()` for cryptographic security
- Secrets are unique on each run
- Store production secrets in a secret manager (GCP Secret Manager, AWS Secrets Manager)
- Never commit generated secrets to version control

### 2. Validate Environment (`validate-env.js`)

Validates that all required environment variables are set and have appropriate values.

**Usage:**

```bash
node scripts/validate-env.js
```

### 3. Verify Directory Structure (`verify-directory-structure.sh`)

Verifies that all required directories exist with proper `.gitkeep` files to preserve directory structure in Git.

**Usage:**

```bash
./scripts/verify-directory-structure.sh
```

**What it checks:**

- Infrastructure directories (Terraform, scripts)
- Application directories (logs, uploads)
- Service directories (logs, cache, tmp)
- .gitignore patterns for preserving .gitkeep files

**Example output:**

```
=========================================
Verifying Directory Structure
=========================================

1. Checking Infrastructure Directories...
✓ Terraform root: infrastructure/terraform
✓ Terraform backends: infrastructure/terraform/backends
...

Verification Summary
Total checks: 24
Passed: 24
Failed: 0

✓ All directory structure checks passed!
```

**Exit codes:**

- `0` - All checks passed
- `1` - One or more checks failed

**When to run:**

- After cloning the repository
- Before deployment
- After adding new services
- As part of CI/CD validation

**What it checks:**

- Required variables are present
- Variable values meet format requirements
- Port numbers are valid
- URLs are properly formatted
- Secrets meet minimum length requirements
- Production-specific security checks

**Example output:**

```
🔍 Validating environment variables...

Environment: development

ℹ️  Information:
  • Found .env file

⚠️  Warnings:
  • Caching is disabled - set ENABLE_CACHING=true to enable PostgreSQL-based caching

✅ Environment validation passed!
```

**Exit codes:**

- `0` - Validation passed
- `1` - Validation failed (missing or invalid variables)

**Integration with CI/CD:**

```yaml
# .github/workflows/deploy.yml
- name: Validate environment
  run: node scripts/validate-env.js
```

## Adding New Scripts

When adding new scripts to this directory:

1. **Make it executable:**

   ```bash
   chmod +x scripts/your-script.js
   ```

2. **Add shebang:**

   ```javascript
   #!/usr/bin/env node
   ```

3. **Document it:**
   - Add description to this README
   - Include usage examples
   - Document any dependencies

4. **Follow conventions:**
   - Use clear, descriptive names
   - Add helpful error messages
   - Include usage instructions in comments
   - Use colors for terminal output

## Common Tasks

### Generate all secrets for a new environment

```bash
# Generate secrets
node scripts/generate-secrets.js > secrets.txt

# Review and copy to .env
cat secrets.txt

# Validate configuration
node scripts/validate-env.js

# Clean up temporary file
rm secrets.txt
```

### Validate before deployment

```bash
# Load production environment
export $(cat .env.production | xargs)

# Validate
node scripts/validate-env.js

# If validation passes, proceed with deployment
```

### Rotate secrets

```bash
# Generate new secrets
node scripts/generate-secrets.js

# Update .env with new values
# Update secret manager with new values
# Deploy with new secrets
# Verify deployment
# Remove old secrets from secret manager
```

## Script Dependencies

All scripts use only Node.js built-in modules:

- `crypto` - For secure random generation
- `fs` - For file system operations
- `path` - For path manipulation

No external dependencies required!

## Troubleshooting

### Script won't run

```bash
# Make sure it's executable
chmod +x scripts/your-script.js

# Run with node explicitly
node scripts/your-script.js
```

### Permission denied

```bash
# Check file permissions
ls -la scripts/

# Fix permissions
chmod +x scripts/*.js
```

### Module not found

```bash
# Make sure you're in the project root
pwd

# Run from project root
node scripts/your-script.js
```

## Best Practices

1. **Always validate** environment before deployment
2. **Generate unique secrets** for each environment
3. **Store secrets securely** in a secret manager
4. **Rotate secrets regularly** (every 90 days)
5. **Never commit secrets** to version control
6. **Use strong secrets** (minimum 32 bytes)
7. **Test scripts locally** before using in CI/CD

## Future Scripts

Planned scripts for future implementation:

- `setup-dev.js` - Automated development environment setup
- `migrate-db.js` - Database migration runner
- `seed-data.js` - Seed test data for development
- `backup-db.js` - Database backup utility
- `health-check.js` - Service health checker
- `deploy.js` - Deployment automation
- `rollback.js` - Rollback to previous version
- `cleanup.js` - Clean up old resources

## Contributing

When contributing new scripts:

1. Follow existing patterns and conventions
2. Add comprehensive documentation
3. Include error handling
4. Add usage examples
5. Test thoroughly
6. Update this README

## Support

For issues with scripts:

1. Check this documentation
2. Review script comments
3. Check logs for error messages
4. Contact DevOps team
