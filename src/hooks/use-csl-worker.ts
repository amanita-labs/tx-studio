// src/hooks/use-csl-worker.ts
import { useCallback, useRef, useEffect } from 'react';
import { TxParseResult, Network } from '@/domain/tx';

// Module-level cache so hashes computed in one component instance are
// reused by another (e.g. paste -> network detection -> dissect).
const hashCache = new Map<string, string>();

type WorkerCallback = (event: { type: string; data: unknown }) => void;

export function useCSLWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<Map<number, WorkerCallback>>(new Map());
  const nextRequestIdRef = useRef(0);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/csl-worker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (event) => {
      const { requestId, type, data } = event.data;
      const callback = callbacksRef.current.get(requestId);
      if (callback) {
        callback({ type, data });
        callbacksRef.current.delete(requestId);
      }
    };

    workerRef.current.onerror = (event) => {
      // Resolve every pending request with an error so nothing hangs.
      const location = event.filename ? ` (${event.filename}:${event.lineno})` : '';
      const error = `Worker error: ${event.message || 'unknown'}${location}`;
      callbacksRef.current.forEach((cb) => cb({ type: 'ERROR', data: { error } }));
      callbacksRef.current.clear();
    };

    workerRef.current.onmessageerror = () => {
      const error = 'Worker message could not be deserialized';
      callbacksRef.current.forEach((cb) => cb({ type: 'ERROR', data: { error } }));
      callbacksRef.current.clear();
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const parseTransaction = useCallback((hex: string, network: Network = 'mainnet'): Promise<TxParseResult> => {
    return new Promise((resolve) => {
      const worker = workerRef.current;
      if (!worker) {
        resolve({ success: false, error: 'Worker not initialized' });
        return;
      }
      const requestId = nextRequestIdRef.current++;
      callbacksRef.current.set(requestId, ({ type, data }) => {
        if (type === 'PARSE_RESULT') {
          resolve(data as TxParseResult);
        } else if (type === 'ERROR') {
          const errData = data as { error?: string; details?: string };
          resolve({
            success: false,
            error: errData.error ?? 'Unknown worker error',
            details: errData.details,
          });
        } else {
          resolve({ success: false, error: `Unexpected worker response: ${type}` });
        }
      });
      worker.postMessage({ requestId, type: 'PARSE_TRANSACTION', data: { hex, network } });
    });
  }, []);

  const computeTransactionHash = useCallback((hex: string): Promise<string> => {
    const normalized = hex.trim().replace(/\s+/g, '');
    const cached = hashCache.get(normalized);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error('Worker not initialized'));
        return;
      }
      const requestId = nextRequestIdRef.current++;
      callbacksRef.current.set(requestId, ({ type, data }) => {
        if (type === 'HASH_RESULT') {
          const hash = (data as { hash: string }).hash;
          hashCache.set(normalized, hash);
          resolve(hash);
        } else if (type === 'ERROR') {
          const err = (data as { error?: string }).error ?? 'Hash computation failed';
          reject(new Error(err));
        } else {
          reject(new Error(`Unexpected worker response: ${type}`));
        }
      });
      worker.postMessage({ requestId, type: 'COMPUTE_HASH', data: { hex } });
    });
  }, []);

  return { parseTransaction, computeTransactionHash };
}
