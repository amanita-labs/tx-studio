// src/domain/tx.ts
export type DomainTx = {
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
  redeemers?: Array<{ purpose: string; index: number; exUnits?: { mem: number; steps: number }; data?: string; scriptHash?: string }>;
  witnesses: { vkeyCount: number; nativeCount: number; plutusCount: number };
  vkeyWitnesses?: Array<{ vkey: string; signature: string; hash: string }>;
  signers?: Array<{ type: 'vkey' | 'native' | 'plutus'; hash: string; address?: string; isWitness?: boolean; isRequired?: boolean }>;
  scriptDataHash?: string;
  totalCollateral?: bigint;
  collateralReturn?: { address: string; ada: bigint; assets: Array<{ policyId: string; assetName: string; quantity: bigint }> };
  referenceInputs?: Array<{ txId: string; index: number }>;
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
    drepHash?: string;
    drepCredential?: {
      type: string;
      hash: string;
      bech32?: string;
    };
    action: "VoteYes" | "VoteNo" | "Abstain";
    proposalId: string;
    anchor?: {
      url?: string;
      hash?: string;
      bytes?: string;
    } | null;
    anchorMissing?: boolean;
  }>;
  committeeVotes?: Array<{
    memberId: string;
    memberCredential?: {
      type: string;
      hash: string;
      bech32?: string;
    };
    action: "VoteYes" | "VoteNo" | "Abstain";
    proposalId: string;
    anchor?: {
      url?: string;
      hash?: string;
      bytes?: string;
    } | null;
    anchorMissing?: boolean;
  }>;
  proposals?: Array<{
    id: string;
    type: "ParameterChange" | "HardForkInitiation" | "TreasuryWithdrawals" | "NoConfidence" | "NewConstitution" | "UpdateCommittee" | "InfoAction";
    details: Record<string, unknown>;
  }>;
};

export type Network = "mainnet" | "preprod" | "preview";

export type TxParseResult = {
  success: true;
  tx: DomainTx;
} | {
  success: false;
  error: string;
  details?: string;
};
