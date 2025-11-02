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
    committee: string;
    proposal: string;
    epoch: string;
    slot: string;
    script: string;
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
      committee: '/gov/committee/{memberId}',
      proposal: '/govAction/gov_action{proposalId}',
      epoch: '/epoch/{epoch}',
      slot: '/slot/{slot}',
      script: '/script/{scriptHash}',
    },
  },
  cexplorer: {
    id: 'cexplorer',
    name: 'CExplorer',
    networks: {
      mainnet: 'https://beta.cexplorer.io',
      preview: 'https://preview.cexplorer.io',
      preprod: 'https://preprod.cexplorer.io',
    },
    urls: {
      address: '/address/{address}',
      transaction: '/tx/{txHash}',
      stakePool: '/pool/{poolId}',
      stakeKey: '/stake/{stakeKey}',
      drep: '/governance/drep/{drepId}',
      committee: '/gov/cc/{memberId}',
      proposal: '/gov/action/{proposalId}',
      epoch: '/epoch/{epoch}',
      slot: '/slot/{slot}',
      script: '/script/{scriptHash}',
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
  
  // Handle special cases for proposal formatting
  if (type === 'proposal') {
    const proposalId = params.proposalId || '';
    
    // Check if proposalId is already in bech32 format (gov_action1...)
    if (proposalId.startsWith('gov_action')) {
      // Already bech32 encoded according to CIP-0129
      if (explorerId === 'cardanoscan') {
        // Cardanoscan expects /govAction/gov_action{encoded_id}
        // Extract the part after 'gov_action' separator
        const encodedPart = proposalId.split('1')[1] || proposalId.substring(11);
        url = url.replace('{proposalId}', encodedPart);
      } else {
        // CExplorer: use the full bech32 string
        url = url.replace('{proposalId}', proposalId);
      }
    } else if (proposalId.includes('#')) {
      // Legacy format: txId#index - try to decode if possible
      const [txId, index] = proposalId.split('#');
      if (explorerId === 'cardanoscan') {
        // Cardanoscan pattern is /govAction/gov_action{encoded_id}
        // Use transaction ID directly - they may handle conversion
        url = url.replace('{proposalId}', txId + (index ? index : '0'));
      } else {
        // CExplorer: use the proposal ID as-is (txId#index)
        url = url.replace('{proposalId}', proposalId);
      }
    } else {
      // Use as-is (might be hex transaction ID or other format)
      url = url.replace('{proposalId}', proposalId);
    }
  } else {
    // Replace placeholders with actual values for all other types
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, value);
    });
  }
  
  return url;
}
