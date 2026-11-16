export interface CreateUserData {
  id?: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  birthDate?: Date | null;
  role?: 'USER' | 'MODERATOR' | 'ADMIN';
  status?: 'ACTIVE' | 'BLOCKED_TEMPORARY' | 'BLOCKED_PERMANENT' | 'PENDING_DELETION' | 'DELETED';
  cityId?: string | null;
}
