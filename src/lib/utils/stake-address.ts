import { bech32 } from "bech32";
import type { Network, StakeCredential } from "@/domain/tx";

export function encodeStakeAddress(
  credential: StakeCredential,
  network: Network
): string {
  const networkId = network === "mainnet" ? 1 : 0;
  const typeNibble = credential.kind === "script" ? 0xf0 : 0xe0;
  const header = typeNibble | networkId;

  const hashBytes = Buffer.from(credential.hash, "hex");
  if (hashBytes.length !== 28) {
    throw new Error(`Invalid stake credential hash length: ${hashBytes.length} (expected 28)`);
  }
  const payload = Buffer.concat([Buffer.from([header]), hashBytes]);
  const hrp = network === "mainnet" ? "stake" : "stake_test";
  return bech32.encode(hrp, bech32.toWords(payload), 1023);
}
