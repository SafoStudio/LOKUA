import type { DataSource } from 'typeorm';
import { UserEntity, UserRepositoryAdapter } from './infrastructure/index.js';
import {
  CreateUserUseCase,
  FindUserByIdUseCase,
  FindUserByEmailUseCase,
  MarkEmailVerifiedUseCase
} from './application/index.js';
import type { CreateUserInput } from './application/index.js';

export function createUsersModule(dataSource: DataSource) {
  const userRepository = new UserRepositoryAdapter(dataSource.getRepository(UserEntity));

  const createUser = new CreateUserUseCase(userRepository);
  const findUserById = new FindUserByIdUseCase(userRepository);
  const findUserByEmail = new FindUserByEmailUseCase(userRepository);
  const markEmailVerified = new MarkEmailVerifiedUseCase(userRepository);

  return {
    createUser: (input: CreateUserInput) => createUser.execute(input),
    findById: (id: string) => findUserById.execute(id),
    findByEmail: (email: string) => findUserByEmail.execute(email),
    markEmailVerified: (id: string) => markEmailVerified.execute(id)
  };
}

export type UsersModule = ReturnType<typeof createUsersModule>;
