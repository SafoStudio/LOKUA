import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import type { GeoJSONPolygon, Coordinates } from '../../../../../common/index.js';
import { geojsonPointTransformer, geojsonPolygonTransformer } from '../../../../../common/index.js';

@Entity({ name: 'districts' })
@Index('idx_districts_city_name', ['cityId', 'name'], { unique: true })
export class DistrictEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_districts_city_id')
  @Column({ type: 'uuid', name: 'city_id' })
  cityId!: string;

  @ManyToOne('CityEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city?: unknown;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Index('idx_districts_center', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    transformer: geojsonPointTransformer
  })
  center!: Coordinates;

  @Index('idx_districts_boundary', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: true,
    transformer: geojsonPolygonTransformer
  })
  boundary!: GeoJSONPolygon | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
