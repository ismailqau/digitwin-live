/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@clone/database';
import { createLogger } from '@clone/logger';
import winston from 'winston';

import { TrainingNotification } from '../types';

export class TrainingNotificationService {
  private prisma: PrismaClient;
  private logger: winston.Logger;

  constructor(prisma: PrismaClient, logger?: winston.Logger) {
    this.prisma = prisma;
    this.logger = logger || createLogger('training-notification-service');
  }

  /**
   * Send training notification
   */
  async sendNotification(notification: TrainingNotification): Promise<void> {
    try {
      // Log the notification
      this.logger.info('Sending training notification', {
        jobId: notification.jobId,
        userId: notification.userId,
        type: notification.type,
        message: notification.message,
      });

      // In a real implementation, this would:
      // 1. Send push notifications via FCM/APNs
      // 2. Send email notifications
      // 3. Send WebSocket notifications to connected clients
      // 4. Store notifications in database for later retrieval

      // For now, we'll simulate these actions
      await this.sendPushNotification(notification);
      await this.sendEmailNotification(notification);
      await this.sendWebSocketNotification(notification);
      await this.storeNotification(notification);

      this.logger.info('Training notification sent successfully', {
        jobId: notification.jobId,
        userId: notification.userId,
        type: notification.type,
      });
    } catch (error) {
      this.logger.error('Failed to send training notification', {
        error,
        notification,
      });
      throw error;
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: TrainingNotification): Promise<void> {
    try {
      // Simulate push notification sending
      // In real implementation, use Firebase Cloud Messaging or similar

      const pushPayload = {
        title: this.getNotificationTitle(notification.type),
        body: notification.message,
        data: {
          jobId: notification.jobId,
          type: notification.type,
          progress: notification.progress?.toString(),
          ...notification.data,
        },
      };

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.logger.debug('Push notification sent', {
        userId: notification.userId,
        payload: pushPayload,
      });
    } catch (error) {
      this.logger.error('Failed to send push notification', { error, notification });
      // Don't throw - notification failure shouldn't fail the job
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: TrainingNotification): Promise<void> {
    try {
      // Only send email for important events
      if (!['started', 'completed', 'failed'].includes(notification.type)) {
        return;
      }

      // Get user email
      const user = await this.prisma.user.findUnique({
        where: { id: notification.userId },
        select: { email: true, name: true },
      });

      if (!user) {
        this.logger.warn('User not found for email notification', {
          userId: notification.userId,
        });
        return;
      }

      const emailData = {
        to: user.email,
        subject: this.getEmailSubject(notification.type),
        template: this.getEmailTemplate(notification.type),
        data: {
          userName: user.name,
          jobId: notification.jobId,
          message: notification.message,
          progress: notification.progress,
          ...notification.data,
        },
      };

      // Simulate email sending
      await new Promise((resolve) => setTimeout(resolve, 200));

      this.logger.debug('Email notification sent', {
        userId: notification.userId,
        email: user.email,
        subject: emailData.subject,
      });
    } catch (error) {
      this.logger.error('Failed to send email notification', { error, notification });
      // Don't throw - notification failure shouldn't fail the job
    }
  }

  /**
   * Send WebSocket notification
   */
  private async sendWebSocketNotification(notification: TrainingNotification): Promise<void> {
    try {
      // In real implementation, this would send to WebSocket server
      // which would then broadcast to connected clients for this user

      const wsPayload = {
        type: 'training_notification',
        jobId: notification.jobId,
        userId: notification.userId,
        notificationType: notification.type,
        message: notification.message,
        progress: notification.progress,
        timestamp: new Date().toISOString(),
        data: notification.data,
      };

      // Simulate WebSocket message sending
      await new Promise((resolve) => setTimeout(resolve, 50));

      this.logger.debug('WebSocket notification sent', {
        userId: notification.userId,
        payload: wsPayload,
      });
    } catch (error) {
      this.logger.error('Failed to send WebSocket notification', { error, notification });
      // Don't throw - notification failure shouldn't fail the job
    }
  }

  /**
   * Store notification in database
   */
  private async storeNotification(notification: TrainingNotification): Promise<void> {
    try {
      // In a real implementation, you might have a notifications table
      // For now, we'll add it to the audit log

      await this.prisma.auditLog.create({
        data: {
          userId: notification.userId,
          action: 'training_notification',
          resource: `training_job:${notification.jobId}`,
          result: 'success',
          metadata: {
            notificationType: notification.type,
            message: notification.message,
            progress: notification.progress,
            data: notification.data,
          } as any,
        },
      });

      this.logger.debug('Notification stored in database', {
        userId: notification.userId,
        jobId: notification.jobId,
        type: notification.type,
      });
    } catch (error) {
      this.logger.error('Failed to store notification', { error, notification });
      // Don't throw - notification failure shouldn't fail the job
    }
  }

  /**
   * Get notification title for push notifications
   */
  private getNotificationTitle(type: string): string {
    switch (type) {
      case 'started':
        return 'Voice Training Started';
      case 'progress':
        return 'Voice Training Progress';
      case 'completed':
        return 'Voice Training Completed';
      case 'failed':
        return 'Voice Training Failed';
      case 'cancelled':
        return 'Voice Training Cancelled';
      default:
        return 'Voice Training Update';
    }
  }

  /**
   * Get email subject
   */
  private getEmailSubject(type: string): string {
    switch (type) {
      case 'started':
        return 'Your voice model training has started';
      case 'completed':
        return 'Your voice model is ready!';
      case 'failed':
        return 'Voice model training failed';
      default:
        return 'Voice model training update';
    }
  }

  /**
   * Get email template name
   */
  private getEmailTemplate(type: string): string {
    switch (type) {
      case 'started':
        return 'training-started';
      case 'completed':
        return 'training-completed';
      case 'failed':
        return 'training-failed';
      default:
        return 'training-update';
    }
  }

  /**
   * Get user's notification preferences
   */
  async getNotificationPreferences(userId: string): Promise<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    webSocketEnabled: boolean;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });

      if (!user) {
        return {
          pushEnabled: true,
          emailEnabled: true,
          webSocketEnabled: true,
        };
      }

      const settings = user.settings as any;
      const notifications = settings?.notifications || {};
      return {
        pushEnabled: notifications.push !== false,
        emailEnabled: notifications.email !== false,
        webSocketEnabled: notifications.webSocket !== false,
      };
    } catch (error) {
      this.logger.error('Failed to get notification preferences', { error, userId });
      // Default to all enabled
      return {
        pushEnabled: true,
        emailEnabled: true,
        webSocketEnabled: true,
      };
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      webSocketEnabled?: boolean;
    }
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentSettings = user.settings as any;
      const updatedSettings = {
        ...currentSettings,
        notifications: {
          ...(currentSettings.notifications || {}),
          push: preferences.pushEnabled,
          email: preferences.emailEnabled,
          webSocket: preferences.webSocketEnabled,
        },
      };

      await this.prisma.user.update({
        where: { id: userId },
        data: { settings: updatedSettings },
      });

      this.logger.info('Notification preferences updated', {
        userId,
        preferences,
      });
    } catch (error) {
      this.logger.error('Failed to update notification preferences', {
        error,
        userId,
        preferences,
      });
      throw error;
    }
  }
}
