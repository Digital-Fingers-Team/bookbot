/**
 * Bounded-concurrency runner (a tiny `p-limit`). Returns a function that runs at
 * most `maxConcurrency` tasks at once; extra tasks queue and start as slots free.
 */
export function createLimiter(maxConcurrency: number) {
  const max = Math.max(1, Math.floor(maxConcurrency));
  const queue: Array<() => void> = [];
  let active = 0;

  const pump = () => {
    while (active < max && queue.length > 0) {
      const start = queue.shift();
      start?.();
    }
  };

  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1;
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            pump();
          });
      };

      queue.push(start);
      pump();
    });
  };
}

/**
 * Map over items running at most `maxConcurrency` workers at a time. Resolves
 * once every item has been processed.
 */
export async function mapWithConcurrency<T>(
  items: readonly T[],
  maxConcurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const limit = createLimiter(maxConcurrency);
  await Promise.all(items.map((item, index) => limit(() => worker(item, index))));
}
