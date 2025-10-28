// src/features/inspector/TxInspector.tsx
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { HexInputPanel } from './HexInputPanel';
import { InspectorTabs } from './InspectorTabs';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { ExportDialog } from '@/components/export-dialog';
import { Button } from '@/components/ui/button';

export function TxInspector() {
  const searchParams = useSearchParams();
  const { 
    txHex, 
    parsedTx, 
    isLoading, 
    error, 
    setTxHex, 
    setError 
  } = useAppStore();

  // Load transaction from URL params
  useEffect(() => {
    const hex = searchParams.get('hex');
    if (hex && hex !== txHex) {
      setTxHex(hex);
    }
  }, [searchParams, txHex, setTxHex]);

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-5rem)]">
          {/* Left Panel - Hex Input */}
          <div className="flex flex-col">
            <HexInputPanel />
          </div>

          {/* Right Panel - Inspector */}
          <div className="flex flex-col">
            {!txHex ? (
              <EmptyState />
            ) : error ? (
              <ErrorState error={error} />
            ) : parsedTx?.success ? (
              <div className="h-full flex flex-col">
                {/* Inspector Tabs */}
                <div className="flex-1">
                  <InspectorTabs tx={parsedTx.tx} txHex={txHex} />
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Decoding transaction...</p>
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
      </div>
    </div>
  );
}
