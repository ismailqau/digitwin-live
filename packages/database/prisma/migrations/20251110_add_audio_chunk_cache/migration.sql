-- CreateTable
CREATE TABLE "audio_chunk_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "audio_data" BYTEA NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'opus',
    "duration_ms" INTEGER NOT NULL,
    "sample_rate" INTEGER NOT NULL DEFAULT 16000,
    "channels" INTEGER NOT NULL DEFAULT 1,
    "compression" TEXT NOT NULL DEFAULT 'opus',
    "storage_path" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_chunk_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audio_chunk_cache_cache_key_key" ON "audio_chunk_cache"("cache_key");

-- CreateIndex
CREATE INDEX "audio_chunk_cache_cache_key_idx" ON "audio_chunk_cache"("cache_key");

-- CreateIndex
CREATE INDEX "audio_chunk_cache_expires_at_idx" ON "audio_chunk_cache"("expires_at");

-- CreateIndex
CREATE INDEX "audio_chunk_cache_last_accessed_at_idx" ON "audio_chunk_cache"("last_accessed_at");

-- CreateIndex
CREATE INDEX "audio_chunk_cache_storage_path_idx" ON "audio_chunk_cache"("storage_path");
