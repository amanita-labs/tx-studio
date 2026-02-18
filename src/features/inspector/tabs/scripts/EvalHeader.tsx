// src/features/inspector/tabs/scripts/EvalHeader.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Play, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { EvalResponse } from '@/lib/types/script-eval';

interface EvalHeaderProps {
  evalResult: EvalResponse | null;
  isEvaluating: boolean;
  onEvaluate: () => void;
}

export function EvalHeader({ evalResult, isEvaluating, onEvaluate }: EvalHeaderProps) {
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
    return null;
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
        {evalResult ? 'Re-evaluate' : 'Evaluate'}
      </Button>
    </div>
  );
}
