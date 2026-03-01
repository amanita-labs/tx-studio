// src/hooks/use-current-protocol-params.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Network } from '@/domain/tx';
import type { AllProtocolParams, AllProtocolParamsResponse } from '@/lib/types/protocol-params';

interface UseCurrentProtocolParamsReturn {
  currentParams: AllProtocolParams | null;
  isLoading: boolean;
  error: string | null;
}

export function useCurrentProtocolParams(
  network: Network,
  hasParameterChangeAction: boolean,
): UseCurrentProtocolParamsReturn {
  const [currentParams, setCurrentParams] = useState<AllProtocolParams | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side per-network cache
  const cache = useRef<Partial<Record<Network, AllProtocolParams>>>({});

  const fetchParams = useCallback(async () => {
    if (cache.current[network]) {
      setCurrentParams(cache.current[network]!);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/blockfrost/protocol-params/all?network=${network}`,
      );
      const data: AllProtocolParamsResponse = await response.json();

      if (data.success) {
        cache.current[network] = data.params;
        setCurrentParams(data.params);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to fetch current protocol parameters');
    } finally {
      setIsLoading(false);
    }
  }, [network]);

  useEffect(() => {
    if (!hasParameterChangeAction) return;
    fetchParams();
  }, [hasParameterChangeAction, fetchParams]);

  return { currentParams, isLoading, error };
}
