/*
  Warnings:

  - You are about to alter the column `embedding` on the `document_chunks` table. The data in that column could be lost. The data in that column will be cast from `vector(768)` to `Text`.

*/
-- DropIndex
DROP INDEX "public"."document_chunks_embedding_idx";

-- AlterTable
ALTER TABLE "document_chunks" ADD COLUMN     "embedding_vector" vector(768),
ALTER COLUMN "embedding" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "embedding_cache" ADD COLUMN     "embedding_vector" vector(768);
