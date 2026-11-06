import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ForeignKey
} from 'typeorm';

@Entity({ name: 'password_credentials' })
export class PasswordCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_password_credentials_user_id', { unique: true })
  @Column({ type: 'uuid', name: 'user_id' })
  @ForeignKey('users', {
    name: 'fk_password_credentials_user_id',
    onDelete: 'CASCADE'
  })
  userId!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
