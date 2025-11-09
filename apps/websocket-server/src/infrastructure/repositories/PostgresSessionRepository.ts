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
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'digitwinline',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          connection_id VARCHAR(255) NOT NULL UNIQUE,
          state VARCHAR(50) NOT NULL,
          conversation_history JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT NOW(),
          last_activity_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '${this.SESSION_TTL_HOURS} hours'
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_connection_id ON sessions(connection_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      `);
    } finally {
      client.release();
    }
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
