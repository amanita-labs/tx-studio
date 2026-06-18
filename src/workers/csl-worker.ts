// src/workers/csl-worker.ts
// Thin worker shell: wires the pure CSL parsing logic in ./csl/parser to the
// worker message protocol. All parsing/verification lives in parser.ts so it
// can be imported and unit-tested without a worker environment.

import { parseTransaction, computeTransactionHash, verifyCip169 } from './csl/parser';

// Handle messages from main thread
self.onmessage = async (event) => {
  const { type, data, requestId } = event.data;

  try {
    switch (type) {
      case 'PARSE_TRANSACTION': {
        const result = await parseTransaction(data.hex, data.network || 'mainnet');
        self.postMessage({ requestId, type: 'PARSE_RESULT', data: result });
        break;
      }
      case 'VERIFY_CIP169': {
        const { metadata, txCbor } = data as { metadata: unknown; txCbor: string };
        const result = await verifyCip169(metadata, txCbor);
        self.postMessage({ requestId, type: 'VERIFY_CIP169_RESULT', data: result });
        break;
      }
      case 'COMPUTE_HASH':
        try {
          const hash = await computeTransactionHash(data.hex);
          self.postMessage({ requestId, type: 'HASH_RESULT', data: { hash } });
        } catch (error) {
          self.postMessage({
            requestId,
            type: 'ERROR',
            data: {
              error: error instanceof Error ? error.message : 'Failed to compute hash',
              details: error instanceof Error ? error.stack : undefined
            }
          });
        }
        break;
      default:
        self.postMessage({ requestId, type: 'ERROR', data: { error: 'Unknown message type' } });
    }
  } catch (error) {
    self.postMessage({
      requestId,
      type: 'ERROR',
      data: {
        error:
          error instanceof Error
            ? error.message
            : error == null
              ? 'Worker threw an empty value (check the browser console for details).'
              : `Worker threw a non-Error value: ${String(error)}`,
        details: error instanceof Error ? error.stack : undefined,
      },
    });
  }
};

// Announce that the worker is ready to receive messages. The host (the
// useCSLWorker hook) buffers any outbound calls until this READY arrives,
// because messages posted before this point can be dispatched against a
// global with no `onmessage` handler set yet (webpack's async chunk +
// asyncWebAssembly bootstrap defers user code until after wasm loads) and
// would otherwise be silently dropped.
self.postMessage({ type: 'WORKER_READY' });
