import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startEventLifecycleWorker } from '../../../src/modules/events/infrastructure/event-lifecycle.worker.js';

describe('event lifecycle worker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('drains full batches immediately and retries a failed batch on the next poll', async () => {
    const processBatch = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('Database unavailable'))
      .mockResolvedValue(false);
    const stop = startEventLifecycleWorker(processBatch);
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(processBatch).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(59_999);
      expect(processBatch).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(processBatch).toHaveBeenCalledTimes(3);
    } finally {
      await stop();
    }
  });

  it('waits for the active batch on shutdown without starting another', async () => {
    let finishBatch!: (hasMore: boolean) => void;
    const batch = new Promise<boolean>((resolve) => {
      finishBatch = resolve;
    });
    const processBatch = vi.fn(() => batch);
    const stop = startEventLifecycleWorker(processBatch);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(processBatch).toHaveBeenCalledTimes(1);

    const stopped = vi.fn();
    const shutdown = stop().then(stopped);
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).not.toHaveBeenCalled();
    finishBatch(true);
    await shutdown;

    await vi.advanceTimersByTimeAsync(60_000);
    expect(stopped).toHaveBeenCalledOnce();
    expect(processBatch).toHaveBeenCalledTimes(1);
  });
});
