// src/lib/types/block-explorer.ts
import { Network } from '@/domain/tx';

export type BlockExplorerId = 'cardanoscan' | 'cexplorer';

export interface BlockExplorer {
  id: BlockExplorerId;
  name: string;
  // Network-specific base URLs
  networks: {
    mainnet: string;
    preview: string;
    preprod: string;
    testnet: string;
  };
  // URL templates for different types of queries
  urls: {
    address: string;
    transaction: string;
    stakePool: string;
    epoch: string;
    slot: string;
  };
}

export const BLOCK_EXPLORERS: Record<BlockExplorerId, BlockExplorer> = {
  cardanoscan: {
    id: 'cardanoscan',
    name: 'Cardanoscan',
    networks: {
      mainnet: 'https://cardanoscan.io',
      preview: 'https://preview.cardanoscan.io',
      preprod: 'https://preprod.cardanoscan.io',
      testnet: 'https://testnet.cardanoscan.io',
    },
    urls: {
      address: '/address/{address}',
      transaction: '/transaction/{txHash}',
      stakePool: '/pool/{poolId}',
      epoch: '/epoch/{epoch}',
      slot: '/slot/{slot}',
    },
  },
  cexplorer: {
    id: 'cexplorer',
    name: 'CExplorer',
    networks: {
      mainnet: 'https://cexplorer.io',
      preview: 'https://preview.cexplorer.io',
      preprod: 'https://preprod.cexplorer.io',
      testnet: 'https://testnet.cexplorer.io',
    },
    urls: {
      address: '/address/{address}',
      transaction: '/tx/{txHash}',
      stakePool: '/pool/{poolId}',
      epoch: '/epoch/{epoch}',
      slot: '/slot/{slot}',
    },
  },
};

export const DEFAULT_BLOCK_EXPLORER: BlockExplorerId = 'cardanoscan';

// Helper function to generate URLs with network support
export function getExplorerUrl(
  explorerId: BlockExplorerId,
  network: Network,
  type: keyof BlockExplorer['urls'],
  params: Record<string, string>
): string {
  const explorer = BLOCK_EXPLORERS[explorerId];
  const baseUrl = explorer.networks[network];
  let url = baseUrl + explorer.urls[type];
  
  // Replace placeholders with actual values
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`{${key}}`, value);
  });
  
  return url;
}
