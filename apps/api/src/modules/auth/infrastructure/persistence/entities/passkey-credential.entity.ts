import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ForeignKey
} from 'typeorm';

@Entity({ name: 'passkey_credentials' })
export class PasskeyCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_passkey_credentials_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  @ForeignKey('users', {
    name: 'fk_passkey_credentials_user_id',
    onDelete: 'CASCADE'
  })
  userId!: string;

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
