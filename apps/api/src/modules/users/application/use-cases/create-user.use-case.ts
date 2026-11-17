import type { User } from '../../domain/index.js';
import type { UserRepository } from '../ports/user.repository.js';
import type { CreateUserData } from '../types/create-user-data.js';

export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(data: CreateUserData): Promise<User> {
    return this.userRepository.create(data);
  }
}
