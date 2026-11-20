import { vi } from 'vitest';
import type { OnboardingStateRepository } from '../../src/modules/onboarding/application/index.js';
import type { UserProvider, UserOnboardingProvider } from '../../src/modules/users/index.js';
import type { AuditLogger } from '../../src/modules/moderation/index.js';
import type { CityProvider, InterestProvider } from '../../src/modules/dictionaries/index.js';
import type { TransactionContext, UnitOfWork } from '../../src/common/index.js';

export function createMockStateRepository(): OnboardingStateRepository {
    return {
        findByUserId: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
        updateStep: vi.fn()
    };
}

export function createMockUserProvider(): UserProvider {
    return {
        findById: vi.fn(),
        findByEmail: vi.fn(),
        create: vi.fn(),
        markEmailVerified: vi.fn(),
        setBirthDate: vi.fn()
    };
}

export function createMockUserOnboardingProvider(): UserOnboardingProvider {
    return {
        applyDateOfBirth: vi.fn(),
        applyProfile: vi.fn(),
        applyCity: vi.fn(),
        applyInterests: vi.fn(),
        applyOptionalProfile: vi.fn(),
        completeOnboarding: vi.fn()
    };
}

export function createMockAuditLogger(): AuditLogger {
    return { log: vi.fn() };
}

export function createMockCityProvider(): CityProvider {
    return {
        findById: vi.fn(),
        findBySlug: vi.fn(),
        listActive: vi.fn()
    };
}

export function createMockInterestProvider(): InterestProvider {
    return {
        findById: vi.fn(),
        findByIds: vi.fn(),
        listActive: vi.fn()
    };
}

export function createMockUnitOfWork(): UnitOfWork {
    const tx = {} as TransactionContext;

    return {
        run: vi.fn(async (fn: (t: TransactionContext) => Promise<unknown>) => fn(tx))
    } as unknown as UnitOfWork;
}