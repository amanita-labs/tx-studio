// src/lib/wallet-summary.ts
import type { AddressCredInfo, AddressCreds, DomainTx, Network, StakeCredential } from '@/domain/tx';
import { decomposeBech32Address } from '@/lib/utils/decompose-bech32-address';
import { encodeStakeAddress } from '@/lib/utils/stake-address';

export type WalletKind = 'wallet' | 'contract' | 'address-only';

export type AssetDelta = {
  policyId: string;
  assetName: string;
  delta: bigint;
};

export type ContributingInput = {
  index: number;
  txId: string;
  outputIndex: number;
  ada: bigint;
  assets: Array<{ policyId: string; assetName: string; quantity: bigint }>;
  isCollateral: boolean;
};

export type ContributingOutput = {
  index: number;
  ada: bigint;
  assets: Array<{ policyId: string; assetName: string; quantity: bigint }>;
  hasDatum: boolean;
  hasScriptRef: boolean;
};

export type ImplicitLine = {
  label: 'Reward Withdrawal' | 'Stake Registration Deposit' | 'Stake Deregistration Refund';
  amount: bigint;
  direction: 'in' | 'out';
};

export type GroupedBy = 'payment' | 'stake' | 'address';

export type WalletSummaryRow = {
  groupKey: string;
  displayAddress: string;
  kind: WalletKind;
  groupedBy: GroupedBy;
  stakeCred?: AddressCredInfo;
  paymentCred?: AddressCredInfo;
  stakeAddress?: string;
  adaDelta: bigint;
  assetDeltas: AssetDelta[];
  implicitLines: ImplicitLine[];
  contributingInputs: ContributingInput[];
  contributingOutputs: ContributingOutput[];
};

export type WalletSummary = {
  rows: WalletSummaryRow[];
  unresolvedInputCount: number;
  totalInputCount: number;
};

function parseCoinValue(value: unknown): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  try { return BigInt(String(value)); } catch { return 0n; }
}

function abs(n: bigint): bigint { return n < 0n ? -n : n; }

function ensureCreds(addr: string | undefined, creds: AddressCreds | undefined): AddressCreds | undefined {
  if (creds && (creds.paymentCred || creds.stakeCred)) return creds;
  if (!addr) return undefined;
  return decomposeBech32Address(addr);
}

type BucketState = {
  groupKey: string;
  displayAddress: string;
  kind: WalletKind;
  groupedBy: GroupedBy;
  stakeCred?: AddressCredInfo;
  paymentCred?: AddressCredInfo;
  adaDelta: bigint;
  assetMap: Map<string, AssetDelta>;
  implicitLines: ImplicitLine[];
  contributingInputs: ContributingInput[];
  contributingOutputs: ContributingOutput[];
};

// Per stake credential, what we need to decide its grouping level.
type StakeGroupInfo = {
  paymentHashes: Set<string>;
  baseAddress?: string;
  hasStakeEvent: boolean;
};

function stakeKeyOf(cred: { kind: string; hash: string }): string {
  return `${cred.kind}:${cred.hash}`;
}

// Decide whether a stake credential collapses to a single payment (base) address.
// True iff it touches exactly one payment address across inputs/outputs AND has no
// stake-level event (withdrawal / registration / deregistration).
function collapsesToPayment(info: StakeGroupInfo | undefined): boolean {
  return !!info && !info.hasStakeEvent && info.paymentHashes.size === 1 && !!info.baseAddress;
}

type DerivedBucket = {
  groupKey: string;
  displayAddress: string;
  kind: WalletKind;
  groupedBy: GroupedBy;
  stakeCred?: AddressCredInfo;
  paymentCred?: AddressCredInfo;
};

function deriveAddressBucket(
  address: string | undefined,
  creds: AddressCreds | undefined,
  network: Network,
  stakeGroups: Map<string, StakeGroupInfo>
): DerivedBucket | null {
  const resolvedCreds = ensureCreds(address, creds);
  const stakeCred = resolvedCreds?.stakeCred;
  const paymentCred = resolvedCreds?.paymentCred;

  if (stakeCred) {
    const kind: WalletKind = paymentCred?.kind === 'script' ? 'contract' : 'wallet';
    const info = stakeGroups.get(stakeKeyOf(stakeCred));

    // Collapse to the wallet's single payment (base) address when it touches only
    // one payment address and has no stake-level event. Use the group's
    // representative base address so every entry of the wallet buckets identically.
    if (collapsesToPayment(info)) {
      const baseAddress = info!.baseAddress!;
      return { groupKey: baseAddress, displayAddress: baseAddress, kind, groupedBy: 'payment', stakeCred, paymentCred };
    }

    let groupKey: string;
    try {
      groupKey = encodeStakeAddress(stakeCred, network);
    } catch {
      groupKey = `stake:${stakeCred.kind}:${stakeCred.hash}`;
    }
    return { groupKey, displayAddress: groupKey, kind, groupedBy: 'stake', stakeCred, paymentCred };
  }

  if (!address) return null;
  const kind: WalletKind = paymentCred?.kind === 'script' ? 'contract' : 'address-only';
  return { groupKey: address, displayAddress: address, kind, groupedBy: 'address', paymentCred };
}

function getOrCreateBucket(
  buckets: Map<string, BucketState>,
  derived: DerivedBucket
): BucketState {
  const existing = buckets.get(derived.groupKey);
  if (existing) {
    // Promote address-only → wallet/contract if more cred info appears later
    if (derived.kind !== 'address-only' && existing.kind === 'address-only') existing.kind = derived.kind;
    if (derived.stakeCred && !existing.stakeCred) existing.stakeCred = derived.stakeCred;
    if (derived.paymentCred && !existing.paymentCred) existing.paymentCred = derived.paymentCred;
    return existing;
  }
  const fresh: BucketState = {
    groupKey: derived.groupKey,
    displayAddress: derived.displayAddress,
    kind: derived.kind,
    groupedBy: derived.groupedBy,
    stakeCred: derived.stakeCred,
    paymentCred: derived.paymentCred,
    adaDelta: 0n,
    assetMap: new Map(),
    implicitLines: [],
    contributingInputs: [],
    contributingOutputs: [],
  };
  buckets.set(derived.groupKey, fresh);
  return fresh;
}

function bumpAsset(map: Map<string, AssetDelta>, policyId: string, assetName: string, delta: bigint) {
  const key = `${policyId}|${assetName}`;
  const existing = map.get(key);
  if (existing) {
    existing.delta += delta;
  } else {
    map.set(key, { policyId, assetName, delta });
  }
}

function stakeCredFromDetails(details: Record<string, unknown>): StakeCredential | null {
  const cred = details.stakeCredential as { kind?: string; hash?: string } | undefined;
  if (!cred || typeof cred.hash !== 'string' || cred.hash.length === 0) return null;
  const kind: 'key' | 'script' = cred.kind === 'script' ? 'script' : 'key';
  return { kind, hash: cred.hash };
}

function bucketForStakeCred(
  buckets: Map<string, BucketState>,
  stakeCred: StakeCredential,
  network: Network
): BucketState {
  let groupKey: string;
  try {
    groupKey = encodeStakeAddress(stakeCred, network);
  } catch {
    groupKey = `stake:${stakeCred.kind}:${stakeCred.hash}`;
  }
  return getOrCreateBucket(buckets, {
    groupKey,
    displayAddress: groupKey,
    kind: 'wallet',
    groupedBy: 'stake',
    stakeCred,
  });
}

// Pre-pass: per stake credential, count distinct payment addresses across
// inputs + outputs and flag any stake-level event. Used to decide whether a
// wallet collapses to a single payment (base) address.
function buildStakeGroups(tx: DomainTx): Map<string, StakeGroupInfo> {
  const groups = new Map<string, StakeGroupInfo>();

  const record = (address: string | undefined, creds: AddressCreds | undefined) => {
    const resolved = ensureCreds(address, creds);
    const stakeCred = resolved?.stakeCred;
    if (!stakeCred) return;
    const key = stakeKeyOf(stakeCred);
    let info = groups.get(key);
    if (!info) {
      info = { paymentHashes: new Set(), hasStakeEvent: false };
      groups.set(key, info);
    }
    const paymentCred = resolved?.paymentCred;
    if (paymentCred?.hash) info.paymentHashes.add(paymentCred.hash);
    if (address && !info.baseAddress) info.baseAddress = address;
  };

  const markEvent = (stakeCred: StakeCredential | null) => {
    if (!stakeCred) return;
    const key = stakeKeyOf(stakeCred);
    let info = groups.get(key);
    if (!info) {
      info = { paymentHashes: new Set(), hasStakeEvent: false };
      groups.set(key, info);
    }
    info.hasStakeEvent = true;
  };

  tx.outputs.forEach((output) => record(output.address, output.addressCreds));
  tx.inputs.forEach((input) => {
    if (input.isCollateral) return;
    const r = input.resolved;
    if (!r || !r.value) return;
    record(r.address, r.addressCreds);
  });

  if (tx.withdrawals) {
    for (const w of tx.withdrawals) {
      markEvent(w.addressCreds?.stakeCred ?? decomposeBech32Address(w.stakeAddr)?.stakeCred ?? null);
    }
  }
  if (tx.certs) {
    for (const cert of tx.certs) {
      if (cert.type === 'StakeRegistration' || cert.type === 'StakeDeregistration') {
        markEvent(stakeCredFromDetails(cert.details));
      }
    }
  }

  return groups;
}

export function computeWalletSummary(tx: DomainTx, network: Network): WalletSummary {
  const buckets = new Map<string, BucketState>();
  const stakeGroups = buildStakeGroups(tx);

  // 1. Outputs (always populated)
  tx.outputs.forEach((output, index) => {
    const derived = deriveAddressBucket(output.address, output.addressCreds, network, stakeGroups);
    if (!derived) return;
    const b = getOrCreateBucket(buckets, derived);
    b.adaDelta += output.ada;
    output.assets.forEach((a) => bumpAsset(b.assetMap, a.policyId, a.assetName, a.quantity));
    b.contributingOutputs.push({
      index,
      ada: output.ada,
      assets: output.assets,
      hasDatum: !!output.datum,
      hasScriptRef: !!output.scriptRef,
    });
  });

  // 2. Regular inputs (resolved only, skip collateral)
  tx.inputs.forEach((input, index) => {
    if (input.isCollateral) return;
    const r = input.resolved;
    if (!r || !r.value) return;
    const derived = deriveAddressBucket(r.address, r.addressCreds, network, stakeGroups);
    if (!derived) return;
    const b = getOrCreateBucket(buckets, derived);
    b.adaDelta -= r.value.ada;
    r.value.assets.forEach((a) => bumpAsset(b.assetMap, a.policyId, a.assetName, -a.quantity));
    b.contributingInputs.push({
      index,
      txId: input.txId,
      outputIndex: input.index,
      ada: r.value.ada,
      assets: r.value.assets,
      isCollateral: false,
    });
  });

  // 3. Withdrawals — attribute to the stake credential receiving the rewards
  if (tx.withdrawals) {
    for (const w of tx.withdrawals) {
      const stakeCred = w.addressCreds?.stakeCred ?? decomposeBech32Address(w.stakeAddr)?.stakeCred;
      if (!stakeCred) continue;
      const b = bucketForStakeCred(buckets, stakeCred, network);
      b.adaDelta += w.amount;
      b.implicitLines.push({ label: 'Reward Withdrawal', amount: w.amount, direction: 'in' });
    }
  }

  // 4. Stake-related certificates (V1: registration deposit / deregistration refund)
  if (tx.certs) {
    for (const cert of tx.certs) {
      if (cert.type === 'StakeRegistration') {
        const stakeCred = stakeCredFromDetails(cert.details);
        if (!stakeCred) continue;
        const deposit = parseCoinValue(cert.details.deposit) || 2_000_000n;
        const b = bucketForStakeCred(buckets, stakeCred, network);
        b.adaDelta -= deposit;
        b.implicitLines.push({ label: 'Stake Registration Deposit', amount: deposit, direction: 'out' });
      } else if (cert.type === 'StakeDeregistration') {
        const stakeCred = stakeCredFromDetails(cert.details);
        if (!stakeCred) continue;
        const refund = parseCoinValue(cert.details.refund) || 2_000_000n;
        const b = bucketForStakeCred(buckets, stakeCred, network);
        b.adaDelta += refund;
        b.implicitLines.push({ label: 'Stake Deregistration Refund', amount: refund, direction: 'in' });
      }
    }
  }

  // 5. Finalize: drop empty buckets, sort assetDeltas, sort rows
  const rows: WalletSummaryRow[] = [];
  for (const b of buckets.values()) {
    const assetDeltas = Array.from(b.assetMap.values()).filter((a) => a.delta !== 0n);
    const isEmpty =
      b.adaDelta === 0n &&
      assetDeltas.length === 0 &&
      b.implicitLines.length === 0 &&
      b.contributingInputs.length === 0 &&
      b.contributingOutputs.length === 0;
    if (isEmpty) continue;
    assetDeltas.sort((x, y) => {
      const d = abs(y.delta) - abs(x.delta);
      if (d > 0n) return 1;
      if (d < 0n) return -1;
      return 0;
    });
    let stakeAddress: string | undefined;
    if (b.stakeCred) {
      try {
        stakeAddress = encodeStakeAddress(b.stakeCred, network);
      } catch {
        stakeAddress = undefined;
      }
    }
    rows.push({
      groupKey: b.groupKey,
      displayAddress: b.displayAddress,
      kind: b.kind,
      groupedBy: b.groupedBy,
      stakeCred: b.stakeCred,
      paymentCred: b.paymentCred,
      stakeAddress,
      adaDelta: b.adaDelta,
      assetDeltas,
      implicitLines: b.implicitLines,
      contributingInputs: b.contributingInputs,
      contributingOutputs: b.contributingOutputs,
    });
  }

  rows.sort((a, b) => {
    const aIsContract = a.kind === 'contract';
    const bIsContract = b.kind === 'contract';
    if (aIsContract !== bIsContract) return aIsContract ? 1 : -1;
    const d = abs(b.adaDelta) - abs(a.adaDelta);
    if (d > 0n) return 1;
    if (d < 0n) return -1;
    return a.groupKey.localeCompare(b.groupKey);
  });

  const regularInputs = tx.inputs.filter((i) => !i.isCollateral);
  return {
    rows,
    unresolvedInputCount: regularInputs.filter((i) => !i.resolved?.value).length,
    totalInputCount: regularInputs.length,
  };
}
