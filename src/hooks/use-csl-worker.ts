// src/hooks/use-csl-worker.ts
import { TxParseResult, Network } from '@/domain/tx';

// Module-level cache so hashes computed in one component instance are
// reused by another (e.g. paste -> network detection -> dissect).
const hashCache = new Map<string, string>();

type WorkerCallback = (event: { type: string; data: unknown }) => void;

// Singleton worker, callbacks map, and request id counter live at module
// scope so they survive React 18 strict-mode mount/cleanup/remount cycles.
// A Web Worker is a genuine page-singleton resource — keep it outside
// React's lifecycle.
let worker: Worker | null = null;
const callbacks = new Map<number, WorkerCallback>();
let nextRequestId = 0;

// READY handshake: messages posted to a freshly-constructed worker can be
// dispatched as `message` events on its global scope BEFORE the worker
// script has set `self.onmessage` (webpack's async bootstrap + the wasm
// import in csl-worker.ts together delay user code until wasm loads). Any
// such early messages fire on a global with no listener and are silently
// dropped — leaving the page hung on "Decoding transaction…". To avoid
// that, we buffer outbound posts here until the worker emits its READY
// message, signalling that its onmessage handler is wired up.
let workerReady = false;
const outboundQueue: Array<() => void> = [];

function flushOutbound() {
  while (outboundQueue.length > 0) {
    const fn = outboundQueue.shift();
    if (fn) fn();
  }
}

function rejectAllPending(error: string) {
  if (callbacks.size === 0) return;
  const pending = Array.from(callbacks.values());
  callbacks.clear();
  pending.forEach((cb) => cb({ type: 'ERROR', data: { error } }));
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/csl-worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.onmessage = (event) => {
    const data = event.data;
    if (data && data.type === 'WORKER_READY') {
      workerReady = true;
      flushOutbound();
      return;
    }
    const { requestId, type, data: payload } = data;
    const cb = callbacks.get(requestId);
    if (cb) {
      callbacks.delete(requestId);
      cb({ type, data: payload });
    }
  };

  worker.onerror = (event) => {
    const location = event.filename ? ` (${event.filename}:${event.lineno})` : '';
    rejectAllPending(`Worker error: ${event.message || 'unknown'}${location}`);
  };

  worker.onmessageerror = () => {
    rejectAllPending('Worker message could not be deserialized');
  };

  return worker;
}

function postWhenReady(send: () => void) {
  if (workerReady) {
    send();
  } else {
    outboundQueue.push(send);
  }
}

function parseTransaction(
  hex: string,
  network: Network = 'mainnet'
): Promise<TxParseResult> {
  return new Promise((resolve) => {
    const w = getWorker();
    const requestId = nextRequestId++;
    callbacks.set(requestId, ({ type, data }) => {
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
    postWhenReady(() => w.postMessage({ requestId, type: 'PARSE_TRANSACTION', data: { hex, network } }));
  });
}

function computeTransactionHash(hex: string): Promise<string> {
  const normalized = hex.trim().replace(/\s+/g, '');
  const cached = hashCache.get(normalized);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const w = getWorker();
    const requestId = nextRequestId++;
    callbacks.set(requestId, ({ type, data }) => {
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
    postWhenReady(() => w.postMessage({ requestId, type: 'COMPUTE_HASH', data: { hex } }));
  });
}

export function useCSLWorker() {
  return { parseTransaction, computeTransactionHash };
}
