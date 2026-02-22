// src/features/inspector/tabs/ScriptsTab.tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, FileCode, Code, Hash, Zap, CheckCircle2, Cpu, Vote, ScrollText, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DomainTx } from '@/domain/tx';
import { toast } from 'sonner';
import { BlockExplorerLink } from '@/components/block-explorer-link';
import { getKnownScriptLabel } from '@/lib/labels';
import { KnownLabelHighlight } from '@/components/known-label-highlight';
import { useAppStore } from '@/lib/store';
import { useScriptEval } from '@/hooks/use-script-eval';
import { EvalHeader } from './scripts/EvalHeader';
import { ExUnitsBudgetCard } from './scripts/ExUnitsBudgetCard';
import { RedeemerCard } from './scripts/RedeemerCard';
import { EvalErrorDisplay } from './scripts/EvalErrorDisplay';
import { ReferenceScriptInfo } from './scripts/ReferenceScriptInfo';
import { OutputDatumsInfo } from './scripts/OutputDatumsInfo';

interface ScriptsTabProps {
  tx: DomainTx;
  txHex: string;
  isOnChain: boolean;
}

export function ScriptsTab({ tx, txHex, isOnChain }: ScriptsTabProps) {
  const network = useAppStore(s => s.network);
  const getEvalCache = useAppStore(s => s.getEvalCache);
  const setEvalCache = useAppStore(s => s.setEvalCache);
  const {
    evaluate,
    fetchProtocolParams,
    evalResult,
    isEvaluating,
    protocolParams,
    costInAda,
    setResult,
  } = useScriptEval();

  const lastEvalKey = useRef<string | null>(null);

  const cacheKey = `${txHex.slice(0, 16)}:${network}`;

  const hasDatums = tx.outputs.some(o => o.datum);
  const hasScripts = (tx.scripts && tx.scripts.length > 0) || (tx.redeemers && tx.redeemers.length > 0) || hasDatums;

  const runEvaluation = useCallback(async () => {
    const [evalResponse] = await Promise.all([
      evaluate(txHex, network),
      fetchProtocolParams(network),
    ]);
    if (evalResponse) {
      setEvalCache(cacheKey, evalResponse);
    }
    return evalResponse;
  }, [evaluate, fetchProtocolParams, txHex, network, setEvalCache, cacheKey]);

  // Auto-evaluate on mount or when tx changes
  useEffect(() => {
    if (!txHex || !hasScripts || isOnChain) return;
    if (lastEvalKey.current === cacheKey) return;
    lastEvalKey.current = cacheKey;

    // Check cache first
    const cached = getEvalCache(cacheKey);
    if (cached) {
      setResult(cached);
      fetchProtocolParams(network);
      return;
    }

    runEvaluation();
  }, [runEvaluation, txHex, hasScripts, isOnChain, getEvalCache, cacheKey, setResult, fetchProtocolParams, network]);

  const handleManualEvaluate = () => {
    runEvaluation();
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'spend': return <Zap className="h-3 w-3" />;
      case 'mint': return <Hash className="h-3 w-3" />;
      case 'cert': return <CheckCircle2 className="h-3 w-3" />;
      case 'reward': return <Cpu className="h-3 w-3" />;
      case 'vote': return <Vote className="h-3 w-3" />;
      case 'propose': return <ScrollText className="h-3 w-3" />;
      default: return <Hash className="h-3 w-3" />;
    }
  };

  const getPurposeColor = (purpose: string) => {
    switch (purpose) {
      case 'spend': return 'text-yellow-700 border-yellow-400/50 dark:text-yellow-400 dark:border-yellow-500/30';
      case 'mint': return 'text-green-700 border-green-400/50 dark:text-green-400 dark:border-green-500/30';
      case 'cert': return 'text-blue-700 border-blue-400/50 dark:text-blue-400 dark:border-blue-500/30';
      case 'reward': return 'text-purple-700 border-purple-400/50 dark:text-purple-400 dark:border-purple-500/30';
      case 'vote': return 'text-rose-700 border-rose-400/50 dark:text-rose-400 dark:border-rose-500/30';
      case 'propose': return 'text-orange-700 border-orange-400/50 dark:text-orange-400 dark:border-orange-500/30';
      default: return '';
    }
  };

  const getScriptTypeIcon = (type: string) => {
    switch (type) {
      case 'native': return <FileCode className="h-4 w-4" />;
      case 'plutus-v1': return <Code className="h-4 w-4" />;
      case 'plutus-v2': return <Code className="h-4 w-4" />;
      default: return <FileCode className="h-4 w-4" />;
    }
  };

  const getScriptTypeColor = (type: string) => {
    switch (type) {
      case 'native': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'plutus-v1': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'plutus-v2': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'plutus-v3': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Calculate total execution units — use evaluated results if available, otherwise declared
  let totalMem = 0;
  let totalSteps = 0;
  let isEvaluatedTotal = false;

  if (evalResult?.success) {
    isEvaluatedTotal = true;
    for (const r of evalResult.results) {
      totalMem += r.budget.memory;
      totalSteps += r.budget.cpu;
    }
  } else if (tx.redeemers) {
    for (const redeemer of tx.redeemers) {
      if (redeemer.exUnits) {
        totalMem += isNaN(Number(redeemer.exUnits.mem)) ? 0 : Number(redeemer.exUnits.mem);
        totalSteps += isNaN(Number(redeemer.exUnits.steps)) ? 0 : Number(redeemer.exUnits.steps);
      }
    }
  }

  if (!hasScripts) {
    return (
      <div className="h-full flex flex-col">
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-center">
              <Code className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">No Scripts Found</h3>
              <p className="text-muted-foreground mb-4">
                This transaction contains no scripts or redeemers.
              </p>
            </div>
            <EvalHeader
              evalResult={evalResult}
              isEvaluating={isEvaluating}
              onEvaluate={handleManualEvaluate}
              isOnChain={isOnChain}
            />
            {evalResult && !evalResult.success && (
              <div className="w-full max-w-lg">
                <EvalErrorDisplay failure={evalResult} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const evalResults = evalResult?.success ? evalResult.results : null;

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Scripts</h3>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {tx.scripts?.length || 0} scripts
            </Badge>
            <Badge variant="outline">
              {tx.redeemers?.length || 0} redeemers
            </Badge>
            {hasDatums && (
              <Badge variant="outline">
                {tx.outputs.filter(o => o.datum).length} datums
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <EvalHeader
            evalResult={evalResult}
            isEvaluating={isEvaluating}
            onEvaluate={handleManualEvaluate}
            isOnChain={isOnChain}
          />
        </div>
      </div>

      {/* Evaluation Error */}
      {evalResult && !evalResult.success && (
        <EvalErrorDisplay failure={evalResult} />
      )}

      {/* Scripts */}
      {tx.scripts && tx.scripts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Scripts
              <Badge variant="outline">{tx.scripts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tx.scripts.map((script, index) => {
                const safeType = String(script?.type || 'unknown');
                const safeHash = String(script?.hash || '');
                const safeSize = script?.bytesLen && !isNaN(Number(script.bytesLen)) ? Number(script.bytesLen) : null;
                const scriptLabel = getKnownScriptLabel(safeHash);
                const matchedRedeemers = tx.redeemers?.filter(r => r.scriptHash === safeHash) ?? [];

                return (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <code className="text-xs font-mono font-medium bg-muted px-1.5 py-0.5 rounded">
                            {safeHash.slice(0, 12)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => {
                              navigator.clipboard.writeText(safeHash);
                              toast.success('Script hash copied');
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {Object.entries(
                          matchedRedeemers.reduce<Record<string, number>>((acc, r) => {
                            acc[r.purpose] = (acc[r.purpose] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([purpose, count]) => (
                          <Badge key={purpose} variant="outline" className={`gap-1 ${getPurposeColor(purpose)}`}>
                            {getPurposeIcon(purpose)}
                            {purpose} ({count})
                          </Badge>
                        ))}
                      </div>
                      <Badge className={getScriptTypeColor(safeType)}>
                        {getScriptTypeIcon(safeType)}
                        <span className="ml-1">{safeType}</span>
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      {scriptLabel && (
                        <KnownLabelHighlight category="script" label={scriptLabel} />
                      )}

                      {script.address && matchedRedeemers.some(r => r.purpose === 'spend') && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Address</span>
                          <div className="flex items-center gap-1">
                            <code className="text-xs font-medium bg-muted px-2 py-1 rounded truncate max-w-[240px]">
                              {script.address.slice(0, 32)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(script.address!);
                                toast.success('Script address copied');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <BlockExplorerLink
                              type="address"
                              params={{ address: script.address }}
                            />
                          </div>
                        </div>
                      )}

                      {safeSize && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Size</span>
                          <span className="text-xs">{safeSize} bytes</span>
                        </div>
                      )}

                      {script.bytes && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">CBOR</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(script.bytes!);
                              toast.success('Script CBOR copied');
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            <span className="text-xs">Copy CBOR</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Redeemers */}
      {tx.redeemers && tx.redeemers.length > 0 && (
        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Redeemers
                  <Badge variant="outline">{tx.redeemers.length}</Badge>
                  <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-3">
                  {[...tx.redeemers].sort((a, b) => a.purpose.localeCompare(b.purpose) || a.index - b.index).map((redeemer, index) => (
                    <RedeemerCard
                      key={index}
                      redeemer={redeemer}
                      index={index}
                      evalResults={evalResults}
                      protocolParams={protocolParams}
                      tx={tx}
                    />
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Total Execution Units with Budget Bars */}
      {tx.redeemers && tx.redeemers.length > 0 && (totalMem > 0 || totalSteps > 0) && (
        <ExUnitsBudgetCard
          totalMem={totalMem}
          totalSteps={totalSteps}
          protocolParams={protocolParams}
          costInAda={costInAda}
          isEvaluated={isEvaluatedTotal}
        />
      )}

      {/* Reference Scripts */}
      <ReferenceScriptInfo tx={tx} />

      {/* Output Datums */}
      <OutputDatumsInfo tx={tx} />

      {/* Script Metadata */}
      {(tx.scriptDataHash || tx.totalCollateral) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Script Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tx.scriptDataHash && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Script Data Hash</span>
                <div className="flex items-center gap-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {tx.scriptDataHash.slice(0, 16)}...
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(tx.scriptDataHash!, 'Script data hash')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            {tx.totalCollateral && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Collateral</span>
                <span className="text-sm font-mono">
                  {(Number(tx.totalCollateral) / 1000000).toFixed(6)} ADA
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
