// src/features/inspector/tabs/scripts/EvalHeader.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Play, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import { EvalResponse } from '@/lib/types/script-eval';

interface EvalHeaderProps {
  evalResult: EvalResponse | null;
  isEvaluating: boolean;
  onEvaluate: () => void;
  isOnChain?: boolean;
}

export function EvalHeader({ evalResult, isEvaluating, onEvaluate, isOnChain }: EvalHeaderProps) {
  const getStatusBadge = () => {
    if (isEvaluating) {
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Evaluating
        </Badge>
      );
    }
    if (evalResult?.success) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Evaluated
        </Badge>
      );
    }
    if (evalResult && !evalResult.success) {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
    if (isOnChain) {
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          <Info className="h-3 w-3 mr-1" />
          On-chain — eval skipped
        </Badge>
      );
    }
    return null;
  };

  const getButtonLabel = () => {
    if (evalResult) return 'Re-evaluate';
    if (isOnChain) return 'Evaluate Anyway';
    return 'Evaluate';
  };

  return (
    <div className="flex items-center gap-2">
      {getStatusBadge()}
      <Button
        variant="outline"
        size="sm"
        onClick={onEvaluate}
        disabled={isEvaluating}
      >
        {isEvaluating ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : evalResult ? (
          <RefreshCw className="h-4 w-4 mr-2" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        {getButtonLabel()}
      </Button>
    </div>
  );
}
