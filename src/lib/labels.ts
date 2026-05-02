// src/lib/labels.ts
import rawLabels from '@/data/known-labels.json';
import { type AddressCreds, type DomainTx, type Network } from '@/domain/tx';
import { encodeEnterpriseAddress } from '@/lib/utils/payment-address';
import { encodeStakeAddress } from '@/lib/utils/stake-address';
import {
  encodeCommitteeBech32,
  encodeDrepBech32,
  encodePoolBech32,
} from '@/lib/utils/governance-bech32';
import { decomposeBech32Address } from '@/lib/utils/decompose-bech32-address';

export type CredentialPurpose = 'payment' | 'stake' | 'drep' | 'cc' | 'pool';

export type TransactionLabelCategory =
  | 'script'
  | 'address'
  | 'payment-cred'
  | 'stake-cred'
  | 'drep'
  | 'cc'
  | 'pool';

export type KnownLabelEntry = {
  name: string;
  description?: string;
  url?: string;
};

type CredentialEntry = KnownLabelEntry & { kind?: 'key' | 'script' };

type RawLabels = {
  scripts?: Record<string, KnownLabelEntry>;
  addresses?: Record<string, KnownLabelEntry>;
  credentials?: Partial<Record<CredentialPurpose, Record<string, CredentialEntry>>>;
  // Legacy shape — read but not authored going forward.
  signerKeyHashes?: Record<string, KnownLabelEntry>;
};

const parsedLabels = rawLabels as RawLabels;

const NETWORKS: Network[] = ['mainnet', 'preprod', 'preview'];

const normalizeKey = (value: string) => value.trim().toLowerCase();

type Index = {
  byScriptHash: Map<string, KnownLabelEntry>;
  byAddress: Map<string, KnownLabelEntry>;
  byCred: Record<CredentialPurpose, Map<string, KnownLabelEntry>>;
};

function emptyIndex(): Index {
  return {
    byScriptHash: new Map(),
    byAddress: new Map(),
    byCred: {
      payment: new Map(),
      stake: new Map(),
      drep: new Map(),
      cc: new Map(),
      pool: new Map(),
    },
  };
}

function setOnce<K, V>(map: Map<K, V>, key: K, value: V) {
  if (!map.has(key)) map.set(key, value);
}

function buildIndex(network: Network): Index {
  const idx = emptyIndex();

  // Scripts: byScriptHash, plus a script hash can serve as either credential type.
  for (const [rawHash, entry] of Object.entries(parsedLabels.scripts ?? {})) {
    if (!rawHash || !entry) continue;
    const hash = normalizeKey(rawHash);
    setOnce(idx.byScriptHash, hash, entry);
    setOnce(idx.byCred.payment, hash, entry);
    setOnce(idx.byCred.stake, hash, entry);
    // Also synthesize a script enterprise address for forward derivation.
    try {
      setOnce(idx.byAddress, encodeEnterpriseAddress({ kind: 'script', hash }, network), entry);
    } catch {
      // ignore unencodable hashes
    }
  }

  // Direct address registrations + bech32-side decomposition into credential indexes.
  for (const [rawAddr, entry] of Object.entries(parsedLabels.addresses ?? {})) {
    if (!rawAddr || !entry) continue;
    const addr = normalizeKey(rawAddr);
    setOnce(idx.byAddress, addr, entry);
    const decomposed = decomposeBech32Address(addr);
    if (decomposed?.paymentCred) {
      setOnce(idx.byCred.payment, normalizeKey(decomposed.paymentCred.hash), entry);
    }
    if (decomposed?.stakeCred) {
      setOnce(idx.byCred.stake, normalizeKey(decomposed.stakeCred.hash), entry);
    }
  }

  // Credential-purpose registrations: register the hash under that purpose and
  // synthesize the canonical bech32 forms so plain string matches still work.
  const creds = parsedLabels.credentials ?? {};

  for (const [rawHash, raw] of Object.entries(creds.payment ?? {})) {
    if (!rawHash || !raw) continue;
    const hash = normalizeKey(rawHash);
    const kind = raw.kind ?? 'key';
    setOnce(idx.byCred.payment, hash, raw);
    try {
      setOnce(idx.byAddress, encodeEnterpriseAddress({ kind, hash }, network), raw);
    } catch {
      // ignore
    }
  }

  for (const [rawHash, raw] of Object.entries(creds.stake ?? {})) {
    if (!rawHash || !raw) continue;
    const hash = normalizeKey(rawHash);
    const kind = raw.kind ?? 'key';
    setOnce(idx.byCred.stake, hash, raw);
    try {
      setOnce(idx.byAddress, encodeStakeAddress({ kind, hash }, network), raw);
    } catch {
      // ignore
    }
  }

  for (const [rawHash, raw] of Object.entries(creds.drep ?? {})) {
    if (!rawHash || !raw) continue;
    const hash = normalizeKey(rawHash);
    const kind = raw.kind ?? 'key';
    setOnce(idx.byCred.drep, hash, raw);
    try {
      setOnce(idx.byAddress, encodeDrepBech32({ kind, hash }), raw);
    } catch {
      // ignore
    }
  }

  for (const [rawHash, raw] of Object.entries(creds.cc ?? {})) {
    if (!rawHash || !raw) continue;
    const hash = normalizeKey(rawHash);
    const kind = raw.kind ?? 'key';
    setOnce(idx.byCred.cc, hash, raw);
    try {
      setOnce(idx.byAddress, encodeCommitteeBech32({ kind, hash }, 'hot'), raw);
      setOnce(idx.byAddress, encodeCommitteeBech32({ kind, hash }, 'cold'), raw);
    } catch {
      // ignore
    }
  }

  for (const [rawHash, raw] of Object.entries(creds.pool ?? {})) {
    if (!rawHash || !raw) continue;
    const hash = normalizeKey(rawHash);
    setOnce(idx.byCred.pool, hash, raw);
    try {
      setOnce(idx.byAddress, encodePoolBech32(hash), raw);
    } catch {
      // ignore
    }
  }

  // Legacy `signerKeyHashes` — fold into payment for backwards compatibility
  // with any unmigrated registry entries.
  for (const [rawHash, entry] of Object.entries(parsedLabels.signerKeyHashes ?? {})) {
    if (!rawHash || !entry) continue;
    const hash = normalizeKey(rawHash);
    setOnce(idx.byCred.payment, hash, entry);
    try {
      setOnce(idx.byAddress, encodeEnterpriseAddress({ kind: 'key', hash }, network), entry);
    } catch {
      // ignore
    }
  }

  return idx;
}

const indexByNetwork = new Map<Network, Index>();
function getIndex(network: Network): Index {
  let idx = indexByNetwork.get(network);
  if (!idx) {
    idx = buildIndex(network);
    indexByNetwork.set(network, idx);
  }
  return idx;
}

// Public lookups -----------------------------------------------------------

export const getKnownScriptLabel = (hash: string | undefined | null): KnownLabelEntry | undefined => {
  if (!hash) return undefined;
  // Script hashes are network-independent. Pick any network's index — they all share `byScriptHash`.
  return getIndex('mainnet').byScriptHash.get(normalizeKey(hash));
};

export const getKnownAddressLabel = (
  address: string | undefined | null,
  network: Network
): KnownLabelEntry | undefined => {
  if (!address) return undefined;
  return getIndex(network).byAddress.get(normalizeKey(address));
};

export const getKnownCredLabel = (
  hash: string | undefined | null,
  purpose: CredentialPurpose,
  network: Network
): KnownLabelEntry | undefined => {
  if (!hash) return undefined;
  return getIndex(network).byCred[purpose].get(normalizeKey(hash));
};

export type ResolveAddressInput = {
  address?: string | null;
  addressCreds?: AddressCreds;
};

// Tries direct bech32 → payment cred → stake cred. If addressCreds is missing,
// decomposes the bech32 string on the fly.
export const resolveAddressLabel = (
  input: ResolveAddressInput,
  network: Network
): KnownLabelEntry | undefined => {
  const { address } = input;
  if (address) {
    const direct = getKnownAddressLabel(address, network);
    if (direct) return direct;
  }
  const creds = input.addressCreds ?? (address ? decomposeBech32Address(address) : undefined);
  if (creds?.paymentCred) {
    const hit = getKnownCredLabel(creds.paymentCred.hash, 'payment', network);
    if (hit) return hit;
  }
  if (creds?.stakeCred) {
    const hit = getKnownCredLabel(creds.stakeCred.hash, 'stake', network);
    if (hit) return hit;
  }
  return undefined;
};

// Aggregation --------------------------------------------------------------

export type TransactionLabelOccurrence = {
  location: string;
  value: string;
};

export type TransactionLabelSummary = {
  category: TransactionLabelCategory;
  value: string;
  label: KnownLabelEntry;
  occurrences: TransactionLabelOccurrence[];
};

const categorySortOrder: Record<TransactionLabelCategory, number> = {
  script: 0,
  address: 1,
  'payment-cred': 2,
  'stake-cred': 3,
  drep: 4,
  cc: 5,
  pool: 6,
};

function readHash(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const obj = detail as Record<string, unknown>;
  const v = obj.hash ?? obj.bech32;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function addLabelSummary(
  summaries: Map<string, TransactionLabelSummary>,
  category: TransactionLabelCategory,
  value: string | undefined | null,
  label: KnownLabelEntry | undefined,
  location: string,
) {
  if (!value || !label) return;
  const normalizedValue = normalizeKey(value);
  const key = `${category}:${normalizedValue}`;
  const occurrence: TransactionLabelOccurrence = { location, value };
  const existing = summaries.get(key);
  if (existing) {
    existing.occurrences.push(occurrence);
    return;
  }
  summaries.set(key, { category, value, label, occurrences: [occurrence] });
}

export const collectTransactionLabels = (
  tx: DomainTx,
  network: Network,
): TransactionLabelSummary[] => {
  const summaries = new Map<string, TransactionLabelSummary>();

  // Scripts (direct hash matches)
  tx.scripts?.forEach((script, index) => {
    const hash = script?.hash ? String(script.hash) : undefined;
    addLabelSummary(summaries, 'script', hash, getKnownScriptLabel(hash), `Script #${index + 1}`);
  });

  tx.redeemers?.forEach((redeemer, index) => {
    const hash = redeemer?.scriptHash ? String(redeemer.scriptHash) : undefined;
    addLabelSummary(summaries, 'script', hash, getKnownScriptLabel(hash), `Redeemer #${index + 1}`);
  });

  // Addresses on inputs / outputs / collateral / collateralReturn (with cred fallback)
  tx.inputs.forEach((input, index) => {
    const addr = input.resolved?.address;
    const label = resolveAddressLabel(
      { address: addr, addressCreds: input.resolved?.addressCreds },
      network,
    );
    const suffix = input.isCollateral ? ' (collateral)' : '';
    addLabelSummary(summaries, 'address', addr, label, `Input #${index}${suffix}`);
  });

  tx.outputs.forEach((output, index) => {
    const label = resolveAddressLabel(
      { address: output.address, addressCreds: output.addressCreds },
      network,
    );
    addLabelSummary(summaries, 'address', output.address, label, `Output #${index}`);
  });

  if (tx.collateralReturn?.address) {
    const addr = tx.collateralReturn.address;
    const label = resolveAddressLabel(
      { address: addr, addressCreds: tx.collateralReturn.addressCreds },
      network,
    );
    addLabelSummary(summaries, 'address', addr, label, 'Collateral return');
  }

  // Withdrawals (stake address; falls back to stake-cred match)
  tx.withdrawals?.forEach((withdrawal, index) => {
    const addr = withdrawal.stakeAddr;
    const label = resolveAddressLabel(
      { address: addr, addressCreds: withdrawal.addressCreds },
      network,
    );
    addLabelSummary(summaries, 'address', addr, label, `Withdrawal #${index + 1}`);
  });

  // Signers — match payment-cred for the signer hash; also try address if present.
  tx.signers?.forEach((signer, index) => {
    const tags = [
      signer.isRequired ? 'required' : null,
      signer.isWitness ? 'witness' : null,
      signer.type,
    ]
      .filter(Boolean)
      .join(' · ');
    const location = tags ? `Signer #${index + 1} (${tags})` : `Signer #${index + 1}`;
    const credLabel = getKnownCredLabel(signer.hash, 'payment', network);
    addLabelSummary(summaries, 'payment-cred', signer.hash, credLabel, location);

    if (signer.address) {
      const addressLabel = resolveAddressLabel(
        { address: signer.address, addressCreds: signer.addressCreds },
        network,
      );
      addLabelSummary(summaries, 'address', signer.address, addressLabel, `Signer #${index + 1} address`);
    }
  });

  // Certificates — credential-purpose dispatch
  tx.certs?.forEach((cert, index) => {
    const loc = `Cert #${index + 1} (${cert.type})`;
    const d = cert.details;
    const stakeHash = readHash(d.stakeCredential);
    const drepHash = readHash(d.drepCredential) ?? readHash(d.votingCredential);
    const hotHash = readHash(d.hotCredential);
    const coldHash = readHash(d.coldCredential);
    const poolHash =
      typeof d.poolKeyHash === 'string'
        ? d.poolKeyHash
        : typeof d.poolId === 'string'
          ? d.poolId
          : readHash(d.poolOperator) ?? readHash(d.operator);

    if (stakeHash) {
      addLabelSummary(
        summaries,
        'stake-cred',
        stakeHash,
        getKnownCredLabel(stakeHash, 'stake', network),
        loc,
      );
    }
    if (drepHash) {
      addLabelSummary(summaries, 'drep', drepHash, getKnownCredLabel(drepHash, 'drep', network), loc);
    }
    if (hotHash) {
      addLabelSummary(summaries, 'cc', hotHash, getKnownCredLabel(hotHash, 'cc', network), `${loc} (hot)`);
    }
    if (coldHash) {
      addLabelSummary(summaries, 'cc', coldHash, getKnownCredLabel(coldHash, 'cc', network), `${loc} (cold)`);
    }
    if (poolHash) {
      addLabelSummary(summaries, 'pool', poolHash, getKnownCredLabel(poolHash, 'pool', network), loc);
    }
  });

  // Governance — drep/cc votes
  tx.governance?.drepVotes?.forEach((vote, index) => {
    const hash = vote.drepCredential?.hash ?? vote.drepHash;
    if (hash) {
      addLabelSummary(
        summaries,
        'drep',
        hash,
        getKnownCredLabel(hash, 'drep', network),
        `DRep vote #${index + 1}`,
      );
    }
  });

  tx.governance?.committeeVotes?.forEach((vote, index) => {
    const hash = vote.memberCredential?.hash;
    if (hash) {
      addLabelSummary(
        summaries,
        'cc',
        hash,
        getKnownCredLabel(hash, 'cc', network),
        `Committee vote #${index + 1}`,
      );
    }
  });

  tx.governance?.committee?.members.forEach((member, index) => {
    if (member.keyHash) {
      addLabelSummary(
        summaries,
        'cc',
        member.keyHash,
        getKnownCredLabel(member.keyHash, 'cc', network),
        `Committee member #${index + 1}`,
      );
    }
  });

  return Array.from(summaries.values()).sort((a, b) => {
    const diff = categorySortOrder[a.category] - categorySortOrder[b.category];
    if (diff !== 0) return diff;
    return a.label.name.localeCompare(b.label.name);
  });
};

// Eagerly build all networks at module load so first render is cheap.
NETWORKS.forEach(getIndex);
