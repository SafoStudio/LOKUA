import type { UnitOfWork } from '../../../../common/index.js';
import type { EventLifecycleRepository } from '../ports/event-lifecycle.repository.js';

const batchSize = 100;

export class AdvanceEventLifecycleUseCase {
  constructor(
    private readonly events: EventLifecycleRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: () => Date
  ) {}

  async execute(): Promise<boolean> {
    const now = this.clock();
    const processed = await this.unitOfWork.run((tx) =>
      this.events.advanceDueEvents(now, batchSize, tx)
    );
    return processed === batchSize;
  }
}
