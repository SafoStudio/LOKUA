import type { PasskeyChallenge, PasskeyChallengeType } from '../../domain/index.js';

export interface PasskeyChallengeRepository {
  create(data: {
    challenge: string;
    type: PasskeyChallengeType;
    userId?: string | null;
    email?: string | null;
    name?: string | null;
    expiresAt: Date;
  }): Promise<void>;

  consume(data: {
    challenge: string;
    type: PasskeyChallengeType;
  }): Promise<PasskeyChallenge | null>;
}
