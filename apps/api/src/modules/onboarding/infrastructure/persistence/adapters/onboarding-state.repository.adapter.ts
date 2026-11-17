import type { EntityManager, Repository } from 'typeorm';
import type {
  OnboardingStateRepository,
  UpdateOnboardingStepData
} from '../../../application/index.js';
import type { OnboardingState, OnboardingStep } from '../../../domain/index.js';
import { OnboardingStateEntity } from '../entities/onboarding-state.entity.js';

export class OnboardingStateRepositoryAdapter implements OnboardingStateRepository {
  constructor(private readonly repo: Repository<OnboardingStateEntity>) {}

  async findByUserId(userId: string, manager?: EntityManager): Promise<OnboardingState | null> {
    const repo = this.getRepo(manager);
    const entity = await repo.findOne({ where: { userId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findById(id: string, manager?: EntityManager): Promise<OnboardingState | null> {
    const repo = this.getRepo(manager);
    const entity = await repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async create(userId: string, manager?: EntityManager): Promise<OnboardingState> {
    const repo = this.getRepo(manager);
    await repo.upsert({ userId, currentStep: 'DATE_OF_BIRTH', completedSteps: [] }, ['userId']);
    const entity = await repo.findOneOrFail({ where: { userId } });
    return this.toDomain(entity);
  }

  async updateStep(
    id: string,
    data: UpdateOnboardingStepData,
    manager?: EntityManager
  ): Promise<OnboardingState> {
    const repo = this.getRepo(manager);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new Error(`OnboardingState ${id} not found`);

    if (data.currentStep !== undefined) entity.currentStep = data.currentStep;
    if (data.completedSteps !== undefined) entity.completedSteps = data.completedSteps;
    if (data.dateOfBirth !== undefined) entity.dateOfBirth = data.dateOfBirth;
    if (data.name !== undefined) entity.name = data.name;
    if (data.mainPhotoUrl !== undefined) entity.mainPhotoUrl = data.mainPhotoUrl;
    if (data.cityId !== undefined) entity.cityId = data.cityId;
    if (data.interestIds !== undefined) entity.interestIds = data.interestIds;
    if (data.bio !== undefined) entity.bio = data.bio;
    if (data.languages !== undefined) entity.languages = data.languages;
    if (data.socialLinks !== undefined) entity.socialLinks = data.socialLinks;
    if (data.completedAt !== undefined) entity.completedAt = data.completedAt;

    const saved = await repo.save(entity);
    return this.toDomain(saved);
  }

  private getRepo(manager?: EntityManager): Repository<OnboardingStateEntity> {
    return manager ? manager.getRepository(OnboardingStateEntity) : this.repo;
  }

  private toDomain(entity: OnboardingStateEntity): OnboardingState {
    return {
      id: entity.id,
      userId: entity.userId,
      currentStep: entity.currentStep as OnboardingStep,
      completedSteps: entity.completedSteps as OnboardingStep[],
      dateOfBirth: entity.dateOfBirth,
      name: entity.name,
      mainPhotoUrl: entity.mainPhotoUrl,
      cityId: entity.cityId,
      interestIds: entity.interestIds,
      bio: entity.bio,
      languages: entity.languages,
      socialLinks: entity.socialLinks,
      completedAt: entity.completedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }
}
