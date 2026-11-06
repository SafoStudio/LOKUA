import type { Repository } from 'typeorm';
import type { User } from '../../../domain/index.js';
import type { UserRepository } from '../../../application/index.js';
import type { UserEntity } from '../entities/user.entity.js';

export class UserRepositoryAdapter implements UserRepository {
  constructor(private readonly repository: Repository<UserEntity>) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repository.findOne({
      where: { id }
    });

    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repository.findOne({
      where: { email }
    });

    return entity ? this.toDomain(entity) : null;
  }

  async create(data: {
    id?: string;
    email: string;
    name: string;
    emailVerified?: boolean;
  }): Promise<User> {
    const entity = this.repository.create({
      ...(data.id ? { id: data.id } : {}),
      email: data.email,
      name: data.name,
      emailVerified: data.emailVerified ?? false
    });

    const saved = await this.repository.save(entity);

    return this.toDomain(saved);
  }

  private toDomain(entity: UserEntity): User {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      emailVerified: entity.emailVerified,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }
}
