// Mirrors the library's internal `inferKind` over `body.onChain` so the UI can
// reason about a CIP-169 binding without re-running the verifier — specifically,
// to tell the user what kind of on-chain item a binding targets when the
// verifier reports it as not found.

export type OnChainKind = 'proposalProcedure' | 'votingProcedures' | 'certificate' | 'unknown';

export type OnChainBinding = {
  kind: OnChainKind;
};

const CERT_TAGS = new Set(['register_drep', 'update_drep', 'resign_committee_cold']);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readBody(document: Record<string, unknown>): Record<string, unknown> | undefined {
  const body = document.body;
  return isObject(body) ? body : undefined;
}

/**
 * Infer what kind of on-chain item a document's CIP-169 `body.onChain` binds to.
 * Returns null when the document carries no `onChain` extension.
 */
export function inferOnChainBinding(document: Record<string, unknown>): OnChainBinding | null {
  const body = readBody(document);
  if (!body || !('onChain' in body)) return null;

  const onChain = body.onChain;
  if (onChain === undefined) return null;

  if (Array.isArray(onChain)) return { kind: 'votingProcedures' };
  if (!isObject(onChain)) return { kind: 'unknown' };

  if (typeof onChain.tag === 'string' && CERT_TAGS.has(onChain.tag)) {
    return { kind: 'certificate' };
  }
  if ('gov_action' in onChain && 'deposit' in onChain && 'reward_account' in onChain) {
    return { kind: 'proposalProcedure' };
  }
  return { kind: 'unknown' };
}
