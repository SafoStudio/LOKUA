import type { Repository } from 'typeorm';
import { LessThan } from 'typeorm';
import type {
  GeocodingCacheRepository,
  CreateGeocodingCacheInput
} from '../../../application/index.js';
import type { GeocodingCache } from '../../../domain/index.js';
import type { GeocodingCacheEntity } from '../entities/geocoding-cache.entity.js';

export class GeocodingCacheRepositoryAdapter implements GeocodingCacheRepository {
  constructor(private readonly repository: Repository<GeocodingCacheEntity>) {}

  async findByQueryHash(queryHash: string): Promise<GeocodingCache | null> {
    const entity = await this.repository.findOne({ where: { queryHash } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(input: CreateGeocodingCacheInput): Promise<void> {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);

    await this.repository.upsert(
      {
        queryHash: input.queryHash,
        rawQuery: input.rawQuery,
        formattedAddress: input.formattedAddress,
        city: input.city,
        district: input.district ?? null,
        countryCode: input.countryCode,
        coordinates: {
          latitude: input.latitude,
          longitude: input.longitude
        },
        provider: input.provider,
        providerPlaceId: input.providerPlaceId ?? null,
        expiresAt
      },
      ['queryHash']
    );
  }

  async deleteExpired(): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThan(new Date())
    });
    return result.affected ?? 0;
  }

  private toDomain(entity: GeocodingCacheEntity): GeocodingCache {
    return {
      id: entity.id,
      queryHash: entity.queryHash,
      rawQuery: entity.rawQuery,
      formattedAddress: entity.formattedAddress,
      city: entity.city,
      district: entity.district,
      countryCode: entity.countryCode,
      coordinates: entity.coordinates,
      provider: entity.provider,
      providerPlaceId: entity.providerPlaceId,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt
    };
  }
}
