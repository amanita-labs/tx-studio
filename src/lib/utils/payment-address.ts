import { bech32 } from "bech32";
import type { AddressCredInfo, Network } from "@/domain/tx";

export function encodeEnterpriseAddress(
  cred: AddressCredInfo,
  network: Network
): string {
  const networkId = network === "mainnet" ? 1 : 0;
  const typeNibble = cred.kind === "script" ? 0x70 : 0x60;
  const header = typeNibble | networkId;

  const hashBytes = Buffer.from(cred.hash, "hex");
  if (hashBytes.length !== 28) {
    throw new Error(`Invalid credential hash length: ${hashBytes.length} (expected 28)`);
  }
  const payload = Buffer.concat([Buffer.from([header]), hashBytes]);
  const hrp = network === "mainnet" ? "addr" : "addr_test";
  return bech32.encode(hrp, bech32.toWords(payload), 1023);
}
