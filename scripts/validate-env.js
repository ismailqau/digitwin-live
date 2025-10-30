#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 *
 * This script validates that all required environment variables are set
 * and have appropriate values for the current environment.
 *
 * Usage:
 *   node scripts/validate-env.js
 *   npm run validate-env
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Required environment variables by environment
const requiredVars = {
  all: ['NODE_ENV', 'JWT_SECRET', 'REFRESH_SECRET'],
  development: ['API_GATEWAY_PORT', 'WEBSOCKET_PORT'],
  production: ['API_GATEWAY_PORT', 'WEBSOCKET_PORT', 'DATABASE_URL', 'CORS_ORIGIN', 'SENTRY_DSN'],
  test: ['TEST_DATABASE_URL'],
};

// Validation rules
const validationRules = {
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'staging', 'production', 'test'],
    message: 'NODE_ENV must be one of: development, staging, production, test',
  },
  JWT_SECRET: {
    type: 'string',
    minLength: 32,
    message: 'JWT_SECRET must be at least 32 characters long',
  },
  REFRESH_SECRET: {
    type: 'string',
    minLength: 32,
    message: 'REFRESH_SECRET must be at least 32 characters long',
  },
  API_GATEWAY_PORT: {
    type: 'number',
    min: 1,
    max: 65535,
    message: 'API_GATEWAY_PORT must be a valid port number (1-65535)',
  },
  WEBSOCKET_PORT: {
    type: 'number',
    min: 1,
    max: 65535,
    message: 'WEBSOCKET_PORT must be a valid port number (1-65535)',
  },
  DATABASE_URL: {
    type: 'url',
    protocol: 'postgresql',
    message: 'DATABASE_URL must be a valid PostgreSQL connection string',
  },
  ENABLE_CACHING: {
    type: 'enum',
    values: ['true', 'false'],
    message: 'ENABLE_CACHING must be true or false',
    optional: true,
  },
  CORS_ORIGIN: {
    type: 'string',
    message: 'CORS_ORIGIN must be set (use * for development, specific domains for production)',
  },
};

// Warning checks for production
const productionWarnings = {
  JWT_SECRET: {
    check: (value) => value !== 'dev-jwt-secret-change-in-production',
    message: 'JWT_SECRET appears to be a development secret',
  },
  REFRESH_SECRET: {
    check: (value) => value !== 'dev-refresh-secret-change-in-production',
    message: 'REFRESH_SECRET appears to be a development secret',
  },
  CORS_ORIGIN: {
    check: (value) => value !== '*',
    message: 'CORS_ORIGIN is set to * (allow all origins) - this is insecure for production',
  },
  ENABLE_API_DOCS: {
    check: (value) => value !== 'true',
    message: 'API documentation is enabled - consider disabling in production',
  },
  ENABLE_DEBUG_ENDPOINTS: {
    check: (value) => value !== 'true',
    message: 'Debug endpoints are enabled - should be disabled in production',
  },
};

class EnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  validate() {
    this.log('\n🔍 Validating environment variables...\n', 'cyan');

    // Load .env file if it exists
    this.loadEnvFile();

    // Get current environment
    const env = process.env.NODE_ENV || 'development';
    this.log(`Environment: ${env}`, 'blue');

    // Check required variables
    this.checkRequiredVars(env);

    // Validate variable values
    this.validateValues();

    // Check for production warnings
    if (env === 'production') {
      this.checkProductionWarnings();
    }

    // Check optional features
    this.checkOptionalFeatures();

    // Display results
    this.displayResults();

    // Exit with appropriate code
    return this.errors.length === 0;
  }

  checkOptionalFeatures() {
    // Check caching status
    const cachingEnabled = process.env.ENABLE_CACHING === 'true';
    if (!cachingEnabled) {
      this.info.push(
        'Caching is disabled - set ENABLE_CACHING=true to enable PostgreSQL-based caching for better performance'
      );
    } else {
      this.info.push('PostgreSQL-based caching is enabled');
    }

    // Check if mock services are enabled
    const mockServices = process.env.MOCK_EXTERNAL_SERVICES === 'true';
    if (mockServices) {
      this.info.push('Mock external services enabled - external API calls will be simulated');
    }
  }

  loadEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      this.info.push('Found .env file');
      // Load .env file manually (without external dependencies)
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');

      lines.forEach((line) => {
        // Skip comments and empty lines
        line = line.trim();
        if (!line || line.startsWith('#')) {
          return;
        }

        // Parse KEY=VALUE
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();

          // Remove quotes if present
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }

          // Only set if not already in environment
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    } else {
      this.warnings.push('No .env file found - using system environment variables');
    }
  }

  checkRequiredVars(env) {
    const required = [...requiredVars.all, ...(requiredVars[env] || [])];

    required.forEach((varName) => {
      if (!process.env[varName]) {
        this.errors.push(`Missing required variable: ${varName}`);
      }
    });
  }

  validateValues() {
    Object.entries(validationRules).forEach(([varName, rule]) => {
      const value = process.env[varName];

      // Skip if optional and not set
      if (rule.optional && !value) {
        return;
      }

      // Skip if not set (will be caught by required check)
      if (!value) {
        return;
      }

      // Validate based on type
      switch (rule.type) {
        case 'enum':
          if (!rule.values.includes(value)) {
            this.errors.push(`${varName}: ${rule.message}`);
          }
          break;

        case 'string':
          if (rule.minLength && value.length < rule.minLength) {
            this.errors.push(`${varName}: ${rule.message}`);
          }
          break;

        case 'number':
          const num = parseInt(value, 10);
          if (isNaN(num)) {
            this.errors.push(`${varName}: Must be a number`);
          } else if (rule.min && num < rule.min) {
            this.errors.push(`${varName}: Must be at least ${rule.min}`);
          } else if (rule.max && num > rule.max) {
            this.errors.push(`${varName}: Must be at most ${rule.max}`);
          }
          break;

        case 'url':
          try {
            const url = new URL(value);
            if (rule.protocol && !url.protocol.startsWith(rule.protocol)) {
              this.errors.push(`${varName}: ${rule.message}`);
            }
          } catch (e) {
            this.errors.push(`${varName}: ${rule.message}`);
          }
          break;
      }
    });
  }

  checkProductionWarnings() {
    Object.entries(productionWarnings).forEach(([varName, warning]) => {
      const value = process.env[varName];
      if (value && !warning.check(value)) {
        this.warnings.push(`${varName}: ${warning.message}`);
      }
    });
  }

  displayResults() {
    this.log('\n' + '='.repeat(60), 'cyan');

    // Display info
    if (this.info.length > 0) {
      this.log('\nℹ️  Information:', 'blue');
      this.info.forEach((msg) => this.log(`  • ${msg}`, 'blue'));
    }

    // Display warnings
    if (this.warnings.length > 0) {
      this.log('\n⚠️  Warnings:', 'yellow');
      this.warnings.forEach((msg) => this.log(`  • ${msg}`, 'yellow'));
    }

    // Display errors
    if (this.errors.length > 0) {
      this.log('\n❌ Errors:', 'red');
      this.errors.forEach((msg) => this.log(`  • ${msg}`, 'red'));
    }

    // Summary
    this.log('\n' + '='.repeat(60), 'cyan');
    if (this.errors.length === 0) {
      this.log('\n✅ Environment validation passed!\n', 'green');
    } else {
      this.log(`\n❌ Environment validation failed with ${this.errors.length} error(s)\n`, 'red');
      this.log('Please fix the errors above and try again.\n', 'yellow');
      this.log('Refer to .env.example for required variables.\n', 'yellow');
    }
  }
}

// Run validation
const validator = new EnvValidator();
const success = validator.validate();

// Exit with appropriate code
process.exit(success ? 0 : 1);
