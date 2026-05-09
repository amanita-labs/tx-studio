import { blake2b } from 'blakejs';
import { getKnownCredLabel } from '@/lib/labels';
import { hexToBytes } from '@/lib/utils/hex';
import type { Network } from '@/domain/tx';

/**
 * CIP-100 witnesses identify themselves by their ed25519 public key (hex).
 * Cardano credentials use blake2b-224 of the pubkey, so we hash before lookup.
 */
function blake2b224Hex(pubkeyHex: string): string {
  const bytes = blake2b(hexToBytes(pubkeyHex), undefined, 28);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function lookupAuthorLabel(
  pubkeyHex: string | undefined,
  network: Network,
): { name: string; description?: string } | undefined {
  if (!pubkeyHex) return undefined;
  let credHash: string;
  try {
    credHash = blake2b224Hex(pubkeyHex);
  } catch {
    return undefined;
  }
  // DReps and CC members both register CIP-100 metadata; check both purposes.
  const drep = getKnownCredLabel(credHash, 'drep', network);
  if (drep) return { name: drep.name, description: drep.description };
  const cc = getKnownCredLabel(credHash, 'cc', network);
  if (cc) return { name: cc.name, description: cc.description };
  return undefined;
}
