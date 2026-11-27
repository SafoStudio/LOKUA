import { AppError } from '../../../../common/index.js';
import type { CityProvider } from '../../../dictionaries/index.js';
import type {
  AccessService,
  AuthUser,
  UserBlockProvider,
  UserProfileProvider
} from '../../../users/index.js';
import type { AgeRestriction } from '../../domain/index.js';
import type { EventRepository } from '../ports/event.repository.js';
import type { GetEventsQuery } from '../types/get-events-query.js';

export class GetEventsUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly access: AccessService,
    private readonly cities: CityProvider,
    private readonly profiles: UserProfileProvider,
    private readonly blocks: UserBlockProvider,
    private readonly clock: () => Date
  ) {}

  async execute(query: GetEventsQuery, user: AuthUser | null) {
    if (query.from && query.to && query.from >= query.to) {
      throw new AppError('The feed date range must end after it starts', 400);
    }

    if (query.origin && query.format === 'ONLINE') {
      throw new AppError('Distance sorting requires offline events', 400);
    }

    if (query.byInterests && !user) throw new AppError('Потрібна авторизація', 401);
    if (query.byInterests && user && (this.access.isBlocked(user) || !user.onboardingCompleted)) {
      throw new AppError('Завершіть онбординг, щоб бачити події за інтересами', 403);
    }

    const [profile, blockedOrganizerIds] = await Promise.all([
      user && (!query.cityId || query.byInterests) ? this.profiles.findByUserId(user.id) : null,
      user ? this.blocks.listBlockerIds(user.id) : []
    ]);
    const city = await this.resolveCity(query.cityId, profile?.cityId);
    const now = this.clock();
    const restrictions: AgeRestriction[] = ['ALL', 'SIXTEEN_PLUS', 'EIGHTEEN_PLUS'];
    return this.eventRepository.findPublished({
      ...query,
      cityId: query.bounds && !query.cityId ? undefined : city.id,
      timezone: city.timezone,
      interestIds: query.byInterests ? (profile?.interestIds ?? []) : undefined,
      now,
      blockedOrganizerIds,
      ageRestrictions: restrictions.filter((restriction) =>
        this.access.canViewEvent(user, restriction, now)
      )
    });
  }

  private async resolveCity(cityId: string | undefined, profileCityId?: string | null) {
    if (cityId) {
      const city = await this.cities.findById(cityId);
      if (!city?.isActive) throw new AppError('Feed city not found', 400);
      return city;
    }

    const profileCity = profileCityId ? await this.cities.findById(profileCityId) : null;
    if (profileCity?.isActive) return profileCity;

    const kyiv = await this.cities.findBySlug('kyiv');
    if (!kyiv?.isActive) throw new AppError('Default feed city is unavailable');
    return kyiv;
  }
}
