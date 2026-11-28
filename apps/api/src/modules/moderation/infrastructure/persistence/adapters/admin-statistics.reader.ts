import type { DataSource } from 'typeorm';
import type {
  AdminStatistics,
  AdminStatisticsReader
} from '../../../application/use-cases/get-admin-statistics.use-case.js';

export class TypeOrmAdminStatisticsReader implements AdminStatisticsReader {
  constructor(private readonly dataSource: DataSource) {}

  async count(from: Date, to: Date): Promise<AdminStatistics> {
    const [result] = await this.dataSource.query<AdminStatistics[]>(
      `SELECT
        (SELECT count(*)::int FROM users WHERE created_at >= $1 AND created_at < $2) AS users,
        (SELECT count(*)::int FROM events WHERE published_at >= $1 AND published_at < $2) AS events,
        (SELECT count(*)::int FROM event_participations
          WHERE entry_mode = 'REQUEST' AND created_at >= $1 AND created_at < $2) AS applications`,
      [from, to]
    );
    return result;
  }
}
