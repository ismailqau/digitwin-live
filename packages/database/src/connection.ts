import { PrismaClient } from '@prisma/client';

/**
 * Database Connection Manager
 * Manages Prisma client instance with connection pooling
 */
export class DatabaseConnection {
  private static instance: PrismaClient | null = null;
  private static isConnected = false;

  /**
   * Get Prisma client instance (singleton)
   */
  static getInstance(): PrismaClient {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        errorFormat: 'pretty',
      });
    }
    return DatabaseConnection.instance;
  }

  /**
   * Connect to database
   */
  static async connect(): Promise<void> {
    if (DatabaseConnection.isConnected) {
      return;
    }

    const prisma = DatabaseConnection.getInstance();
    await prisma.$connect();
    DatabaseConnection.isConnected = true;

    console.log('✅ Database connected successfully');
  }

  /**
   * Disconnect from database
   */
  static async disconnect(): Promise<void> {
    if (!DatabaseConnection.isConnected || !DatabaseConnection.instance) {
      return;
    }

    await DatabaseConnection.instance.$disconnect();
    DatabaseConnection.isConnected = false;
    DatabaseConnection.instance = null;

    console.log('✅ Database disconnected successfully');
  }

  /**
   * Check if database is connected
   */
  static isHealthy(): boolean {
    return DatabaseConnection.isConnected;
  }

  /**
   * Execute a health check query
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get connection pool statistics
   */
  static async getPoolStats(): Promise<{
    activeConnections: number;
    idleConnections: number;
  }> {
    // Note: Prisma doesn't expose pool stats directly
    // This is a placeholder for monitoring
    return {
      activeConnections: 0,
      idleConnections: 0,
    };
  }
}

/**
 * Prisma error with code
 */
interface PrismaErrorWithCode extends Error {
  code?: string;
  meta?: Record<string, unknown>;
}

/**
 * Global error handler for Prisma
 */
export function handlePrismaError(error: PrismaErrorWithCode): Error {
  if (error.code === 'P2002') {
    return new Error('Unique constraint violation');
  }
  if (error.code === 'P2025') {
    return new Error('Record not found');
  }
  if (error.code === 'P2003') {
    return new Error('Foreign key constraint violation');
  }
  if (error.code === 'P2024') {
    return new Error('Connection timeout');
  }

  return error;
}
