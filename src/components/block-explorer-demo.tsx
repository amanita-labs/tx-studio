// src/components/block-explorer-demo.tsx
'use client';

import { BlockExplorerLink } from './block-explorer-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function BlockExplorerDemo() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Block Explorer Demo</CardTitle>
        <CardDescription>
          Example links using the selected block explorer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">Address:</p>
          <BlockExplorerLink 
            type="address" 
            params={{ address: "addr1q9rl0..." }}
          >
            View Address
          </BlockExplorerLink>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium">Transaction:</p>
          <BlockExplorerLink 
            type="transaction" 
            params={{ txHash: "abc123..." }}
          >
            View Transaction
          </BlockExplorerLink>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium">Stake Pool:</p>
          <BlockExplorerLink 
            type="stakePool" 
            params={{ poolId: "pool1..." }}
          >
            View Pool
          </BlockExplorerLink>
        </div>
      </CardContent>
    </Card>
  );
}
