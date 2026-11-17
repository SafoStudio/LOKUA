import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import type { UserProvider, UserOnboardingProvider } from '../users/index.js';
import type { CityProvider, InterestProvider } from '../dictionaries/index.js';
import type { AuditLogger } from '../moderation/index.js';
import {
  SetDateOfBirthUseCase,
  SetProfileUseCase,
  SetCityUseCase,
  SetInterestsUseCase,
  SetOptionalProfileUseCase,
  CompleteOnboardingUseCase,
  GetOnboardingStateUseCase
} from './application/index.js';
import { OnboardingStateEntity, OnboardingStateRepositoryAdapter } from './infrastructure/index.js';
import { createOnboardingController } from './presentation/http/onboarding.controller.js';
import { createOnboardingRouter } from './presentation/http/onboarding.routes.js';

export interface CreateOnboardingModuleDependencies {
  dataSource: DataSource;
  users: UserProvider;
  onboardingUsers: UserOnboardingProvider;
  cities: CityProvider;
  interests: InterestProvider;
  audit: AuditLogger;
  requireAuth: RequestHandler;
}

export function createOnboardingModule({
  dataSource,
  users,
  onboardingUsers,
  cities,
  interests,
  audit,
  requireAuth
}: CreateOnboardingModuleDependencies) {
  const stateRepository = new OnboardingStateRepositoryAdapter(
    dataSource.getRepository(OnboardingStateEntity)
  );

  const getOnboardingState = new GetOnboardingStateUseCase(stateRepository);

  const setDateOfBirth = new SetDateOfBirthUseCase(
    dataSource,
    stateRepository,
    users,
    onboardingUsers,
    audit
  );

  const setProfile = new SetProfileUseCase(
    dataSource,
    stateRepository,
    users,
    onboardingUsers,
    audit
  );

  const setCity = new SetCityUseCase(
    dataSource,
    stateRepository,
    users,
    onboardingUsers,
    cities,
    audit
  );

  const setInterests = new SetInterestsUseCase(
    dataSource,
    stateRepository,
    users,
    onboardingUsers,
    interests,
    audit
  );

  const setOptionalProfile = new SetOptionalProfileUseCase(
    dataSource,
    stateRepository,
    users,
    onboardingUsers,
    audit
  );

  const completeOnboarding = new CompleteOnboardingUseCase(
    dataSource,
    stateRepository,
    users,
    onboardingUsers,
    audit
  );

  const controller = createOnboardingController({
    setDateOfBirth,
    setProfile,
    setCity,
    setInterests,
    setOptionalProfile,
    completeOnboarding,
    getOnboardingState
  });

  const router = createOnboardingRouter({
    requireAuth,
    controller
  });

  return { router };
}

export type OnboardingModule = ReturnType<typeof createOnboardingModule>;
