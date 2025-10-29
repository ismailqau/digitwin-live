import { Query, QueryHandler, QueryResult } from '../types';

/**
 * Base Query Handler
 * Provides common functionality for query handlers
 */
export abstract class BaseQueryHandler<TQuery extends Query, TResult = any>
  implements QueryHandler<TQuery, TResult>
{
  /**
   * Handle the query
   */
  abstract handle(query: TQuery): Promise<QueryResult<TResult>>;

  /**
   * Create success result
   */
  protected success<T>(data: T): QueryResult<T> {
    return {
      success: true,
      data,
      timestamp: new Date(),
      fromCache: false,
    };
  }

  /**
   * Create error result
   */
  protected error(error: Error): QueryResult {
    return {
      success: false,
      error,
      timestamp: new Date(),
      fromCache: false,
    };
  }
}
