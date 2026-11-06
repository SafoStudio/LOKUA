import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ForeignKey
} from 'typeorm';

@Entity({ name: 'google_credentials' })
export class GoogleCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_google_credentials_user_id', { unique: true })
  @Column({ type: 'uuid', name: 'user_id' })
  @ForeignKey('users', {
    name: 'fk_google_credentials_user_id',
    onDelete: 'CASCADE'
  })
  userId!: string;

  @Index('idx_google_credentials_sub', { unique: true })
  @Column({ type: 'varchar', length: 255, name: 'google_sub' })
  googleSub!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
