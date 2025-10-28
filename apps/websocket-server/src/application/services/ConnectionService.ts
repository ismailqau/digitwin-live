import { injectable } from 'tsyringe';
import { Socket } from 'socket.io';
import { ServerMessage } from '../../domain/models/Message';

@injectable()
export class ConnectionService {
  private connections: Map<string, Socket> = new Map();

  registerConnection(sessionId: string, socket: Socket): void {
    this.connections.set(sessionId, socket);
  }

  unregisterConnection(sessionId: string): void {
    this.connections.delete(sessionId);
  }

  sendToClient(sessionId: string, message: ServerMessage): boolean {
    const socket = this.connections.get(sessionId);
    if (!socket) {
      return false;
    }

    socket.emit('message', message);
    return true;
  }

  getConnection(sessionId: string): Socket | undefined {
    return this.connections.get(sessionId);
  }

  isConnected(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  getActiveConnectionCount(): number {
    return this.connections.size;
  }
}
