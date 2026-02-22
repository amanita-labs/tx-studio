// src/features/inspector/tabs/scripts/DatumOutputCard.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
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
    size?: number;
  };
}

export function DatumOutputCard({ index, address, datum }: DatumOutputCardProps) {
  const isInline = !!datum.inline;

  const datumInfo: DatumInfo = {
    type: isInline ? 'inline' : 'hash',
    value: datum.hash || '',
    decodedType: datum.type,
    decodedContent: datum.content,
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Output #{index}</span>
          <code className="text-xs text-muted-foreground truncate max-w-[180px]">
            {address.slice(0, 24)}...
          </code>
        </div>
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

      <DatumDisplay datum={datumInfo} />

      {datum.hash && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Datum hash</span>
          <div className="flex items-center gap-1">
            <code className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">
              {datum.hash.slice(0, 16)}...
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
    </div>
  );
}
