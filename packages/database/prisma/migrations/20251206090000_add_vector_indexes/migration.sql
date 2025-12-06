-- Add vector similarity search indexes for pgvector columns
-- These indexes enable fast cosine similarity searches on embeddings

-- Index for document_chunks.embedding_vector (RAG document retrieval)
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_vector_idx" 
ON "document_chunks" USING ivfflat (embedding_vector vector_cosine_ops) 
WITH (lists = 100);

-- Index for embedding_cache.embedding_vector (cached embeddings lookup)
CREATE INDEX IF NOT EXISTS "embedding_cache_embedding_vector_idx" 
ON "embedding_cache" USING ivfflat (embedding_vector vector_cosine_ops) 
WITH (lists = 100);
