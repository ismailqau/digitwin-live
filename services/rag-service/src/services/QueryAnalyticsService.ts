import { logger } from '@clone/logger';
import { Pool } from 'pg';

import { QueryAnalytics } from './QueryOptimizer';

export interface PopularQuery {
  query: string;
  count: number;
  avgRelevanceScore: number;
  lastQueried: Date;
}

export interface LowConfidenceQuery {
  query: string;
  userId: string;
  timestamp: Date;
  avgRelevanceScore: number;
  resultsCount: number;
}

/**
 * Query Analytics Service - Tracks and analyzes query patterns
 */
export class QueryAnalyticsService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  /**
   * Store query analytics
   */
  async storeAnalytics(analytics: QueryAnalytics): Promise<void> {
    try {
      await this.pool.query(
        `
        INSERT INTO query_analytics (
          query, user_id, timestamp, results_count, avg_relevance_score, has_low_confidence
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          analytics.query,
          analytics.userId,
          analytics.timestamp,
          analytics.resultsCount,
          analytics.avgRelevanceScore,
          analytics.hasLowConfidence,
        ]
      );

      logger.info('Query analytics stored', { query: analytics.query });
    } catch (error) {
      logger.error('Failed to store query analytics', { error });
      // Don't throw - analytics failure shouldn't break the query flow
    }
  }

  /**
   * Get popular queries (most frequently asked)
   */
  async getPopularQueries(limit: number = 10, userId?: string): Promise<PopularQuery[]> {
    try {
      const query = userId
        ? `
          SELECT 
            query,
            COUNT(*) as count,
            AVG(avg_relevance_score) as avg_relevance_score,
            MAX(timestamp) as last_queried
          FROM query_analytics
          WHERE user_id = $1
          GROUP BY query
          ORDER BY count DESC, last_queried DESC
          LIMIT $2
        `
        : `
          SELECT 
            query,
            COUNT(*) as count,
            AVG(avg_relevance_score) as avg_relevance_score,
            MAX(timestamp) as last_queried
          FROM query_analytics
          GROUP BY query
          ORDER BY count DESC, last_queried DESC
          LIMIT $1
        `;

      const params = userId ? [userId, limit] : [limit];
      const result = await this.pool.query(query, params);

      return result.rows.map((row) => ({
        query: row.query,
        count: parseInt(row.count),
        avgRelevanceScore: parseFloat(row.avg_relevance_score),
        lastQueried: new Date(row.last_queried),
      }));
    } catch (error) {
      logger.error('Failed to get popular queries', { error });
      return [];
    }
  }

  /**
   * Get low confidence queries (queries with poor results)
   */
  async getLowConfidenceQueries(
    limit: number = 10,
    userId?: string
  ): Promise<LowConfidenceQuery[]> {
    try {
      const query = userId
        ? `
          SELECT query, user_id, timestamp, avg_relevance_score, results_count
          FROM query_analytics
          WHERE user_id = $1 AND has_low_confidence = true
          ORDER BY timestamp DESC
          LIMIT $2
        `
        : `
          SELECT query, user_id, timestamp, avg_relevance_score, results_count
          FROM query_analytics
          WHERE has_low_confidence = true
          ORDER BY timestamp DESC
          LIMIT $1
        `;

      const params = userId ? [userId, limit] : [limit];
      const result = await this.pool.query(query, params);

      return result.rows.map((row) => ({
        query: row.query,
        userId: row.user_id,
        timestamp: new Date(row.timestamp),
        avgRelevanceScore: parseFloat(row.avg_relevance_score),
        resultsCount: row.results_count,
      }));
    } catch (error) {
      logger.error('Failed to get low confidence queries', { error });
      return [];
    }
  }

  /**
   * Get query statistics for a user
   */
  async getUserQueryStats(userId: string): Promise<{
    totalQueries: number;
    uniqueQueries: number;
    avgRelevanceScore: number;
    lowConfidenceRate: number;
  }> {
    try {
      const result = await this.pool.query(
        `
        SELECT 
          COUNT(*) as total_queries,
          COUNT(DISTINCT query) as unique_queries,
          AVG(avg_relevance_score) as avg_relevance_score,
          SUM(CASE WHEN has_low_confidence THEN 1 ELSE 0 END)::float / COUNT(*) as low_confidence_rate
        FROM query_analytics
        WHERE user_id = $1
        `,
        [userId]
      );

      const row = result.rows[0];
      return {
        totalQueries: parseInt(row.total_queries) || 0,
        uniqueQueries: parseInt(row.unique_queries) || 0,
        avgRelevanceScore: parseFloat(row.avg_relevance_score) || 0,
        lowConfidenceRate: parseFloat(row.low_confidence_rate) || 0,
      };
    } catch (error) {
      logger.error('Failed to get user query stats', { error });
      return {
        totalQueries: 0,
        uniqueQueries: 0,
        avgRelevanceScore: 0,
        lowConfidenceRate: 0,
      };
    }
  }

  /**
   * Clean up old analytics data (older than 90 days)
   */
  async cleanupOldAnalytics(daysToKeep: number = 90): Promise<number> {
    try {
      const result = await this.pool.query(
        `
        DELETE FROM query_analytics
        WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
        RETURNING id
        `
      );

      const deletedCount = result.rowCount || 0;
      logger.info('Old analytics cleaned up', { deletedCount, daysToKeep });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old analytics', { error });
      return 0;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
