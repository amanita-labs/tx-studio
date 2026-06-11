import { describe, it, expect } from 'vitest';
import { parseTransaction, computeTransactionHash } from './parser';
import { SAMPLE_TRANSACTIONS } from '@/lib/sample-data';
import { safeStringify } from '@/lib/utils';

// Golden-fixture tests. These parse the repo's real sample transactions and
// snapshot the full DomainTx output. They are the regression net for the
// behavior-preserving refactors (memory-leak fixes, helper extraction): the
// snapshots must stay byte-for-byte identical across those changes.
describe('parseTransaction — golden fixtures', () => {
  for (const sample of SAMPLE_TRANSACTIONS) {
    it(`parses "${sample.name}" deterministically`, async () => {
      const result = await parseTransaction(sample.hex, sample.network);

      expect(result.success).toBe(true);
      // safeStringify normalizes BigInt -> "<n>n" so the snapshot is stable.
      expect(safeStringify(result, 2)).toMatchSnapshot();
    });
  }
});

describe('parseTransaction — error handling', () => {
  it('rejects non-hex input', async () => {
    const result = await parseTransaction('not-hex-at-all!!', 'mainnet');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeTruthy();
  });

  it('rejects too-short hex', async () => {
    const result = await parseTransaction('84a0', 'mainnet');
    expect(result.success).toBe(false);
  });
});

describe('computeTransactionHash', () => {
  it('matches the tx id produced by parseTransaction', async () => {
    for (const sample of SAMPLE_TRANSACTIONS) {
      const parsed = await parseTransaction(sample.hex, sample.network);
      const hash = await computeTransactionHash(sample.hex);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(hash).toBe(parsed.tx?.id);
    }
  });
});
