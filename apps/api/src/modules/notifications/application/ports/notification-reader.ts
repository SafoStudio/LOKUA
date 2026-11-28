import type { NotificationType } from '../../domain/index.js';

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  targetType: string;
  targetId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationReader {
  list(userId: string, limit: number, cursor?: string): Promise<NotificationRecord[]>;
  getPreferences(userId: string): Promise<{ emailEnabled: boolean } | undefined>;
  setPreferences(userId: string, emailEnabled: boolean): Promise<void>;
  markRead(userId: string, id: string): Promise<boolean>;
}
