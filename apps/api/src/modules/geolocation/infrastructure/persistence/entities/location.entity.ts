import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import type { Coordinates } from '../../../../../common/index.js';
import { geojsonPointTransformer } from '../../../../../common/index.js';

@Entity({ name: 'locations' })
export class LocationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  address!: string;

  @Index('idx_locations_city_id')
  @Column({ type: 'uuid', name: 'city_id' })
  cityId!: string;

  @ManyToOne('CityEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'city_id' })
  city?: unknown;

  @Index('idx_locations_district_id')
  @Column({ type: 'uuid', name: 'district_id', nullable: true })
  districtId!: string | null;

  @ManyToOne('DistrictEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'district_id' })
  district?: unknown;

  @Column({ type: 'char', length: 2, name: 'country_code', default: 'UA' })
  countryCode!: string;

  @ManyToOne('CountryEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'country_code' })
  country?: unknown;

  @Index('idx_locations_coordinates', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    transformer: geojsonPointTransformer
  })
  coordinates!: Coordinates;

  @Index('idx_locations_public_coordinates', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'public_coordinates',
    transformer: geojsonPointTransformer
  })
  publicCoordinates!: Coordinates;

  @Column({ type: 'varchar', length: 50, default: 'manual' })
  provider!: string;

  @Column({ type: 'varchar', length: 255, name: 'provider_place_id', nullable: true })
  providerPlaceId!: string | null;

  @Index('idx_locations_created_by')
  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: unknown;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
