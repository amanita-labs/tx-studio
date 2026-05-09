'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { CollectedAnchor } from '@/lib/governance-metadata/collect-anchors';
import type { ResolvedGovernanceMetadata } from '@/lib/governance-metadata/types';
import { validateGovernanceMetadata } from '@/lib/governance-metadata/validator';
import { useCSLWorker } from '@/hooks/use-csl-worker';

type FetchResponse =
  | {
      success: true;
      rawHex: string;
      document: Record<string, unknown>;
      computedHash: string;
      hashOk: boolean;
    }
  | { success: false; error: string };

export function useGovernanceMetadata() {
  const setGovernanceMetadata = useAppStore((s) => s.setGovernanceMetadata);
  const network = useAppStore((s) => s.network);
  const { verifyCip169 } = useCSLWorker();

  const resolveOne = useCallback(
    async (anchor: CollectedAnchor, txHex: string): Promise<void> => {
      setGovernanceMetadata(anchor.key, { status: 'fetching' });

      let fetched: FetchResponse;
      try {
        const res = await fetch('/api/governance-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: anchor.url, dataHash: anchor.hash }),
        });
        fetched = await res.json();
      } catch (err) {
        setGovernanceMetadata(anchor.key, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Fetch failed',
        });
        return;
      }

      if (!fetched.success) {
        setGovernanceMetadata(anchor.key, { status: 'error', error: fetched.error });
        return;
      }

      const validated = await validateGovernanceMetadata({
        rawHex: fetched.rawHex,
        document: fetched.document,
        computedHash: fetched.computedHash,
        dataHash: anchor.hash,
        hashOk: fetched.hashOk,
        network,
      });

      const result: ResolvedGovernanceMetadata = { ...validated };

      if (validated.hasCip169Extension) {
        result.cip169 = { status: 'verifying' };
        setGovernanceMetadata(anchor.key, { status: 'resolved', result });
        try {
          const binding = await verifyCip169(fetched.document, txHex);
          setGovernanceMetadata(anchor.key, {
            status: 'resolved',
            result: { ...result, cip169: binding },
          });
        } catch (err) {
          setGovernanceMetadata(anchor.key, {
            status: 'resolved',
            result: {
              ...result,
              cip169: {
                status: 'error',
                error: err instanceof Error ? err.message : 'CIP-169 verify failed',
              },
            },
          });
        }
        return;
      }

      setGovernanceMetadata(anchor.key, { status: 'resolved', result });
    },
    [network, setGovernanceMetadata, verifyCip169],
  );

  const resolveAll = useCallback(
    async (anchors: CollectedAnchor[], txHex: string): Promise<void> => {
      await Promise.all(anchors.map((a) => resolveOne(a, txHex)));
    },
    [resolveOne],
  );

  return { resolveOne, resolveAll };
}
