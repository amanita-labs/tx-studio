// src/lib/cip10-registry.ts
// CIP-0010 Transaction Metadata Label Registry
// Fetched from: https://github.com/cardano-foundation/CIPs/blob/master/CIP-0010/registry.json

const REGISTRY_URL =
  'https://raw.githubusercontent.com/cardano-foundation/CIPs/refs/heads/master/CIP-0010/registry.json';

let registry: Map<number, string> | null = null;
let fetchPromise: Promise<void> | null = null;

interface RegistryEntry {
  transaction_metadatum_label: number;
  description: string;
}

export async function ensureCip10Registry(): Promise<void> {
  if (registry) return;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(REGISTRY_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<RegistryEntry[]>;
    })
    .then((entries) => {
      registry = new Map(
        entries.map((e) => [e.transaction_metadatum_label, e.description]),
      );
    })
    .catch(() => {
      // On failure, fall back to an empty map so lookups return undefined
      registry = new Map();
    });

  return fetchPromise;
}

export function getCip10Entry(label: number): string | undefined {
  return registry?.get(label);
}
