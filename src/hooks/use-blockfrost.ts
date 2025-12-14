// src/hooks/use-blockfrost.ts
import { useState, useCallback } from 'react';
import { Network } from '@/domain/tx';
import { FetchTransactionResponse } from '@/lib/types/blockfrost';

interface UseBlockfrostReturn {
  fetchTransaction: (hash: string, network: Network) => Promise<FetchTransactionResponse>;
  isLoading: boolean;
  error: string | null;
}

/**
 * React hook for fetching Cardano transactions from Blockfrost via API routes
 */
export function useBlockfrost(): UseBlockfrostReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransaction = useCallback(
    async (hash: string, network: Network): Promise<FetchTransactionResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        // Validate hash format (basic check)
        const trimmedHash = hash.trim();
        if (trimmedHash.length !== 64) {
          const errorMsg = 'Transaction hash must be 64 hexadecimal characters';
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }

        // Call our API route
        const response = await fetch(
          `/api/blockfrost/transactions/${encodeURIComponent(trimmedHash)}?network=${network}`
        );

        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
          let errorMsg = 'Failed to fetch transaction';
          try {
            const errorData: FetchTransactionResponse = await response.json();
            errorMsg = errorData.success === false ? errorData.error : `HTTP ${response.status}: ${response.statusText}`;
          } catch {
            errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          }
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
            statusCode: response.status,
          };
        }

        const data: FetchTransactionResponse = await response.json();

        if (!data.success) {
          setError(data.error || 'Failed to fetch transaction');
          return data;
        }

        // Clear error on success
        setError(null);
        return data;
      } catch (err) {
        let errorMessage = 'An unexpected error occurred';
        
        if (err instanceof TypeError && err.message.includes('fetch')) {
          errorMessage = 'Network error. API routes may not be available in static export mode. Please deploy to Vercel for Blockfrost features.';
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        console.error('Blockfrost fetch error:', err);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    fetchTransaction,
    isLoading,
    error,
  };
}
