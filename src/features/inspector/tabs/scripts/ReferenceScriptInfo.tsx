// src/features/inspector/tabs/scripts/ReferenceScriptInfo.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, FileCode, Link } from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { toast } from 'sonner';

interface ReferenceScriptInfoProps {
  tx: DomainTx;
}

function getScriptTypeBadgeColor(type: string) {
  switch (type) {
    case 'PlutusV1': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'PlutusV2': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'PlutusV3': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'Native': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

export function ReferenceScriptInfo({ tx }: ReferenceScriptInfoProps) {
  const outputsWithScriptRef = tx.outputs
    .map((output, index) => ({ output, index }))
    .filter(({ output }) => output.scriptRef);

  const hasReferenceInputs = tx.referenceInputs && tx.referenceInputs.length > 0;

  if (outputsWithScriptRef.length === 0 && !hasReferenceInputs) {
    return null;
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5" />
          Reference Scripts
          <Badge variant="outline">
            {outputsWithScriptRef.length + (tx.referenceInputs?.length || 0)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Reference inputs */}
        {hasReferenceInputs && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Reference Inputs</div>
            {tx.referenceInputs!.map((refInput, index) => (
              <div key={index} className="border rounded-lg p-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">TxId</span>
                  <div className="flex items-center gap-1">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">
                      {refInput.txId.slice(0, 16)}...#{refInput.index}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => copyToClipboard(`${refInput.txId}#${refInput.index}`, 'Reference input')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Outputs with scriptRef */}
        {outputsWithScriptRef.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Outputs with Reference Scripts</div>
            {outputsWithScriptRef.map(({ output, index }) => {
              const scriptRef = output.scriptRef!;
              return (
                <div key={index} className="border rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Output #{index}</span>
                    <Badge className={getScriptTypeBadgeColor(scriptRef.type)}>
                      <FileCode className="h-3 w-3 mr-1" />
                      {scriptRef.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Script bytes</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">
                        {scriptRef.bytes.slice(0, 24)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => copyToClipboard(scriptRef.bytes, 'Script bytes')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Size</span>
                    <span className="text-xs">{Math.ceil(scriptRef.bytes.length / 2)} bytes</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
