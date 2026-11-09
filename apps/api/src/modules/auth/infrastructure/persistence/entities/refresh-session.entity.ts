import { Entity, PrimaryColumn, Column, CreateDateColumn, Index, ForeignKey } from 'typeorm';

@Entity({ name: 'refresh_sessions' })
export class RefreshSessionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_refresh_sessions_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  @ForeignKey('users', {
    name: 'fk_refresh_sessions_user_id',
    onDelete: 'CASCADE'
  })
  userId!: string;

  @Index('idx_refresh_sessions_token_hash', { unique: true })
  @Column({ type: 'varchar', length: 64, name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at'
  })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;
}
