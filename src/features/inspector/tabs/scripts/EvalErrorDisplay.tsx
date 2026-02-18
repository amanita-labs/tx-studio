// src/features/inspector/tabs/scripts/EvalErrorDisplay.tsx
'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { EvalFailure } from '@/lib/types/script-eval';
import { getOgmiosErrorMessage, getOgmiosErrorCategory, OgmiosErrorCategory } from '@/lib/ogmios-errors';
import { safeStringify } from '@/lib/utils';

interface EvalErrorDisplayProps {
  failure: EvalFailure;
}

function getCategoryLabel(category: OgmiosErrorCategory): string {
  switch (category) {
    case 'context': return 'Context Error';
    case 'script': return 'Script Error';
    case 'phase1': return 'Phase-1 Error';
    case 'phase2': return 'Phase-2 Error';
    case 'governance': return 'Governance Error';
    case 'unknown': return 'Error';
  }
}

function getCategoryColor(category: OgmiosErrorCategory): string {
  switch (category) {
    case 'context': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'script': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'phase1': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'phase2': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'governance': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'unknown': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

export function EvalErrorDisplay({ failure }: EvalErrorDisplayProps) {
  const [isRawOpen, setIsRawOpen] = useState(false);

  const ogmiosCode = failure.ogmiosError?.code;
  const category = ogmiosCode ? getOgmiosErrorCategory(ogmiosCode) : 'unknown';
  const humanMessage = ogmiosCode
    ? getOgmiosErrorMessage(ogmiosCode)
    : failure.error;

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Evaluation Failed
        {ogmiosCode !== undefined && ogmiosCode !== 0 && (
          <Badge className={getCategoryColor(category)}>
            {getCategoryLabel(category)}
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">{humanMessage}</p>
        {failure.error !== humanMessage && (
          <p className="text-xs text-muted-foreground">{failure.error}</p>
        )}

        {failure.ogmiosError && (
          <Collapsible open={isRawOpen} onOpenChange={setIsRawOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                {isRawOpen ? (
                  <><ChevronDown className="h-3 w-3 mr-1" /> Hide details</>
                ) : (
                  <><ChevronRight className="h-3 w-3 mr-1" /> Show raw error</>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {safeStringify(failure.ogmiosError, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </AlertDescription>
    </Alert>
  );
}
