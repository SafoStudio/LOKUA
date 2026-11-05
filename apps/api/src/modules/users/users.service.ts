import { AppDataSource } from '../../db/data-source.js';
import { User } from './user.entity.js';

const repo = () => AppDataSource.getRepository(User);

export const usersService = {
  findByEmail(email: string): Promise<User | null> {
    return repo().findOne({ where: { email } });
  },

  findById(id: string): Promise<User | null> {
    return repo().findOne({ where: { id } });
  },

  async create(data: { email: string; name: string; emailVerified?: boolean }): Promise<User> {
    const user = repo().create({
      email: data.email,
      name: data.name,
      emailVerified: data.emailVerified ?? false
    });
    return repo().save(user);
  }
};
