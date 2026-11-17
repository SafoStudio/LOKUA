import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('countries')
export class CountryEntity {
  @PrimaryColumn({ type: 'char', length: 2 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
