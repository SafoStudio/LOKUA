import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import type { UserOnboardingProvider } from '../users/index.js';
import type { CityProvider, InterestProvider } from '../dictionaries/index.js';
import type { AuditLogger } from '../moderation/index.js';
import type { ImageOwnership } from '../storage/index.js';
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
import { TypeOrmUnitOfWork } from '../../common/index.js';

export interface CreateOnboardingModuleDependencies {
  dataSource: DataSource;
  onboardingUsers: UserOnboardingProvider;
  cities: CityProvider;
  interests: InterestProvider;
  audit: AuditLogger;
  requireAuth: RequestHandler;
  images: ImageOwnership;
}

export function createOnboardingModule({
  dataSource,
  onboardingUsers,
  cities,
  interests,
  audit,
  requireAuth,
  images
}: CreateOnboardingModuleDependencies) {
  const stateRepository = new OnboardingStateRepositoryAdapter(
    dataSource.getRepository(OnboardingStateEntity)
  );

  const unitOfWork = new TypeOrmUnitOfWork(dataSource);

  const getOnboardingState = new GetOnboardingStateUseCase(stateRepository);

  const setDateOfBirth = new SetDateOfBirthUseCase(
    unitOfWork,
    stateRepository,
    onboardingUsers,
    audit
  );

  const setProfile = new SetProfileUseCase(
    unitOfWork,
    stateRepository,
    onboardingUsers,
    audit,
    images
  );

  const setCity = new SetCityUseCase(unitOfWork, stateRepository, onboardingUsers, cities, audit);

  const setInterests = new SetInterestsUseCase(
    unitOfWork,
    stateRepository,
    onboardingUsers,
    interests,
    audit
  );

  const setOptionalProfile = new SetOptionalProfileUseCase(
    unitOfWork,
    stateRepository,
    onboardingUsers,
    audit
  );

  const completeOnboarding = new CompleteOnboardingUseCase(
    unitOfWork,
    stateRepository,
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
