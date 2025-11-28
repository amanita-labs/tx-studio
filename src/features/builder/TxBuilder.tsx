// src/features/builder/TxBuilder.tsx
'use client';

import { EmptyBuilderState } from './EmptyBuilderState';
import { WalletConnection } from './WalletConnection';
import { BuilderTabs } from './BuilderTabs';
import { TransactionSummary } from './TransactionSummary';
import { TransactionActions } from './TransactionActions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';

export function TxBuilder() {
  const { walletConnected } = useAppStore();

  if (!walletConnected) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-[calc(100vh-5rem)]">
          <EmptyBuilderState />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-5rem)]">
        {/* Left Panel - Wallet Connection + Certificate Builder Forms */}
        <div className="flex flex-col space-y-4">
          <WalletConnection />
          <ScrollArea className="flex-1">
            <BuilderTabs />
          </ScrollArea>
        </div>

        {/* Right Panel - Transaction Summary + Actions */}
        <div className="flex flex-col space-y-4">
          <TransactionSummary />
          <TransactionActions />
        </div>
      </div>
    </div>
  );
}

