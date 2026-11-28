import { AppError } from '../../../../common/index.js';
import type { CityProvider, InterestProvider } from '../../../dictionaries/index.js';

export interface ProfileSettingsPatch {
  name?: string;
  cityId?: string;
  interestIds?: string[];
  bio?: string | null;
  languages?: string[] | null;
  socialLinks?: Record<string, string> | null;
}

export interface ProfileSettingsStore {
  update(userId: string, patch: ProfileSettingsPatch): Promise<void>;
}

export class ProfileSettingsService {
  constructor(
    private readonly store: ProfileSettingsStore,
    private readonly cities: CityProvider,
    private readonly interests: InterestProvider
  ) {}

  async update(userId: string, patch: ProfileSettingsPatch): Promise<void> {
    if (patch.cityId && !(await this.cities.findById(patch.cityId))?.isActive) {
      throw new AppError('Місто недоступне', 422);
    }
    if (patch.interestIds) {
      const ids = [...new Set(patch.interestIds)];
      if (ids.length < 3 || ids.length > 20) {
        throw new AppError('Оберіть від 3 до 20 різних інтересів', 422);
      }
      const found = await this.interests.findActiveByIds(ids);
      if (found.length !== ids.length) {
        throw new AppError('Деякі інтереси недоступні', 422);
      }
      patch = { ...patch, interestIds: ids };
    }
    await this.store.update(userId, patch);
  }
}
