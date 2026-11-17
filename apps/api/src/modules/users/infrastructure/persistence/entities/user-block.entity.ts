import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check
} from 'typeorm';

@Entity({ name: 'user_blocks' })
@Index('idx_user_blocks_unique', ['blockerId', 'blockedId'], { unique: true })
@Check('chk_user_blocks_self', '"blocker_id" <> "blocked_id"')
export class UserBlockEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_blocks_blocker_id')
  @Column({ type: 'uuid', name: 'blocker_id' })
  blockerId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocker_id' })
  blocker?: unknown;

  @Index('idx_user_blocks_blocked_id')
  @Column({ type: 'uuid', name: 'blocked_id' })
  blockedId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_id' })
  blocked?: unknown;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
