// src/components/blockfrost-fetch.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Network } from '@/domain/tx';
import { useBlockfrost } from '@/hooks/use-blockfrost';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { isValidTransactionHash } from '@/lib/blockfrost/config';
import { toast } from 'sonner';

interface BlockfrostFetchProps {
  onTransactionFetched?: (hex: string, network: Network) => void;
  network: Network;
}

export function BlockfrostFetch({
  onTransactionFetched,
  network,
}: BlockfrostFetchProps) {
  const [hash, setHash] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { fetchTransaction, isLoading, error } = useBlockfrost();

  // Auto-fetch on paste if it's a valid transaction hash
  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = e.clipboardData.getData('text').trim();
    
    // Check if pasted value is a transaction hash (64 hex chars)
    if (isValidTransactionHash(pastedValue)) {
      e.preventDefault();
      setHash(pastedValue);
      // Auto-fetch after a short delay to allow state update
      setTimeout(() => {
        handleFetch(pastedValue);
      }, 0);
    }
  };

  const handleFetch = async (hashToFetch?: string) => {
    const hashValue = hashToFetch || hash.trim();
    
    // Clear previous errors
    setLocalError(null);
    
    if (!hashValue) {
      const errorMsg = 'Please enter a transaction hash';
      setLocalError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!isValidTransactionHash(hashValue)) {
      const errorMsg = 'Invalid transaction hash format. Must be 64 hexadecimal characters.';
      setLocalError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      const result = await fetchTransaction(hashValue, network);

      if (result.success) {
        // Call the callback with the fetched transaction hex
        onTransactionFetched?.(result.hex, network);
        // Clear the hash input and errors after successful fetch
        setHash('');
        setLocalError(null);
        toast.success('Transaction fetched successfully');
      } else {
        const errorMsg = result.error || 'Failed to fetch transaction';
        setLocalError(errorMsg);
        toast.error(errorMsg);
        // Keep the hash in the input so user can retry
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setLocalError(errorMsg);
      toast.error(errorMsg);
      console.error('Error fetching transaction:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && hash.trim()) {
      handleFetch();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Paste transaction id to fetch from on-chain..."
            value={hash}
            onChange={(e) => {
              setHash(e.target.value);
              // Clear error when user starts typing
              if (localError) setLocalError(null);
            }}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            className="font-mono pl-9 pr-20"
            disabled={isLoading}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button
          onClick={() => handleFetch()}
          disabled={!hash.trim() || isLoading || !isValidTransactionHash(hash.trim())}
          size="sm"
          className="shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              Fetch
            </>
          ) : (
            <>
              <Search className="h-3 w-3 mr-1.5" />
              Fetch
            </>
          )}
        </Button>
      </div>
      {(localError || error) && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{localError || error}</span>
        </div>
      )}
    </div>
  );
}
