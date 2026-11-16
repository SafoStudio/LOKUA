import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { Coordinates } from '../../../../../common/index.js';
import { geojsonPointTransformer } from '../../../../../common/index.js';

@Entity({ name: 'geocoding_cache' })
export class GeocodingCacheEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_geocoding_cache_hash', { unique: true })
  @Column({ type: 'varchar', length: 64, name: 'query_hash' })
  queryHash!: string;

  @Column({ type: 'text', name: 'raw_query' })
  rawQuery!: string;

  @Column({ type: 'text', name: 'formatted_address' })
  formattedAddress!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district!: string | null;

  @Column({ type: 'char', length: 2, name: 'country_code', default: 'UA' })
  countryCode!: string;

  @Index('idx_geocoding_cache_coordinates', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    transformer: geojsonPointTransformer
  })
  coordinates!: Coordinates;

  @Column({ type: 'varchar', length: 50 })
  provider!: string;

  @Index('idx_geocoding_cache_expires')
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
