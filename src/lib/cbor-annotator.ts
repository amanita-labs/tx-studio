// src/lib/cbor-annotator.ts
import { decode } from 'cbor-x';

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
      // Convert hex to bytes
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }

      // Parse CBOR with position tracking
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
        if (node) {
          nodes.push(node);
          offset = node.endByte;
        } else {
          break;
        }
      }
    } catch (error) {
      warnings.push(`Parsing stopped at byte ${offset}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { nodes, warnings };
  }

  private parseNode(bytes: Uint8Array, offset: number): CBORNode | null {
    if (offset >= bytes.length) return null;

    const firstByte = bytes[offset];
    const majorType = (firstByte & 0xE0) >> 5;

    let node: CBORNode;

    switch (majorType) {
      case 0: // Unsigned integer
        node = this.parseUnsignedInteger(bytes, offset);
        break;
      case 1: // Negative integer
        node = this.parseNegativeInteger(bytes, offset);
        break;
      case 2: // Byte string
        node = this.parseByteString(bytes, offset);
        break;
      case 3: // Text string
        node = this.parseTextString(bytes, offset);
        break;
      case 4: // Array
        node = this.parseArray(bytes, offset);
        break;
      case 5: // Map/Object
        node = this.parseMap(bytes, offset);
        break;
      case 6: // Tag
        node = this.parseTag(bytes, offset);
        break;
      case 7: // Float/Simple/Stop
        node = this.parseFloatOrSimple(bytes, offset);
        break;
      default:
        return null;
    }

    return node;
  }

  private parseUnsignedInteger(bytes: Uint8Array, offset: number): CBORNode {
    const firstByte = bytes[offset];
    const minorType = firstByte & 0x1F;
    let value: number;
    let endOffset = offset + 1;

    if (minorType < 24) {
      value = minorType;
    } else if (minorType === 24) {
      value = bytes[offset + 1];
      endOffset = offset + 2;
    } else if (minorType === 25) {
      value = (bytes[offset + 1] << 8) | bytes[offset + 2];
      endOffset = offset + 3;
    } else if (minorType === 26) {
      value = (bytes[offset + 1] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 8) | bytes[offset + 4];
      endOffset = offset + 5;
    } else {
      value = 0; // 64-bit not supported in this simplified version
    }

    return {
      id: `uint-${offset}`,
      type: 'number',
      value,
      startByte: offset,
      endByte: endOffset,
      label: `Unsigned Integer: ${value}`,
      description: `8-bit unsigned integer value`
    };
  }

  private parseNegativeInteger(bytes: Uint8Array, offset: number): CBORNode {
    const firstByte = bytes[offset];
    const minorType = firstByte & 0x1F;
    let value: number;
    let endOffset = offset + 1;

    if (minorType < 24) {
      value = -(minorType + 1);
    } else if (minorType === 24) {
      value = -(bytes[offset + 1] + 1);
      endOffset = offset + 2;
    } else if (minorType === 25) {
      value = -(((bytes[offset + 1] << 8) | bytes[offset + 2]) + 1);
      endOffset = offset + 3;
    } else {
      value = 0;
    }

    return {
      id: `nint-${offset}`,
      type: 'number',
      value,
      startByte: offset,
      endByte: endOffset,
      label: `Negative Integer: ${value}`,
      description: `8-bit negative integer value`
    };
  }

  private parseByteString(bytes: Uint8Array, offset: number): CBORNode {
    const firstByte = bytes[offset];
    const minorType = firstByte & 0x1F;
    let length: number;
    let endOffset = offset + 1;

    if (minorType < 24) {
      length = minorType;
    } else if (minorType === 24) {
      length = bytes[offset + 1];
      endOffset = offset + 2;
    } else if (minorType === 25) {
      length = (bytes[offset + 1] << 8) | bytes[offset + 2];
      endOffset = offset + 3;
    } else {
      length = 0;
    }

    const value = Array.from(bytes.slice(endOffset, endOffset + length))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      id: `bytes-${offset}`,
      type: 'bytes',
      value,
      startByte: offset,
      endByte: endOffset + length,
      label: `Byte String (${length} bytes)`,
      description: `Binary data: ${value.slice(0, 32)}${value.length > 32 ? '...' : ''}`
    };
  }

  private parseTextString(bytes: Uint8Array, offset: number): CBORNode {
    const firstByte = bytes[offset];
    const minorType = firstByte & 0x1F;
    let length: number;
    let endOffset = offset + 1;

    if (minorType < 24) {
      length = minorType;
    } else if (minorType === 24) {
      length = bytes[offset + 1];
      endOffset = offset + 2;
    } else {
      length = 0;
    }

    const value = new TextDecoder().decode(bytes.slice(endOffset, endOffset + length));

    return {
      id: `text-${offset}`,
      type: 'string',
      value,
      startByte: offset,
      endByte: endOffset + length,
      label: `Text String: "${value}"`,
      description: `UTF-8 text string`
    };
  }

  private parseArray(bytes: Uint8Array, offset: number): CBORNode {
    const firstByte = bytes[offset];
    const minorType = firstByte & 0x1F;
    let length: number;
    let endOffset = offset + 1;

    if (minorType < 24) {
      length = minorType;
    } else if (minorType === 24) {
      length = bytes[offset + 1];
      endOffset = offset + 2;
    } else {
      length = 0;
    }

    const children: CBORNode[] = [];
    let currentOffset = endOffset;

    for (let i = 0; i < length && currentOffset < bytes.length; i++) {
      const child = this.parseNode(bytes, currentOffset);
      if (child) {
        children.push(child);
        currentOffset = child.endByte;
      } else {
        break;
      }
    }

    return {
      id: `array-${offset}`,
      type: 'array',
      value: children.map(c => c.value),
      startByte: offset,
      endByte: currentOffset,
      children,
      label: `Array (${length} items)`,
      description: `CBOR array with ${length} elements`
    };
  }

  private parseMap(bytes: Uint8Array, offset: number): CBORNode {
    const firstByte = bytes[offset];
    const minorType = firstByte & 0x1F;
    let length: number;
    let endOffset = offset + 1;

    if (minorType < 24) {
      length = minorType;
    } else if (minorType === 24) {
      length = bytes[offset + 1];
      endOffset = offset + 2;
    } else {
      length = 0;
    }

    const children: CBORNode[] = [];
    let currentOffset = endOffset;

    for (let i = 0; i < length && currentOffset < bytes.length; i++) {
      // Parse key
      const key = this.parseNode(bytes, currentOffset);
      if (key) {
        children.push(key);
        currentOffset = key.endByte;
      } else {
        break;
      }

      // Parse value
      const value = this.parseNode(bytes, currentOffset);
      if (value) {
        children.push(value);
        currentOffset = value.endByte;
      } else {
        break;
      }
    }

    return {
      id: `map-${offset}`,
      type: 'object',
      value: {},
      startByte: offset,
      endByte: currentOffset,
      children,
      label: `Map (${length} pairs)`,
      description: `CBOR map with ${length} key-value pairs`
    };
  }

  private parseTag(bytes: Uint8Array, offset: number): CBORNode {
    const firstByte = bytes[offset];
    const minorType = firstByte & 0x1F;
    let tagValue: number;
    let endOffset = offset + 1;

    if (minorType < 24) {
      tagValue = minorType;
    } else if (minorType === 24) {
      tagValue = bytes[offset + 1];
      endOffset = offset + 2;
    } else {
      tagValue = 0;
    }

    // Parse the tagged value
    const taggedValue = this.parseNode(bytes, endOffset);
    const finalEndOffset = taggedValue ? taggedValue.endByte : endOffset;

    return {
      id: `tag-${offset}`,
      type: 'tag',
      value: taggedValue?.value,
      startByte: offset,
      endByte: finalEndOffset,
      children: taggedValue ? [taggedValue] : undefined,
      semanticTag: tagValue,
      label: `Tag ${tagValue}`,
      description: `CBOR semantic tag ${tagValue}`
    };
  }

  private parseFloatOrSimple(bytes: Uint8Array, offset: number): CBORNode {
    const firstByte = bytes[offset];
    const minorType = firstByte & 0x1F;

    if (minorType < 24) {
      return {
        id: `simple-${offset}`,
        type: 'number',
        value: minorType,
        startByte: offset,
        endByte: offset + 1,
        label: `Simple Value: ${minorType}`,
        description: `CBOR simple value`
      };
    }

    return {
      id: `float-${offset}`,
      type: 'number',
      value: 0,
      startByte: offset,
      endByte: offset + 1,
      label: `Float/Simple`,
      description: `CBOR float or simple value`
    };
  }
}
