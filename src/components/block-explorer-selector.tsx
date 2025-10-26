// src/components/block-explorer-selector.tsx
'use client';

import { useAppStore } from '@/lib/store';
import { BLOCK_EXPLORERS, BlockExplorerId } from '@/lib/types/block-explorer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink } from 'lucide-react';

export function BlockExplorerSelector() {
  const { blockExplorer, setBlockExplorer } = useAppStore();

  const handleValueChange = (value: string) => {
    setBlockExplorer(value as BlockExplorerId);
  };

  return (
    <div className="flex items-center space-x-2">
      <Select value={blockExplorer} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(BLOCK_EXPLORERS).map((explorer) => (
            <SelectItem key={explorer.id} value={explorer.id}>
              <div className="flex items-center space-x-2">
                <span>{explorer.name}</span>
                <ExternalLink className="h-3 w-3 opacity-50" />
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
