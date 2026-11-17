import type {
  CreateLocationProviderInput,
  LocationProvider,
  LocationRepository
} from '../../../application/index.js';
import type { CreateLocationUseCase } from '../../../application/index.js';
import type { Location, PublicLocationView } from '../../../domain/index.js';
import { toLocationView } from '../../../domain/index.js';

export class LocationProviderAdapter implements LocationProvider {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly createLocation: CreateLocationUseCase
  ) {}

  async findById(id: string): Promise<Location | null> {
    return this.locationRepository.findById(id);
  }

  async findPublicById(id: string): Promise<PublicLocationView | null> {
    const location = await this.locationRepository.findById(id);
    return location ? toLocationView(location, 'PUBLIC') : null;
  }

  async create(input: CreateLocationProviderInput): Promise<Location> {
    return this.createLocation.execute({
      name: input.name,
      address: input.address,
      cityId: input.cityId,
      districtId: input.districtId,
      countryCode: input.countryCode,
      exactCoordinates: input.exactCoordinates,
      publicCoordinates: input.publicCoordinates,
      provider: input.provider,
      providerPlaceId: input.providerPlaceId,
      createdBy: input.createdBy
    });
  }
}
