// src/lib/blockfrost/utxos.ts
import { Network } from '@/domain/tx';
import { BlockfrostTxUtxos } from '@/lib/types/blockfrost';
import { createBlockfrostClient } from './client';
import { transactionUtxosCache, CACHE_TTL_SUCCESS } from './cache';

/**
 * Fetch the UTXOs of a transaction from Blockfrost.
 * Returns the producing transaction's outputs — `outputs[input.index]` is the
 * UTXO actually consumed when this tx is referenced as an input.
 */
export async function fetchTransactionUtxos(
  network: Network,
  hash: string
): Promise<BlockfrostTxUtxos> {
  const cacheKey = `${network}:${hash}`;
  const cached = transactionUtxosCache.get(cacheKey);
  if (cached) return cached;

  const api = createBlockfrostClient(network);

  try {
    const raw = await api.txsUtxos(hash);
    const result: BlockfrostTxUtxos = {
      hash: raw.hash,
      outputs: raw.outputs.map((o) => ({
        address: o.address,
        amount: o.amount.map((a) => ({ unit: a.unit, quantity: a.quantity })),
        output_index: o.output_index,
        data_hash: o.data_hash ?? null,
        inline_datum: o.inline_datum ?? null,
        collateral: o.collateral ?? false,
        reference_script_hash: o.reference_script_hash ?? null,
      })),
    };
    transactionUtxosCache.set(cacheKey, result, CACHE_TTL_SUCCESS);
    return result;
  } catch (error: unknown) {
    const e = error as { status_code?: number; message?: string };
    if (e?.status_code === 404) throw new Error('Transaction not found');
    if (e?.status_code === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (e?.status_code === 403) throw new Error('Blockfrost API key invalid or insufficient permissions');
    if (e?.status_code === 400) throw new Error(`Invalid request: ${e.message || 'Bad request'}`);
    if (error instanceof Error) throw error;
    if (e?.message) throw new Error(`Blockfrost API error: ${e.message}`);
    throw new Error('Failed to fetch transaction UTXOs');
  }
}
