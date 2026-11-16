export type Interest = {
  id: string;
  name: string;
  isActive: boolean;
};

export interface InterestProvider {
  findById(id: string): Promise<Interest | null>;
  listActive(): Promise<Interest[]>;
}
