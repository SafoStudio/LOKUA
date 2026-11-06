import type { User } from '../../domain/index.js';
import type { UserRepository } from '../ports/user.repository.js';

export class FindUserByIdUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  execute(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}
