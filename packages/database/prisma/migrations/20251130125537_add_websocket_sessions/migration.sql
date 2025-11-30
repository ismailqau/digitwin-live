-- AlterTable
ALTER TABLE "knowledge_documents" ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "voice_models" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "conversation_history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_samples" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "sample_rate" INTEGER NOT NULL,
    "channels" INTEGER NOT NULL DEFAULT 1,
    "quality_score" DOUBLE PRECISION NOT NULL,
    "storage_path" TEXT NOT NULL,
    "processed_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "voice_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "voice_model_id" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_cost" DOUBLE PRECISION NOT NULL,
    "actual_cost" DOUBLE PRECISION,
    "estimated_time_ms" INTEGER NOT NULL,
    "actual_time_ms" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "gpu_node_id" TEXT,
    "job_data" JSONB NOT NULL DEFAULT '{}',
    "logs" JSONB NOT NULL DEFAULT '[]',
    "quality_metrics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_job_voice_samples" (
    "training_job_id" TEXT NOT NULL,
    "voice_sample_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_job_voice_samples_pkey" PRIMARY KEY ("training_job_id","voice_sample_id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_analytics" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "results_count" INTEGER NOT NULL,
    "avg_relevance_score" DOUBLE PRECISION NOT NULL,
    "has_low_confidence" BOOLEAN NOT NULL,

    CONSTRAINT "query_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_connection_id_key" ON "sessions"("connection_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_connection_id_idx" ON "sessions"("connection_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "voice_samples_user_id_status_idx" ON "voice_samples"("user_id", "status");

-- CreateIndex
CREATE INDEX "voice_samples_deleted_at_idx" ON "voice_samples"("deleted_at");

-- CreateIndex
CREATE INDEX "training_jobs_user_id_status_idx" ON "training_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "training_jobs_status_priority_idx" ON "training_jobs"("status", "priority");

-- CreateIndex
CREATE INDEX "training_jobs_created_at_idx" ON "training_jobs"("created_at");

-- CreateIndex
CREATE INDEX "training_jobs_gpu_node_id_idx" ON "training_jobs"("gpu_node_id");

-- CreateIndex
CREATE INDEX "faqs_user_id_priority_idx" ON "faqs"("user_id", "priority");

-- CreateIndex
CREATE INDEX "faqs_deleted_at_idx" ON "faqs"("deleted_at");

-- CreateIndex
CREATE INDEX "query_analytics_user_id_timestamp_idx" ON "query_analytics"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "query_analytics_query_idx" ON "query_analytics"("query");

-- CreateIndex
CREATE INDEX "query_analytics_has_low_confidence_idx" ON "query_analytics"("has_low_confidence");

-- CreateIndex
CREATE INDEX "query_analytics_timestamp_idx" ON "query_analytics"("timestamp");

-- CreateIndex
CREATE INDEX "voice_models_status_idx" ON "voice_models"("status");

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_voice_model_id_fkey" FOREIGN KEY ("voice_model_id") REFERENCES "voice_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_job_voice_samples" ADD CONSTRAINT "training_job_voice_samples_training_job_id_fkey" FOREIGN KEY ("training_job_id") REFERENCES "training_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_job_voice_samples" ADD CONSTRAINT "training_job_voice_samples_voice_sample_id_fkey" FOREIGN KEY ("voice_sample_id") REFERENCES "voice_samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
