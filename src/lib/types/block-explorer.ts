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
  };
  // URL templates for different types of queries
  urls: {
    address: string;
    transaction: string;
    stakePool: string;
    stakeKey: string;
    drep: string;
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
    },
    urls: {
      address: '/address/{address}',
      transaction: '/transaction/{txHash}',
      stakePool: '/pool/{poolId}',
      stakeKey: '/stakeKey/{stakeKey}',
      drep: '/drep/{drepId}',
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
    },
    urls: {
      address: '/address/{address}',
      transaction: '/tx/{txHash}',
      stakePool: '/pool/{poolId}',
      stakeKey: '/stake/{stakeKey}',
      drep: '/governance/drep/{drepId}',
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
  // Fall back to mainnet for unsupported networks
  const networkKey = network in explorer.networks ? network : 'mainnet';
  const baseUrl = explorer.networks[networkKey as keyof typeof explorer.networks];
  let url = baseUrl + explorer.urls[type];
  
  // Replace placeholders with actual values
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`{${key}}`, value);
  });
  
  return url;
}
