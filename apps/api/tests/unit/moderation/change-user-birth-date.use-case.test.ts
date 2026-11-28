import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeUserBirthDateUseCase } from '../../../src/modules/moderation/application/index.js';
import type { User, UserProvider } from '../../../src/modules/users/index.js';
import type { AuditLogger } from '../../../src/modules/moderation/index.js';
import type { UnitOfWork, TransactionContext } from '../../../src/common/index.js';

const baseUser: User = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  emailVerified: true,
  birthDate: new Date('2000-01-01T00:00:00.000Z'),
  role: 'USER',
  status: 'ACTIVE',
  cityId: null,
  bio: null,
  languages: null,
  socialLinks: null,
  onboardingCompleted: true,
  termsAcceptedAt: null,
  blockedUntil: null,
  deletionRequestedAt: null,
  notificationSettings: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('ChangeUserBirthDateUseCase', () => {
  let users: UserProvider;
  let audit: AuditLogger;
  let unitOfWork: UnitOfWork;
  let tx: TransactionContext;

  beforeEach(() => {
    tx = {} as TransactionContext;
    unitOfWork = {
      run: vi.fn(async (fn: (t: TransactionContext) => Promise<unknown>) => fn(tx))
    } as unknown as UnitOfWork;

    users = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      markEmailVerified: vi.fn(),
      setBirthDate: vi.fn()
    };

    audit = { log: vi.fn() };
  });

  it('throws 404 when user not found', async () => {
    (users.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const useCase = new ChangeUserBirthDateUseCase(unitOfWork, users, audit);

    await expect(
      useCase.execute({
        actorId: 'admin',
        targetUserId: 'missing',
        birthDate: new Date('1999-01-01T00:00:00.000Z'),
        reason: 'fix',
        ip: null
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates birth date and writes audit inside transaction', async () => {
    (users.findById as ReturnType<typeof vi.fn>).mockResolvedValue(baseUser);
    const newDate = new Date('1999-12-31T00:00:00.000Z');
    const updated = { ...baseUser, birthDate: newDate };
    (users.setBirthDate as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const useCase = new ChangeUserBirthDateUseCase(unitOfWork, users, audit);

    const result = await useCase.execute({
      actorId: 'admin',
      targetUserId: 'u1',
      birthDate: newDate,
      reason: 'fix',
      ip: '127.0.0.1'
    });

    expect(result).toEqual(updated);
    expect(users.findById).toHaveBeenCalledWith('u1', tx, true);
    expect(users.setBirthDate).toHaveBeenCalledWith('u1', newDate, tx);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin',
        action: 'USER_BIRTH_DATE_CHANGED',
        targetType: 'USER',
        targetId: 'u1',
        beforeState: { birthDate: '2000-01-01' },
        afterState: { birthDate: '1999-12-31' },
        reason: 'fix',
        ip: '127.0.0.1'
      }),
      tx
    );
  });
});
