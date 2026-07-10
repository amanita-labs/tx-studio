'use client';

import { useMemo, useState } from 'react';
import { Wallet, Loader2, AlertCircle, Info, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { computeWalletSummary } from '@/lib/wallet-summary';
import { useResolveInputs, type InputResolutionStatus } from '@/hooks/use-resolve-inputs';
import { WalletSummaryRow } from './WalletSummaryRow';
import { TreasuryDonationRow } from './TreasuryDonationRow';
import type { DomainTx } from '@/domain/tx';

interface Props {
  tx: DomainTx;
}

export function WalletSummaryCard({ tx }: Props) {
  const network = useAppStore((s) => s.network);
  const resolution = useResolveInputs(tx);
  const summary = useMemo(() => computeWalletSummary(tx, network), [tx, network]);
  // Collapsed by default — input resolution still runs (it feeds the I/O lists
  // below); only the summary UI is hidden until the user expands it.
  const [open, setOpen] = useState(false);

  const treasuryDonation =
    tx.treasuryDonation && tx.treasuryDonation > 0n ? tx.treasuryDonation : undefined;

  const showSkeleton =
    resolution.status === 'loading' &&
    summary.unresolvedInputCount === summary.totalInputCount &&
    summary.totalInputCount > 0;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
            <CardTitle className="flex flex-1 items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Summary ({summary.rows.length + (treasuryDonation ? 1 : 0)})
              </span>
              <ResolutionIndicator status={resolution.status} resolved={resolution.resolvedCount} total={resolution.totalCount} />
            </CardTitle>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
        {resolution.status === 'unavailable' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Wallet summary requires a Blockfrost connection. Inputs cannot be resolved in static-export mode.
            </AlertDescription>
          </Alert>
        )}

        {resolution.status === 'error' && summary.rows.length === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Could not resolve inputs{resolution.error ? `: ${resolution.error}` : '.'}
            </AlertDescription>
          </Alert>
        )}

        {(resolution.status === 'partial' || (resolution.status === 'error' && summary.rows.length > 0)) && (
          <Alert className="mb-3 border-amber-500/50 bg-amber-500/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Showing partial summary — {summary.unresolvedInputCount} of {summary.totalInputCount} inputs could not be resolved. Spent values may be incomplete.
            </AlertDescription>
          </Alert>
        )}

        {showSkeleton && (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                <div className="h-5 bg-muted animate-pulse rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!showSkeleton && summary.rows.length === 0 && !treasuryDonation && resolution.status !== 'unavailable' && resolution.status !== 'error' && (
          <p className="text-sm text-muted-foreground">No wallet activity to summarise.</p>
        )}

        {(summary.rows.length > 0 || treasuryDonation) && (
          <div className="space-y-3">
            {summary.rows.map((row) => (
              <WalletSummaryRow key={row.groupKey} row={row} tx={tx} />
            ))}
            {treasuryDonation && <TreasuryDonationRow amount={treasuryDonation} />}
          </div>
        )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ResolutionIndicator({
  status,
  resolved,
  total,
}: {
  status: InputResolutionStatus;
  resolved: number;
  total: number;
}) {
  if (status === 'loading' || status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {resolved} of {total} resolved
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-normal text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        error
      </span>
    );
  }
  if (status === 'unavailable') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        unavailable
      </span>
    );
  }
  return null;
}
