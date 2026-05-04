// src/features/inspector/tabs/scripts/DatumDisplay.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { DatumInfo } from '@/lib/types/script-eval';
import { safeStringify } from '@/lib/utils';
import { PlutusJsonView } from './PlutusJsonView';

interface DatumDisplayProps {
  datum: DatumInfo;
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error(`Failed to copy ${label.toLowerCase()}`);
  }
}

export function DatumDisplay({ datum }: DatumDisplayProps) {
  const cbor = datum.cbor;
  const hasDecoded = datum.decodedContent != null;

  // Hash-only datums: nothing to inspect; the parent card already shows the hash row.
  if (!cbor && !hasDecoded) {
    return null;
  }

  const decodedJson = hasDecoded ? safeStringify(datum.decodedContent, 2) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Left pane: raw CBOR hex (hidden on small screens) */}
      {cbor && (
        <div className="hidden md:block space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">CBOR</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => copyText(cbor, 'Datum CBOR')}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <pre className="text-xs font-mono bg-muted px-3 py-2 rounded block whitespace-pre-wrap break-all max-h-[60vh] overflow-auto">
            {cbor}
          </pre>
        </div>
      )}

      {/* Right pane: decoded JSON */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">JSON</span>
          {decodedJson && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => copyText(decodedJson, 'Datum JSON')}
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="bg-muted px-3 py-2 rounded max-h-[60vh] overflow-auto">
          {hasDecoded ? (
            <PlutusJsonView data={datum.decodedContent} />
          ) : (
            <span className="text-xs text-muted-foreground italic">
              Unable to decode CBOR to JSON
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
