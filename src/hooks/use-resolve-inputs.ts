// src/hooks/use-resolve-inputs.ts
'use client';

import { useEffect, useState } from 'react';
import type { DomainTx, Network } from '@/domain/tx';
import type { BlockfrostTxUtxos, BlockfrostTxUtxoOutput } from '@/lib/types/blockfrost';
import { useAppStore } from '@/lib/store';
import { decomposeBech32Address } from '@/lib/utils/decompose-bech32-address';
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
  const promise = (async () => {
    const res = await fetchTransactionUtxosClient(txId, network);
    if (!res.success) throw new Error(res.error);
    utxosCache.set(key, res.utxos);
    return res.utxos;
  })();
  utxosInFlight.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
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

    Promise.all(
      uniqueTxIds.map(async (sourceTxId) => {
        const result = await resolveOnce(network, sourceTxId);
        if (cancelToken.cancelled) return;

        if ('error' in result) {
          if (result.error.toLowerCase().includes('static export')) unavailable = true;
          lastError = result.error;
          return;
        }

        // Atomically merge this source tx's outputs into matching inputs.
        // Functional setState avoids races between parallel callbacks.
        let resolvedNow = 0;
        useAppStore.setState((s) => {
          const current = s.parsedTx;
          if (!current?.success || current.tx.id !== tx.id) return s;
          let anyChange = false;
          const nextInputs = current.tx.inputs.map((inp) => {
            if (inp.txId !== sourceTxId || inp.resolved?.value) return inp;
            const utxo = result.outputs.find((o) => o.output_index === inp.index);
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
      })
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
