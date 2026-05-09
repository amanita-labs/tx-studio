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
