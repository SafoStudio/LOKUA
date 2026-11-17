import type { UserRole, UserStatus } from '../../domain/index.js';

export interface CreateUserData {
  id?: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  birthDate?: Date | null;
  role?: UserRole;
  status?: UserStatus;
  cityId?: string | null;
}
