import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { PasskeyChallengeType } from '../../../domain/index.js';

@Entity({ name: 'passkey_challenges' })
export class PasskeyChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_passkey_challenges_challenge', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  challenge!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: PasskeyChallengeType;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at'
  })
  createdAt!: Date;
}
