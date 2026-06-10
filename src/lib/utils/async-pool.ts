// src/lib/utils/async-pool.ts

/**
 * Run `fn` over `items` with at most `limit` concurrent in-flight calls.
 * Used to bound fan-out fetches (e.g. resolving input UTXOs / checking spent
 * status) so a tx with many distinct sources doesn't fire every request at
 * once and trip Blockfrost's rate limit.
 */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
}
