import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity({ name: 'google_credentials' })
export class GoogleCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_google_credentials_user_id', { unique: true })
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index('idx_google_credentials_sub', { unique: true })
  @Column({ type: 'varchar', length: 255, name: 'google_sub' })
  googleSub!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
