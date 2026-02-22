// src/lib/blockfrost/multi-network-search.ts
import { Network } from '@/domain/tx';
import { fetchTransactionByHash, checkTransactionExists } from './client';
import { BlockfrostTransaction } from '@/lib/types/blockfrost';

export interface MultiNetworkSearchResult {
  success: true;
  network: Network;
  hex: string;
  metadata: BlockfrostTransaction;
}

export interface MultiNetworkSearchError {
  success: false;
  error: string;
  searchedNetworks: Network[];
}

export type MultiNetworkSearchResponse = MultiNetworkSearchResult | MultiNetworkSearchError;

export interface NetworkDetectionResult { success: true; network: Network }
export interface NetworkDetectionError { success: false; error: string; searchedNetworks: Network[] }
export type NetworkDetectionResponse = NetworkDetectionResult | NetworkDetectionError;

/**
 * Search for a transaction across all networks sequentially
 * Order: mainnet → preview → preprod
 * Stops on first successful result
 */
export async function searchTransactionAcrossNetworks(
  hash: string
): Promise<MultiNetworkSearchResponse> {
  const networks: Network[] = ['mainnet', 'preview', 'preprod'];
  const searchedNetworks: Network[] = [];
  const errors: Array<{ network: Network; error: string }> = [];

  for (const network of networks) {
    searchedNetworks.push(network);
    
    try {
      const result = await fetchTransactionByHash(network, hash);
      
      // Success! Return immediately
      return {
        success: true,
        network,
        hex: result.hex,
        metadata: result.transaction,
      };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = error?.status_code;
      
      // 404 means transaction not found on this network - continue searching
      if (statusCode === 404) {
        errors.push({ network, error: 'Transaction not found' });
        continue; // Try next network
      }
      
      // Rate limiting (429) - continue to next network
      if (statusCode === 429) {
        errors.push({ network, error: 'Rate limit exceeded' });
        continue; // Try next network
      }
      
      // Configuration errors (403, missing API key) - log but continue
      if (statusCode === 403 || errorMessage.includes('project ID') || errorMessage.includes('API key')) {
        errors.push({ network, error: 'API configuration error' });
        continue; // Try next network
      }
      
      // Other errors - log but continue searching
      errors.push({ network, error: errorMessage });
      continue;
    }
  }

  // Transaction not found on any network
  const errorMessages = errors.map(e => `${e.network}: ${e.error}`).join('; ');
  return {
    success: false,
    error: `Transaction not found on mainnet, preview, or preprod networks. Errors: ${errorMessages}`,
    searchedNetworks,
  };
}

/**
 * Detect which network a transaction targets by checking if its first input exists on-chain.
 * Uses lightweight metadata-only check (no CBOR fetch).
 * Order: mainnet → preview → preprod
 */
export async function detectNetworkFromInputs(
  inputTxIds: string[]
): Promise<NetworkDetectionResponse> {
  if (!inputTxIds.length) {
    return { success: false, error: 'No input transaction IDs provided', searchedNetworks: [] };
  }

  const txId = inputTxIds[0];
  const networks: Network[] = ['mainnet', 'preview', 'preprod'];
  const searchedNetworks: Network[] = [];
  const errors: Array<{ network: Network; error: string }> = [];

  for (const network of networks) {
    searchedNetworks.push(network);

    try {
      const exists = await checkTransactionExists(network, txId);
      if (exists) {
        return { success: true, network };
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = error?.status_code;

      if (statusCode === 429) {
        errors.push({ network, error: 'Rate limit exceeded' });
        continue;
      }

      if (statusCode === 403 || errorMessage.includes('project ID') || errorMessage.includes('API key')) {
        errors.push({ network, error: 'API configuration error' });
        continue;
      }

      errors.push({ network, error: errorMessage });
      continue;
    }
  }

  const errorMessages = errors.map(e => `${e.network}: ${e.error}`).join('; ');
  return {
    success: false,
    error: errors.length
      ? `Input tx not found. Errors: ${errorMessages}`
      : 'Input transaction not found on any network',
    searchedNetworks,
  };
}
