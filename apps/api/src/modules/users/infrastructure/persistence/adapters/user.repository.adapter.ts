import { Not } from 'typeorm';
import type { Repository } from 'typeorm';
import type { CreateUserData, UserRepository } from '../../../application/index.js';
import type { User } from '../../../domain/index.js';
import { UserEntity } from '../entities/user.entity.js';
import type { TransactionContext } from '../../../../../common/index.js';
import { AppError, toEntityManager } from '../../../../../common/index.js';

export class UserRepositoryAdapter implements UserRepository {
  constructor(private readonly repo: Repository<UserEntity>) {}

  async findById(id: string, tx?: TransactionContext): Promise<User | null> {
    const repo = tx ? toEntityManager(tx).getRepository(UserEntity) : this.repo;
    const entity = await repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async create(data: CreateUserData, tx?: TransactionContext): Promise<User> {
    const repo = tx ? toEntityManager(tx).getRepository(UserEntity) : this.repo;
    const entity = repo.create({
      id: data.id,
      email: data.email,
      name: data.name,
      emailVerified: data.emailVerified ?? false,
      birthDate: data.birthDate ?? null,
      role: data.role ?? 'USER',
      status: data.status ?? 'ACTIVE',
      cityId: data.cityId ?? null,
      termsAcceptedAt: data.termsAcceptedAt ?? null
    });
    const saved = await repo.save(entity);
    return this.toDomain(saved);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.repo.update({ id, status: Not('DELETED') }, { emailVerified: true });
  }

  async setBirthDate(id: string, birthDate: Date, tx?: TransactionContext): Promise<User> {
    const repo = tx ? toEntityManager(tx).getRepository(UserEntity) : this.repo;
    const result = await repo.update({ id, status: Not('DELETED') }, { birthDate });
    if (!result.affected) throw new AppError('User not found', 404);
    const updated = await repo.findOneOrFail({ where: { id } });
    return this.toDomain(updated);
  }

  private toDomain(entity: UserEntity): User {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      emailVerified: entity.emailVerified,
      birthDate: entity.birthDate,
      role: entity.role,
      status: entity.status,
      cityId: entity.cityId,
      bio: entity.bio,
      languages: entity.languages,
      socialLinks: entity.socialLinks,
      onboardingCompleted: entity.onboardingCompleted,
      termsAcceptedAt: entity.termsAcceptedAt,
      blockedUntil: entity.blockedUntil,
      deletionRequestedAt: entity.deletionRequestedAt,
      ...(entity.sessionVersion ? { sessionVersion: entity.sessionVersion } : {}),
      notificationSettings: entity.notificationSettings,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }
}
