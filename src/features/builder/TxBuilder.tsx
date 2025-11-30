// src/features/builder/TxBuilder.tsx
'use client';

import { EmptyBuilderState } from './EmptyBuilderState';
import { WalletConnection } from './WalletConnection';
import { BuilderSections } from './BuilderSections';
import { TransactionSummary } from './TransactionSummary';
import { TransactionActions } from './TransactionActions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Wallet, Construction } from 'lucide-react';

export function TxBuilder() {
  const { walletConnected } = useAppStore();

  return (
    <div className="container mx-auto p-4">
      <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
        <Construction className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-900 dark:text-amber-100">
          <strong>Work in Progress:</strong> The transaction builder is under active development. 
          Some certificate types and transaction body elements may not be fully implemented yet.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-8rem)]">
        {/* Left Panel - Wallet Connection + Certificate Builder Forms */}
        <div className="flex flex-col space-y-4">
          {walletConnected ? (
            <WalletConnection />
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Connect a wallet to build and submit transactions. You can still explore the certificate builder forms below.
                </AlertDescription>
              </Alert>
              <EmptyBuilderState />
            </div>
          )}
          <ScrollArea className="flex-1">
            <BuilderSections />
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

