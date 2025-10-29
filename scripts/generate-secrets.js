#!/usr/bin/env node

/**
 * Secret Generation Script
 * 
 * This script generates secure random secrets for use in environment variables.
 * 
 * Usage:
 *   node scripts/generate-secrets.js
 *   npm run generate-secrets
 */

const crypto = require('crypto');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateSecret(length = 32, encoding = 'base64') {
  return crypto.randomBytes(length).toString(encoding);
}

function generateHexSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateUUID() {
  return crypto.randomUUID();
}

function displaySecret(name, value, description = '') {
  log(`\n${name}:`, 'cyan');
  if (description) {
    log(`  ${description}`, 'yellow');
  }
  log(`  ${value}`, 'green');
}

function main() {
  log('\n' + '='.repeat(70), 'cyan');
  log('🔐 Secure Secret Generator', 'bold');
  log('='.repeat(70) + '\n', 'cyan');

  log('Generating secure secrets for your environment variables...', 'yellow');
  log('Copy these values to your .env file.\n', 'yellow');

  // JWT Secrets
  log('━'.repeat(70), 'cyan');
  log('JWT Authentication Secrets', 'bold');
  log('━'.repeat(70), 'cyan');

  displaySecret(
    'JWT_SECRET',
    generateSecret(32),
    'Used to sign access tokens (32 bytes, base64)'
  );

  displaySecret(
    'REFRESH_SECRET',
    generateSecret(32),
    'Used to sign refresh tokens (32 bytes, base64)'
  );

  // Session Secrets
  log('\n' + '━'.repeat(70), 'cyan');
  log('Session Management Secrets', 'bold');
  log('━'.repeat(70), 'cyan');

  displaySecret(
    'SESSION_SECRET',
    generateHexSecret(32),
    'Used for session management (32 bytes, hex)'
  );

  displaySecret(
    'CSRF_SECRET',
    generateSecret(24),
    'Used for CSRF protection (24 bytes, base64)'
  );

  // Webhook Secrets
  log('\n' + '━'.repeat(70), 'cyan');
  log('Webhook Secrets', 'bold');
  log('━'.repeat(70), 'cyan');

  displaySecret(
    'WEBHOOK_SECRET',
    generateSecret(32),
    'Used to verify webhook signatures (32 bytes, base64)'
  );

  // Encryption Keys
  log('\n' + '━'.repeat(70), 'cyan');
  log('Encryption Keys', 'bold');
  log('━'.repeat(70), 'cyan');

  displaySecret(
    'ENCRYPTION_KEY',
    generateHexSecret(32),
    'Used for data encryption (32 bytes, hex - 256 bits)'
  );

  // API Keys
  log('\n' + '━'.repeat(70), 'cyan');
  log('Internal API Keys', 'bold');
  log('━'.repeat(70), 'cyan');

  displaySecret(
    'INTERNAL_API_KEY',
    generateUUID(),
    'Used for internal service-to-service communication'
  );

  // Database Passwords
  log('\n' + '━'.repeat(70), 'cyan');
  log('Database Passwords', 'bold');
  log('━'.repeat(70), 'cyan');

  displaySecret(
    'DATABASE_PASSWORD',
    generateSecret(24),
    'Strong password for database user (24 bytes, base64)'
  );

  // Note: Redis not used - caching is PostgreSQL-based

  // Additional Secrets
  log('\n' + '━'.repeat(70), 'cyan');
  log('Additional Secrets', 'bold');
  log('━'.repeat(70), 'cyan');

  displaySecret(
    'ADMIN_API_KEY',
    generateUUID(),
    'Admin API key for privileged operations'
  );

  displaySecret(
    'BACKUP_ENCRYPTION_KEY',
    generateHexSecret(32),
    'Used to encrypt backups (32 bytes, hex)'
  );

  // Instructions
  log('\n' + '='.repeat(70), 'cyan');
  log('📝 Instructions', 'bold');
  log('='.repeat(70) + '\n', 'cyan');

  log('1. Copy the secrets above to your .env file', 'yellow');
  log('2. Store production secrets in a secure secret manager', 'yellow');
  log('3. Never commit secrets to version control', 'yellow');
  log('4. Rotate secrets regularly (every 90 days recommended)', 'yellow');
  log('5. Use different secrets for each environment\n', 'yellow');

  // Security Notes
  log('🔒 Security Notes:', 'bold');
  log('  • These secrets are cryptographically secure random values', 'green');
  log('  • Each secret is unique and generated using crypto.randomBytes()', 'green');
  log('  • Store production secrets in GCP Secret Manager or similar', 'green');
  log('  • Never share secrets via email, chat, or insecure channels', 'green');
  log('  • Revoke and regenerate if a secret is compromised\n', 'green');

  // Example .env snippet
  log('📄 Example .env snippet:', 'bold');
  log('━'.repeat(70) + '\n', 'cyan');

  const exampleEnv = `# JWT Authentication
JWT_SECRET=${generateSecret(32)}
REFRESH_SECRET=${generateSecret(32)}

# Session Management
SESSION_SECRET=${generateHexSecret(32)}
CSRF_SECRET=${generateSecret(24)}

# Webhooks
WEBHOOK_SECRET=${generateSecret(32)}

# Database
DATABASE_PASSWORD=${generateSecret(24)}
`;

  log(exampleEnv, 'green');

  log('='.repeat(70) + '\n', 'cyan');
}

// Run the generator
main();
