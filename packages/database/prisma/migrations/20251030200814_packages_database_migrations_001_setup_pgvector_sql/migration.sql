-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "personality_traits" TEXT[],
    "speaking_style" TEXT,
    "preferred_llm_provider" TEXT,
    "preferred_tts_provider" TEXT,
    "conversation_minutes_used" INTEGER NOT NULL DEFAULT 0,
    "subscription_tier" TEXT NOT NULL DEFAULT 'free',
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_models" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_path" TEXT NOT NULL,
    "sample_rate" INTEGER NOT NULL DEFAULT 22050,
    "quality_score" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "voice_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_models" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "model_path" TEXT NOT NULL,
    "resolution" JSONB NOT NULL,
    "quality_score" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "face_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "current_turn_id" TEXT,
    "llm_provider" TEXT NOT NULL,
    "tts_provider" TEXT NOT NULL,
    "voice_model_id" TEXT,
    "face_model_id" TEXT,
    "total_turns" INTEGER NOT NULL DEFAULT 0,
    "average_latency_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_turns" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_audio_duration_ms" INTEGER NOT NULL,
    "user_transcript" TEXT NOT NULL,
    "transcript_confidence" DOUBLE PRECISION NOT NULL,
    "retrieved_chunks" TEXT[],
    "llm_response" TEXT NOT NULL,
    "response_audio_duration_ms" INTEGER NOT NULL,
    "asr_latency_ms" INTEGER NOT NULL,
    "rag_latency_ms" INTEGER NOT NULL,
    "llm_latency_ms" INTEGER NOT NULL,
    "tts_latency_ms" INTEGER NOT NULL,
    "total_latency_ms" INTEGER NOT NULL,
    "asr_cost" DOUBLE PRECISION NOT NULL,
    "llm_cost" DOUBLE PRECISION NOT NULL,
    "tts_cost" DOUBLE PRECISION NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "conversation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "text_content" TEXT NOT NULL,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "author" TEXT,
    "source_url" TEXT,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "storage_path" TEXT NOT NULL,
    "vector_ids" TEXT[],
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedding_cache" (
    "id" TEXT NOT NULL,
    "query_hash" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embedding_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vector_search_cache" (
    "id" TEXT NOT NULL,
    "query_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vector_search_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_response_cache" (
    "id" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "llm_response_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "voice_models_user_id_is_active_idx" ON "voice_models"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "voice_models_deleted_at_idx" ON "voice_models"("deleted_at");

-- CreateIndex
CREATE INDEX "face_models_user_id_is_active_idx" ON "face_models"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "face_models_deleted_at_idx" ON "face_models"("deleted_at");

-- CreateIndex
CREATE INDEX "conversation_sessions_user_id_started_at_idx" ON "conversation_sessions"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "conversation_sessions_state_idx" ON "conversation_sessions"("state");

-- CreateIndex
CREATE INDEX "conversation_turns_session_id_timestamp_idx" ON "conversation_turns"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "knowledge_documents_user_id_uploaded_at_idx" ON "knowledge_documents"("user_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");

-- CreateIndex
CREATE INDEX "knowledge_documents_deleted_at_idx" ON "knowledge_documents"("deleted_at");

-- CreateIndex
CREATE INDEX "document_chunks_user_id_idx" ON "document_chunks"("user_id");

-- CreateIndex
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_document_id_chunk_index_key" ON "document_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE UNIQUE INDEX "embedding_cache_query_hash_key" ON "embedding_cache"("query_hash");

-- CreateIndex
CREATE INDEX "embedding_cache_query_hash_idx" ON "embedding_cache"("query_hash");

-- CreateIndex
CREATE INDEX "embedding_cache_expires_at_idx" ON "embedding_cache"("expires_at");

-- CreateIndex
CREATE INDEX "vector_search_cache_query_hash_user_id_idx" ON "vector_search_cache"("query_hash", "user_id");

-- CreateIndex
CREATE INDEX "vector_search_cache_expires_at_idx" ON "vector_search_cache"("expires_at");

-- CreateIndex
CREATE INDEX "llm_response_cache_prompt_hash_idx" ON "llm_response_cache"("prompt_hash");

-- CreateIndex
CREATE INDEX "llm_response_cache_expires_at_idx" ON "llm_response_cache"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limits_user_id_endpoint_window_start_idx" ON "rate_limits"("user_id", "endpoint", "window_start");

-- CreateIndex
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits"("window_start");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_user_id_endpoint_window_start_key" ON "rate_limits"("user_id", "endpoint", "window_start");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_timestamp_idx" ON "audit_logs"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "voice_models" ADD CONSTRAINT "voice_models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_models" ADD CONSTRAINT "face_models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Alter document_chunks embedding column to use pgvector type
ALTER TABLE "document_chunks" ALTER COLUMN "embedding" TYPE vector(768) USING embedding::vector(768);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_idx" ON "document_chunks" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
