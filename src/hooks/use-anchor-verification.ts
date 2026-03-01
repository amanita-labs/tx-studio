// src/hooks/use-anchor-verification.ts
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DomainTx } from '@/domain/tx';

export type AnchorVerificationStatus = 'pending' | 'loading' | 'fetched' | 'error';

export type AnchorVerificationResult = {
  status: AnchorVerificationStatus;
  computedHash?: string;
  error?: string;
};

/**
 * Extracts all unique anchor URLs from a DomainTx.
 */
function extractAnchorUrls(tx: DomainTx): string[] {
  const urls = new Set<string>();

  // Governance proposals
  if (tx.governance?.proposals) {
    for (const proposal of tx.governance.proposals) {
      const d = proposal.details as Record<string, unknown>;
      // Proposal anchor
      const anchor = d.anchor as Record<string, unknown> | undefined;
      const raw = d.raw as Record<string, unknown> | undefined;
      const rawAnchor = raw?.anchor as Record<string, unknown> | undefined;
      const anchorUrl = d.anchorUrl ?? anchor?.url ?? rawAnchor?.anchor_url;
      if (anchorUrl && typeof anchorUrl === 'string') urls.add(anchorUrl);

      // NewConstitution constitution anchor
      const constitution = d.constitution as Record<string, unknown> | undefined;
      const constitutionUrl = d.constitutionUrl ?? constitution?.url;
      if (constitutionUrl && typeof constitutionUrl === 'string') urls.add(constitutionUrl);
    }
  }

  // DRep votes
  if (tx.governance?.drepVotes) {
    for (const vote of tx.governance.drepVotes) {
      if (vote.anchor?.url) urls.add(vote.anchor.url);
    }
  }

  // Committee votes
  if (tx.governance?.committeeVotes) {
    for (const vote of tx.governance.committeeVotes) {
      if (vote.anchor?.url) urls.add(vote.anchor.url);
    }
  }

  // Certificates
  if (tx.certs) {
    for (const cert of tx.certs) {
      const d = cert.details as Record<string, unknown>;
      const url =
        d.anchorUrl ??
        (d.anchor as Record<string, unknown> | undefined)?.url;
      if (url && typeof url === 'string') urls.add(url);
    }
  }

  return Array.from(urls);
}

export function useAnchorVerification(tx: DomainTx) {
  const urls = useMemo(() => extractAnchorUrls(tx), [tx]);
  const [results, setResults] = useState<Map<string, AnchorVerificationResult>>(new Map());

  useEffect(() => {
    if (urls.length === 0) return;

    const controller = new AbortController();

    // Initialize all as loading
    setResults(prev => {
      const next = new Map(prev);
      for (const url of urls) {
        next.set(url, { status: 'loading' });
      }
      return next;
    });

    // Fire concurrent fetches
    for (const url of urls) {
      fetch('/api/anchor-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      })
        .then(res => res.json())
        .then((data: { success: boolean; hash?: string; error?: string }) => {
          if (controller.signal.aborted) return;
          setResults(prev => {
            const next = new Map(prev);
            if (data.success && data.hash) {
              next.set(url, { status: 'fetched', computedHash: data.hash });
            } else {
              next.set(url, { status: 'error', error: data.error ?? 'Unknown error' });
            }
            return next;
          });
        })
        .catch(err => {
          if (controller.signal.aborted) return;
          setResults(prev => {
            const next = new Map(prev);
            next.set(url, { status: 'error', error: err instanceof Error ? err.message : 'Fetch failed' });
            return next;
          });
        });
    }

    return () => controller.abort();
  }, [urls]);

  const getVerification = useCallback(
    (url: string): AnchorVerificationResult => {
      return results.get(url) ?? { status: 'pending' };
    },
    [results],
  );

  return { getVerification };
}
