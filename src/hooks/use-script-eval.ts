// src/hooks/use-script-eval.ts
import { useState, useCallback, useRef } from 'react';
import { Network } from '@/domain/tx';
import {
  EvalResponse,
  EvalResult,
  ProtocolParamsSubset,
  ProtocolParamsResponse,
} from '@/lib/types/script-eval';

interface UseScriptEvalReturn {
  evaluate: (cbor: string, network: Network) => Promise<EvalResponse>;
  fetchProtocolParams: (network: Network) => Promise<ProtocolParamsSubset | null>;
  evalResult: EvalResponse | null;
  isEvaluating: boolean;
  protocolParams: ProtocolParamsSubset | null;
  isLoadingParams: boolean;
  costInAda: number | null;
}

export function useScriptEval(): UseScriptEvalReturn {
  const [evalResult, setEvalResult] = useState<EvalResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [protocolParams, setProtocolParams] = useState<ProtocolParamsSubset | null>(null);
  const [isLoadingParams, setIsLoadingParams] = useState(false);

  // Cache protocol params per-network for the session
  const paramsCache = useRef<Partial<Record<Network, ProtocolParamsSubset>>>({});

  const evaluate = useCallback(
    async (cbor: string, network: Network): Promise<EvalResponse> => {
      setIsEvaluating(true);
      setEvalResult(null);

      try {
        const response = await fetch('/api/blockfrost/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cbor, network }),
        });

        let data: EvalResponse;

        if (!response.ok) {
          try {
            data = await response.json();
          } catch {
            data = {
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
            };
          }
        } else {
          data = await response.json();
        }

        setEvalResult(data);
        return data;
      } catch (err) {
        let errorMessage = 'An unexpected error occurred during evaluation';

        if (err instanceof TypeError && err.message.includes('fetch')) {
          errorMessage =
            'Network error. API routes are not available in static export mode. Script evaluation only works in development mode or with a hosting provider that supports Next.js API routes.';
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        const result: EvalResponse = { success: false, error: errorMessage };
        setEvalResult(result);
        return result;
      } finally {
        setIsEvaluating(false);
      }
    },
    []
  );

  const fetchProtocolParams = useCallback(
    async (network: Network): Promise<ProtocolParamsSubset | null> => {
      // Return cached if available
      if (paramsCache.current[network]) {
        const cached = paramsCache.current[network]!;
        setProtocolParams(cached);
        return cached;
      }

      setIsLoadingParams(true);

      try {
        const response = await fetch(
          `/api/blockfrost/protocol-params?network=${network}`
        );

        const data: ProtocolParamsResponse = await response.json();

        if (data.success) {
          paramsCache.current[network] = data.params;
          setProtocolParams(data.params);
          return data.params;
        }

        return null;
      } catch {
        return null;
      } finally {
        setIsLoadingParams(false);
      }
    },
    []
  );

  // Derive ADA cost from eval results + protocol params
  let costInAda: number | null = null;
  if (evalResult?.success && protocolParams) {
    const results = evalResult.results as EvalResult[];
    let totalCost = 0;
    for (const r of results) {
      totalCost += r.budget.memory * protocolParams.priceMem + r.budget.cpu * protocolParams.priceStep;
    }
    costInAda = totalCost;
  }

  return {
    evaluate,
    fetchProtocolParams,
    evalResult,
    isEvaluating,
    protocolParams,
    isLoadingParams,
    costInAda,
  };
}
