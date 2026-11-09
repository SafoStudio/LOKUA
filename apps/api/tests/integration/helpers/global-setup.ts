import { createTestDataSource } from './test-db.js';

export default async function globalSetup(): Promise<void> {
    const dataSource = createTestDataSource();

    try {
        await dataSource.initialize();
        await dataSource.runMigrations();
    } finally {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}