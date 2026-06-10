// src/lib/blockfrost/address-utxos.ts
import { Network } from '@/domain/tx';
import { BlockfrostAddressUtxoRef } from '@/lib/types/blockfrost';
import { createBlockfrostClient } from './client';
import { addressUtxosCache, CACHE_TTL_ADDRESS_UTXOS } from './cache';

/**
 * Fetch the current unspent UTXO references at an address, reduced to
 * `{ tx_hash, output_index }`. Used to decide whether a given input UTXO is
 * still unspent (present in this set) or has been spent elsewhere (absent) —
 * the off-chain / draft-transaction case. Fetches all pages so membership
 * checks are accurate for addresses with more than one page of UTXOs.
 */
export async function fetchAddressUtxoRefs(
  network: Network,
  address: string
): Promise<BlockfrostAddressUtxoRef[]> {
  const cacheKey = `${network}:${address}`;
  const cached = addressUtxosCache.get(cacheKey);
  if (cached) return cached;

  const api = createBlockfrostClient(network);

  try {
    const raw = await api.addressesUtxosAll(address);
    const refs: BlockfrostAddressUtxoRef[] = raw.map((u) => ({
      tx_hash: u.tx_hash,
      output_index: u.output_index,
    }));
    addressUtxosCache.set(cacheKey, refs, CACHE_TTL_ADDRESS_UTXOS);
    return refs;
  } catch (error: unknown) {
    const e = error as { status_code?: number; message?: string };
    // 404 = address has never appeared on-chain → it holds no UTXOs.
    if (e?.status_code === 404) {
      addressUtxosCache.set(cacheKey, [], CACHE_TTL_ADDRESS_UTXOS);
      return [];
    }
    if (e?.status_code === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (e?.status_code === 403) throw new Error('Blockfrost API key invalid or insufficient permissions');
    if (e?.status_code === 400) throw new Error(`Invalid request: ${e.message || 'Bad request'}`);
    if (error instanceof Error) throw error;
    if (e?.message) throw new Error(`Blockfrost API error: ${e.message}`);
    throw new Error('Failed to fetch address UTXOs');
  }
}
