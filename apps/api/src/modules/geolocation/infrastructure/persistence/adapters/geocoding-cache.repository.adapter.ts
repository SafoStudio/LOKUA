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

  async save(input: CreateGeocodingCacheInput): Promise<GeocodingCache> {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);

    const existing = await this.repository.findOne({
      where: { queryHash: input.queryHash }
    });

    if (existing) {
      existing.rawQuery = input.rawQuery;
      existing.formattedAddress = input.formattedAddress;
      existing.city = input.city;
      existing.district = input.district ?? null;
      existing.countryCode = input.countryCode;
      existing.coordinates = {
        latitude: input.latitude,
        longitude: input.longitude
      };
      existing.provider = input.provider;
      existing.expiresAt = expiresAt;

      const saved = await this.repository.save(existing);
      return this.toDomain(saved);
    }

    const entity = this.repository.create({
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
      expiresAt
    });

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
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
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt
    };
  }
}
