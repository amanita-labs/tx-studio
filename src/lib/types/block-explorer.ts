// src/lib/types/block-explorer.ts

export type BlockExplorerId = 'cardanoscan' | 'cexplorer';

export interface BlockExplorer {
  id: BlockExplorerId;
  name: string;
  baseUrl: string;
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
    baseUrl: 'https://cardanoscan.io',
    urls: {
      address: 'https://cardanoscan.io/address/{address}',
      transaction: 'https://cardanoscan.io/transaction/{txHash}',
      stakePool: 'https://cardanoscan.io/pool/{poolId}',
      epoch: 'https://cardanoscan.io/epoch/{epoch}',
      slot: 'https://cardanoscan.io/slot/{slot}',
    },
  },
  cexplorer: {
    id: 'cexplorer',
    name: 'CExplorer',
    baseUrl: 'https://cexplorer.io',
    urls: {
      address: 'https://cexplorer.io/address/{address}',
      transaction: 'https://cexplorer.io/tx/{txHash}',
      stakePool: 'https://cexplorer.io/pool/{poolId}',
      epoch: 'https://cexplorer.io/epoch/{epoch}',
      slot: 'https://cexplorer.io/slot/{slot}',
    },
  },
};

export const DEFAULT_BLOCK_EXPLORER: BlockExplorerId = 'cardanoscan';

// Helper function to generate URLs
export function getExplorerUrl(
  explorerId: BlockExplorerId,
  type: keyof BlockExplorer['urls'],
  params: Record<string, string>
): string {
  const explorer = BLOCK_EXPLORERS[explorerId];
  let url = explorer.urls[type];
  
  // Replace placeholders with actual values
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`{${key}}`, value);
  });
  
  return url;
}
