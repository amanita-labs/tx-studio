import { describe, it, expect } from 'vitest';
import { CBORAnnotator, CBORNode } from '@/lib/cbor-annotator';

const annotator = CBORAnnotator.getInstance();

async function annotateOne(hex: string): Promise<CBORNode> {
  const result = await annotator.annotate(hex);
  expect(result.warnings).toEqual([]);
  expect(result.nodes).toHaveLength(1);
  return result.nodes[0];
}

describe('integers', () => {
  it('decodes 8-byte unsigned integers (lovelace amounts above 4294 ADA)', async () => {
    // 1b 00000002540be400 = 10_000_000_000
    const node = await annotateOne('1b00000002540be400');
    expect(node.value).toBe(10_000_000_000);
    expect(node.startByte).toBe(0);
    expect(node.endByte).toBe(9);
  });

  it('decodes unsigned integers beyond Number.MAX_SAFE_INTEGER as bigint', async () => {
    const node = await annotateOne('1bffffffffffffffff');
    expect(node.value).toBe(18446744073709551615n);
    expect(node.endByte).toBe(9);
  });

  it('decodes 4-byte unsigned integers with the high bit set', async () => {
    const node = await annotateOne('1affffffff');
    expect(node.value).toBe(4294967295);
    expect(node.endByte).toBe(5);
  });

  it('decodes 4-byte and 8-byte negative integers', async () => {
    // 3a fffffffe = -(0xfffffffe + 1) = -4294967295
    const four = await annotateOne('3afffffffe');
    expect(four.value).toBe(-4294967295);
    expect(four.endByte).toBe(5);

    // 3b 00000002540be3ff = -10_000_000_000
    const eight = await annotateOne('3b00000002540be3ff');
    expect(eight.value).toBe(-10_000_000_000);
    expect(eight.endByte).toBe(9);
  });
});

describe('tags', () => {
  it('decodes multi-byte tags — tag 258 wraps every input set in Conway transactions', async () => {
    // d9 0102 (tag 258) 81 (array of 1) 00
    const node = await annotateOne('d901028100');
    expect(node.type).toBe('tag');
    expect(node.semanticTag).toBe(258);
    expect(node.endByte).toBe(5);
    expect(node.children).toHaveLength(1);
    const arr = node.children![0];
    expect(arr.type).toBe('array');
    expect(arr.startByte).toBe(3);
    expect(arr.endByte).toBe(5);
  });

  it('labels 8-byte tag numbers beyond 2^53 exactly instead of rounding', async () => {
    // db ffffffffffffffff (tag 18446744073709551615) 00
    const node = await annotateOne('dbffffffffffffffff00');
    expect(node.label).toContain('18446744073709551615');
    expect(node.semanticTag).toBeUndefined();
  });

  it('decodes 1-byte-argument tags (Plutus constructor tag 121)', async () => {
    // d8 79 (tag 121) 80 (empty array)
    const node = await annotateOne('d87980');
    expect(node.semanticTag).toBe(121);
    expect(node.endByte).toBe(3);
  });
});

describe('indefinite-length items', () => {
  it('decodes indefinite-length arrays', async () => {
    // 9f 01 02 ff
    const node = await annotateOne('9f0102ff');
    expect(node.type).toBe('array');
    expect(node.children).toHaveLength(2);
    expect(node.children![0].value).toBe(1);
    expect(node.children![1].value).toBe(2);
    expect(node.endByte).toBe(4);
  });

  it('decodes indefinite-length maps', async () => {
    // bf 6161 01 ff = {"a": 1}
    const node = await annotateOne('bf616101ff');
    expect(node.type).toBe('object');
    expect(node.children).toHaveLength(2);
    expect(node.children![0].value).toBe('a');
    expect(node.children![1].value).toBe(1);
    expect(node.endByte).toBe(5);
  });

  it('decodes indefinite-length byte strings by concatenating chunks', async () => {
    // 5f 42 0102 41 03 ff
    const node = await annotateOne('5f4201024103ff');
    expect(node.type).toBe('bytes');
    expect(node.value).toBe('010203');
    expect(node.endByte).toBe(7);
  });

  it('decodes indefinite-length text strings by concatenating chunks', async () => {
    // 7f 62 "ab" 61 "c" ff
    const node = await annotateOne('7f6261626163ff');
    expect(node.type).toBe('string');
    expect(node.value).toBe('abc');
    expect(node.endByte).toBe(7);
  });
});

describe('multi-byte length arguments', () => {
  it('decodes arrays with 2-byte length arguments', async () => {
    // 99 0101 (array of 257) followed by 257 zeros
    const node = await annotateOne('990101' + '00'.repeat(257));
    expect(node.type).toBe('array');
    expect(node.children).toHaveLength(257);
    expect(node.endByte).toBe(3 + 257);
  });

  it('decodes maps with 2-byte length arguments', async () => {
    // b9 0100 (map of 256 pairs) with uint keys/values encoded as 2 bytes each
    let hex = 'b90100';
    for (let i = 0; i < 256; i++) {
      hex += '18' + i.toString(16).padStart(2, '0') + '00';
    }
    const node = await annotateOne(hex);
    expect(node.type).toBe('object');
    expect(node.children).toHaveLength(512);
    expect(node.endByte).toBe(3 + 256 * 3);
  });

  it('decodes text strings with 2-byte length arguments', async () => {
    // 79 0100 followed by 256 × "a"
    const node = await annotateOne('790100' + '61'.repeat(256));
    expect(node.value).toBe('a'.repeat(256));
    expect(node.endByte).toBe(3 + 256);
  });

  it('decodes byte strings with 4-byte length arguments', async () => {
    // 5a 00000100 followed by 256 bytes
    const node = await annotateOne('5a00000100' + 'ab'.repeat(256));
    expect(node.type).toBe('bytes');
    expect(node.value).toBe('ab'.repeat(256));
    expect(node.endByte).toBe(5 + 256);
  });
});

describe('floats and simple values', () => {
  it('decodes half-precision floats', async () => {
    const node = await annotateOne('f93c00');
    expect(node.value).toBe(1);
    expect(node.endByte).toBe(3);
  });

  it('decodes single-precision floats', async () => {
    const node = await annotateOne('fa3fc00000');
    expect(node.value).toBe(1.5);
    expect(node.endByte).toBe(5);
  });

  it('decodes double-precision floats', async () => {
    const node = await annotateOne('fb3ff199999999999a');
    expect(node.value).toBe(1.1);
    expect(node.endByte).toBe(9);
  });

  it('decodes booleans, null, and undefined', async () => {
    const t = await annotateOne('f5');
    expect(t.type).toBe('boolean');
    expect(t.value).toBe(true);

    const f = await annotateOne('f4');
    expect(f.type).toBe('boolean');
    expect(f.value).toBe(false);

    const n = await annotateOne('f6');
    expect(n.type).toBe('null');
    expect(n.value).toBe(null);

    const u = await annotateOne('f7');
    expect(u.type).toBe('undefined');
    expect(u.value).toBe(undefined);
  });
});

describe('malformed input', () => {
  it('reports a warning for truncated input instead of fabricating nodes', async () => {
    // array of 2 with only 1 element present
    const result = await annotator.annotate('8200');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('rejects invalid hex instead of silently decoding it as zero bytes', async () => {
    await expect(annotator.annotate('0xa16161')).rejects.toThrow(/hex/i);
    await expect(annotator.annotate('zz')).rejects.toThrow(/hex/i);
  });

  it('reports the byte offset where parsing actually failed', async () => {
    // map of 2 pairs, truncated after the first key: fails at byte 2
    const result = await annotator.annotate('a200');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('byte 2');
  });

  it('rejects two-byte simple values below 32 as not well-formed (RFC 8949 §3.3)', async () => {
    const result = await annotator.annotate('f814');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.nodes).toHaveLength(0);
  });

  it('reports a warning for a stray break byte', async () => {
    const result = await annotator.annotate('ff');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.nodes).toHaveLength(0);
  });
});

describe('Conway-era transaction body fragment', () => {
  // a2                       map(2)
  //   00                     key 0 (inputs)
  //   d90102                 tag 258 (set)
  //     81                   array(1)
  //       82                 array(2)
  //         5820 ab×32       tx id
  //         00               index
  //   02                     key 2 (fee)
  //   1a0002dfb0             188_336 lovelace
  const hex = 'a200d9010281825820' + 'ab'.repeat(32) + '00' + '02' + '1a0002dfb0';

  it('annotates the full structure with contiguous byte spans', async () => {
    const node = await annotateOne(hex);
    expect(node.type).toBe('object');
    expect(node.endByte).toBe(hex.length / 2);

    const [inputsKey, inputsSet, feeKey, feeValue] = node.children!;
    expect(inputsKey.value).toBe(0);
    expect(inputsSet.type).toBe('tag');
    expect(inputsSet.semanticTag).toBe(258);
    expect(feeKey.value).toBe(2);
    expect(feeValue.value).toBe(188_336);

    // spans are contiguous: each child starts where the previous one ended
    expect(inputsSet.startByte).toBe(inputsKey.endByte);
    expect(feeKey.startByte).toBe(inputsSet.endByte);
    expect(feeValue.startByte).toBe(feeKey.endByte);

    const input = inputsSet.children![0].children![0];
    expect(input.children![0].type).toBe('bytes');
    expect(input.children![0].value).toBe('ab'.repeat(32));
    expect(input.children![1].value).toBe(0);
  });
});
