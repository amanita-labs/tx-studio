// src/lib/blockfrost/cache.ts
import { MultiNetworkSearchResponse } from './multi-network-search';

interface CacheEntry {
  result: MultiNetworkSearchResponse;
  expiresAt: number;
}

/**
 * Simple in-memory cache for Blockfrost API responses
 * Uses TTL-based expiration
 */
class BlockfrostCache {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Get cached result if available and not expired
   * @param hash Transaction hash (will be normalized to lowercase)
   * @returns Cached result or null if not found/expired
   */
  get(hash: string): MultiNetworkSearchResponse | null {
    const key = hash.toLowerCase().trim();
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Store a result in cache with TTL
   * @param hash Transaction hash (will be normalized to lowercase)
   * @param result The result to cache
   * @param ttlMs Time to live in milliseconds
   */
  set(hash: string, result: MultiNetworkSearchResponse, ttlMs: number): void {
    const key = hash.toLowerCase().trim();
    const expiresAt = Date.now() + ttlMs;

    this.cache.set(key, {
      result,
      expiresAt,
    });
  }

  /**
   * Check if hash exists in cache and is not expired
   * @param hash Transaction hash
   * @returns true if cached and not expired
   */
  has(hash: string): boolean {
    return this.get(hash) !== null;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries from cache
   * Can be called periodically to clean up
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

// Export singleton instance
export const blockfrostCache = new BlockfrostCache();

// TTL constants
export const CACHE_TTL_SUCCESS = 60 * 60 * 1000; // 1 hour for successful lookups
export const CACHE_TTL_NOT_FOUND = 5 * 60 * 1000; // 5 minutes for 404 results
