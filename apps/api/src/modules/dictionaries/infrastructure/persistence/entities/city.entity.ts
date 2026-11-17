import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';
import { CountryEntity } from './country.entity.js';
import type { GeoJSONPolygon } from '../../../../../common/index.js';
import { geojsonPolygonTransformer } from '../transformers/geojson.transformer.js';

@Entity('cities')
@Unique('uq_cities_country_slug', ['country_code', 'slug'])
@Index('idx_cities_bbox', ['bbox'], { spatial: true })
export class CityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'char', length: 2, default: 'UA' })
  country_code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: true,
    transformer: geojsonPolygonTransformer
  })
  bbox!: GeoJSONPolygon | null;

  @Column({ type: 'varchar', length: 64, default: 'Europe/Kyiv' })
  timezone!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => CountryEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  })
  @JoinColumn({ name: 'country_code', referencedColumnName: 'code' })
  country!: CountryEntity;
}
