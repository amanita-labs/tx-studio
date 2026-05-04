// src/features/inspector/tabs/scripts/DatumOutputCard.tsx
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { DatumDisplay } from './DatumDisplay';
import { DatumInfo } from '@/lib/types/script-eval';

interface DatumOutputCardProps {
  index: number;
  address: string;
  datum: {
    inline?: boolean | string;
    hash?: string;
    type?: string;
    content?: unknown;
    cbor?: string;
    size?: number;
  };
  defaultOpen?: boolean;
}

export function DatumOutputCard({ index, address, datum, defaultOpen = false }: DatumOutputCardProps) {
  const isInline = !!datum.inline;
  const inspectable = isInline && (datum.cbor || datum.content != null);
  const [open, setOpen] = useState(defaultOpen);

  const datumInfo: DatumInfo = {
    type: isInline ? 'inline' : 'hash',
    value: datum.hash || '',
    cbor: typeof datum.cbor === 'string' ? datum.cbor : undefined,
    decodedType: datum.type,
    decodedContent: datum.content,
  };

  const card = (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {inspectable ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-1 -ml-1">
                {open ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          ) : null}
          <span className="text-sm font-medium">Output #{index}</span>
          <code className="text-xs text-muted-foreground truncate max-w-[180px]">
            {address.slice(0, 24)}...
          </code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {datum.type && (
            <Badge
              variant="outline"
              className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-[10px] px-1.5 py-0"
            >
              {datum.type}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={
              isInline
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }
          >
            {isInline ? 'inline' : 'hash'}
          </Badge>
        </div>
      </div>

      {datum.hash && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Datum hash</span>
          <div className="flex items-center gap-1 min-w-0">
            <code className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[260px]">
              {datum.hash}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => {
                navigator.clipboard.writeText(datum.hash!);
                toast.success('Datum hash copied');
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {datum.size != null && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Size</span>
          <span className="text-xs">{datum.size} bytes</span>
        </div>
      )}

      {inspectable && (
        <CollapsibleContent>
          <div className="pt-2 border-t">
            <DatumDisplay datum={datumInfo} />
          </div>
        </CollapsibleContent>
      )}
    </div>
  );

  if (!inspectable) {
    return card;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {card}
    </Collapsible>
  );
}
