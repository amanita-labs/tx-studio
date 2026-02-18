// src/features/inspector/tabs/scripts/ExUnitsBudgetCard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProtocolParamsSubset } from '@/lib/types/script-eval';

interface ExUnitsBudgetCardProps {
  totalMem: number;
  totalSteps: number;
  protocolParams: ProtocolParamsSubset | null;
  costInAda: number | null;
  isEvaluated: boolean;
}

function getBarColor(pct: number): string {
  if (pct < 50) return 'text-green-600';
  if (pct < 80) return 'text-yellow-600';
  return 'text-red-600';
}

function getIndicatorClass(pct: number): string {
  if (pct < 50) return '[&>[data-slot=progress-indicator]]:bg-green-500';
  if (pct < 80) return '[&>[data-slot=progress-indicator]]:bg-yellow-500';
  return '[&>[data-slot=progress-indicator]]:bg-red-500';
}

export function ExUnitsBudgetCard({
  totalMem,
  totalSteps,
  protocolParams,
  costInAda,
  isEvaluated,
}: ExUnitsBudgetCardProps) {
  const memPct = protocolParams?.maxTxExMem
    ? Math.min((totalMem / protocolParams.maxTxExMem) * 100, 100)
    : null;
  const stepsPct = protocolParams?.maxTxExSteps
    ? Math.min((totalSteps / protocolParams.maxTxExSteps) * 100, 100)
    : null;

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5" />
          Total Execution Units
          {isEvaluated && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              evaluated
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Memory */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Memory</div>
              {memPct !== null && (
                <span className={cn('text-xs font-mono font-medium', getBarColor(memPct))}>
                  {memPct.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-mono font-bold">
              {totalMem.toLocaleString()}
            </div>
            {memPct !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Progress
                      value={memPct}
                      className={cn('h-2', getIndicatorClass(memPct))}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {totalMem.toLocaleString()} / {protocolParams!.maxTxExMem.toLocaleString()} memory units
                </TooltipContent>
              </Tooltip>
            )}
            <div className="text-xs text-muted-foreground">memory units</div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">CPU Steps</div>
              {stepsPct !== null && (
                <span className={cn('text-xs font-mono font-medium', getBarColor(stepsPct))}>
                  {stepsPct.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-mono font-bold">
              {totalSteps.toLocaleString()}
            </div>
            {stepsPct !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Progress
                      value={stepsPct}
                      className={cn('h-2', getIndicatorClass(stepsPct))}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {totalSteps.toLocaleString()} / {protocolParams!.maxTxExSteps.toLocaleString()} CPU steps
                </TooltipContent>
              </Tooltip>
            )}
            <div className="text-xs text-muted-foreground">CPU steps</div>
          </div>
        </div>

        {/* ADA Cost */}
        {costInAda !== null && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Estimated execution cost</span>
              <span className="text-sm font-mono font-semibold">
                ~{costInAda.toFixed(6)} ADA
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
