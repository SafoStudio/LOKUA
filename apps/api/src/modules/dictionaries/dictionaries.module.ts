import type { DataSource } from 'typeorm';
import type {
  CityProvider,
  CountryProvider,
  InterestProvider,
  CategoryProvider
} from './application/index.js';
import {
  CityEntity,
  CountryEntity,
  InterestEntity,
  CategoryEntity,
  CityRepositoryAdapter,
  CountryRepositoryAdapter,
  InterestRepositoryAdapter,
  CategoryRepositoryAdapter
} from './infrastructure/index.js';

interface CreateDictionariesModuleDependencies {
  dataSource: DataSource;
}

export function createDictionariesModule({ dataSource }: CreateDictionariesModuleDependencies) {
  const cities: CityProvider = new CityRepositoryAdapter(dataSource.getRepository(CityEntity));

  const countries: CountryProvider = new CountryRepositoryAdapter(
    dataSource.getRepository(CountryEntity)
  );

  const interests: InterestProvider = new InterestRepositoryAdapter(
    dataSource.getRepository(InterestEntity)
  );

  const categories: CategoryProvider = new CategoryRepositoryAdapter(
    dataSource.getRepository(CategoryEntity)
  );

  return {
    cities,
    countries,
    interests,
    categories
  };
}

export type DictionariesModule = ReturnType<typeof createDictionariesModule>;
