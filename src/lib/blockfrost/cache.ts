// src/lib/blockfrost/cache.ts
import type { MultiNetworkSearchResponse, NetworkDetectionResponse } from './multi-network-search';
import type { BlockfrostTransaction } from '@/lib/types/blockfrost';
import type { ProtocolParamsSubset } from '@/lib/types/script-eval';

interface CacheEntry<T> {
  result: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache for Blockfrost API responses
 * Uses TTL-based expiration
 */
class BlockfrostCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();

  /**
   * Get cached result if available and not expired
   * @param key Cache key (will be normalized to lowercase)
   * @returns Cached result or null if not found/expired
   */
  get(key: string): T | null {
    const normalizedKey = key.toLowerCase().trim();
    const entry = this.cache.get(normalizedKey);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(normalizedKey);
      return null;
    }

    return entry.result;
  }

  /**
   * Store a result in cache with TTL
   * @param key Cache key (will be normalized to lowercase)
   * @param result The result to cache
   * @param ttlMs Time to live in milliseconds
   */
  set(key: string, result: T, ttlMs: number): void {
    const normalizedKey = key.toLowerCase().trim();
    const expiresAt = Date.now() + ttlMs;

    this.cache.set(normalizedKey, {
      result,
      expiresAt,
    });
  }

  /**
   * Check if key exists in cache and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries from cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size (number of entries)
   */
  size(): number {
    return this.cache.size;
  }
}

// TTL constants
export const CACHE_TTL_SUCCESS = 60 * 60 * 1000; // 1 hour for successful lookups
export const CACHE_TTL_NOT_FOUND = 5 * 60 * 1000; // 5 minutes for 404 results
export const CACHE_TTL_NETWORK_DETECTION = 60 * 60 * 1000; // 1 hour for network detection
export const CACHE_TTL_PROTOCOL_PARAMS = 4 * 60 * 60 * 1000; // 4 hours for protocol params

// Typed singleton instances
export const multiNetworkSearchCache = new BlockfrostCache<MultiNetworkSearchResponse>();
export const networkDetectionCache = new BlockfrostCache<NetworkDetectionResponse>();
export const transactionCache = new BlockfrostCache<{ transaction: BlockfrostTransaction; hex: string }>();
export const protocolParamsCache = new BlockfrostCache<ProtocolParamsSubset>();

// Backward compat alias — used by multi-network-search.ts
export const blockfrostCache = multiNetworkSearchCache;
