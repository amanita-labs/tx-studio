// src/lib/token-registry.ts

export interface TokenMetadata {
  subject: string;
  name: string;
  ticker?: string;
  decimals?: number;
  logo?: string; // base64 PNG
  description?: string;
  url?: string;
}

const REGISTRY_BASE = 'https://tokens.cardano.org/metadata';
const HIT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MISS_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CONCURRENCY = 5;
const MAX_TOKENS_PER_TX = 100;

// Module-level cache — survives across component mounts / tab switches
const cache = new Map<string, { entry: TokenMetadata | null; expiresAt: number }>();
const pending = new Map<string, Promise<TokenMetadata | null>>();

export function buildTokenSubject(policyId: string, assetName: string): string {
  return `${policyId}${assetName}`;
}

export function getCachedTokenMetadata(subject: string): TokenMetadata | null | undefined {
  const cached = cache.get(subject);
  if (!cached) return undefined; // not in cache
  if (Date.now() > cached.expiresAt) {
    cache.delete(subject);
    return undefined;
  }
  return cached.entry; // null = known miss, TokenMetadata = known hit
}

export async function fetchTokenMetadata(subject: string): Promise<TokenMetadata | null> {
  // Check cache first
  const cached = getCachedTokenMetadata(subject);
  if (cached !== undefined) return cached;

  // Dedup in-flight requests
  const inflight = pending.get(subject);
  if (inflight) return inflight;

  const promise = (async (): Promise<TokenMetadata | null> => {
    try {
      const res = await fetch(`${REGISTRY_BASE}/${subject}`);
      if (!res.ok) {
        cache.set(subject, { entry: null, expiresAt: Date.now() + MISS_TTL });
        return null;
      }
      const data = await res.json();
      const entry: TokenMetadata = {
        subject: data.subject ?? subject,
        name: data.name?.value ?? '',
        ticker: data.ticker?.value,
        decimals: data.decimals?.value,
        logo: data.logo?.value,
        description: data.description?.value,
        url: data.url?.value,
      };
      cache.set(subject, { entry, expiresAt: Date.now() + HIT_TTL });
      return entry;
    } catch (err) {
      console.warn(`[token-registry] Failed to fetch metadata for ${subject}:`, err);
      cache.set(subject, { entry: null, expiresAt: Date.now() + MISS_TTL });
      return null;
    } finally {
      pending.delete(subject);
    }
  })();

  pending.set(subject, promise);
  return promise;
}

async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function fetchTokenMetadataBatch(
  subjects: string[],
): Promise<Map<string, TokenMetadata | null>> {
  // Cap at MAX_TOKENS_PER_TX to stay within rate limits
  const toFetch = subjects.slice(0, MAX_TOKENS_PER_TX);

  const tasks = toFetch.map(
    (subject) => () => fetchTokenMetadata(subject),
  );

  const results = await withConcurrencyLimit(tasks, MAX_CONCURRENCY);

  const map = new Map<string, TokenMetadata | null>();
  toFetch.forEach((subject, i) => {
    map.set(subject, results[i]);
  });
  return map;
}
