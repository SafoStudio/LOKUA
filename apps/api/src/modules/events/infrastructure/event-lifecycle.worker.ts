import { logger } from '../../../common/index.js';

const pollingIntervalMs = 60_000;

export function startEventLifecycleWorker(processBatch: () => Promise<boolean>) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let activeRun: Promise<void> | undefined;

  async function run(): Promise<void> {
    try {
      let hasMore = true;
      while (!stopped && hasMore) {
        hasMore = await processBatch();
      }
    } catch (err) {
      logger.error({ err }, 'Event lifecycle processing failed');
    }
  }

  function tick(): void {
    activeRun = run().finally(() => {
      if (!stopped) timer = setTimeout(tick, pollingIntervalMs).unref();
    });
  }

  tick();

  return async (): Promise<void> => {
    stopped = true;
    clearTimeout(timer);
    await activeRun;
  };
}
