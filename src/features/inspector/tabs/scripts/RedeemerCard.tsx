// src/features/inspector/tabs/scripts/RedeemerCard.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Zap, Hash, CheckCircle2, Cpu, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { DomainTx } from '@/domain/tx';
import { EvalResult, ProtocolParamsSubset, DatumInfo } from '@/lib/types/script-eval';
import { DatumDisplay } from './DatumDisplay';
import { cn } from '@/lib/utils';

interface RedeemerCardProps {
  redeemer: NonNullable<DomainTx['redeemers']>[number];
  index: number;
  evalResults: EvalResult[] | null;
  protocolParams: ProtocolParamsSubset | null;
  tx: DomainTx;
}

// Map DomainTx purpose names to Ogmios validator key prefixes
function normalizeRedeemerPurpose(purpose: string): string {
  switch (purpose) {
    case 'cert': return 'certificate';
    case 'reward': return 'withdrawal';
    default: return purpose;
  }
}

function getPurposeIcon(purpose: string) {
  switch (purpose) {
    case 'spend': return <Zap className="h-4 w-4" />;
    case 'mint': return <Hash className="h-4 w-4" />;
    case 'cert': return <CheckCircle2 className="h-4 w-4" />;
    case 'reward': return <Cpu className="h-4 w-4" />;
    default: return <Hash className="h-4 w-4" />;
  }
}

function getDiffIcon(diff: number | null) {
  if (diff === null) return null;
  if (diff > 0) return <ArrowDown className="h-3 w-3 text-green-600" />;
  if (diff < 0) return <ArrowUp className="h-3 w-3 text-red-600" />;
  return <Minus className="h-3 w-3 text-yellow-600" />;
}

function getDiffColor(diff: number | null) {
  if (diff === null) return '';
  if (diff > 0) return 'text-green-600'; // declared > evaluated = over-budgeted (safe)
  if (diff < 0) return 'text-red-600';   // declared < evaluated = under-budgeted (problem)
  return 'text-yellow-600';              // exact match
}

export function RedeemerCard({ redeemer, index, evalResults, protocolParams, tx }: RedeemerCardProps) {
  const safePurpose = String(redeemer?.purpose || 'unknown');
  const safeIndex = isNaN(Number(redeemer?.index)) ? 0 : Number(redeemer.index);
  const safeData = redeemer?.data ? String(redeemer.data) : null;
  const safeScriptHash = redeemer?.scriptHash ? String(redeemer.scriptHash) : null;
  const safeExUnits = redeemer?.exUnits ? {
    mem: isNaN(Number(redeemer.exUnits.mem)) ? 0 : Number(redeemer.exUnits.mem),
    steps: isNaN(Number(redeemer.exUnits.steps)) ? 0 : Number(redeemer.exUnits.steps),
  } : null;

  // Match evaluated result
  const normalizedPurpose = normalizeRedeemerPurpose(safePurpose);
  const evalKey = `${normalizedPurpose}:${safeIndex}`;
  const matchedEval = evalResults?.find(r => r.validator === evalKey) || null;

  // Compute diffs
  const memDiff = safeExUnits && matchedEval
    ? safeExUnits.mem - matchedEval.budget.memory
    : null;
  const stepsDiff = safeExUnits && matchedEval
    ? safeExUnits.steps - matchedEval.budget.cpu
    : null;

  // Per-redeemer ADA cost (from evaluated budget)
  let perRedeemerCost: number | null = null;
  if (matchedEval && protocolParams) {
    perRedeemerCost =
      matchedEval.budget.memory * protocolParams.priceMem +
      matchedEval.budget.cpu * protocolParams.priceStep;
  }

  // Find datum for spend redeemers
  // For spend purpose, the redeemer index refers to the sorted input index.
  // Datums live on outputs (the UTXOs being spent). We scan tx.outputs for any
  // that carry datum info, since the inputs' resolved data doesn't include datums.
  let datum: DatumInfo | null = null;
  if (safePurpose === 'spend') {
    for (const output of tx.outputs) {
      if (output.datum) {
        if (output.datum.inline) {
          datum = {
            type: 'inline',
            value: output.datum.hash || '(inline)',
            decodedType: output.datum.type,
            decodedContent: output.datum.content,
          };
          break;
        } else if (output.datum.hash) {
          datum = { type: 'hash', value: output.datum.hash };
          break;
        }
      }
    }
  }

  const tryParseJSON = (str: string): { isJSON: boolean; parsed?: unknown } => {
    try {
      const parsed = JSON.parse(str);
      return { isJSON: true, parsed };
    } catch {
      return { isJSON: false };
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Redeemer #{index + 1}</span>
        <div className="flex items-center gap-2">
          {perRedeemerCost !== null && (
            <span className="text-xs font-mono text-muted-foreground">
              ~{perRedeemerCost.toFixed(6)} ADA
            </span>
          )}
          <div className="flex items-center gap-1">
            {getPurposeIcon(safePurpose)}
            <span className="text-xs capitalize">{safePurpose}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Index</span>
          <span className="text-xs">{safeIndex}</span>
        </div>

        {/* ExUnits with side-by-side diff */}
        {safeExUnits && (
          <div className="space-y-1">
            {/* Memory row */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-xs items-center">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Memory (declared)</span>
                <span className="font-mono">{safeExUnits.mem.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                {matchedEval && getDiffIcon(memDiff)}
              </div>
              <div className="flex items-center justify-between">
                {matchedEval ? (
                  <>
                    <span className="text-muted-foreground">evaluated</span>
                    <span className={cn('font-mono', getDiffColor(memDiff))}>
                      {matchedEval.budget.memory.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">not evaluated</span>
                )}
              </div>
            </div>

            {/* Steps row */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-xs items-center">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Steps (declared)</span>
                <span className="font-mono">{safeExUnits.steps.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                {matchedEval && getDiffIcon(stepsDiff)}
              </div>
              <div className="flex items-center justify-between">
                {matchedEval ? (
                  <>
                    <span className="text-muted-foreground">evaluated</span>
                    <span className={cn('font-mono', getDiffColor(stepsDiff))}>
                      {matchedEval.budget.cpu.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">not evaluated</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Redeemer data */}
        {safeData && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Data</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => {
                  navigator.clipboard.writeText(safeData);
                  toast.success('Redeemer data copied');
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            {(() => {
              const { isJSON, parsed } = tryParseJSON(safeData);
              if (isJSON && parsed) {
                return (
                  <code className="text-xs bg-muted px-2 py-1 rounded block whitespace-pre-wrap break-all">
                    {JSON.stringify(parsed, null, 2)}
                  </code>
                );
              }
              return (
                <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                  {safeData.length > 64 ? `${safeData.slice(0, 64)}...` : safeData}
                </code>
              );
            })()}
          </div>
        )}

        {/* Script hash */}
        {safeScriptHash && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Script Hash</span>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {safeScriptHash.slice(0, 16)}...
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => {
                  navigator.clipboard.writeText(safeScriptHash);
                  toast.success('Script hash copied');
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Datum for spend redeemers */}
        {datum && <DatumDisplay datum={datum} />}
      </div>
    </div>
  );
}
