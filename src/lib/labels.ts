// src/lib/labels.ts
import rawLabels from '@/data/known-labels.json';
import { type DomainTx } from '@/domain/tx';

type LabelCategory = 'scripts' | 'addresses' | 'signerKeyHashes';

export type TransactionLabelCategory = 'script' | 'address' | 'signer';

export type KnownLabelEntry = {
  name: string;
  description?: string;
  url?: string;
};

type KnownLabels = {
  [K in LabelCategory]: Record<string, KnownLabelEntry>;
};

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

const parsedLabels = rawLabels as Partial<KnownLabels>;

// Ensure all categories exist even if the JSON file omits them
const labels: KnownLabels = {
  scripts: parsedLabels.scripts ?? {},
  addresses: parsedLabels.addresses ?? {},
  signerKeyHashes: parsedLabels.signerKeyHashes ?? {},
};

const normalizeKey = (value: string) => value.trim().toLowerCase();

const normalizedCaches: KnownLabels = {
  scripts: {},
  addresses: {},
  signerKeyHashes: {},
};

const ensureNormalizedCache = (category: LabelCategory) => {
  if (Object.keys(normalizedCaches[category]).length > 0) {
    return normalizedCaches[category];
  }

  const categoryEntries = labels[category] || {};
  const normalizedEntries: Record<string, KnownLabelEntry> = {};

  for (const [key, entry] of Object.entries(categoryEntries)) {
    if (!key || !entry) continue;
    normalizedEntries[normalizeKey(key)] = entry;
  }

  normalizedCaches[category] = normalizedEntries;
  return normalizedEntries;
};

const lookup = (category: LabelCategory, key: string | undefined | null): KnownLabelEntry | undefined => {
  if (!key) return undefined;
  const normalizedKey = normalizeKey(key);
  const cache = ensureNormalizedCache(category);
  return cache[normalizedKey];
};

export const getKnownScriptLabel = (hash: string | undefined | null) => lookup('scripts', hash);
export const getKnownAddressLabel = (address: string | undefined | null) => lookup('addresses', address);
export const getKnownSignerLabel = (hash: string | undefined | null) => lookup('signerKeyHashes', hash);

export const hasKnownLabel = (category: LabelCategory, key: string | undefined | null) => Boolean(lookup(category, key));

export const getAllKnownLabels = (): KnownLabels => ({
  scripts: { ...ensureNormalizedCache('scripts') },
  addresses: { ...ensureNormalizedCache('addresses') },
  signerKeyHashes: { ...ensureNormalizedCache('signerKeyHashes') },
});

const addLabelSummary = (
  summaries: Map<string, TransactionLabelSummary>,
  category: TransactionLabelCategory,
  value: string | undefined | null,
  label: KnownLabelEntry | undefined,
  location: string
) => {
  if (!value || !label) return;
  const normalizedValue = normalizeKey(value);
  const key = `${category}:${normalizedValue}`;
  const occurrence: TransactionLabelOccurrence = {
    location,
    value
  };

  const existing = summaries.get(key);
  if (existing) {
    existing.occurrences.push(occurrence);
    return;
  }

  summaries.set(key, {
    category,
    value,
    label,
    occurrences: [occurrence]
  });
};

const categorySortOrder: Record<TransactionLabelCategory, number> = {
  script: 0,
  address: 1,
  signer: 2,
};

export const collectTransactionLabels = (tx: DomainTx): TransactionLabelSummary[] => {
  const summaries = new Map<string, TransactionLabelSummary>();

  // Scripts
  tx.scripts?.forEach((script, index) => {
    const hash = script?.hash ? String(script.hash) : undefined;
    const label = getKnownScriptLabel(hash);
    addLabelSummary(summaries, 'script', hash, label, `Script #${index + 1}`);
  });

  tx.redeemers?.forEach((redeemer, index) => {
    const hash = redeemer?.scriptHash ? String(redeemer.scriptHash) : undefined;
    const label = getKnownScriptLabel(hash);
    addLabelSummary(summaries, 'script', hash, label, `Redeemer #${index + 1}`);
  });

  // Addresses from inputs
  tx.inputs.forEach((input, index) => {
    const resolvedAddress = input.resolved?.address;
    const label = getKnownAddressLabel(resolvedAddress);
    const suffix = input.isCollateral ? ' (collateral)' : '';
    addLabelSummary(summaries, 'address', resolvedAddress, label, `Input #${index}${suffix}`);
  });

  // Outputs
  tx.outputs.forEach((output, index) => {
    const label = getKnownAddressLabel(output.address);
    addLabelSummary(summaries, 'address', output.address, label, `Output #${index}`);
  });

  // Collateral return
  if (tx.collateralReturn?.address) {
    const address = tx.collateralReturn.address;
    const label = getKnownAddressLabel(address);
    addLabelSummary(summaries, 'address', address, label, 'Collateral return');
  }

  // Withdrawals (stake credentials)
  tx.withdrawals?.forEach((withdrawal, index) => {
    const label = getKnownAddressLabel(withdrawal.stakeAddr);
    addLabelSummary(summaries, 'address', withdrawal.stakeAddr, label, `Withdrawal #${index + 1}`);
  });

  // Signers
  tx.signers?.forEach((signer, index) => {
    const signerLabel = getKnownSignerLabel(signer.hash);
    const tags = [
      signer.isRequired ? 'required' : null,
      signer.isWitness ? 'witness' : null,
      signer.type
    ].filter(Boolean).join(' · ');
    const location = tags ? `Signer #${index + 1} (${tags})` : `Signer #${index + 1}`;
    addLabelSummary(summaries, 'signer', signer.hash, signerLabel, location);

    if (signer.address) {
      const addressLabel = getKnownAddressLabel(signer.address);
      addLabelSummary(summaries, 'address', signer.address, addressLabel, `Signer #${index + 1} address`);
    }
  });

  const results = Array.from(summaries.values());

  results.sort((a, b) => {
    const categoryDiff = categorySortOrder[a.category] - categorySortOrder[b.category];
    if (categoryDiff !== 0) return categoryDiff;
    return a.label.name.localeCompare(b.label.name);
  });

  return results;
};

