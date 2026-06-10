// src/hooks/use-resolve-inputs.ts
'use client';

import { useEffect, useState } from 'react';
import type { DomainTx, Network } from '@/domain/tx';
import type { BlockfrostTxUtxos, BlockfrostTxUtxoOutput } from '@/lib/types/blockfrost';
import { useAppStore } from '@/lib/store';
import { decomposeBech32Address } from '@/lib/utils/decompose-bech32-address';
import { mapWithConcurrency } from '@/lib/utils/async-pool';
import { fetchTransactionUtxosClient } from './use-blockfrost';

export type InputResolutionStatus =
  | 'idle'
  | 'loading'
  | 'partial'
  | 'complete'
  | 'error'
  | 'unavailable';

export type InputResolutionState = {
  status: InputResolutionStatus;
  resolvedCount: number;
  totalCount: number;
  error?: string;
};

const utxosCache = new Map<string, BlockfrostTxUtxos>();
const utxosInFlight = new Map<string, Promise<BlockfrostTxUtxos>>();
// Negative cache: remember recent failures so toggling tabs (which remounts this
// hook) doesn't immediately re-fire the same failing requests at Blockfrost —
// the exact behaviour that amplifies a rate-limit (429) burst. Entries expire so
// a transient failure still gets retried after the window.
const utxosErrorCache = new Map<string, { error: string; at: number }>();
const NEGATIVE_CACHE_TTL_MS = 60_000;

// Cap how many producer-tx UTXO fetches run at once. A consolidation tx can have
// hundreds of inputs from distinct parents; an unbounded fan-out would fire them
// all simultaneously and trip Blockfrost's rate limit.
const MAX_CONCURRENT_RESOLUTIONS = 8;

function cacheKey(network: Network, txId: string): string {
  return `${network}:${txId}`;
}

function lovelaceFromAmount(amount: BlockfrostTxUtxoOutput['amount']): bigint {
  for (const a of amount) {
    if (a.unit === 'lovelace') {
      try { return BigInt(a.quantity); } catch { return 0n; }
    }
  }
  return 0n;
}

function assetsFromAmount(amount: BlockfrostTxUtxoOutput['amount']): Array<{ policyId: string; assetName: string; quantity: bigint }> {
  const out: Array<{ policyId: string; assetName: string; quantity: bigint }> = [];
  for (const a of amount) {
    if (a.unit === 'lovelace') continue;
    // Blockfrost concatenates policyId (28 bytes = 56 hex) + assetName hex
    const policyId = a.unit.slice(0, 56);
    const assetName = a.unit.slice(56);
    let quantity: bigint;
    try { quantity = BigInt(a.quantity); } catch { quantity = 0n; }
    out.push({ policyId, assetName, quantity });
  }
  return out;
}

async function resolveOnce(network: Network, txId: string): Promise<BlockfrostTxUtxos | { error: string }> {
  const key = cacheKey(network, txId);
  const cached = utxosCache.get(key);
  if (cached) return cached;
  const inFlight = utxosInFlight.get(key);
  if (inFlight) return inFlight;
  const negative = utxosErrorCache.get(key);
  if (negative && Date.now() - negative.at < NEGATIVE_CACHE_TTL_MS) {
    return { error: negative.error };
  }
  const promise = (async () => {
    const res = await fetchTransactionUtxosClient(txId, network);
    if (!res.success) throw new Error(res.error);
    utxosCache.set(key, res.utxos);
    utxosErrorCache.delete(key);
    return res.utxos;
  })();
  utxosInFlight.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    utxosErrorCache.set(key, { error, at: Date.now() });
    return { error };
  } finally {
    utxosInFlight.delete(key);
  }
}

/**
 * Auto-resolve every input UTXO of `tx` via Blockfrost and write the populated
 * `resolved` field back into the store's parsedTx. Reuses a module-scope cache
 * so flipping tabs (or visiting the same tx again) doesn't re-fetch.
 */
export function useResolveInputs(tx: DomainTx | null): InputResolutionState {
  const network = useAppStore((s) => s.network);
  const [state, setState] = useState<InputResolutionState>({
    status: 'idle',
    resolvedCount: 0,
    totalCount: 0,
  });
  useEffect(() => {
    if (!tx) {
      setState({ status: 'idle', resolvedCount: 0, totalCount: 0 });
      return;
    }

    const totalRegular = tx.inputs.filter((i) => !i.isCollateral).length;
    const alreadyResolvedRegular = tx.inputs.filter((i) => !i.isCollateral && i.resolved?.value).length;

    if (totalRegular === 0) {
      setState({ status: 'complete', resolvedCount: 0, totalCount: 0 });
      return;
    }

    // Collect unique source-tx hashes that still need resolution
    const unresolved = tx.inputs.filter((i) => !i.resolved?.value);
    const uniqueTxIds = Array.from(new Set(unresolved.map((i) => i.txId)));

    if (uniqueTxIds.length === 0) {
      setState({ status: 'complete', resolvedCount: alreadyResolvedRegular, totalCount: totalRegular });
      return;
    }

    const cancelToken = { cancelled: false };

    setState({ status: 'loading', resolvedCount: alreadyResolvedRegular, totalCount: totalRegular });

    let unavailable = false;
    let lastError: string | undefined;

    mapWithConcurrency(uniqueTxIds, MAX_CONCURRENT_RESOLUTIONS, async (sourceTxId) => {
        const result = await resolveOnce(network, sourceTxId);
        if (cancelToken.cancelled) return;

        if ('error' in result) {
          if (result.error.toLowerCase().includes('static export')) unavailable = true;
          lastError = result.error;
          return;
        }

        // Atomically merge this source tx's outputs into matching inputs.
        // Functional setState avoids races between parallel callbacks.
        // Index outputs by output_index for O(1) lookup when many inputs share
        // the same producer tx.
        const outputByIndex = new Map<number, BlockfrostTxUtxoOutput>();
        for (const o of result.outputs) outputByIndex.set(o.output_index, o);
        let resolvedNow = 0;
        useAppStore.setState((s) => {
          const current = s.parsedTx;
          if (!current?.success || current.tx.id !== tx.id) return s;
          let anyChange = false;
          const nextInputs = current.tx.inputs.map((inp) => {
            if (inp.txId !== sourceTxId || inp.resolved?.value) return inp;
            const utxo = outputByIndex.get(inp.index);
            if (!utxo) return inp;
            anyChange = true;
            return {
              ...inp,
              resolved: {
                address: utxo.address,
                addressCreds: decomposeBech32Address(utxo.address),
                value: {
                  ada: lovelaceFromAmount(utxo.amount),
                  assets: assetsFromAmount(utxo.amount),
                },
              },
            };
          });
          resolvedNow = nextInputs.filter((i) => !i.isCollateral && i.resolved?.value).length;
          if (!anyChange) return s;
          return { parsedTx: { success: true, tx: { ...current.tx, inputs: nextInputs } } };
        });

        setState((prev) => ({
          ...prev,
          status: resolvedNow >= totalRegular ? 'complete' : 'partial',
          resolvedCount: resolvedNow,
          totalCount: totalRegular,
        }));
      }
    ).then(() => {
      if (cancelToken.cancelled) return;
      setState((prev) => {
        if (unavailable) {
          return { status: 'unavailable', resolvedCount: prev.resolvedCount, totalCount: totalRegular, error: lastError };
        }
        if (prev.resolvedCount >= totalRegular) {
          return { status: 'complete', resolvedCount: prev.resolvedCount, totalCount: totalRegular };
        }
        if (prev.resolvedCount > 0) {
          return { status: 'partial', resolvedCount: prev.resolvedCount, totalCount: totalRegular, error: lastError };
        }
        return { status: 'error', resolvedCount: 0, totalCount: totalRegular, error: lastError ?? 'Could not resolve inputs' };
      });
    });

    return () => {
      cancelToken.cancelled = true;
    };
    // Deliberately key only on the tx identity + network. The effect mutates
    // `tx.inputs` via the store, which would otherwise re-trigger this effect
    // and cancel in-flight fetches on every successful resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx?.id, network]);

  return state;
}
