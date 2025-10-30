import 'reflect-metadata';
import { container } from 'tsyringe';

import { AuthService } from '../../application/services/AuthService';
import { ConnectionService } from '../../application/services/ConnectionService';
import { MessageRouterService } from '../../application/services/MessageRouterService';
import { SessionService } from '../../application/services/SessionService';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { WebSocketController } from '../../presentation/controllers/WebSocketController';
import { PostgresSessionRepository } from '../repositories/PostgresSessionRepository';

export function setupContainer(): void {
  // Register repositories
  container.register<ISessionRepository>('ISessionRepository', {
    useClass: PostgresSessionRepository,
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
