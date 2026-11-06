import type { User } from '../../domain/index.js';
import type { UserRepository } from '../ports/user.repository.js';

export class FindUserByEmailUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  execute(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }
}
