// src/hooks/use-blockfrost.ts
import { useState, useCallback } from 'react';
import { Network } from '@/domain/tx';
import { FetchTransactionResponse, FetchTxUtxosResponse, FetchAddressUtxosResponse } from '@/lib/types/blockfrost';
import { NetworkDetectionResponse } from '@/lib/blockfrost/multi-network-search';

/**
 * Standalone client-side fetcher for a transaction's UTXOs (the producing tx's outputs).
 * Used by useResolveInputs to fan out parallel requests; not bound to React state so
 * concurrent calls don't clobber each other.
 */
export async function fetchTransactionUtxosClient(
  hash: string,
  network: Network
): Promise<FetchTxUtxosResponse> {
  const trimmedHash = hash.trim();
  if (trimmedHash.length !== 64) {
    return { success: false, error: 'Transaction hash must be 64 hexadecimal characters' };
  }
  try {
    const response = await fetch(
      `/api/blockfrost/transactions/${encodeURIComponent(trimmedHash)}/utxos?network=${network}`
    );
    if (!response.ok) {
      let errorMsg = 'Failed to fetch transaction UTXOs';
      try {
        const errorData: FetchTxUtxosResponse = await response.json();
        errorMsg = errorData.success === false ? errorData.error : `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      }
      return { success: false, error: errorMsg, statusCode: response.status };
    }
    const data: FetchTxUtxosResponse = await response.json();
    return data;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network error. API routes are not available in static export mode.',
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Standalone client-side fetcher for an address's current UTXO references.
 * Used by useInputSpentStatus to check whether an off-chain tx's inputs are
 * still unspent; not bound to React state so concurrent calls don't clobber.
 */
export async function fetchAddressUtxosClient(
  address: string,
  network: Network
): Promise<FetchAddressUtxosResponse> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { success: false, error: 'Address is required' };
  }
  try {
    const response = await fetch(
      `/api/blockfrost/addresses/${encodeURIComponent(trimmed)}/utxos?network=${network}`
    );
    if (!response.ok) {
      let errorMsg = 'Failed to fetch address UTXOs';
      try {
        const errorData: FetchAddressUtxosResponse = await response.json();
        errorMsg = errorData.success === false ? errorData.error : `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      }
      return { success: false, error: errorMsg, statusCode: response.status };
    }
    const data: FetchAddressUtxosResponse = await response.json();
    return data;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network error. API routes are not available in static export mode.',
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

interface UseBlockfrostReturn {
  fetchTransaction: (hash: string, network: Network) => Promise<FetchTransactionResponse>;
  searchTransactionAcrossNetworks: (hash: string) => Promise<FetchTransactionResponse>;
  detectNetworkFromInputs: (inputTxIds: string[]) => Promise<NetworkDetectionResponse>;
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
          errorMessage = 'Network error. API routes are not available in static export mode. Blockfrost features only work in development mode or with a hosting provider that supports Next.js API routes.';
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

  const searchTransactionAcrossNetworks = useCallback(
    async (hash: string): Promise<FetchTransactionResponse> => {
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

        // Call our multi-network search API route
        const response = await fetch(
          `/api/blockfrost/transactions/${encodeURIComponent(trimmedHash)}/search-all`
        );

        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
          let errorMsg = 'Failed to search transaction across networks';
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
          setError(data.error || 'Failed to search transaction across networks');
          return data;
        }

        // Clear error on success
        setError(null);
        return data;
      } catch (err) {
        let errorMessage = 'An unexpected error occurred';
        
        if (err instanceof TypeError && err.message.includes('fetch')) {
          errorMessage = 'Network error. API routes are not available in static export mode. Blockfrost features only work in development mode or with a hosting provider that supports Next.js API routes.';
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        console.error('Multi-network search error:', err);
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

  const detectNetworkFromInputs = useCallback(
    async (inputTxIds: string[]): Promise<NetworkDetectionResponse> => {
      try {
        const response = await fetch('/api/blockfrost/detect-network', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputTxIds }),
        });

        const data: NetworkDetectionResponse = await response.json();
        return data;
      } catch (err) {
        let errorMessage = 'An unexpected error occurred';

        if (err instanceof TypeError && err.message.includes('fetch')) {
          errorMessage = 'Network error. API routes are not available in static export mode.';
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        console.error('Network detection from inputs error:', err);
        return { success: false, error: errorMessage, searchedNetworks: [] };
      }
    },
    []
  );

  return {
    fetchTransaction,
    searchTransactionAcrossNetworks,
    detectNetworkFromInputs,
    isLoading,
    error,
  };
}
