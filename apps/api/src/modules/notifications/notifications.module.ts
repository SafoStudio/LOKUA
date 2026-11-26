import type { RequestHandler } from 'express';
import type { DataSource } from 'typeorm';
import { startBatchWorker } from '../../common/start-batch-worker.js';
import { NotificationStore } from './infrastructure/notification.store.js';
import type { NotificationEmailSender } from './infrastructure/notification.store.js';
import type { NotificationPublisher } from './notification-publisher.js';
import { createNotificationsRouter } from './presentation/http/notifications.routes.js';

export interface CreateNotificationsModuleDependencies {
  dataSource: DataSource;
  requireAuth: RequestHandler;
  sendEmail: NotificationEmailSender;
}

export function createNotificationsModule({
  dataSource,
  requireAuth,
  sendEmail
}: CreateNotificationsModuleDependencies) {
  const store = new NotificationStore(dataSource, sendEmail);
  const publisher: NotificationPublisher = store;

  return {
    publisher,
    router: createNotificationsRouter(requireAuth, store),
    startDeliveryWorker: () =>
      startBatchWorker(() => store.processDelivery(), 15_000, 'Notification delivery failed')
  };
}

export type NotificationsModule = ReturnType<typeof createNotificationsModule>;
