import type { NotificationType } from './domain/index.js';

export const notificationCopy: Record<
  NotificationType,
  { title: string; message: string; email: boolean }
> = {
  NEW_APPLICATION: {
    title: 'Нова заявка',
    message: 'На вашу подію надійшла нова заявка.',
    email: false
  },
  FREE_PARTICIPATION: {
    title: 'Новий учасник',
    message: 'Хтось записався на вашу подію.',
    email: false
  },
  PARTICIPATION_CANCELLED: {
    title: 'Участь скасовано',
    message: 'Користувач скасував участь у вашій події.',
    email: false
  },
  APPLICATION_APPROVED: {
    title: 'Заявку схвалено',
    message: 'Організатор схвалив вашу заявку на участь.',
    email: true
  },
  APPLICATION_REJECTED: {
    title: 'Заявку відхилено',
    message: 'Цього разу вашу заявку на участь не схвалено.',
    email: false
  },
  PARTICIPANT_REMOVED: {
    title: 'Участь припинено',
    message: 'Організатор виключив вас зі списку учасників.',
    email: true
  },
  EVENT_CHANGED: {
    title: 'Подію оновлено',
    message: 'Змінилися дата, час, адреса або посилання на подію. Перевірте її сторінку.',
    email: true
  },
  EVENT_CANCELLED: {
    title: 'Подію скасовано',
    message: 'Організатор скасував подію.',
    email: true
  },
  EVENT_REMINDER_24H: {
    title: 'Нагадування про подію',
    message: 'Ваша подія почнеться менш ніж за 24 години.',
    email: true
  },
  NEW_COMMENT: {
    title: 'Новий коментар',
    message: 'До вашої події додали коментар.',
    email: false
  },
  COMMENT_REPLY: {
    title: 'Відповідь на коментар',
    message: 'На ваш коментар відповіли.',
    email: false
  },
  REVIEW_REMINDER: {
    title: 'Залиште відгук',
    message: 'Подія завершилася. Ви можете залишити відгук протягом семи днів.',
    email: false
  },
  NEW_REVIEW: {
    title: 'Новий відгук',
    message: 'Учасник залишив відгук про вашу подію.',
    email: false
  },
  REVIEW_REPLY: {
    title: 'Відповідь на відгук',
    message: 'Організатор відповів на ваш відгук.',
    email: false
  },
  ACCOUNT_STATUS_CHANGED: {
    title: 'Статус акаунта змінено',
    message: 'Статус вашого акаунта було змінено.',
    email: true
  }
};
