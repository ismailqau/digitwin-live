-- Migration: Setup pgvector extension and vector indexes
-- This migration sets up PostgreSQL with pgvector for vector similarity search

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector indexes for document chunks
-- Note: This will be applied after the Prisma migration creates the tables

-- Function to create vector index (to be run after table creation)
CREATE OR REPLACE FUNCTION create_vector_indexes() RETURNS void AS $$
BEGIN
  -- Check if document_chunks table exists and create vector index
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_chunks') THEN
    -- Create IVFFlat index for fast similarity search
    -- The embedding column should be converted to vector type in application code
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding::vector(768)) WITH (lists = 100)';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Note: Run create_vector_indexes() after Prisma migration completes
-- This can be done in the application startup or manually