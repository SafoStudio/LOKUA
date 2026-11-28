import type { Repository } from 'typeorm';
import type {
  LocationRepository,
  CreateLocationInput,
  NearbyLocationResult
} from '../../../application/index.js';
import type { Location } from '../../../domain/index.js';
import type { Coordinates } from '../../../../../common/index.js';
import type { LocationEntity } from '../entities/location.entity.js';
import { DistrictEntity } from '../entities/district.entity.js';

// Both the current event location and its stored snapshot are private references.
const discoverableLocation = `NOT loc.is_private AND NOT EXISTS (
  SELECT 1 FROM events event
  WHERE event.primary_location_id = loc.id AND event.hide_exact_address
) AND NOT EXISTS (
  SELECT 1 FROM event_location_snapshot snapshot
  JOIN events event ON event.id = snapshot.event_id
  WHERE snapshot.location_id = loc.id AND event.hide_exact_address
)`;

export class LocationRepositoryAdapter implements LocationRepository {
  constructor(private readonly repository: Repository<LocationEntity>) {}

  async findById(id: string): Promise<Location | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findDiscoverableById(id: string): Promise<Location | null> {
    const entity = await this.repository
      .createQueryBuilder('loc')
      .where('loc.id = :id', { id })
      .andWhere(discoverableLocation)
      .getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async findExactById(id: string, viewerId: string): Promise<Location | null> {
    const entity = await this.repository
      .createQueryBuilder('loc')
      .where('loc.id = :id', { id })
      .andWhere(`(loc.created_by = :viewerId OR (${discoverableLocation}))`, { viewerId })
      .getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async create(input: CreateLocationInput): Promise<Location> {
    const entity = this.repository.create({
      name: input.name,
      address: input.address,
      cityId: input.cityId,
      districtId: input.districtId,
      countryCode: input.countryCode,
      coordinates: input.exactCoordinates,
      publicCoordinates: input.publicCoordinates,
      provider: input.provider,
      providerPlaceId: input.providerPlaceId,
      createdBy: input.createdBy,
      isPrivate: input.createdBy !== null
    });

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  districtBelongsToCity(districtId: string, cityId: string): Promise<boolean> {
    return this.repository.manager
      .getRepository(DistrictEntity)
      .existsBy({ id: districtId, cityId });
  }

  async findNearby(
    coordinates: Coordinates,
    radiusMeters: number,
    limit: number
  ): Promise<NearbyLocationResult[]> {
    const origin = 'ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography';
    const { entities, raw } = await this.repository
      .createQueryBuilder('loc')
      .addSelect(`ST_Distance(loc.public_coordinates, ${origin})`, 'distance_meters')
      .where(`ST_DWithin(loc.public_coordinates, ${origin}, :radiusMeters)`, {
        ...coordinates,
        radiusMeters
      })
      .andWhere(discoverableLocation)
      .orderBy('distance_meters', 'ASC')
      .addOrderBy('loc.id', 'ASC')
      .limit(limit)
      .getRawAndEntities<{ distance_meters: number }>();

    return entities.map((entity, index) => ({
      location: this.toDomain(entity),
      distanceMeters: Number(raw[index].distance_meters)
    }));
  }

  async findInBBox(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    limit: number
  ): Promise<Location[]> {
    const entities = await this.repository
      .createQueryBuilder('loc')
      .where(
        'ST_Intersects(loc.public_coordinates, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)::geography)',
        { minLng, minLat, maxLng, maxLat }
      )
      .andWhere(discoverableLocation)
      .orderBy('loc.created_at', 'DESC')
      .addOrderBy('loc.id', 'ASC')
      .limit(limit)
      .getMany();

    return entities.map((entity) => this.toDomain(entity));
  }

  async search(query: string, cityId: string | null, limit: number): Promise<Location[]> {
    const qb = this.repository
      .createQueryBuilder('loc')
      .where('(loc.name ILIKE :q OR loc.address ILIKE :q)', { q: `%${query}%` })
      .andWhere(discoverableLocation);

    if (cityId) qb.andWhere('loc.city_id = :cityId', { cityId });

    const entities = await qb.orderBy('loc.name', 'ASC').take(limit).getMany();

    return entities.map((entity) => this.toDomain(entity));
  }

  private toDomain(entity: LocationEntity): Location {
    return {
      id: entity.id,
      name: entity.name,
      address: entity.address,
      cityId: entity.cityId,
      districtId: entity.districtId,
      countryCode: entity.countryCode,
      exactCoordinates: entity.coordinates,
      publicCoordinates: entity.publicCoordinates,
      provider: entity.provider,
      providerPlaceId: entity.providerPlaceId,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }
}
