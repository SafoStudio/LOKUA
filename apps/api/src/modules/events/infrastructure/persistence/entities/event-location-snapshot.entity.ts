import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToOne
} from 'typeorm';
import type { Coordinates } from '../../../../../common/index.js';
import { geojsonPointTransformer } from '../../../../../common/index.js';

@Entity({ name: 'event_location_snapshot' })
export class EventLocationSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_event_location_snapshot_event_id', { unique: true })
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @OneToOne('EventEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: unknown;

  @Index('idx_event_location_snapshot_location_id')
  @Column({ type: 'uuid', name: 'location_id' })
  locationId!: string;

  @ManyToOne('LocationEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'location_id' })
  location?: unknown;

  @Index('idx_event_location_snapshot_city_id')
  @Column({ type: 'uuid', name: 'city_id' })
  cityId!: string;

  @ManyToOne('CityEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'city_id' })
  city?: unknown;

  @Index('idx_event_location_snapshot_district_id')
  @Column({ type: 'uuid', name: 'district_id', nullable: true })
  districtId!: string | null;

  @ManyToOne('DistrictEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'district_id' })
  district?: unknown | null;

  @Column({ type: 'char', length: 2, name: 'country_code', default: 'UA' })
  countryCode!: string;

  @ManyToOne('CountryEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'country_code' })
  country?: unknown;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  address!: string;

  @Index('idx_event_location_snapshot_coordinates', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    transformer: geojsonPointTransformer
  })
  coordinates!: Coordinates;

  @Index('idx_event_location_snapshot_public_coordinates', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'public_coordinates',
    transformer: geojsonPointTransformer
  })
  publicCoordinates!: Coordinates;

  @Column({
    type: 'timestamptz',
    name: 'snapshot_at',
    default: () => 'CURRENT_TIMESTAMP'
  })
  snapshotAt!: Date;
}
