// src/hooks/use-input-spent-status.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DomainTx, Network } from '@/domain/tx';
import { useAppStore } from '@/lib/store';
import { mapWithConcurrency } from '@/lib/utils/async-pool';
import { fetchAddressUtxosClient } from './use-blockfrost';

export type SpentStatus = 'spent' | 'unspent' | 'checking' | 'unknown';

/** Stable per-input key: producing-tx hash + output index. */
export function spentKey(txId: string, index: number): string {
  return `${txId}#${index}`;
}

const MAX_CONCURRENT_LOOKUPS = 8;
const NEGATIVE_CACHE_TTL_MS = 60_000;

// network:address -> set of "txhash#index" currently unspent at that address.
const addrUtxoSetCache = new Map<string, Set<string>>();
const addrInFlight = new Map<string, Promise<Set<string>>>();
const addrErrorCache = new Map<string, { error: string; at: number }>();

async function fetchAddrUtxoSet(
  network: Network,
  address: string
): Promise<Set<string> | { error: string }> {
  const key = `${network}:${address}`;
  const cached = addrUtxoSetCache.get(key);
  if (cached) return cached;
  const inFlight = addrInFlight.get(key);
  if (inFlight) return inFlight;
  const negative = addrErrorCache.get(key);
  if (negative && Date.now() - negative.at < NEGATIVE_CACHE_TTL_MS) {
    return { error: negative.error };
  }
  const promise = (async () => {
    const res = await fetchAddressUtxosClient(address, network);
    if (!res.success) throw new Error(res.error);
    const set = new Set(res.utxos.map((u) => spentKey(u.tx_hash, u.output_index)));
    addrUtxoSetCache.set(key, set);
    addrErrorCache.delete(key);
    return set;
  })();
  addrInFlight.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    addrErrorCache.set(key, { error, at: Date.now() });
    return { error };
  } finally {
    addrInFlight.delete(key);
  }
}

/**
 * Determine, per input, whether the consumed UTXO has been spent or is still
 * unspent — keyed by `spentKey(txId, index)`.
 *
 * - On-chain tx: it has already consumed all of its inputs, so every input is
 *   `spent`. No Blockfrost calls.
 * - Off-chain (draft) tx: an input is only `spent` if *another* tx already
 *   consumed that UTXO. We check membership in the input address's current UTXO
 *   set (one lookup per unique address, deduped / concurrency-capped /
 *   negative-cached). Depends on `useResolveInputs` having populated input
 *   addresses; inputs without a resolved address yet read as `checking`.
 */
type Overrides = { forTxId: string | null; statuses: Map<string, SpentStatus> };

export function useInputSpentStatus(tx: DomainTx | null): Map<string, SpentStatus> {
  const isOnChain = useAppStore((s) => s.isOnChain);
  const network = useAppStore((s) => s.network);
  // Async off-chain lookup results, scoped to the tx they were computed for so
  // a stale result never leaks onto a different transaction.
  const [overrides, setOverrides] = useState<Overrides>({ forTxId: null, statuses: new Map() });

  // Base map is a pure derivation of (tx, isOnChain) — computed during render,
  // no effect needed: on-chain → every input 'spent'; off-chain → 'checking'
  // until the async lookup resolves it.
  const base = useMemo(() => {
    const map = new Map<string, SpentStatus>();
    if (!tx) return map;
    for (const inp of tx.inputs) {
      map.set(spentKey(inp.txId, inp.index), isOnChain ? 'spent' : 'checking');
    }
    return map;
  }, [tx, isOnChain]);

  // Off-chain inputs: look up each unique input address's current UTXO set and
  // decide spent vs unspent by membership. `tx` gets a new identity each time
  // useResolveInputs writes a resolved address, so this re-runs as they fill in.
  useEffect(() => {
    if (!tx || isOnChain) return;

    const inputsWithAddr = tx.inputs.filter((i) => i.resolved?.address);
    const uniqueAddrs = Array.from(new Set(inputsWithAddr.map((i) => i.resolved!.address!)));
    if (uniqueAddrs.length === 0) return;

    const cancel = { cancelled: false };

    mapWithConcurrency(uniqueAddrs, MAX_CONCURRENT_LOOKUPS, async (addr) => {
      const result = await fetchAddrUtxoSet(network, addr);
      if (cancel.cancelled) return;
      setOverrides((prev) => {
        const carry = prev.forTxId === tx.id ? prev.statuses : new Map<string, SpentStatus>();
        const next = new Map(carry);
        for (const inp of tx.inputs) {
          if (inp.resolved?.address !== addr) continue;
          const k = spentKey(inp.txId, inp.index);
          if ('error' in result) {
            next.set(k, 'unknown');
          } else {
            next.set(k, result.has(k) ? 'unspent' : 'spent');
          }
        }
        return { forTxId: tx.id, statuses: next };
      });
    });

    return () => {
      cancel.cancelled = true;
    };
  }, [tx, isOnChain, network]);

  return useMemo(() => {
    if (!tx || overrides.forTxId !== tx.id) return base;
    const merged = new Map(base);
    for (const [k, v] of overrides.statuses) {
      if (merged.has(k)) merged.set(k, v);
    }
    return merged;
  }, [base, overrides, tx]);
}
