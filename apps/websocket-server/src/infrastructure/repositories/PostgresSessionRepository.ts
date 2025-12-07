import { ConversationState } from '@clone/shared-types';
import { Pool } from 'pg';
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import { Session, SessionEntity } from '../../domain/models/Session';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';

@injectable()
export class PostgresSessionRepository implements ISessionRepository {
  private pool: Pool;
  private readonly SESSION_TTL_HOURS = 2;

  constructor() {
    // Support Cloud SQL socket path or direct connection
    const cloudSqlConnection = process.env.CLOUD_SQL_CONNECTION_NAME;
    const socketPath = cloudSqlConnection ? `/cloudsql/${cloudSqlConnection}` : undefined;

    this.pool = new Pool({
      // Use DATABASE_* vars (Cloud Run) or POSTGRES_* vars (local) or defaults
      host: socketPath
        ? undefined
        : process.env.DATABASE_HOST || process.env.POSTGRES_HOST || 'localhost',
      port: socketPath
        ? undefined
        : parseInt(process.env.DATABASE_PORT || process.env.POSTGRES_PORT || '5432'),
      database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'digitwinlive',
      user: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
      // Cloud SQL uses Unix socket
      ...(socketPath && { host: socketPath }),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    console.log('[PostgresSessionRepository] Pool configured:', {
      host: socketPath || process.env.DATABASE_HOST || 'localhost',
      database: process.env.DATABASE_NAME || 'digitwinlive',
      user: process.env.DATABASE_USER || 'postgres',
      hasCloudSql: !!cloudSqlConnection,
    });
  }

  async create(userId: string, connectionId: string): Promise<Session> {
    const session = new SessionEntity(uuidv4(), userId, connectionId, ConversationState.IDLE);

    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO sessions (id, user_id, connection_id, state, conversation_history, created_at, last_activity_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '${this.SESSION_TTL_HOURS} hours')`,
        [
          session.id,
          session.userId,
          session.connectionId,
          session.state,
          JSON.stringify(session.conversationHistory),
          session.createdAt,
          session.lastActivityAt,
        ]
      );
    } finally {
      client.release();
    }

    return session;
  }

  async findById(sessionId: string): Promise<Session | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
        [sessionId]
      );

      if (result.rows.length === 0) return null;

      return this.mapRowToSession(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async update(session: Session): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE sessions 
         SET state = $1, conversation_history = $2, last_activity_at = $3, 
             expires_at = NOW() + INTERVAL '${this.SESSION_TTL_HOURS} hours'
         WHERE id = $4`,
        [
          session.state,
          JSON.stringify(session.conversationHistory),
          session.lastActivityAt,
          session.id,
        ]
      );
    } finally {
      client.release();
    }
  }

  async delete(sessionId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    } finally {
      client.release();
    }
  }

  async findByUserId(userId: string): Promise<Session[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
        [userId]
      );

      return result.rows.map((row) => this.mapRowToSession(row));
    } finally {
      client.release();
    }
  }

  async findByConnectionId(connectionId: string): Promise<Session | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM sessions WHERE connection_id = $1 AND expires_at > NOW()',
        [connectionId]
      );

      if (result.rows.length === 0) return null;

      return this.mapRowToSession(result.rows[0]);
    } finally {
      client.release();
    }
  }

  private mapRowToSession(row: Record<string, unknown>): Session {
    return new SessionEntity(
      row.id as string,
      row.user_id as string,
      row.connection_id as string,
      row.state as ConversationState,
      JSON.parse((row.conversation_history as string) || '[]'),
      new Date(row.created_at as string | number | Date),
      new Date(row.last_activity_at as string | number | Date)
    );
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  // Cleanup expired sessions periodically
  async cleanupExpiredSessions(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('DELETE FROM sessions WHERE expires_at <= NOW()');
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }
}
