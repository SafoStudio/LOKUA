import type { Request, Response } from 'express';
import type {
  SetDateOfBirthUseCase,
  SetProfileUseCase,
  SetCityUseCase,
  SetInterestsUseCase,
  SetOptionalProfileUseCase,
  CompleteOnboardingUseCase,
  GetOnboardingStateUseCase
} from '../../application/index.js';
import type {
  DateOfBirthInput,
  ProfileInput,
  CityInput,
  InterestsInput,
  OptionalProfileInput
} from './onboarding.schema.js';
import { toOnboardingContext } from './onboarding-context.js';
import { toOnboardingStateView } from './onboarding-state.view.js';

interface OnboardingControllerDependencies {
  setDateOfBirth: SetDateOfBirthUseCase;
  setProfile: SetProfileUseCase;
  setCity: SetCityUseCase;
  setInterests: SetInterestsUseCase;
  setOptionalProfile: SetOptionalProfileUseCase;
  completeOnboarding: CompleteOnboardingUseCase;
  getOnboardingState: GetOnboardingStateUseCase;
}

export function createOnboardingController({
  setDateOfBirth,
  setProfile,
  setCity,
  setInterests,
  setOptionalProfile,
  completeOnboarding,
  getOnboardingState
}: OnboardingControllerDependencies) {
  return {
    async getState(req: Request, res: Response): Promise<void> {
      const state = await getOnboardingState.execute(toOnboardingContext(req));
      res.status(200).json({ data: toOnboardingStateView(state) });
    },

    async applyDateOfBirth(req: Request, res: Response): Promise<void> {
      const body = req.body as DateOfBirthInput;
      const state = await setDateOfBirth.execute(toOnboardingContext(req), body.birthDate);
      res.status(200).json({ data: toOnboardingStateView(state) });
    },

    async applyProfile(req: Request, res: Response): Promise<void> {
      const body = req.body as ProfileInput;
      const state = await setProfile.execute(toOnboardingContext(req), {
        name: body.name,
        mainPhotoUrl: body.mainPhotoUrl
      });
      res.status(200).json({ data: toOnboardingStateView(state) });
    },

    async applyCity(req: Request, res: Response): Promise<void> {
      const body = req.body as CityInput;
      const state = await setCity.execute(toOnboardingContext(req), { cityId: body.cityId });
      res.status(200).json({ data: toOnboardingStateView(state) });
    },

    async applyInterests(req: Request, res: Response): Promise<void> {
      const body = req.body as InterestsInput;
      const state = await setInterests.execute(toOnboardingContext(req), {
        interestIds: body.interestIds
      });
      res.status(200).json({ data: toOnboardingStateView(state) });
    },

    async applyOptionalProfile(req: Request, res: Response): Promise<void> {
      const body = req.body as OptionalProfileInput;
      const state = await setOptionalProfile.execute(toOnboardingContext(req), {
        bio: body.bio,
        languages: body.languages,
        socialLinks: body.socialLinks
      });
      res.status(200).json({ data: toOnboardingStateView(state) });
    },

    async complete(req: Request, res: Response): Promise<void> {
      const state = await completeOnboarding.execute(toOnboardingContext(req));
      res.status(200).json({ data: toOnboardingStateView(state) });
    }
  };
}

export type OnboardingController = ReturnType<typeof createOnboardingController>;
