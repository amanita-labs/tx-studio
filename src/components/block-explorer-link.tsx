// src/components/block-explorer-link.tsx
'use client';

import { useBlockExplorer } from '@/hooks/use-block-explorer';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlockExplorerLinkProps {
  type: 'address' | 'transaction' | 'stakePool' | 'epoch' | 'slot';
  params: Record<string, string>;
  className?: string;
}

export function BlockExplorerLink({ 
  type, 
  params, 
  className
}: BlockExplorerLinkProps) {
  const { getUrl } = useBlockExplorer();
  
  const url = getUrl(type, params);
  
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={className}
    >
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        title="View in explorer"
      >
        <ExternalLink className="h-3 w-3" />
      </a>
    </Button>
  );
}
