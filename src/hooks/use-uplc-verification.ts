// src/hooks/use-uplc-verification.ts
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fetchScriptByHash, normalizeHash } from '@/lib/uplc-link/client';
import type { UplcLookup } from '@/lib/uplc-link/types';

interface UseUplcVerificationReturn {
  result: UplcLookup;
  refetch: () => void;
}

export function useUplcVerification(hash: string | undefined): UseUplcVerificationReturn {
  const setUplcCache = useAppStore(s => s.setUplcCache);
  const clearUplcCacheEntry = useAppStore(s => s.clearUplcCacheEntry);

  const normalized = hash ? normalizeHash(hash) : null;

  // Reactive subscription to the cache slice for this hash. Re-renders when the
  // cache entry is written, so we don't need local state for the result.
  const cached = useAppStore(s =>
    normalized ? (s.uplcCache[normalized] ?? null) : null,
  );

  const result: UplcLookup = !normalized
    ? { state: 'error', message: 'Invalid script hash' }
    : (cached ?? { state: 'loading' });

  const [reqId, setReqId] = useState(0);

  useEffect(() => {
    if (!normalized) return;

    // Read the latest cache value at effect-time (not via closure) so we don't
    // include `cached` as a dep — including it would cause the cleanup to abort
    // the in-flight fetch the moment the cache is updated by our own resolution.
    const existing = useAppStore.getState().uplcCache[normalized];
    if (existing && existing.state !== 'loading') return;

    const controller = new AbortController();
    let cancelled = false;

    fetchScriptByHash(normalized, controller.signal)
      .then(next => {
        if (cancelled) return;
        setUplcCache(normalized, next);
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Network error';
        setUplcCache(normalized, { state: 'error', message });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [normalized, reqId, setUplcCache]);

  const refetch = useCallback(() => {
    if (!normalized) return;
    clearUplcCacheEntry(normalized);
    setReqId(n => n + 1);
  }, [normalized, clearUplcCacheEntry]);

  return { result, refetch };
}
