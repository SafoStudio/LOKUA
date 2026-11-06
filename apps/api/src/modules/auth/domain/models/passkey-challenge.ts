export type PasskeyChallengeType = 'SIGNUP' | 'REGISTRATION' | 'AUTHENTICATION';

export interface PasskeyChallenge {
  id: string;
  challenge: string;
  type: PasskeyChallengeType;
  userId: string | null;
  email: string | null;
  name: string | null;
  expiresAt: Date;
  createdAt: Date;
}
