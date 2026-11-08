export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'REGISTER_SUCCESS'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_CHANGED'
  | 'LOGOUT'
  | 'LOGOUT_ALL'
  | 'REFRESH_TOKEN_REUSE_DETECTED'
  | 'PASSKEY_LOGIN_SUCCESS'
  | 'PASSKEY_LOGIN_FAILURE';

export interface SecurityEvent {
  id: string;
  userId: string | null;
  eventType: SecurityEventType;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
