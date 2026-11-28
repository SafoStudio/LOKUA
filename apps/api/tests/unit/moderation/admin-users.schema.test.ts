import { describe, expect, it } from 'vitest';
import { changeBirthDateSchema } from '../../../src/modules/moderation/presentation/http/admin-users.schema.js';

describe('changeBirthDateSchema', () => {
  it('accepts a real calendar date and trims the audit reason', () => {
    expect(
      changeBirthDateSchema.parse({ birthDate: '2000-02-29', reason: '  verified document  ' })
    ).toEqual({ birthDate: '2000-02-29', reason: 'verified document' });
  });

  it.each(['2023-02-29', '2024-04-31', '2024-13-01'])('rejects invalid date %s', (birthDate) => {
    expect(changeBirthDateSchema.safeParse({ birthDate, reason: 'review' }).success).toBe(false);
  });

  it('rejects unrecognized fields and blank reasons', () => {
    expect(
      changeBirthDateSchema.safeParse({ birthDate: '2000-01-01', reason: '   ' }).success
    ).toBe(false);
    expect(
      changeBirthDateSchema.safeParse({
        birthDate: '2000-01-01',
        reason: 'review',
        role: 'ADMIN'
      }).success
    ).toBe(false);
  });
});
