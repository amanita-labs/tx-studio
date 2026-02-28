// src/lib/utils/asset-fingerprint.ts
import AssetFingerprint from '@emurgo/cip14-js';

/**
 * Compute the CIP-14 asset fingerprint (asset1...) for a native token.
 */
export function computeAssetFingerprint(policyId: string, assetName: string): string {
  return AssetFingerprint.fromParts(
    Buffer.from(policyId, 'hex'),
    Buffer.from(assetName, 'hex'),
  ).fingerprint();
}

/**
 * Decode a hex-encoded asset name to UTF-8, falling back to hex
 * if the result contains non-printable characters.
 */
export function decodeAssetName(hex: string): string {
  if (!hex) return '';
  try {
    const decoded = Buffer.from(hex, 'hex').toString('utf8');
    if (/^[\x20-\x7E\u00A0-\uFFFF]*$/.test(decoded) && decoded.length > 0) {
      return decoded;
    }
    return hex;
  } catch {
    return hex;
  }
}
