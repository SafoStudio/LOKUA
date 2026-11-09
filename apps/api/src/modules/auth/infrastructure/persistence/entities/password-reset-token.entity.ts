import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ForeignKey
} from 'typeorm';

@Entity({ name: 'password_reset_tokens' })
export class PasswordResetTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_password_reset_tokens_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  @ForeignKey('users', {
    name: 'fk_password_reset_tokens_user_id',
    onDelete: 'CASCADE'
  })
  userId!: string;

  @Index('idx_password_reset_tokens_token_hash', { unique: true })
  @Column({ type: 'varchar', length: 64, name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at'
  })
  createdAt!: Date;
}
