import type { LocationRepository } from '../ports/location.repository.js';
import type { PublicLocationView } from '../../domain/index.js';
import { toLocationView, LocationNotFoundError } from '../../domain/index.js';

export interface FindPublicLocationByIdInput {
  id: string;
}

export class FindPublicLocationByIdUseCase {
  constructor(private readonly locationRepository: Pick<LocationRepository, 'findById'>) {}

  async execute(input: FindPublicLocationByIdInput): Promise<PublicLocationView> {
    const location = await this.locationRepository.findById(input.id);
    if (!location) {
      throw new LocationNotFoundError(input.id);
    }
    return toLocationView(location, 'PUBLIC');
  }
}
