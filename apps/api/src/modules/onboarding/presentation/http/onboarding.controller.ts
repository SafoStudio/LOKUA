import type { Request, Response, NextFunction } from 'express';
import type {
  SetDateOfBirthUseCase,
  SetProfileUseCase,
  SetCityUseCase,
  SetInterestsUseCase,
  SetOptionalProfileUseCase,
  CompleteOnboardingUseCase,
  GetOnboardingStateUseCase
} from '../../application/index.js';
import type { OnboardingContext } from '../../application/index.js';
import type { OnboardingState } from '../../domain/index.js';
import { AppError } from '../../../../common/index.js';
import type {
  DateOfBirthInput,
  ProfileInput,
  CityInput,
  InterestsInput,
  OptionalProfileInput
} from './onboarding.schema.js';

interface OnboardingControllerDependencies {
  setDateOfBirth: SetDateOfBirthUseCase;
  setProfile: SetProfileUseCase;
  setCity: SetCityUseCase;
  setInterests: SetInterestsUseCase;
  setOptionalProfile: SetOptionalProfileUseCase;
  completeOnboarding: CompleteOnboardingUseCase;
  getOnboardingState: GetOnboardingStateUseCase;
}

function toContext(req: Request): OnboardingContext {
  if (!req.user) throw new AppError('Authentication required', 401);
  return {
    user: req.user,
    ip: req.ip ?? null
  };
}

function toView(state: OnboardingState) {
  return {
    id: state.id,
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    completedAt: state.completedAt,
    data: {
      dateOfBirth: state.dateOfBirth ? state.dateOfBirth.toISOString().slice(0, 10) : null,
      name: state.name,
      mainPhotoUrl: state.mainPhotoUrl,
      cityId: state.cityId,
      interestIds: state.interestIds,
      bio: state.bio,
      languages: state.languages,
      socialLinks: state.socialLinks
    }
  };
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
  const getState = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = await getOnboardingState.execute(toContext(req));
      res.status(200).json({ data: toView(state) });
    } catch (error) {
      next(error);
    }
  };

  const applyDateOfBirth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as DateOfBirthInput;
      const state = await setDateOfBirth.execute(toContext(req), body.birthDate);
      res.status(200).json({ data: toView(state) });
    } catch (error) {
      next(error);
    }
  };

  const applyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ProfileInput;
      const state = await setProfile.execute(toContext(req), {
        name: body.name,
        mainPhotoUrl: body.mainPhotoUrl
      });
      res.status(200).json({ data: toView(state) });
    } catch (error) {
      next(error);
    }
  };

  const applyCity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CityInput;
      const state = await setCity.execute(toContext(req), { cityId: body.cityId });
      res.status(200).json({ data: toView(state) });
    } catch (error) {
      next(error);
    }
  };

  const applyInterests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as InterestsInput;
      const state = await setInterests.execute(toContext(req), {
        interestIds: body.interestIds
      });
      res.status(200).json({ data: toView(state) });
    } catch (error) {
      next(error);
    }
  };

  const applyOptionalProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as OptionalProfileInput;
      const state = await setOptionalProfile.execute(toContext(req), {
        bio: body.bio,
        languages: body.languages,
        socialLinks: body.socialLinks
      });
      res.status(200).json({ data: toView(state) });
    } catch (error) {
      next(error);
    }
  };

  const complete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = await completeOnboarding.execute(toContext(req));
      res.status(200).json({ data: toView(state) });
    } catch (error) {
      next(error);
    }
  };

  return {
    getState,
    applyDateOfBirth,
    applyProfile,
    applyCity,
    applyInterests,
    applyOptionalProfile,
    complete
  };
}
