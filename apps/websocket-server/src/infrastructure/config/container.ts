import 'reflect-metadata';
import { container } from 'tsyringe';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { PostgresSessionRepository } from '../repositories/PostgresSessionRepository';
import { SessionService } from '../../application/services/SessionService';
import { ConnectionService } from '../../application/services/ConnectionService';
import { MessageRouterService } from '../../application/services/MessageRouterService';
import { AuthService } from '../../application/services/AuthService';
import { WebSocketController } from '../../presentation/controllers/WebSocketController';

export function setupContainer(): void {
  // Register repositories
  container.register<ISessionRepository>('ISessionRepository', {
    useClass: PostgresSessionRepository
  });

  // Register services
  container.registerSingleton(SessionService);
  container.registerSingleton(ConnectionService);
  container.registerSingleton(MessageRouterService);
  container.registerSingleton(AuthService);

  // Register controllers
  container.registerSingleton(WebSocketController);
}

export { container };
