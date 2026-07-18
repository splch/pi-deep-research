/**
 * Run `items` through `worker` with at most `concurrency` in flight at once.
 * Results are returned in input order. A worker that throws yields a rejected
 * slot the caller can inspect; use mapSettled for the non-throwing variant.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));

  async function runner(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runner()));
  return results;
}

export interface SettledOk<R> {
  ok: true;
  value: R;
}
export interface SettledErr {
  ok: false;
  error: unknown;
}
export type Settled<R> = SettledOk<R> | SettledErr;

/** Like mapWithConcurrency, but a throwing worker becomes a { ok: false } slot instead of rejecting the whole run. */
export async function mapSettled<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<Settled<R>[]> {
  return mapWithConcurrency(items, concurrency, async (item, index) => {
    try {
      return { ok: true, value: await worker(item, index) } as Settled<R>;
    } catch (error) {
      return { ok: false, error } as Settled<R>;
    }
  });
}
