import type { Repository } from 'typeorm';
import type {
  LocationRepository,
  CreateLocationInput,
  NearbyLocationResult
} from '../../../application/index.js';
import type { Location } from '../../../domain/index.js';
import type { Coordinates } from '../../../../../common/index.js';
import type { LocationEntity } from '../entities/location.entity.js';

// Both the current event location and its stored snapshot are private references.
const discoverableLocation = `NOT EXISTS (
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
      createdBy: input.createdBy
    });

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findNearby(
    coordinates: Coordinates,
    radiusMeters: number,
    limit: number
  ): Promise<NearbyLocationResult[]> {
    const rawResults = await this.repository.query(
      `SELECT loc.*,
              ST_Distance(
                loc.coordinates,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS distance_meters
       FROM "locations" loc
       WHERE ST_DWithin(
         loc.coordinates,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       ) AND ${discoverableLocation}
       ORDER BY distance_meters ASC
       LIMIT $4`,
      [coordinates.longitude, coordinates.latitude, radiusMeters, limit]
    );

    return rawResults.map((raw: LocationEntity & { distance_meters: string | number }) => ({
      location: this.toDomain(raw),
      distanceMeters: Number(raw.distance_meters)
    }));
  }

  async findInBBox(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    limit: number
  ): Promise<Location[]> {
    const rawResults = await this.repository.query(
      `SELECT loc.* FROM "locations" loc
       WHERE ST_Intersects(
         coordinates,
         ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
       ) AND ${discoverableLocation}
       ORDER BY created_at DESC
       LIMIT $5`,
      [minLng, minLat, maxLng, maxLat, limit]
    );

    return rawResults.map((raw: LocationEntity) => this.toDomain(raw));
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
