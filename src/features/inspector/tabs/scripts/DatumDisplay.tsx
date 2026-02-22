// src/features/inspector/tabs/scripts/DatumDisplay.tsx
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { DatumInfo } from '@/lib/types/script-eval';
import { safeStringify } from '@/lib/utils';

interface DatumDisplayProps {
  datum: DatumInfo;
}

export function DatumDisplay({ datum }: DatumDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDecoded = datum.decodedContent != null;

  const decodedJson = hasDecoded ? safeStringify(datum.decodedContent, 2) : null;
  const isLong = hasDecoded
    ? (decodedJson!.length > 200)
    : (datum.value.length > 128);

  const copyDatum = async () => {
    const text = decodedJson || datum.value;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Datum copied to clipboard');
    } catch {
      toast.error('Failed to copy datum');
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Datum</span>
        <Badge
          variant="outline"
          className={
            datum.type === 'inline'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] px-1.5 py-0'
          }
        >
          {datum.type}
        </Badge>
        {datum.decodedType && (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-[10px] px-1.5 py-0"
          >
            {datum.decodedType}
          </Badge>
        )}
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto" onClick={copyDatum}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      {/* Decoded Plutus Data */}
      {hasDecoded ? (
        isLong ? (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <pre className={`text-xs bg-muted px-2 py-1 rounded block whitespace-pre-wrap break-all ${isOpen ? '' : 'max-h-32 overflow-hidden'}`}>
              {isOpen ? decodedJson : `${decodedJson!.slice(0, 200)}...`}
            </pre>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs mt-1 px-2">
                {isOpen ? (
                  <><ChevronDown className="h-3 w-3 mr-1" /> Collapse</>
                ) : (
                  <><ChevronRight className="h-3 w-3 mr-1" /> Expand</>
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        ) : (
          <pre className="text-xs bg-muted px-2 py-1 rounded block whitespace-pre-wrap break-all">
            {decodedJson}
          </pre>
        )
      ) : (
        /* Raw hash / hex fallback */
        isLong ? (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
              {isOpen ? datum.value : `${datum.value.slice(0, 128)}...`}
            </code>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs mt-1 px-2">
                {isOpen ? (
                  <><ChevronDown className="h-3 w-3 mr-1" /> Collapse</>
                ) : (
                  <><ChevronRight className="h-3 w-3 mr-1" /> Expand ({datum.value.length} chars)</>
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        ) : (
          <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
            {datum.value}
          </code>
        )
      )}
    </div>
  );
}
