// src/hooks/use-block-explorer.ts
'use client';

import { useAppStore } from '@/lib/store';
import { BLOCK_EXPLORERS, BlockExplorerId, getExplorerUrl } from '@/lib/types/block-explorer';

export function useBlockExplorer() {
  const { blockExplorer, setBlockExplorer } = useAppStore();
  
  const currentExplorer = BLOCK_EXPLORERS[blockExplorer];
  
  const getUrl = (type: keyof typeof currentExplorer.urls, params: Record<string, string>) => {
    return getExplorerUrl(blockExplorer, type, params);
  };
  
  return {
    currentExplorer,
    blockExplorer,
    setBlockExplorer,
    getUrl,
  };
}
