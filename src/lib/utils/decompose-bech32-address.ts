import { bech32 } from "bech32";
import type { AddressCreds } from "@/domain/tx";

// Decompose a Cardano shelley-era bech32 address into its payment / stake credentials
// without using CSL. Returns undefined for byron, pointer, or malformed addresses —
// callers fall back to plain bech32 string matching.
//
// Header byte layout (CIP-19 / Shelley spec):
//   bits 7..4 = address type, bit 3..0 = network id
//
// Type nibbles we handle:
//   0x0 base: keyhash payment + keyhash stake
//   0x1 base: scripthash payment + keyhash stake
//   0x2 base: keyhash payment + scripthash stake
//   0x3 base: scripthash payment + scripthash stake
//   0x6 enterprise: keyhash payment, no stake
//   0x7 enterprise: scripthash payment, no stake
//   0xe reward: keyhash stake
//   0xf reward: scripthash stake
//
// 0x4/0x5 are pointer addresses (uncommon, decomposable but stake side is a pointer
// not a credential — we return only paymentCred). 0x8 is byron — we return undefined.

export function decomposeBech32Address(addr: string): AddressCreds | undefined {
  if (!addr) return undefined;
  // Byron addresses don't bech32-decode with HRP "addr"/"addr_test" — they use base58.
  // bech32.decode will throw.
  let decoded: { words: number[] };
  try {
    decoded = bech32.decode(addr, 1023);
  } catch {
    return undefined;
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(bech32.fromWords(decoded.words));
  } catch {
    return undefined;
  }
  if (bytes.length < 1) return undefined;
  const header = bytes[0];
  const typeNibble = (header >> 4) & 0x0f;

  const toHex = (start: number, end: number) =>
    Buffer.from(bytes.slice(start, end)).toString("hex");

  // Base addresses: 1-byte header + 28-byte payment + 28-byte stake = 57 bytes
  if (typeNibble <= 0x3) {
    if (bytes.length < 57) return undefined;
    const paymentKind = (typeNibble & 0x1) === 0 ? "key" : "script";
    const stakeKind = (typeNibble & 0x2) === 0 ? "key" : "script";
    return {
      paymentCred: { kind: paymentKind, hash: toHex(1, 29) },
      stakeCred: { kind: stakeKind, hash: toHex(29, 57) },
    };
  }

  // Pointer addresses: keep payment, drop pointer stake.
  if (typeNibble === 0x4 || typeNibble === 0x5) {
    if (bytes.length < 29) return undefined;
    const paymentKind = typeNibble === 0x4 ? "key" : "script";
    return { paymentCred: { kind: paymentKind, hash: toHex(1, 29) } };
  }

  // Enterprise addresses: 1-byte header + 28-byte payment = 29 bytes
  if (typeNibble === 0x6 || typeNibble === 0x7) {
    if (bytes.length < 29) return undefined;
    const paymentKind = typeNibble === 0x6 ? "key" : "script";
    return { paymentCred: { kind: paymentKind, hash: toHex(1, 29) } };
  }

  // Reward addresses: 1-byte header + 28-byte stake = 29 bytes
  if (typeNibble === 0xe || typeNibble === 0xf) {
    if (bytes.length < 29) return undefined;
    const stakeKind = typeNibble === 0xe ? "key" : "script";
    return { stakeCred: { kind: stakeKind, hash: toHex(1, 29) } };
  }

  return undefined;
}
