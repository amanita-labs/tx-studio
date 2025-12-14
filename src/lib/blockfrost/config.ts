// src/lib/blockfrost/config.ts
import { Network } from '@/domain/tx';

/**
 * Blockfrost configuration
 * Maps networks to their corresponding Blockfrost project ID environment variables
 */

export interface BlockfrostConfig {
  network: Network;
  envVarName: string;
}

export const BLOCKFROST_CONFIG: Record<Network, BlockfrostConfig> = {
  mainnet: {
    network: 'mainnet',
    envVarName: 'BLOCKFROST_MAINNET_PROJECT_ID',
  },
  preprod: {
    network: 'preprod',
    envVarName: 'BLOCKFROST_PREPROD_PROJECT_ID',
  },
  preview: {
    network: 'preview',
    envVarName: 'BLOCKFROST_PREVIEW_PROJECT_ID',
  },
};

/**
 * Get Blockfrost project ID for a given network
 */
export function getBlockfrostProjectId(network: Network): string | null {
  const config = BLOCKFROST_CONFIG[network];
  if (!config) {
    return null;
  }

  const projectId = process.env[config.envVarName];
  return projectId || null;
}

/**
 * Validate that a transaction hash is in the correct format
 * Cardano transaction hashes are 64 hex characters
 */
export function isValidTransactionHash(hash: string): boolean {
  // Remove any whitespace
  const trimmed = hash.trim();
  
  // Must be exactly 64 hex characters
  if (trimmed.length !== 64) {
    return false;
  }
  
  // Must be valid hexadecimal
  return /^[0-9a-fA-F]{64}$/.test(trimmed);
}
