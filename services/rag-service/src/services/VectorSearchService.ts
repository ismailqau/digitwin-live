import { RAGError } from '@clone/errors';
import { logger } from '@clone/logger';
import { Pool } from 'pg';

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  content: string;
  // Enhanced source metadata for tracking
  documentId?: string;
  documentTitle?: string;
  chunkIndex?: number;
  sourceType?: 'document' | 'faq' | 'conversation';
  contentSnippet?: string;
}

export interface SearchFilter {
  userId: string;
  sourceType?: string;
  dateRange?: { start: Date; end: Date };
  keywords?: string[];
  hybridSearch?: boolean;
}

export interface VectorSearchConfig {
  connectionString: string;
  similarityThreshold: number;
}

export interface VectorDocument {
  id: string;
  documentId: string;
  userId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

/**
 * PostgreSQL pgvector adapter for vector search
 */
export class PostgreSQLVectorSearch {
  private pool: Pool;
  private similarityThreshold: number;

  constructor(config: VectorSearchConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
    });
    this.similarityThreshold = config.similarityThreshold;
  }

  async search(embedding: number[], topK: number, filter: SearchFilter): Promise<SearchResult[]> {
    try {
      logger.info('Performing vector search', {
        topK,
        userId: filter.userId,
        embeddingDimensions: embedding.length,
        hybridSearch: filter.hybridSearch,
        keywords: filter.keywords?.length || 0,
      });

      if (filter.hybridSearch && filter.keywords && filter.keywords.length > 0) {
        return this.performHybridSearch(embedding, topK, filter);
      } else {
        return this.performVectorSearch(embedding, topK, filter);
      }
    } catch (error) {
      logger.error('Vector search failed', { error });
      throw new RAGError('Vector search failed');
    }
  }

  private async performVectorSearch(
    embedding: number[],
    topK: number,
    filter: SearchFilter
  ): Promise<SearchResult[]> {
    try {
      // Convert embedding array to pgvector format
      const embeddingStr = `[${embedding.join(',')}]`;

      // Build query with filters - include document information
      let query = `
        SELECT 
          dc.id,
          dc.content,
          dc.metadata,
          dc.document_id,
          dc.chunk_index,
          kd.title as document_title,
          1 - (dc.embedding <=> $1::vector) as similarity
        FROM document_chunks dc
        LEFT JOIN knowledge_documents kd ON dc.document_id = kd.id
        WHERE dc.user_id = $2
      `;

      const params: unknown[] = [embeddingStr, filter.userId];
      let paramIndex = 3;

      if (filter.sourceType) {
        query += ` AND dc.metadata->>'sourceType' = $${paramIndex}`;
        params.push(filter.sourceType);
        paramIndex++;
      }

      if (filter.dateRange) {
        query += ` AND dc.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filter.dateRange.start, filter.dateRange.end);
        paramIndex += 2;
      }

      query += `
        AND 1 - (dc.embedding <=> $1::vector) > $${paramIndex}
        ORDER BY dc.embedding <=> $1::vector
        LIMIT $${paramIndex + 1}
      `;
      params.push(this.similarityThreshold, topK);

      const result = await this.pool.query(query, params);

      const searchResults: SearchResult[] = result.rows.map((row) => ({
        id: row.id,
        score: row.similarity,
        metadata: row.metadata,
        content: row.content,
        // Enhanced source metadata from query results
        documentId: row.document_id,
        documentTitle: row.document_title || 'Untitled Document',
        chunkIndex: row.chunk_index,
        sourceType: (row.metadata?.sourceType as 'document' | 'faq' | 'conversation') || 'document',
        contentSnippet: row.content.substring(0, 200) + (row.content.length > 200 ? '...' : ''),
      }));

      logger.info('Vector search completed', {
        resultsFound: searchResults.length,
        topScore: searchResults[0]?.score,
      });

      return searchResults;
    } catch (error) {
      logger.error('Vector search failed', { error });
      throw new RAGError('Vector search failed');
    }
  }

  private async performHybridSearch(
    embedding: number[],
    topK: number,
    filter: SearchFilter
  ): Promise<SearchResult[]> {
    try {
      // Convert embedding array to pgvector format
      const embeddingStr = `[${embedding.join(',')}]`;

      // Create keyword search terms for full-text search
      const keywordQuery = filter.keywords!.join(' & ');

      // Hybrid search: combine vector similarity with keyword matching
      let query = `
        SELECT 
          dc.id,
          dc.content,
          dc.metadata,
          dc.document_id,
          dc.chunk_index,
          kd.title as document_title,
          (1 - (dc.embedding <=> $1::vector)) as vector_similarity,
          ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', $3)) as keyword_score,
          (
            (1 - (dc.embedding <=> $1::vector)) * 0.7 + 
            ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', $3)) * 0.3
          ) as hybrid_score
        FROM document_chunks dc
        LEFT JOIN knowledge_documents kd ON dc.document_id = kd.id
        WHERE dc.user_id = $2
          AND (
            1 - (dc.embedding <=> $1::vector) > $4
            OR to_tsvector('english', dc.content) @@ plainto_tsquery('english', $3)
          )
      `;

      const params: unknown[] = [
        embeddingStr,
        filter.userId,
        keywordQuery,
        this.similarityThreshold,
      ];
      let paramIndex = 5;

      if (filter.sourceType) {
        query += ` AND dc.metadata->>'sourceType' = $${paramIndex}`;
        params.push(filter.sourceType);
        paramIndex++;
      }

      if (filter.dateRange) {
        query += ` AND dc.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filter.dateRange.start, filter.dateRange.end);
        paramIndex += 2;
      }

      query += `
        ORDER BY hybrid_score DESC
        LIMIT $${paramIndex}
      `;
      params.push(topK);

      const result = await this.pool.query(query, params);

      const searchResults: SearchResult[] = result.rows.map((row) => ({
        id: row.id,
        score: row.hybrid_score || row.vector_similarity,
        metadata: {
          ...row.metadata,
          vectorSimilarity: row.vector_similarity,
          keywordScore: row.keyword_score,
          hybridScore: row.hybrid_score,
        },
        content: row.content,
        // Enhanced source metadata from query results
        documentId: row.document_id,
        documentTitle: row.document_title || 'Untitled Document',
        chunkIndex: row.chunk_index,
        sourceType: (row.metadata?.sourceType as 'document' | 'faq' | 'conversation') || 'document',
        contentSnippet: row.content.substring(0, 200) + (row.content.length > 200 ? '...' : ''),
      }));

      logger.info('Hybrid search completed', {
        resultsFound: searchResults.length,
        topScore: searchResults[0]?.score,
        keywords: filter.keywords,
      });

      return searchResults;
    } catch (error) {
      logger.error('Vector search failed', { error });
      throw new RAGError('Vector search failed');
    }
  }

  async upsert(vectors: VectorDocument[]): Promise<void> {
    try {
      logger.info('Upserting vectors', { count: vectors.length });

      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        for (const vector of vectors) {
          const embeddingStr = `[${vector.embedding.join(',')}]`;
          await client.query(
            `
            INSERT INTO document_chunks (id, document_id, user_id, chunk_index, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
            ON CONFLICT (document_id, chunk_index) 
            DO UPDATE SET 
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              metadata = EXCLUDED.metadata
            `,
            [
              vector.id,
              vector.documentId,
              vector.userId,
              vector.chunkIndex,
              vector.content,
              embeddingStr,
              JSON.stringify(vector.metadata),
            ]
          );
        }

        await client.query('COMMIT');
        logger.info('Vectors upserted successfully');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Vector upsert failed', { error });
      throw new RAGError('Vector upsert failed');
    }
  }

  async delete(ids: string[]): Promise<void> {
    try {
      logger.info('Deleting vectors', { count: ids.length });

      await this.pool.query('DELETE FROM document_chunks WHERE id = ANY($1)', [ids]);

      logger.info('Vectors deleted successfully');
    } catch (error) {
      logger.error('Vector deletion failed', { error });
      throw new RAGError('Vector deletion failed');
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Weaviate adapter for vector search (alternative to PostgreSQL)
 */
export class WeaviateVectorSearch {
  // private client: any; // Weaviate client type - TODO: Initialize when implementing
  // private similarityThreshold: number;

  constructor(_config: { url: string; apiKey?: string; similarityThreshold: number }) {
    // TODO: Initialize Weaviate client when WEAVIATE_ENABLED=true
    // this.similarityThreshold = config.similarityThreshold;
    logger.info('Weaviate adapter initialized (placeholder)');
  }

  async search(
    _embedding: number[],
    _topK: number,
    _filter: SearchFilter
  ): Promise<SearchResult[]> {
    // TODO: Implement Weaviate search
    throw new RAGError('Weaviate search not yet implemented');
  }

  async upsert(_vectors: VectorDocument[]): Promise<void> {
    // TODO: Implement Weaviate upsert
    throw new RAGError('Weaviate upsert not yet implemented');
  }

  async delete(_ids: string[]): Promise<void> {
    // TODO: Implement Weaviate delete
    throw new RAGError('Weaviate delete not yet implemented');
  }
}

/**
 * Factory for creating vector search service based on configuration
 */
export class VectorSearchService {
  private adapter: PostgreSQLVectorSearch | WeaviateVectorSearch;

  constructor(config: {
    useWeaviate: boolean;
    postgresql?: VectorSearchConfig;
    weaviate?: { url: string; apiKey?: string; similarityThreshold: number };
  }) {
    if (config.useWeaviate && config.weaviate) {
      this.adapter = new WeaviateVectorSearch(config.weaviate);
      logger.info('Using Weaviate for vector search');
    } else if (config.postgresql) {
      this.adapter = new PostgreSQLVectorSearch(config.postgresql);
      logger.info('Using PostgreSQL pgvector for vector search');
    } else {
      throw new RAGError('No valid vector search configuration provided');
    }
  }

  async search(embedding: number[], topK: number, filter: SearchFilter): Promise<SearchResult[]> {
    return this.adapter.search(embedding, topK, filter);
  }

  async upsert(vectors: VectorDocument[]): Promise<void> {
    return this.adapter.upsert(vectors);
  }

  async delete(ids: string[]): Promise<void> {
    return this.adapter.delete(ids);
  }
}
