import type { LocationRepository } from '../ports/location.repository.js';
import type { Location } from '../../domain/index.js';
import type { CityProvider, CountryProvider } from '../../../dictionaries/index.js';
import type { UserProvider } from '../../../users/index.js';
import {
  isValidCoordinates,
  obfuscateCoordinates,
  InvalidCoordinatesError,
  LocationValidationError
} from '../../domain/index.js';

export interface CreateLocationUseCaseInput {
  name: string;
  address: string;
  cityId: string;
  districtId: string | null;
  countryCode?: string;
  exactCoordinates: { latitude: number; longitude: number };
  publicCoordinates?: { latitude: number; longitude: number };
  provider?: string;
  providerPlaceId?: string | null;
  createdBy: string | null;
}

export class CreateLocationUseCase {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly cityProvider: CityProvider,
    private readonly countryProvider: CountryProvider,
    private readonly userProvider: UserProvider
  ) {}

  async execute(input: CreateLocationUseCaseInput): Promise<Location> {
    if (!isValidCoordinates(input.exactCoordinates)) {
      throw new InvalidCoordinatesError();
    }

    const city = await this.cityProvider.findById(input.cityId);
    if (!city) {
      throw new LocationValidationError(`City with id '${input.cityId}' not found`);
    }

    const countryCode = input.countryCode ?? 'UA';
    const country = await this.countryProvider.findByCode(countryCode);
    if (!country) {
      throw new LocationValidationError(`Country with code '${countryCode}' not found`);
    }

    if (input.createdBy) {
      const user = await this.userProvider.findById(input.createdBy);
      if (!user) {
        throw new LocationValidationError(`User with id '${input.createdBy}' not found`);
      }
    }

    let publicCoordinates: { latitude: number; longitude: number };
    if (input.publicCoordinates) {
      if (!isValidCoordinates(input.publicCoordinates)) {
        throw new InvalidCoordinatesError(
          'Invalid public coordinates. Latitude must be in [-90, 90], Longitude in [-180, 180]'
        );
      }
      publicCoordinates = input.publicCoordinates;
    } else {
      publicCoordinates = obfuscateCoordinates(input.exactCoordinates);
    }

    return this.locationRepository.create({
      name: input.name,
      address: input.address,
      cityId: input.cityId,
      districtId: input.districtId,
      countryCode,
      exactCoordinates: input.exactCoordinates,
      publicCoordinates,
      provider: input.provider ?? 'manual',
      providerPlaceId: input.providerPlaceId ?? null,
      createdBy: input.createdBy
    });
  }
}
