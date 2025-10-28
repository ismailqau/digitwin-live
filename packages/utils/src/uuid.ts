import { randomBytes } from 'crypto';

export function generateUUID(): string {
  return randomBytes(16).toString('hex');
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

export function generateTurnId(): string {
  return `turn_${Date.now()}_${randomBytes(8).toString('hex')}`;
}
