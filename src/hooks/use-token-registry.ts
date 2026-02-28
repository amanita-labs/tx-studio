// src/hooks/use-token-registry.ts
import { useState, useEffect, useMemo, useRef } from 'react';
import { DomainTx } from '@/domain/tx';
import {
  TokenMetadata,
  buildTokenSubject,
  fetchTokenMetadataBatch,
  getCachedTokenMetadata,
} from '@/lib/token-registry';

export function useTokenRegistry(tx: DomainTx): {
  getMetadata: (policyId: string, assetName: string) => TokenMetadata | null | undefined;
  isLoading: boolean;
} {
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fetchIdRef = useRef(0);

  // Collect all unique subjects from every part of the transaction
  const subjects = useMemo(() => {
    const set = new Set<string>();

    const addAssets = (assets: Array<{ policyId: string; assetName: string }>) => {
      for (const a of assets) {
        set.add(buildTokenSubject(a.policyId, a.assetName));
      }
    };

    for (const input of tx.inputs) {
      if (input.resolved?.value?.assets) addAssets(input.resolved.value.assets);
    }
    for (const output of tx.outputs) {
      addAssets(output.assets);
    }
    if (tx.mint) addAssets(tx.mint);
    if (tx.collateralReturn) addAssets(tx.collateralReturn.assets);

    return Array.from(set);
  }, [tx]);

  // Stable string key so same-content / different-ref arrays don't re-trigger
  const subjectKey = useMemo(() => subjects.join(','), [subjects]);

  useEffect(() => {
    if (subjects.length === 0) return;

    // Only fetch subjects not yet cached
    const uncached = subjects.filter((s) => getCachedTokenMetadata(s) === undefined);

    // Warm-cache remount: everything is already cached, just bump version
    // so the render picks up cached data via getMetadata
    if (uncached.length === 0) {
      setVersion((v) => v + 1);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);

    fetchTokenMetadataBatch(uncached).then(() => {
      // Always bump version so getMetadata re-derives with fresh cache
      setVersion((v) => v + 1);
      // Only clear loading if this is still the latest fetch
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    });
  }, [subjectKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const getMetadata = useMemo(() => {
    // version is captured to re-derive after fetch completes
    void version;
    return (policyId: string, assetName: string): TokenMetadata | null | undefined => {
      const subject = buildTokenSubject(policyId, assetName);
      return getCachedTokenMetadata(subject);
    };
  }, [version]);

  return { getMetadata, isLoading };
}
