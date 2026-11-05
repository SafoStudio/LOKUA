import bcrypt from 'bcryptjs';
import { AppDataSource } from '../../db/data-source.js';
import { PasswordCredential } from '../credentials/password-credential.entity.js';
import { usersService } from '../users/users.service.js';
import { AppError } from '../../common/errors/app-error.js';

const SALT_ROUNDS = 12;

const repo = () => AppDataSource.getRepository(PasswordCredential);

export const passwordStrategy = {
  async register(email: string, name: string, password: string) {
    const existing = await usersService.findByEmail(email);
    if (existing) throw new AppError('Email already registered', 409);

    const user = await usersService.create({ email, name });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const credential = repo().create({ userId: user.id, passwordHash });
    await repo().save(credential);

    return user;
  },

  async verify(email: string, password: string) {
    const user = await usersService.findByEmail(email);
    if (!user) throw new AppError('Invalid credentials', 401);

    const credential = await repo().findOne({ where: { userId: user.id } });
    if (!credential) throw new AppError('Invalid credentials', 401);

    const valid = await bcrypt.compare(password, credential.passwordHash);
    if (!valid) throw new AppError('Invalid credentials', 401);

    return user;
  }
};
