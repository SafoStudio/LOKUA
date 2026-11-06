import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env, isDev } from '../config/env.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,

  synchronize: false,

  logging: env.NODE_ENV === 'development',

  entities: [isDev ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'],

  migrations: [isDev ? 'src/db/migrations/*.ts' : 'dist/db/migrations/*.js']
});
