import type { DataSource } from 'typeorm';
import { createAdminDictionary } from './application/admin-dictionary.js';
import {
  createAdminDictionariesRouter,
  createPublicDictionariesRouter
} from './presentation/http/dictionaries.routes.js';
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

  const interests = new InterestRepositoryAdapter(dataSource.getRepository(InterestEntity));

  const categories = new CategoryRepositoryAdapter(dataSource.getRepository(CategoryEntity));
  const publicCategories: CategoryProvider = categories;
  const publicInterests: InterestProvider = interests;

  return {
    cities,
    countries,
    interests: publicInterests,
    categories: publicCategories,
    router: createPublicDictionariesRouter(categories, interests),
    adminRouter: createAdminDictionariesRouter(
      createAdminDictionary(categories),
      createAdminDictionary(interests)
    )
  };
}

export type DictionariesModule = ReturnType<typeof createDictionariesModule>;
