import type { Repository } from 'typeorm';
import type { UserProfile, UserProfileProvider } from '../../../application/index.js';
import type { UserEntity } from '../entities/user.entity.js';

interface UserProfileRow {
  id: string;
  email: string;
  name: string;
  cityId: string | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  avatarUrl: string | null;
  interestIds: string[] | null;
}

const SQL = `
  SELECT
    u.id,
    u.email,
    u.name,
    u.city_id AS "cityId",
    u.onboarding_completed AS "onboardingCompleted",
    u.created_at AS "createdAt",
    photo.url AS "avatarUrl",
    interests.ids AS "interestIds"
  FROM users u
  LEFT JOIN LATERAL (
    SELECT p.url
    FROM user_photos p
    WHERE p.user_id = u.id
    ORDER BY p.is_primary DESC, p.order_num ASC, p.created_at ASC
    LIMIT 1
  ) photo ON TRUE
  LEFT JOIN LATERAL (
    SELECT array_agg(ui.interest_id) AS ids
    FROM user_interests ui
    WHERE ui.user_id = u.id
  ) interests ON TRUE
  WHERE u.id = $1
`;

export class UserProfileProviderAdapter implements UserProfileProvider {
  constructor(private readonly repo: Repository<UserEntity>) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const rows = await this.repo.manager.query<UserProfileRow[]>(SQL, [userId]);
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      cityId: row.cityId,
      interestIds: row.interestIds ?? [],
      onboardingCompleted: row.onboardingCompleted,
      createdAt: row.createdAt
    };
  }
}
