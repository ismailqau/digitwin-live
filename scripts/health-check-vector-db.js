#!/usr/bin/env node

/**
 * Vector Database Health Check Script
 * 
 * This script performs quick health checks on the vector database
 * and can be used for monitoring and alerting in production.
 */

const { Client } = require('pg');
const https = require('https');
const http = require('http');

// Load environment variables
require('dotenv').config();

class VectorDatabaseHealthCheck {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      status: 'unknown',
      checks: {},
      response_time: 0,
      errors: []
    };
    this.startTime = Date.now();
  }

  async check() {
    try {
      const weaviateEnabled = process.env.WEAVIATE_ENABLED === 'true';
      
      if (weaviateEnabled) {
        await this.checkWeaviate();
      } else {
        await this.checkPostgreSQL();
      }
      
      this.results.response_time = Date.now() - this.startTime;
      this.results.status = this.results.errors.length === 0 ? 'healthy' : 'unhealthy';
      
      return this.results;
    } catch (error) {
      this.results.status = 'error';
      this.results.errors.push(error.message);
      this.results.response_time = Date.now() - this.startTime;
      return this.results;
    }
  }

  async checkPostgreSQL() {
    try {
      const client = new Client({ 
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000
      });
      
      await client.connect();
      
      // Basic connectivity check
      const result = await client.query('SELECT 1 as health_check');
      this.results.checks.postgresql_connection = 'ok';
      
      // Check pgvector extension
      const extensionResult = await client.query(
        "SELECT * FROM pg_extension WHERE extname = 'vector'"
      );
      
      if (extensionResult.rows.length > 0) {
        this.results.checks.pgvector_extension = 'installed';
        
        // Test vector operation
        await client.query("SELECT '[1,2,3]'::vector as test_vector");
        this.results.checks.vector_operations = 'ok';
      } else {
        this.results.checks.pgvector_extension = 'not_installed';
        this.results.errors.push('pgvector extension not installed');
      }
      
      // Check DocumentChunk table
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'document_chunks'
        )
      `);
      
      if (tableResult.rows[0].exists) {
        this.results.checks.document_chunks_table = 'exists';
      } else {
        this.results.checks.document_chunks_table = 'missing';
        this.results.errors.push('DocumentChunk table not found');
      }
      
      await client.end();
    } catch (error) {
      this.results.checks.postgresql_connection = 'failed';
      this.results.errors.push(`PostgreSQL: ${error.message}`);
    }
  }

  async checkWeaviate() {
    try {
      const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
      
      // Check Weaviate connectivity
      const response = await this.makeHttpRequest(`${weaviateUrl}/v1/meta`, 'GET', null, {}, 5000);
      
      if (response.statusCode === 200) {
        this.results.checks.weaviate_connection = 'ok';
        
        const data = JSON.parse(response.body);
        this.results.checks.weaviate_version = data.version;
        
        // Check if we can access schema
        const schemaResponse = await this.makeHttpRequest(`${weaviateUrl}/v1/schema`, 'GET', null, {}, 3000);
        
        if (schemaResponse.statusCode === 200) {
          this.results.checks.weaviate_schema_access = 'ok';
        } else {
          this.results.checks.weaviate_schema_access = 'failed';
          this.results.errors.push('Cannot access Weaviate schema');
        }
      } else {
        this.results.checks.weaviate_connection = 'failed';
        this.results.errors.push(`Weaviate returned status ${response.statusCode}`);
      }
    } catch (error) {
      this.results.checks.weaviate_connection = 'failed';
      this.results.errors.push(`Weaviate: ${error.message}`);
    }
  }

  makeHttpRequest(url, method = 'GET', data = null, headers = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: headers,
        timeout: timeout
      };

      const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
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
}

// CLI usage
if (require.main === module) {
  const healthCheck = new VectorDatabaseHealthCheck();
  
  healthCheck.check().then(results => {
    // Output format based on arguments
    const format = process.argv[2] || 'json';
    
    if (format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else if (format === 'prometheus') {
      // Prometheus metrics format
      console.log(`# HELP vector_db_health Vector database health status`);
      console.log(`# TYPE vector_db_health gauge`);
      console.log(`vector_db_health{status="${results.status}"} ${results.status === 'healthy' ? 1 : 0}`);
      console.log(`# HELP vector_db_response_time Vector database response time in milliseconds`);
      console.log(`# TYPE vector_db_response_time gauge`);
      console.log(`vector_db_response_time ${results.response_time}`);
    } else if (format === 'text') {
      // Human readable format
      console.log(`Vector Database Health: ${results.status.toUpperCase()}`);
      console.log(`Response Time: ${results.response_time}ms`);
      console.log(`Timestamp: ${results.timestamp}`);
      
      if (results.errors.length > 0) {
        console.log(`Errors: ${results.errors.join(', ')}`);
      }
      
      console.log('Checks:');
      Object.entries(results.checks).forEach(([check, status]) => {
        console.log(`  ${check}: ${status}`);
      });
    }
    
    // Exit with appropriate code
    process.exit(results.status === 'healthy' ? 0 : 1);
  }).catch(error => {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = VectorDatabaseHealthCheck;