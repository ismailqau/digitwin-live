#!/usr/bin/env node

/**
 * Vector Database Verification Script
 *
 * This script verifies that the vector database is properly configured and working
 * in both local and GCP environments. It tests PostgreSQL with pgvector extension.
 */

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');
const { Client } = require('pg');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logHeader(message) {
  log(`\n${colors.bold}${message}${colors.reset}`, 'blue');
}

// Load environment variables
require('dotenv').config();

class VectorDatabaseVerifier {
  constructor() {
    this.results = {
      environment: {},
      postgresql: {},
      pgvector: {},
      gcp: {},
      overall: { passed: 0, failed: 0, warnings: 0 },
    };
  }

  async verify() {
    logHeader('🔍 Vector Database Verification');
    logInfo('Checking PostgreSQL with pgvector configuration and connectivity...\n');

    await this.checkEnvironmentVariables();
    await this.checkPostgreSQLSetup();
    await this.checkPgvectorExtension();
    await this.checkGCPConfiguration();
    await this.runVectorOperationTests();

    this.printSummary();

    // Exit with appropriate code
    process.exit(this.results.overall.failed > 0 ? 1 : 0);
  }

  async checkEnvironmentVariables() {
    logHeader('📋 Environment Variables');

    const requiredVars = ['DATABASE_URL', 'NODE_ENV'];

    const vectorVars = ['VECTOR_DIMENSIONS', 'VECTOR_INDEX_LISTS'];

    // Check required variables
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        logSuccess(`${varName} is set`);
        this.results.environment[varName] = 'present';
        this.results.overall.passed++;
      } else {
        logError(`${varName} is missing`);
        this.results.environment[varName] = 'missing';
        this.results.overall.failed++;
      }
    }

    // Check vector-specific variables
    for (const varName of vectorVars) {
      if (process.env[varName]) {
        logSuccess(`${varName} = ${process.env[varName]}`);
        this.results.environment[varName] = process.env[varName];
        this.results.overall.passed++;
      } else {
        logWarning(`${varName} is not set`);
        this.results.environment[varName] = 'not_set';
        this.results.overall.warnings++;
      }
    }

    // Vector database is always PostgreSQL with pgvector
    logInfo('Vector Database: PostgreSQL with pgvector');
  }

  async checkPostgreSQLSetup() {
    logHeader('🐘 PostgreSQL Configuration');

    if (!process.env.DATABASE_URL) {
      logError('DATABASE_URL not set, skipping PostgreSQL checks');
      this.results.postgresql.status = 'skipped';
      return;
    }

    try {
      // Test basic connection
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      logSuccess('PostgreSQL connection established');
      this.results.postgresql.connection = 'success';
      this.results.overall.passed++;

      // Check PostgreSQL version
      const versionResult = await client.query('SELECT version()');
      const version = versionResult.rows[0].version;
      logInfo(`PostgreSQL version: ${version.split(' ')[1]}`);
      this.results.postgresql.version = version.split(' ')[1];

      // Check if pgvector extension is available
      try {
        const extensionResult = await client.query(
          "SELECT * FROM pg_available_extensions WHERE name = 'vector'"
        );

        if (extensionResult.rows.length > 0) {
          logSuccess('pgvector extension is available');
          this.results.postgresql.pgvector_available = true;
          this.results.overall.passed++;

          // Check if pgvector is installed
          const installedResult = await client.query(
            "SELECT * FROM pg_extension WHERE extname = 'vector'"
          );

          if (installedResult.rows.length > 0) {
            logSuccess('pgvector extension is installed');
            this.results.postgresql.pgvector_installed = true;
            this.results.overall.passed++;
          } else {
            logWarning('pgvector extension is available but not installed');
            logInfo('Run: CREATE EXTENSION IF NOT EXISTS vector;');
            this.results.postgresql.pgvector_installed = false;
            this.results.overall.warnings++;
          }
        } else {
          logWarning('pgvector extension is not available');
          logInfo('Install pgvector for your PostgreSQL version');
          this.results.postgresql.pgvector_available = false;
          this.results.overall.warnings++;
        }
      } catch (error) {
        logWarning(`Could not check pgvector availability: ${error.message}`);
        this.results.postgresql.pgvector_check = 'failed';
        this.results.overall.warnings++;
      }

      // Check if DocumentChunk table exists
      try {
        const tableResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'document_chunks'
          )
        `);

        if (tableResult.rows[0].exists) {
          logSuccess('DocumentChunk table exists');
          this.results.postgresql.document_chunks_table = true;
          this.results.overall.passed++;

          // Check table structure
          const columnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'document_chunks'
            ORDER BY ordinal_position
          `);

          const hasEmbeddingColumn = columnsResult.rows.some(
            (row) => row.column_name === 'embedding'
          );
          if (hasEmbeddingColumn) {
            logSuccess('DocumentChunk table has embedding column');
            this.results.postgresql.embedding_column = true;
            this.results.overall.passed++;
          } else {
            logError('DocumentChunk table missing embedding column');
            this.results.postgresql.embedding_column = false;
            this.results.overall.failed++;
          }
        } else {
          logWarning('DocumentChunk table does not exist');
          logInfo('Run: pnpm db:migrate');
          this.results.postgresql.document_chunks_table = false;
          this.results.overall.warnings++;
        }
      } catch (error) {
        logError(`Could not check DocumentChunk table: ${error.message}`);
        this.results.postgresql.table_check = 'failed';
        this.results.overall.failed++;
      }

      await client.end();
    } catch (error) {
      logError(`PostgreSQL connection failed: ${error.message}`);
      this.results.postgresql.connection = 'failed';
      this.results.postgresql.error = error.message;
      this.results.overall.failed++;
    }
  }

  async checkPgvectorExtension() {
    logHeader('🔌 pgvector Extension');

    if (!process.env.DATABASE_URL) {
      logError('DATABASE_URL not set, skipping pgvector checks');
      this.results.pgvector.status = 'skipped';
      return;
    }

    try {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();

      // Check if pgvector extension is installed
      const extensionResult = await client.query(
        "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
      );

      if (extensionResult.rows.length > 0) {
        const version = extensionResult.rows[0].extversion;
        logSuccess(`pgvector extension is installed (version ${version})`);
        this.results.pgvector.installed = true;
        this.results.pgvector.version = version;
        this.results.overall.passed++;

        // Test vector operations
        try {
          await client.query("SELECT '[1,2,3]'::vector");
          logSuccess('Vector data type is working');
          this.results.pgvector.vector_type = true;
          this.results.overall.passed++;

          // Test cosine similarity operator
          await client.query("SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector");
          logSuccess('Cosine similarity operator is working');
          this.results.pgvector.cosine_similarity = true;
          this.results.overall.passed++;
        } catch (error) {
          logError(`Vector operations failed: ${error.message}`);
          this.results.pgvector.operations = 'failed';
          this.results.overall.failed++;
        }

        // Check for vector indexes
        try {
          const indexResult = await client.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'document_chunks' 
            AND indexdef LIKE '%vector%'
          `);

          if (indexResult.rows.length > 0) {
            logSuccess(`Found ${indexResult.rows.length} vector index(es)`);
            this.results.pgvector.indexes = indexResult.rows.length;
            this.results.overall.passed++;
          } else {
            logWarning('No vector indexes found on document_chunks table');
            logInfo(
              'Create index with: CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops);'
            );
            this.results.pgvector.indexes = 0;
            this.results.overall.warnings++;
          }
        } catch (error) {
          logWarning(`Could not check vector indexes: ${error.message}`);
          this.results.pgvector.index_check = 'failed';
          this.results.overall.warnings++;
        }
      } else {
        logError('pgvector extension is not installed');
        logInfo('Install with: CREATE EXTENSION IF NOT EXISTS vector;');
        this.results.pgvector.installed = false;
        this.results.overall.failed++;
      }

      await client.end();
    } catch (error) {
      logError(`pgvector check failed: ${error.message}`);
      this.results.pgvector.error = error.message;
      this.results.overall.failed++;
    }
  }

  async checkGCPConfiguration() {
    logHeader('☁️  GCP Configuration');

    const gcpProjectId = process.env.GCP_PROJECT_ID;
    const googleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!gcpProjectId) {
      logWarning('GCP_PROJECT_ID not set');
      this.results.gcp.project_id = 'not_set';
      this.results.overall.warnings++;
      return;
    }

    logSuccess(`GCP Project ID: ${gcpProjectId}`);
    this.results.gcp.project_id = gcpProjectId;
    this.results.overall.passed++;

    if (googleCredentials) {
      logSuccess(`Google credentials path: ${googleCredentials}`);
      this.results.gcp.credentials_path = googleCredentials;
      this.results.overall.passed++;

      // Check if credentials file exists
      try {
        const fs = require('fs');
        if (fs.existsSync(googleCredentials)) {
          logSuccess('Google credentials file exists');
          this.results.gcp.credentials_file = 'exists';
          this.results.overall.passed++;
        } else {
          logError('Google credentials file not found');
          this.results.gcp.credentials_file = 'not_found';
          this.results.overall.failed++;
        }
      } catch (error) {
        logError(`Could not check credentials file: ${error.message}`);
        this.results.gcp.credentials_check = 'failed';
        this.results.overall.failed++;
      }
    } else {
      logWarning('GOOGLE_APPLICATION_CREDENTIALS not set');
      this.results.gcp.credentials_path = 'not_set';
      this.results.overall.warnings++;
    }

    // Check if gcloud CLI is available
    try {
      const gcloudVersion = execSync('gcloud version', { encoding: 'utf8', stdio: 'pipe' });
      logSuccess('gcloud CLI is available');
      this.results.gcp.gcloud_cli = 'available';
      this.results.overall.passed++;
    } catch (error) {
      logWarning('gcloud CLI not available');
      this.results.gcp.gcloud_cli = 'not_available';
      this.results.overall.warnings++;
    }

    // Check Cloud SQL connection (if in GCP environment)
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('cloudsql')) {
      logInfo('Detected Cloud SQL connection string');
      this.results.gcp.cloud_sql = 'detected';

      try {
        // Test Cloud SQL proxy connection
        execSync('pgrep cloud_sql_proxy', { stdio: 'pipe' });
        logSuccess('Cloud SQL Proxy is running');
        this.results.gcp.cloud_sql_proxy = 'running';
        this.results.overall.passed++;
      } catch {
        logWarning('Cloud SQL Proxy not detected');
        this.results.gcp.cloud_sql_proxy = 'not_running';
        this.results.overall.warnings++;
      }
    }
  }

  async runVectorOperationTests() {
    logHeader('🧪 Vector Operation Tests');

    // Always use PostgreSQL with pgvector
    await this.testPostgreSQLVectorOperations();
  }

  // Weaviate is no longer used - using PostgreSQL pgvector instead

  async testPostgreSQLVectorOperations() {
    if (!process.env.DATABASE_URL) {
      logWarning('DATABASE_URL not set, skipping PostgreSQL vector tests');
      return;
    }

    try {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();

      // Check if pgvector is installed
      const extensionResult = await client.query(
        "SELECT * FROM pg_extension WHERE extname = 'vector'"
      );

      if (extensionResult.rows.length === 0) {
        logWarning('pgvector extension not installed, skipping vector operation tests');
        await client.end();
        return;
      }

      // Test vector operations
      try {
        // Create a test vector
        const testVector = '[0.1, 0.2, 0.3]';
        const result = await client.query('SELECT $1::vector AS test_vector', [testVector]);

        if (result.rows.length > 0) {
          logSuccess('PostgreSQL vector operations working');
          this.results.postgresql.vector_operations = 'success';
          this.results.overall.passed++;
        }
      } catch (error) {
        logError(`PostgreSQL vector operation failed: ${error.message}`);
        this.results.postgresql.vector_operations = 'failed';
        this.results.overall.failed++;
      }

      await client.end();
    } catch (error) {
      logError(`PostgreSQL vector test failed: ${error.message}`);
      this.results.postgresql.vector_test = 'failed';
      this.results.overall.failed++;
    }
  }

  makeHttpRequest(url, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: headers,
        timeout: 10000,
      };

      const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(data);
      }

      req.end();
    });
  }

  printSummary() {
    logHeader('📊 Verification Summary');

    const { passed, failed, warnings } = this.results.overall;

    logInfo(`✅ Passed: ${passed}`);
    if (warnings > 0) logWarning(`⚠️  Warnings: ${warnings}`);
    if (failed > 0) logError(`❌ Failed: ${failed}`);

    console.log('\n' + '='.repeat(60));

    if (failed === 0) {
      logSuccess('🎉 Vector database verification completed successfully!');
      logInfo('✨ Your PostgreSQL with pgvector is ready to use');
    } else {
      logError('❌ Vector database verification failed');
      logInfo('Please check the errors above and refer to the documentation:');
      logInfo('- docs/VECTOR-DATABASE-SETUP.md');
      logInfo('- docs/TROUBLESHOOTING.md');
    }

    // Save results to file for CI/CD
    const fs = require('fs');
    fs.writeFileSync('vector-db-verification-results.json', JSON.stringify(this.results, null, 2));
    logInfo('📄 Results saved to vector-db-verification-results.json');
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new VectorDatabaseVerifier();
  verifier.verify().catch((error) => {
    logError(`Verification failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = VectorDatabaseVerifier;
