import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env, isDev, isProduction } from '../config/env.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,

  ssl: isProduction ? { rejectUnauthorized: true } : false,
  connectTimeoutMS: 10_000,
  extra: isProduction ? { max: 10 } : undefined,

  synchronize: false,

  logging: isDev,

  entities: [isDev ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'],

  migrations: [isDev ? 'src/db/migrations/*.ts' : 'dist/db/migrations/*.js']
});
