export const DETAIL_CONCURRENCY = 5;

/**
 * Maps items through an async function with at most `limit` calls in flight.
 * Results keep input order. After the first rejection no new work starts,
 * and the returned promise rejects with that error.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  const workerCount = Math.min(Math.max(1, Math.floor(limit)), items.length);
  let nextIndex = 0;
  let failed = false;

  async function worker(): Promise<void> {
    while (!failed && nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
