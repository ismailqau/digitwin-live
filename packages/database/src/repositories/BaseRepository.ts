/**
 * Base Repository Interface
 * Provides common CRUD operations with soft delete support
 */
export interface BaseRepository<T> {
  /**
   * Find a record by ID
   * @param id - Record ID
   * @param includeDeleted - Include soft-deleted records
   */
  findById(id: string, includeDeleted?: boolean): Promise<T | null>;

  /**
   * Find all records matching criteria
   * @param where - Filter criteria
   * @param includeDeleted - Include soft-deleted records
   */
  findMany(where?: any, includeDeleted?: boolean): Promise<T[]>;

  /**
   * Find one record matching criteria
   * @param where - Filter criteria
   * @param includeDeleted - Include soft-deleted records
   */
  findOne(where: any, includeDeleted?: boolean): Promise<T | null>;

  /**
   * Create a new record
   * @param data - Record data
   */
  create(data: any): Promise<T>;

  /**
   * Update a record by ID
   * @param id - Record ID
   * @param data - Updated data
   */
  update(id: string, data: any): Promise<T>;

  /**
   * Delete a record by ID (soft delete)
   * @param id - Record ID
   */
  delete(id: string): Promise<T>;

  /**
   * Permanently delete a record by ID
   * @param id - Record ID
   */
  hardDelete(id: string): Promise<T>;

  /**
   * Restore a soft-deleted record
   * @param id - Record ID
   */
  restore(id: string): Promise<T>;

  /**
   * Count records matching criteria
   * @param where - Filter criteria
   * @param includeDeleted - Include soft-deleted records
   */
  count(where?: any, includeDeleted?: boolean): Promise<number>;

  /**
   * Check if a record exists
   * @param where - Filter criteria
   * @param includeDeleted - Include soft-deleted records
   */
  exists(where: any, includeDeleted?: boolean): Promise<boolean>;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  orderBy?: any;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
