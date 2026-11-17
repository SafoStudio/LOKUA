export type Country = {
  code: string;
  name: string;
};

export interface CountryProvider {
  findByCode(code: string): Promise<Country | null>;
  listAll(): Promise<Country[]>;
}
