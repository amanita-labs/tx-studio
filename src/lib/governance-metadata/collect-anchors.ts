import type { DomainTx } from '@/domain/tx';

export type AnchorSource =
  | { kind: 'drep-vote'; index: number; voter: string; proposalId: string }
  | { kind: 'committee-vote'; index: number; voter: string; proposalId: string }
  | { kind: 'proposal'; index: number; proposalId: string; proposalType: string }
  | { kind: 'drep-registration'; certIndex: number; drepId?: string }
  | { kind: 'drep-update'; certIndex: number; drepId?: string };

export type CollectedAnchor = {
  source: AnchorSource;
  url: string;
  hash: string;
  /** Stable key for store + deduplication. */
  key: string;
};

function readAnchorFromDetails(
  details: Record<string, unknown>,
): { url: string; hash: string } | null {
  const a = details.anchor as { url?: string; hash?: string } | null | undefined;
  if (!a || !a.url || !a.hash) return null;
  return { url: a.url, hash: a.hash };
}

export function collectAllAnchors(tx: DomainTx): CollectedAnchor[] {
  const out: CollectedAnchor[] = [];

  tx.governance?.drepVotes?.forEach((vote, i) => {
    if (!vote.anchor?.url || !vote.anchor.hash) return;
    out.push({
      source: { kind: 'drep-vote', index: i, voter: vote.drepId, proposalId: vote.proposalId },
      url: vote.anchor.url,
      hash: vote.anchor.hash,
      key: `${vote.anchor.url}#${vote.anchor.hash}`,
    });
  });

  tx.governance?.committeeVotes?.forEach((vote, i) => {
    if (!vote.anchor?.url || !vote.anchor.hash) return;
    out.push({
      source: {
        kind: 'committee-vote',
        index: i,
        voter: vote.memberId,
        proposalId: vote.proposalId,
      },
      url: vote.anchor.url,
      hash: vote.anchor.hash,
      key: `${vote.anchor.url}#${vote.anchor.hash}`,
    });
  });

  tx.governance?.proposals?.forEach((prop, i) => {
    const a = readAnchorFromDetails(prop.details);
    if (!a) return;
    out.push({
      source: { kind: 'proposal', index: i, proposalId: prop.id, proposalType: prop.type },
      url: a.url,
      hash: a.hash,
      key: `${a.url}#${a.hash}`,
    });
  });

  tx.certs?.forEach((cert, i) => {
    if (cert.type !== 'DRepRegistration' && cert.type !== 'DRepUpdate') return;
    const a = readAnchorFromDetails(cert.details);
    if (!a) return;
    const drepId = (cert.details.drepId as string | undefined) ?? undefined;
    out.push({
      source:
        cert.type === 'DRepRegistration'
          ? { kind: 'drep-registration', certIndex: i, drepId }
          : { kind: 'drep-update', certIndex: i, drepId },
      url: a.url,
      hash: a.hash,
      key: `${a.url}#${a.hash}`,
    });
  });

  return out;
}

export function txHasGovernanceAnchors(tx: DomainTx): boolean {
  return collectAllAnchors(tx).length > 0;
}
