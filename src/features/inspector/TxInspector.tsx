// src/features/inspector/TxInspector.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { HexInputPanel } from './HexInputPanel';
import { InspectorTabs } from './InspectorTabs';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { ExportDialog } from '@/components/export-dialog';
import { Button } from '@/components/ui/button';
import { isValidTransactionHash } from '@/lib/blockfrost/config';
import { useBlockfrost } from '@/hooks/use-blockfrost';
import { useCSLWorker } from '@/hooks/use-csl-worker';

export function TxInspector() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { 
    txHex, 
    parsedTx, 
    isLoading, 
    error, 
    setTxHex,
    setParsedTx,
    setLoading,
    setNetwork,
    setNetworkDetected,
    setError 
  } = useAppStore();
  const { searchTransactionAcrossNetworks } = useBlockfrost();
  const { parseTransaction } = useCSLWorker();
  const hasLoadedFromUrl = useRef<string | null>(null);

  // Load transaction from URL path (/{txHash}) or query params (?hex=...)
  useEffect(() => {
    // First check URL path for transaction hash
    const pathHash = pathname && pathname !== '/' ? pathname.slice(1) : null;
    
    // Then check query params
    const queryHex = searchParams.get('hex');
    
    // Prefer path hash over query hex
    const hashToLoad = pathHash || queryHex;
    
    // Only load if we have a hash and haven't already loaded this specific hash from URL
    if (hashToLoad && hashToLoad !== hasLoadedFromUrl.current && hashToLoad !== txHex) {
      // Validate if it's a transaction hash (64 hex chars)
      if (isValidTransactionHash(hashToLoad)) {
        hasLoadedFromUrl.current = hashToLoad;
        setLoading(true);
        setError(null);
        
        // Fetch transaction from Blockfrost
        searchTransactionAcrossNetworks(hashToLoad)
          .then(async (result) => {
            if (result.success && result.hex && result.network) {
              setTxHex(result.hex);
              setNetwork(result.network);
              setNetworkDetected(true);
              
              // Parse the transaction
              const parseResult = await parseTransaction(result.hex, result.network);
              setParsedTx(parseResult);
            } else {
              const errorMsg = result.success === false ? result.error : 'Transaction not found';
              setError(errorMsg);
            }
          })
          .catch((err) => {
            const errorMsg = err instanceof Error ? err.message : 'Failed to load transaction';
            setError(errorMsg);
          })
          .finally(() => {
            setLoading(false);
          });
      } else if (hashToLoad.length >= 100) {
        // It's a full hex transaction, not a hash
        hasLoadedFromUrl.current = hashToLoad;
        setTxHex(hashToLoad);
      }
    }
    
    // Reset the ref if we're no longer on a hash URL
    if (!hashToLoad && hasLoadedFromUrl.current) {
      hasLoadedFromUrl.current = null;
    }
  }, [pathname, searchParams, txHex, setTxHex, setParsedTx, setLoading, setNetwork, setNetworkDetected, setError, searchTransactionAcrossNetworks, parseTransaction]);

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
