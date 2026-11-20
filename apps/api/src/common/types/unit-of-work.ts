export interface TransactionContext {
  readonly __brand: unique symbol;
}

export interface UnitOfWork {
  run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
