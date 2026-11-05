import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity({ name: 'passkey_credentials' })
export class PasskeyCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_passkey_credentials_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index('idx_passkey_credentials_credential_id', { unique: true })
  @Column({ type: 'text', name: 'credential_id' })
  credentialId!: string;

  @Column({ type: 'bytea', name: 'public_key' })
  publicKey!: Buffer;

  @Column({ type: 'bigint', default: 0 })
  counter!: string;

  @Column({ type: 'text', array: true, nullable: true })
  transports!: string[] | null;

  @Column({ type: 'boolean', name: 'backed_up', default: false })
  backedUp!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
