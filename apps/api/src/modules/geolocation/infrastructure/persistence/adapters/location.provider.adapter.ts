import type { TransactionContext } from '../../../../../common/index.js';
import type { CreateLocationProviderInput, LocationProvider } from '../../../application/index.js';
import type { CreateLocationUseCase } from '../../../application/index.js';
import type { Location, PublicLocationView } from '../../../domain/index.js';
import { toLocationView } from '../../../domain/index.js';
import type { LocationRepositoryAdapter } from './location.repository.adapter.js';

export class LocationProviderAdapter implements LocationProvider {
  constructor(
    private readonly locationRepository: Pick<
      LocationRepositoryAdapter,
      'findById' | 'findDiscoverableById'
    >,
    private readonly createLocation: CreateLocationUseCase
  ) {}

  findById(id: string, tx?: TransactionContext): Promise<Location | null> {
    return this.locationRepository.findById(id, tx);
  }

  async findPublicById(id: string): Promise<PublicLocationView | null> {
    const location = await this.locationRepository.findDiscoverableById(id);
    return location ? toLocationView(location, 'PUBLIC') : null;
  }

  create(input: CreateLocationProviderInput): Promise<Location> {
    return this.createLocation.execute(input);
  }
}
