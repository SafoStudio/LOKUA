import type { User } from '../../../users/index.js';

export function toAdminBirthDateView(user: User) {
  return {
    id: user.id,
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null
  };
}
