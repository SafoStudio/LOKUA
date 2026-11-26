import { startBatchWorker } from '../../../common/start-batch-worker.js';

export function startEventLifecycleWorker(processBatch: () => Promise<boolean>) {
  return startBatchWorker(processBatch, 60_000, 'Event lifecycle processing failed');
}
