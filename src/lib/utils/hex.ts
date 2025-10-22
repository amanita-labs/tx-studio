// src/lib/utils/hex.ts
export function isValidHex(hex: string): boolean {
  return /^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0;
}

export function hexToBytes(hex: string): Uint8Array {
  if (!isValidHex(hex)) {
    throw new Error('Invalid hex string');
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function formatHexDump(hex: string, bytesPerLine: number = 16): string[] {
  const lines: string[] = [];
  const bytes = hexToBytes(hex);
  
  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const offset = i.toString(16).padStart(8, '0');
    const hexPart = Array.from(bytes.slice(i, i + bytesPerLine))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    const asciiPart = Array.from(bytes.slice(i, i + bytesPerLine))
      .map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')
      .join('');
    
    lines.push(`${offset}: ${hexPart.padEnd(bytesPerLine * 3 - 1)} |${asciiPart}|`);
  }
  
  return lines;
}

export function getByteRange(hex: string, startByte: number, endByte: number): string {
  const startIndex = startByte * 2;
  const endIndex = endByte * 2;
  return hex.slice(startIndex, endIndex);
}
