// src/lib/cbor-annotator.ts
import { bytesToHex, hexToBytes } from '@/lib/utils/hex';

export interface CBORNode {
  id: string;
  type: 'array' | 'object' | 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'bytes' | 'tag';
  value: unknown;
  startByte: number;
  endByte: number;
  children?: CBORNode[];
  label?: string;
  description?: string;
  semanticTag?: number;
}

export interface CBORAnnotation {
  nodes: CBORNode[];
  totalBytes: number;
  warnings: string[];
}

const BREAK = 0xff;

class CBORParseError extends Error {
  constructor(message: string, readonly offset: number) {
    super(message);
  }
}

interface Header {
  majorType: number;
  /** Argument value (length, integer value, or tag number). `null` means indefinite length. */
  arg: bigint | null;
  /** Offset just past the header bytes. */
  dataStart: number;
}

export class CBORAnnotator {
  private static instance: CBORAnnotator;

  static getInstance(): CBORAnnotator {
    if (!CBORAnnotator.instance) {
      CBORAnnotator.instance = new CBORAnnotator();
    }
    return CBORAnnotator.instance;
  }

  async annotate(hex: string): Promise<CBORAnnotation> {
    try {
      const bytes = hexToBytes(hex);
      const result = this.parseCBORWithPositions(bytes, 0);

      return {
        nodes: result.nodes,
        totalBytes: bytes.length,
        warnings: result.warnings
      };
    } catch (error) {
      throw new Error(`CBOR parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseCBORWithPositions(bytes: Uint8Array, startOffset: number): { nodes: CBORNode[], warnings: string[] } {
    const nodes: CBORNode[] = [];
    const warnings: string[] = [];
    let offset = startOffset;

    try {
      while (offset < bytes.length) {
        const node = this.parseNode(bytes, offset);
        nodes.push(node);
        offset = node.endByte;
      }
    } catch (error) {
      const failedAt = error instanceof CBORParseError ? error.offset : offset;
      warnings.push(`Parsing stopped at byte ${failedAt}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { nodes, warnings };
  }

  private readHeader(bytes: Uint8Array, offset: number): Header {
    if (offset >= bytes.length) {
      throw new CBORParseError('Unexpected end of data', offset);
    }

    const firstByte = bytes[offset];
    const majorType = (firstByte & 0xe0) >> 5;
    const minorType = firstByte & 0x1f;

    if (minorType < 24) {
      return { majorType, arg: BigInt(minorType), dataStart: offset + 1 };
    }

    if (minorType >= 24 && minorType <= 27) {
      const argLength = 1 << (minorType - 24); // 1, 2, 4, or 8 bytes
      if (offset + 1 + argLength > bytes.length) {
        throw new CBORParseError('Unexpected end of data in header argument', offset);
      }
      let arg = 0n;
      for (let i = 0; i < argLength; i++) {
        arg = (arg << 8n) | BigInt(bytes[offset + 1 + i]);
      }
      return { majorType, arg, dataStart: offset + 1 + argLength };
    }

    if (minorType === 31) {
      return { majorType, arg: null, dataStart: offset + 1 };
    }

    throw new CBORParseError(`Reserved additional information value ${minorType}`, offset);
  }

  /** Convert a header argument to a number, for use as a length. */
  private toLength(arg: bigint, bytes: Uint8Array, dataStart: number, itemOffset: number): number {
    if (arg > BigInt(bytes.length - dataStart)) {
      throw new CBORParseError(`Declared length ${arg} exceeds remaining data`, itemOffset);
    }
    return Number(arg);
  }

  /** Represent an integer as a JS number when safe, bigint otherwise. */
  private toIntValue(arg: bigint): number | bigint {
    return arg <= BigInt(Number.MAX_SAFE_INTEGER) && arg >= -BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(arg)
      : arg;
  }

  private parseNode(bytes: Uint8Array, offset: number): CBORNode {
    if (offset >= bytes.length) {
      throw new CBORParseError('Unexpected end of data', offset);
    }
    if (bytes[offset] === BREAK) {
      throw new CBORParseError('Unexpected break byte outside indefinite-length item', offset);
    }

    const header = this.readHeader(bytes, offset);

    switch (header.majorType) {
      case 0: return this.parseUnsignedInteger(header, offset);
      case 1: return this.parseNegativeInteger(header, offset);
      case 2: return this.parseByteString(bytes, header, offset);
      case 3: return this.parseTextString(bytes, header, offset);
      case 4: return this.parseArray(bytes, header, offset);
      case 5: return this.parseMap(bytes, header, offset);
      case 6: return this.parseTag(bytes, header, offset);
      default: return this.parseFloatOrSimple(bytes, header, offset);
    }
  }

  private parseUnsignedInteger(header: Header, offset: number): CBORNode {
    if (header.arg === null) {
      throw new CBORParseError('Indefinite length is not valid for integers', offset);
    }
    const value = this.toIntValue(header.arg);

    return {
      id: `uint-${offset}`,
      type: 'number',
      value,
      startByte: offset,
      endByte: header.dataStart,
      label: `Unsigned Integer: ${value}`,
      description: `Unsigned integer (${header.dataStart - offset} byte encoding)`
    };
  }

  private parseNegativeInteger(header: Header, offset: number): CBORNode {
    if (header.arg === null) {
      throw new CBORParseError('Indefinite length is not valid for integers', offset);
    }
    const value = this.toIntValue(-1n - header.arg);

    return {
      id: `nint-${offset}`,
      type: 'number',
      value,
      startByte: offset,
      endByte: header.dataStart,
      label: `Negative Integer: ${value}`,
      description: `Negative integer (${header.dataStart - offset} byte encoding)`
    };
  }

  /**
   * Read the chunks of an indefinite-length string (major type 2 or 3).
   * Returns the concatenated chunk ranges and the offset past the break byte.
   */
  private readIndefiniteChunks(bytes: Uint8Array, offset: number, majorType: number): { ranges: Array<[number, number]>, endOffset: number } {
    const ranges: Array<[number, number]> = [];
    let current = offset;

    while (true) {
      if (current >= bytes.length) {
        throw new CBORParseError('Unexpected end of data in indefinite-length string', current);
      }
      if (bytes[current] === BREAK) {
        return { ranges, endOffset: current + 1 };
      }
      const chunk = this.readHeader(bytes, current);
      if (chunk.majorType !== majorType || chunk.arg === null) {
        throw new CBORParseError('Indefinite-length string chunks must be definite-length strings of the same type', current);
      }
      const length = this.toLength(chunk.arg, bytes, chunk.dataStart, current);
      ranges.push([chunk.dataStart, chunk.dataStart + length]);
      current = chunk.dataStart + length;
    }
  }

  /**
   * Resolve the content ranges of a string (major type 2 or 3): a single
   * range when definite-length, one range per chunk when indefinite.
   */
  private readStringBody(bytes: Uint8Array, header: Header, offset: number, majorType: number): { ranges: Array<[number, number]>, endOffset: number } {
    if (header.arg === null) {
      return this.readIndefiniteChunks(bytes, header.dataStart, majorType);
    }
    const length = this.toLength(header.arg, bytes, header.dataStart, offset);
    return { ranges: [[header.dataStart, header.dataStart + length]], endOffset: header.dataStart + length };
  }

  private parseByteString(bytes: Uint8Array, header: Header, offset: number): CBORNode {
    const { ranges, endOffset } = this.readStringBody(bytes, header, offset, 2);
    const value = ranges.map(([start, stop]) => bytesToHex(bytes.subarray(start, stop))).join('');
    const byteCount = value.length / 2;
    return {
      id: `bytes-${offset}`,
      type: 'bytes',
      value,
      startByte: offset,
      endByte: endOffset,
      label: `Byte String (${byteCount} bytes)`,
      description: `Binary data: ${value.slice(0, 32)}${value.length > 32 ? '...' : ''}`
    };
  }

  private parseTextString(bytes: Uint8Array, header: Header, offset: number): CBORNode {
    const { ranges, endOffset } = this.readStringBody(bytes, header, offset, 3);
    const value = ranges.map(([start, stop]) => new TextDecoder().decode(bytes.subarray(start, stop))).join('');

    return {
      id: `text-${offset}`,
      type: 'string',
      value,
      startByte: offset,
      endByte: endOffset,
      label: `Text String: "${value.length > 48 ? value.slice(0, 48) + '...' : value}"`,
      description: `UTF-8 text string`
    };
  }

  /**
   * Parse the items of a container body. `count` is the number of items,
   * or null for indefinite length (read until a break byte).
   */
  private parseItems(bytes: Uint8Array, offset: number, count: number | null): { children: CBORNode[], endOffset: number } {
    const children: CBORNode[] = [];
    let current = offset;

    while (count === null || children.length < count) {
      if (current >= bytes.length) {
        throw new CBORParseError(count === null ? 'Unexpected end of data in indefinite-length container' : 'Unexpected end of data in container', current);
      }
      if (count === null && bytes[current] === BREAK) {
        return { children, endOffset: current + 1 };
      }
      const child = this.parseNode(bytes, current);
      children.push(child);
      current = child.endByte;
    }

    return { children, endOffset: current };
  }

  private parseArray(bytes: Uint8Array, header: Header, offset: number): CBORNode {
    // Item counts are not validated against remaining bytes up front:
    // parseItems fails at the exact offset where the data runs out.
    const count = header.arg === null ? null : Number(header.arg);
    const { children, endOffset } = this.parseItems(bytes, header.dataStart, count);

    return {
      id: `array-${offset}`,
      type: 'array',
      value: children.map(c => c.value),
      startByte: offset,
      endByte: endOffset,
      children,
      label: `Array (${children.length} items${header.arg === null ? ', indefinite' : ''})`,
      description: `CBOR array with ${children.length} elements`
    };
  }

  private parseMap(bytes: Uint8Array, header: Header, offset: number): CBORNode {
    const pairCount = header.arg === null ? null : Number(header.arg);
    const { children, endOffset } = this.parseItems(
      bytes,
      header.dataStart,
      pairCount === null ? null : pairCount * 2
    );

    if (pairCount === null && children.length % 2 !== 0) {
      throw new CBORParseError('Indefinite-length map has an odd number of items', offset);
    }

    return {
      id: `map-${offset}`,
      type: 'object',
      value: {},
      startByte: offset,
      endByte: endOffset,
      children,
      label: `Map (${children.length / 2} pairs${header.arg === null ? ', indefinite' : ''})`,
      description: `CBOR map with ${children.length / 2} key-value pairs`
    };
  }

  private parseTag(bytes: Uint8Array, header: Header, offset: number): CBORNode {
    if (header.arg === null) {
      throw new CBORParseError('Indefinite length is not valid for tags', offset);
    }
    // semanticTag stays a JS number; leave it unset for (unrealistic) tag
    // numbers beyond 2^53 rather than silently rounding them.
    const semanticTag = header.arg <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(header.arg) : undefined;
    const tagText = header.arg.toString();
    const taggedValue = this.parseNode(bytes, header.dataStart);

    return {
      id: `tag-${offset}`,
      type: 'tag',
      value: taggedValue.value,
      startByte: offset,
      endByte: taggedValue.endByte,
      children: [taggedValue],
      semanticTag,
      label: `Tag ${tagText}${semanticTag === 258 ? ' (set)' : semanticTag !== undefined && semanticTag >= 121 && semanticTag <= 127 ? ` (Plutus constructor ${semanticTag - 121})` : ''}`,
      description: `CBOR semantic tag ${tagText}`
    };
  }

  private parseFloatOrSimple(bytes: Uint8Array, header: Header, offset: number): CBORNode {
    const minorType = bytes[offset] & 0x1f;

    // Simple values: false / true / null / undefined
    if (minorType === 20 || minorType === 21) {
      const value = minorType === 21;
      return {
        id: `bool-${offset}`,
        type: 'boolean',
        value,
        startByte: offset,
        endByte: header.dataStart,
        label: `Boolean: ${value}`,
        description: 'CBOR boolean'
      };
    }
    if (minorType === 22) {
      return {
        id: `null-${offset}`,
        type: 'null',
        value: null,
        startByte: offset,
        endByte: header.dataStart,
        label: 'Null',
        description: 'CBOR null'
      };
    }
    if (minorType === 23) {
      return {
        id: `undefined-${offset}`,
        type: 'undefined',
        value: undefined,
        startByte: offset,
        endByte: header.dataStart,
        label: 'Undefined',
        description: 'CBOR undefined'
      };
    }

    // Floats (half / single / double precision)
    if (minorType >= 25 && minorType <= 27) {
      const value = this.readFloat(bytes, offset + 1, minorType);
      return {
        id: `float-${offset}`,
        type: 'number',
        value,
        startByte: offset,
        endByte: header.dataStart,
        label: `Float: ${value}`,
        description: `IEEE 754 ${minorType === 25 ? 'half' : minorType === 26 ? 'single' : 'double'}-precision float`
      };
    }

    // Remaining cases: unassigned simple values (0-19 immediate, or one-byte via minor 24)
    // RFC 8949 §3.3: 0xf8 followed by a byte below 32 is not well-formed
    if (minorType === 24 && header.arg !== null && header.arg < 32n) {
      throw new CBORParseError(`Two-byte simple value ${header.arg} is not well-formed (must be 32-255)`, offset);
    }
    const value = Number(header.arg);
    return {
      id: `simple-${offset}`,
      type: 'number',
      value,
      startByte: offset,
      endByte: header.dataStart,
      label: `Simple Value: ${value}`,
      description: 'CBOR simple value'
    };
  }

  private readFloat(bytes: Uint8Array, offset: number, minorType: number): number {
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    if (minorType === 26) return view.getFloat32(offset);
    if (minorType === 27) return view.getFloat64(offset);

    // Half-precision: decode manually (no DataView support)
    const half = view.getUint16(offset);
    const sign = half & 0x8000 ? -1 : 1;
    const exponent = (half >> 10) & 0x1f;
    const mantissa = half & 0x03ff;
    if (exponent === 0) return sign * mantissa * 2 ** -24;
    if (exponent === 31) return mantissa === 0 ? sign * Infinity : NaN;
    return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
  }
}
