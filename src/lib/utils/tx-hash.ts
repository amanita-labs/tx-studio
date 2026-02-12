// src/lib/utils/tx-hash.ts
/**
 * Compute transaction hash from hex-encoded transaction CBOR
 * Uses CSL worker to compute hash without full parsing
 * Caches results to avoid recomputing the same hex
 */

// Simple in-memory cache for hash computations (no expiration - valid for session)
const hashCache = new Map<string, string>();

export async function computeTransactionHash(hex: string): Promise<string> {
  // Normalize hex (trim whitespace)
  const normalizedHex = hex.trim().replace(/\s+/g, '');
  
  // Check cache first
  const cachedHash = hashCache.get(normalizedHex);
  if (cachedHash) {
    return cachedHash;
  }

  return new Promise((resolve, reject) => {
    // Create worker
    const worker = new Worker(new URL('../../workers/csl-worker.ts', import.meta.url), {
      type: 'module',
    });

    // Set timeout for worker response
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Hash computation timeout'));
    }, 30000); // 30 second timeout

    // Handle messages from worker
    worker.onmessage = (event) => {
      clearTimeout(timeout);
      worker.terminate();

      const { type, data } = event.data;

      if (type === 'HASH_RESULT') {
        // Cache the computed hash
        hashCache.set(normalizedHex, data.hash);
        resolve(data.hash);
      } else if (type === 'ERROR') {
        reject(new Error(data.error || 'Failed to compute transaction hash'));
      } else {
        reject(new Error('Unexpected response from worker'));
      }
    };

    // Handle worker errors
    worker.onerror = (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(`Worker error: ${error.message}`));
    };

    // Send message to worker
    worker.postMessage({
      type: 'COMPUTE_HASH',
      data: { hex },
    });
  });
}
