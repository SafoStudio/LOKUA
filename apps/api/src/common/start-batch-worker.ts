import { logger } from './logger.js';

export function startBatchWorker(
  processBatch: () => Promise<boolean>,
  pollingIntervalMs: number,
  errorMessage: string
) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let activeRun: Promise<void> | undefined;

  async function run(): Promise<void> {
    try {
      let hasMore = true;
      while (!stopped && hasMore) hasMore = await processBatch();
    } catch (err) {
      logger.error({ err }, errorMessage);
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
