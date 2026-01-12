// src/lib/blockfrost/client.ts
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { Network } from '@/domain/tx';
import { getBlockfrostProjectId } from './config';
import { BlockfrostTransaction } from '@/lib/types/blockfrost';

/**
 * Create a Blockfrost API client for the specified network
 */
export function createBlockfrostClient(network: Network): BlockFrostAPI {
  const projectId = getBlockfrostProjectId(network);
  
  if (!projectId) {
    throw new Error(
      `Blockfrost project ID not configured for network: ${network}. ` +
      `Please set ${getBlockfrostProjectIdEnvVarName(network)} environment variable.`
    );
  }

  return new BlockFrostAPI({
    projectId,
  });
}

/**
 * Get the environment variable name for a network's project ID
 */
function getBlockfrostProjectIdEnvVarName(network: Network): string {
  const envVarNames: Record<Network, string> = {
    mainnet: 'BLOCKFROST_MAINNET_PROJECT_ID',
    preprod: 'BLOCKFROST_PREPROD_PROJECT_ID',
    preview: 'BLOCKFROST_PREVIEW_PROJECT_ID',
  };
  
  return envVarNames[network];
}

/**
 * Fetch transaction by hash from Blockfrost
 * Returns both transaction metadata and CBOR hex
 */
export async function fetchTransactionByHash(
  network: Network,
  hash: string
): Promise<{ transaction: BlockfrostTransaction; hex: string }> {
  // Fetch transaction metadata first to validate it exists
  const api = createBlockfrostClient(network);
  
  try {
    const transaction = await api.txs(hash);
    
    // Then fetch the CBOR hex
    const hex = await fetchTransactionHex(network, hash);

    return {
      transaction,
      hex,
    };
  } catch (error: any) {
    // Handle Blockfrost SDK errors
    if (error?.status_code === 404) {
      throw new Error('Transaction not found');
    }
    if (error?.status_code === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error?.status_code === 403) {
      throw new Error('Blockfrost API key invalid or insufficient permissions');
    }
    if (error?.status_code === 400) {
      throw new Error(`Invalid request: ${error.message || 'Bad request'}`);
    }
    
    // Re-throw if it's already an Error instance
    if (error instanceof Error) {
      throw error;
    }
    
    // Handle SDK error objects
    if (error?.message) {
      throw new Error(`Blockfrost API error: ${error.message}`);
    }
    
    throw new Error('Failed to fetch transaction');
  }
}

/**
 * Fetch transaction CBOR hex by hash
 * Uses Blockfrost SDK's txsCbor method
 */
export async function fetchTransactionHex(
  network: Network,
  hash: string
): Promise<string> {
  const api = createBlockfrostClient(network);
  
  try {
    // Use the SDK's txsCbor method which returns { cbor: "hex_string" }
    const result = await api.txsCbor(hash);
    
    if (!result || !result.cbor) {
      throw new Error('Unexpected response format from Blockfrost API: missing cbor field');
    }
    
    return result.cbor;
  } catch (error: any) {
    // Handle Blockfrost SDK errors
    if (error?.status_code === 404) {
      throw new Error('Transaction not found');
    }
    if (error?.status_code === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error?.status_code === 403) {
      throw new Error('Blockfrost API key invalid or insufficient permissions');
    }
    if (error?.status_code === 400) {
      throw new Error(`Invalid request: ${error.message || 'Bad request'}`);
    }
    
    // Re-throw if it's already an Error instance
    if (error instanceof Error) {
      throw error;
    }
    
    // Handle SDK error objects
    if (error?.message) {
      throw new Error(`Blockfrost API error: ${error.message}`);
    }
    
    throw new Error('Failed to fetch transaction hex');
  }
}

