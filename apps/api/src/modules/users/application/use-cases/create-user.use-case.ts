import type { User } from '../../domain/index.js';
import type { UserRepository } from '../ports/user.repository.js';

export interface CreateUserInput {
  email: string;
  name: string;
  emailVerified?: boolean;
}

export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  execute(input: CreateUserInput): Promise<User> {
    return this.userRepository.create(input);
  }
}
