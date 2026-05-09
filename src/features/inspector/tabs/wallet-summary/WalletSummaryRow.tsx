'use client';

import { useState } from 'react';
import { Wallet, FileCode, MapPin, ChevronDown, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { BlockExplorerLink } from '@/components/block-explorer-link';
import { KnownLabelHighlight } from '@/components/known-label-highlight';
import { AssetDisplay } from '@/components/asset-display';
import { resolveAddressLabel, type TransactionLabelCategory } from '@/lib/labels';
import { useTokenRegistry } from '@/hooks/use-token-registry';
import { useAppStore } from '@/lib/store';
import { formatAda, formatAssetQuantity } from '@/lib/utils/ada';
import { cn } from '@/lib/utils';
import type { DomainTx } from '@/domain/tx';
import type { ImplicitLine, WalletSummaryRow as Row } from '@/lib/wallet-summary';

interface Props {
  row: Row;
  tx: DomainTx;
}

function truncateAddress(address: string, startLength = 15, endLength = 4): string {
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copied to clipboard`))
    .catch(() => toast.error('Failed to copy to clipboard'));
}

function rowKindIcon(kind: Row['kind']) {
  if (kind === 'contract') return <FileCode className="h-3.5 w-3.5" />;
  if (kind === 'address-only') return <MapPin className="h-3.5 w-3.5" />;
  return <Wallet className="h-3.5 w-3.5" />;
}

function rowKindLabel(kind: Row['kind']): string {
  if (kind === 'contract') return 'Contract';
  if (kind === 'address-only') return 'Address';
  return 'Wallet';
}

function deltaWording(adaDelta: bigint): { label: string; value: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (adaDelta > 0n) return { label: 'ada Received', value: `+${formatAda(adaDelta)}`, tone: 'positive' };
  if (adaDelta < 0n) return { label: 'ada Spent', value: formatAda(adaDelta), tone: 'negative' };
  return { label: 'ada Net', value: '0', tone: 'neutral' };
}

function ImplicitLineRow({ line }: { line: ImplicitLine }) {
  const sign = line.direction === 'in' ? '+' : '−';
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{line.label}</span>
      <span className="text-xs font-mono">{sign}{formatAda(line.amount)} ada</span>
    </div>
  );
}

export function WalletSummaryRow({ row, tx }: Props) {
  const [open, setOpen] = useState(false);
  const network = useAppStore((s) => s.network);
  const { getMetadata } = useTokenRegistry(tx);

  const explorerType: 'stakeKey' | 'address' = row.stakeCred ? 'stakeKey' : 'address';
  const explorerParams: Record<string, string> = row.stakeCred
    ? { stakeKey: row.displayAddress }
    : { address: row.displayAddress };

  const labelCategory: TransactionLabelCategory = row.kind === 'contract' ? 'script' : 'address';
  const knownLabel = resolveAddressLabel(
    {
      address: row.kind === 'contract' || row.kind === 'address-only' ? row.displayAddress : undefined,
      addressCreds: { paymentCred: row.paymentCred, stakeCred: row.stakeCred },
    },
    network,
  );

  const delta = deltaWording(row.adaDelta);
  const inlineAssets = row.assetDeltas.slice(0, 2);
  const remainingAssets = row.assetDeltas.length - inlineAssets.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={open}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen((prev) => !prev);
              }
            }}
            className="px-3 py-2 space-y-2 cursor-pointer hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="secondary" className="gap-1 flex-shrink-0">
                  {rowKindIcon(row.kind)}
                  {rowKindLabel(row.kind)}
                </Badge>
                <code className="text-xs bg-muted px-2 py-1 rounded truncate">
                  {truncateAddress(row.displayAddress)}
                </code>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(row.displayAddress, row.stakeCred ? 'Stake address' : 'Address')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <BlockExplorerLink type={explorerType} params={explorerParams} />
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{delta.label}</span>
              <span className={cn(
                'text-sm font-mono',
                delta.tone === 'positive' && 'text-green-600 dark:text-green-500',
                delta.tone === 'negative' && 'text-red-600 dark:text-red-500',
              )}>
                {delta.value} ada
              </span>
            </div>

            {(inlineAssets.length > 0 || remainingAssets > 0) && (
              <div className="flex items-center flex-wrap gap-1.5">
                {inlineAssets.map((a, i) => {
                  const meta = getMetadata(a.policyId, a.assetName);
                  const decimals = meta?.decimals ?? 0;
                  const sign = a.delta > 0n ? '+' : '';
                  const ticker = meta?.ticker ?? meta?.name ?? truncateAddress(a.assetName || a.policyId, 6, 4);
                  return (
                    <Badge key={i} variant="outline" className="text-xs font-mono font-normal">
                      {sign}{formatAssetQuantity(a.delta, decimals)} {ticker}
                    </Badge>
                  );
                })}
                {remainingAssets > 0 && (
                  <Badge variant="outline" className="text-xs">
                    +{remainingAssets} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-2 space-y-3 border-t bg-muted/20">
            {knownLabel && (
              <KnownLabelHighlight category={labelCategory} label={knownLabel} />
            )}

            {row.implicitLines.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Implicit</span>
                <div className="space-y-1">
                  {row.implicitLines.map((line, i) => (
                    <ImplicitLineRow key={i} line={line} />
                  ))}
                </div>
              </div>
            )}

            {row.assetDeltas.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Assets ({row.assetDeltas.length})</span>
                <div className="space-y-1">
                  {row.assetDeltas.map((a, i) => (
                    <AssetDisplay
                      key={i}
                      asset={{ policyId: a.policyId, assetName: a.assetName, quantity: a.delta }}
                      metadata={getMetadata(a.policyId, a.assetName)}
                    />
                  ))}
                </div>
              </div>
            )}

            {row.contributingInputs.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Inputs ({row.contributingInputs.length})</span>
                <div className="space-y-1">
                  {row.contributingInputs.map((inp) => (
                    <div key={`${inp.txId}#${inp.outputIndex}`} className="flex items-center justify-between gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate">
                        Input #{inp.index} · {inp.txId.slice(0, 12)}...#{inp.outputIndex}
                      </code>
                      <span className="text-xs font-mono flex-shrink-0">−{formatAda(inp.ada)} ada</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {row.contributingOutputs.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Outputs ({row.contributingOutputs.length})</span>
                <div className="space-y-1">
                  {row.contributingOutputs.map((out) => (
                    <div key={out.index} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="text-xs bg-muted px-2 py-1 rounded">Output #{out.index}</code>
                        {out.hasDatum && <Badge variant="outline" className="text-xs">Datum</Badge>}
                        {out.hasScriptRef && <Badge variant="outline" className="text-xs">Script</Badge>}
                      </div>
                      <span className="text-xs font-mono flex-shrink-0">+{formatAda(out.ada)} ada</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
