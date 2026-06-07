import type { OnChainKind } from './onchain';

/** "{url}#{hash}" — stable id for the store and dedup. */
export type AnchorKey = string;

export type DetectedCip = 'cip-100' | 'cip-108' | 'cip-119' | 'cip-136' | 'unknown';

export type AuthorWitness = {
  name?: string;
  pubkeyHex: string;
  /** ed25519 signature verification status. 'unverifiable' = malformed witness or missing sig. */
  signature: 'valid' | 'invalid' | 'unverifiable';
  /** Resolved label from the existing known-labels registry, if matched. */
  label?: { name: string; description?: string };
};

export type Cip169Binding =
  | { status: 'idle' }
  | { status: 'verifying' }
  | { status: 'ok'; selectorKind: string }
  | { status: 'mismatch'; differences: Array<{ path: string; metadataValue: unknown; actionValue: unknown }> }
  /**
   * The document declares a CIP-169 binding to an on-chain item that is absent
   * from the inspected transaction — i.e. the binding belongs to a different
   * transaction (e.g. a vote's anchor re-using the proposal's rationale). Not a
   * failure; informational.
   */
  | { status: 'not-in-tx'; boundKind: OnChainKind }
  /**
   * The bound on-chain item IS present in this transaction, but the metadata
   * library could not decode it, so the binding cannot be verified. Surfaces a
   * library limitation rather than a problem with the document or transaction.
   */
  | { status: 'undecodable'; boundKind: OnChainKind; reason: string }
  | { status: 'error'; error: string };

export type SchemaIssue = {
  path: string;
  message: string;
  code: string;
};

export type ResolvedGovernanceMetadata = {
  /** Raw fetched bytes as hex (kept for debugging / signature verify input). */
  rawHex: string;
  /** Parsed JSON document. */
  document: Record<string, unknown>;
  detectedCip: DetectedCip;
  /** True if the document also carries a CIP-169 onChain extension. */
  hasCip169Extension: boolean;
  hashOk: boolean;
  computedHash: string;
  /** Schema validation issues from the library; empty if document is valid. */
  schemaIssues: SchemaIssue[];
  authors: AuthorWitness[];
  cip169?: Cip169Binding;
};

export type GovernanceMetadataState =
  | { status: 'idle' }
  | { status: 'fetching' }
  | { status: 'resolved'; result: ResolvedGovernanceMetadata }
  | { status: 'error'; error: string };
