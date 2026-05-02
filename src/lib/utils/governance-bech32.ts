import { bech32 } from "bech32";
import type { AddressCredInfo } from "@/domain/tx";

function encodeWithHrp(hrp: string, bytes: Buffer): string {
  return bech32.encode(hrp, bech32.toWords(bytes), 1023);
}

function hashBuffer(hash: string): Buffer {
  const buf = Buffer.from(hash, "hex");
  if (buf.length !== 28) {
    throw new Error(`Invalid credential hash length: ${buf.length} (expected 28)`);
  }
  return buf;
}

// CIP-0129: drep1 / drep_script1 — no header byte (legacy bech32 encoding).
export function encodeDrepBech32(cred: AddressCredInfo): string {
  const hrp = cred.kind === "script" ? "drep_script" : "drep";
  return encodeWithHrp(hrp, hashBuffer(cred.hash));
}

// CIP-0129 committee credentials. Header byte = (keyType << 4) | credentialType
// keyType: hot=0x00, cold=0x01. credentialType: keyHash=0x02, scriptHash=0x03.
export function encodeCommitteeBech32(
  cred: AddressCredInfo,
  scope: "hot" | "cold"
): string {
  const hrp = scope === "hot" ? "cc_hot" : "cc_cold";
  const keyType = scope === "hot" ? 0x00 : 0x01;
  const credentialType = cred.kind === "script" ? 0x03 : 0x02;
  const headerByte = (keyType << 4) | credentialType;
  const payload = Buffer.concat([Buffer.from([headerByte]), hashBuffer(cred.hash)]);
  return encodeWithHrp(hrp, payload);
}

// pool1... — HRP "pool", raw 28-byte payload, key hash only.
export function encodePoolBech32(hash: string): string {
  return encodeWithHrp("pool", hashBuffer(hash));
}
