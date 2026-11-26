import type { LocationRepository } from '../ports/location.repository.js';
import type { Location } from '../../domain/index.js';
import { LocationNotFoundError } from '../../domain/index.js';

export interface FindLocationByIdInput {
  id: string;
}

export class FindLocationByIdUseCase {
  constructor(private readonly locationRepository: Pick<LocationRepository, 'findById'>) {}

  async execute(input: FindLocationByIdInput): Promise<Location> {
    const location = await this.locationRepository.findById(input.id);
    if (!location) {
      throw new LocationNotFoundError(input.id);
    }
    return location;
  }
}
