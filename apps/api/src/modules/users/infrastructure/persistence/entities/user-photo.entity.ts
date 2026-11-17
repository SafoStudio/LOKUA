import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';

@Entity({ name: 'user_photos' })
export class UserPhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_photos_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: unknown;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'integer', name: 'order_num', default: 0 })
  orderNum!: number;

  @Column({ type: 'boolean', name: 'is_primary', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
