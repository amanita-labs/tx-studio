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
    committeeHot: string;
    committeeCold: string;
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
      committeeHot: '/cchot/{memberId}',
      committeeCold: '/ccmember/{memberId}',
      proposal: '/govAction/{proposalId}',
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
      committeeHot: '/gov/cc/{memberId}',
      committeeCold: '/gov/cc/{memberId}',
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
  
  // Determine the actual URL type (may differ from input type for special cases)
  let actualType: keyof BlockExplorer['urls'] = type;
  
  // Handle committee credentials - detect hot vs cold based on memberId prefix
  if (type === 'committee') {
    const memberId = params.memberId || '';
    if (memberId.startsWith('cc_hot1')) {
      actualType = 'committeeHot';
    } else if (memberId.startsWith('cc_cold1')) {
      actualType = 'committeeCold';
    }
  }
  
  let url = baseUrl + explorer.urls[actualType];
  
  // Handle special cases for governance action (proposal) formatting
  if (type === 'proposal') {
    const proposalId = params.proposalId || '';
    
    // Cardanoscan expects /govAction/{bech32_id} - use the full bech32 ID
    if (explorerId === 'cardanoscan') {
      // Use the full bech32 ID for Cardanoscan (e.g., gov_action1...)
      url = url.replace('{proposalId}', proposalId);
    } else {
      // CExplorer: use the full bech32 string or legacy format
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
