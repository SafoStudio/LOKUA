import { AppError } from '../../../../common/index.js';

export interface AdminStatistics {
  users: number;
  events: number;
  applications: number;
}

export interface AdminStatisticsReader {
  count(from: Date, to: Date): Promise<AdminStatistics>;
}

export class GetAdminStatisticsUseCase {
  constructor(private readonly statistics: AdminStatisticsReader) {}

  execute(from: Date, to: Date): Promise<AdminStatistics> {
    if (from >= to) throw new AppError('Початок періоду має бути раніше за кінець', 400);
    return this.statistics.count(from, to);
  }
}
