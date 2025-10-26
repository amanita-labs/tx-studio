// src/components/block-explorer-link.tsx
'use client';

import { useBlockExplorer } from '@/hooks/use-block-explorer';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlockExplorerLinkProps {
  type: 'address' | 'transaction' | 'stakePool' | 'epoch' | 'slot';
  params: Record<string, string>;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function BlockExplorerLink({ 
  type, 
  params, 
  children, 
  className,
  variant = 'link',
  size = 'sm'
}: BlockExplorerLinkProps) {
  const { getUrl } = useBlockExplorer();
  
  const url = getUrl(type, params);
  
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={className}
    >
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center space-x-1"
      >
        <span>{children}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </Button>
  );
}
