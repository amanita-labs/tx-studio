'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnchorCard } from '../components/AnchorCard';
import {
  collectAllAnchors,
  type AnchorSource,
  type CollectedAnchor,
} from '@/lib/governance-metadata/collect-anchors';
import { useGovernanceMetadata } from '@/hooks/use-governance-metadata';
import type { DomainTx } from '@/domain/tx';

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

const GROUP_LABELS: Record<AnchorSource['kind'], string> = {
  proposal: 'Governance actions',
  'drep-vote': 'DRep votes',
  'committee-vote': 'Committee votes',
  'drep-registration': 'DRep registrations',
  'drep-update': 'DRep updates',
};

const GROUP_ORDER: AnchorSource['kind'][] = [
  'proposal',
  'drep-vote',
  'committee-vote',
  'drep-registration',
  'drep-update',
];

function groupAnchors(
  anchors: CollectedAnchor[],
): Array<[AnchorSource['kind'], CollectedAnchor[]]> {
  const groups = new Map<AnchorSource['kind'], CollectedAnchor[]>();
  for (const a of anchors) {
    const list = groups.get(a.source.kind) ?? [];
    list.push(a);
    groups.set(a.source.kind, list);
  }
  return GROUP_ORDER.filter((k) => groups.has(k)).map((k) => [k, groups.get(k)!]);
}

export function GovernanceTab({ tx, txHex }: { tx: DomainTx; txHex: string }) {
  const anchors = useMemo(() => collectAllAnchors(tx), [tx]);
  const grouped = useMemo(() => groupAnchors(anchors), [anchors]);
  const { resolveAll } = useGovernanceMetadata();

  if (anchors.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        This transaction does not contain any governance anchors.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {isStaticExport && (
        <Alert className="border-yellow-500/50">
          <AlertTitle>Metadata resolution unavailable</AlertTitle>
          <AlertDescription>
            Anchors are listed below, but fetching their JSON-LD bodies requires the
            dynamic build. Run <code>npm run dev</code> or deploy to a server to enable
            resolution.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {anchors.length} anchor{anchors.length === 1 ? '' : 's'} in this transaction
        </p>
        <Button
          size="sm"
          onClick={() => resolveAll(anchors, txHex)}
          disabled={isStaticExport}
        >
          Resolve all
        </Button>
      </div>
      {grouped.map(([kind, list]) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {GROUP_LABELS[kind]} ({list.length})
          </h2>
          <div className="space-y-2">
            {list.map((a) => (
              <AnchorCard
                key={`${a.source.kind}:${a.key}`}
                anchor={a}
                txHex={txHex}
                // Collapse document bodies by default when the tx has multiple
                // anchors, so the tab reads as a list of validations.
                defaultMetadataOpen={anchors.length <= 1}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
