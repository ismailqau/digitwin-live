import 'reflect-metadata';
import { container } from 'tsyringe';

import { AuthService } from '../../application/services/AuthService';
import { ConnectionService } from '../../application/services/ConnectionService';
import { ConversationOrchestrator } from '../../application/services/ConversationOrchestrator';
import { ConversationSessionService } from '../../application/services/ConversationSessionService';
import { MessageRouterService } from '../../application/services/MessageRouterService';
import { MetricsService } from '../../application/services/MetricsService';
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
  container.registerSingleton(ConversationSessionService);
  container.registerSingleton(ConversationOrchestrator);
  container.registerSingleton(MessageRouterService);
  container.registerSingleton(AuthService);
  container.registerSingleton(MetricsService);

  // Register controllers
  container.registerSingleton(WebSocketController);
}

export { container };
