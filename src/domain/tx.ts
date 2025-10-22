// src/domain/tx.ts
export type DomainTx = {
  era: "Alonzo" | "Babbage" | "Conway" | "Unknown";
  id: string;
  sizeBytes: number;
  feeLovelace: bigint;
  ttl?: number | null;
  slot?: number | null;
  validity: { start?: number | null; end?: number | null };
  inputs: Array<{
    txId: string; 
    index: number; 
    isCollateral: boolean;
    resolved?: { address?: string; value?: ValueSummary } // optional future lookup
  }>;
  outputs: Array<{
    address: string;
    ada: bigint;
    assets: Array<{ policyId: string; assetName: string; quantity: bigint }>;
    datum?: { inline?: string; hash?: string; ref?: boolean };
    scriptRef?: { type: "PlutusV1"|"PlutusV2"|"PlutusV3"|"Native"; bytes: string };
  }>;
  mint?: Array<{ policyId: string; assetName: string; quantity: bigint }>;
  certs?: Array<CertificateVM>;           // normalized, labeled
  withdrawals?: Array<{ stakeAddr: string; amount: bigint }>;
  governance?: GovernanceVM | null;       // Conway actions, drep votes, etc.
  metadata?: Array<{ label: string; json?: unknown; cbor?: string }>;
  scripts?: Array<{ type: string; hash: string; bytesLen: number }>;
  redeemers?: Array<{ purpose: string; index: number; exUnits?: { mem: number; steps: number } }>;
  witnesses: { vkeyCount: number; nativeCount: number; plutusCount: number };
  warnings: string[];
};

export type ValueSummary = {
  ada: bigint;
  assets: Array<{ policyId: string; assetName: string; quantity: bigint }>;
};

export type CertificateVM = {
  type: "StakeRegistration" | "StakeDeregistration" | "StakeDelegation" | "PoolRegistration" | "PoolRetirement" | "GenesisKeyDelegation" | "MoveInstantaneousRewards" | "Constitution" | "CommitteeHotAuth" | "DRepRegistration" | "DRepDeregistration" | "DRepUpdate" | "VoteDelegation" | "Vote" | "Proposal" | "UpdateCommittee" | "NewConstitution" | "NoConfidence" | "InfoAction" | "TreasuryWithdrawals" | "TreasuryWithdrawalsAction" | "Unknown";
  label: string;
  details: Record<string, unknown>;
};

export type GovernanceVM = {
  constitution?: {
    hash: string;
    url?: string;
  };
  committee?: {
    members: Array<{ keyHash: string; epoch: number }>;
    threshold: number;
  };
  drepVotes?: Array<{
    drepId: string;
    action: "VoteYes" | "VoteNo" | "Abstain";
    proposalId: string;
  }>;
  committeeVotes?: Array<{
    memberId: string;
    action: "VoteYes" | "VoteNo" | "Abstain";
    proposalId: string;
  }>;
  proposals?: Array<{
    id: string;
    type: "ParameterChange" | "HardForkInitiation" | "TreasuryWithdrawals" | "NoConfidence" | "NewConstitution" | "InfoAction";
    details: Record<string, unknown>;
  }>;
};

export type Network = "mainnet" | "preprod" | "preview" | "testnet";

export type TxParseResult = {
  success: true;
  tx: DomainTx;
} | {
  success: false;
  error: string;
  details?: string;
};
