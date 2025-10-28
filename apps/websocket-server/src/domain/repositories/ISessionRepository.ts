import { Session } from '../models/Session';

export interface ISessionRepository {
  create(userId: string, connectionId: string): Promise<Session>;
  findById(sessionId: string): Promise<Session | null>;
  update(session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
  findByUserId(userId: string): Promise<Session[]>;
  findByConnectionId(connectionId: string): Promise<Session | null>;
}
