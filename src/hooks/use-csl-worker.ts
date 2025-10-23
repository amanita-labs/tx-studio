// src/hooks/use-csl-worker.ts
import { useCallback, useRef, useEffect } from 'react';
import { TxParseResult } from '@/domain/tx';

export function useCSLWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<Map<string, (result: TxParseResult) => void>>(new Map());

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(new URL('../workers/csl-worker.ts', import.meta.url), {
      type: 'module',
    });

    // Handle messages from worker
    workerRef.current.onmessage = (event) => {
      const { type, data } = event.data;
      
      if (type === 'PARSE_RESULT') {
        const callback = callbacksRef.current.get('parse');
        if (callback) {
          callback(data);
          callbacksRef.current.delete('parse');
        }
      } else if (type === 'ERROR') {
        const callback = callbacksRef.current.get('parse');
        if (callback) {
          callback({
            success: false,
            error: data.error,
            details: data.details,
          });
          callbacksRef.current.delete('parse');
        }
      }
    };

    // Cleanup
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const parseTransaction = useCallback((hex: string): Promise<TxParseResult> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        resolve({
          success: false,
          error: 'Worker not initialized',
        });
        return;
      }

      // Store callback
      callbacksRef.current.set('parse', resolve);

      // Send message to worker
      workerRef.current.postMessage({
        type: 'PARSE_TRANSACTION',
        data: { hex },
      });
    });
  }, []);

  return { parseTransaction };
}
