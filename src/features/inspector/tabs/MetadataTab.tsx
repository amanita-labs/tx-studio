// src/features/inspector/tabs/MetadataTab.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DomainTx } from '@/domain/tx';
import { Copy, FileText, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MetadataTabProps {
  tx: DomainTx;
}

export function MetadataTab({ tx }: MetadataTabProps) {
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {!tx.metadata || tx.metadata.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Metadata</h3>
            <p className="text-muted-foreground">
              This transaction contains no metadata.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tx.metadata.map((metadata, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Metadata Label {metadata.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metadata.json ? (
                  <div>
                    <h4 className="text-sm font-medium mb-2">JSON Data</h4>
                    <div className="bg-muted rounded-lg p-3">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(metadata.json as any, null, 2)}
                      </pre>
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(
                          JSON.stringify(metadata.json, null, 2),
                          'JSON metadata'
                        )}
                      >
                        <Copy className="h-3 w-3 mr-2" />
                        Copy JSON
                      </Button>
                    </div>
                  </div>
                ) : null}
                
                {metadata.cbor && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">CBOR Data</h4>
                    <div className="bg-muted rounded-lg p-3">
                      <code className="text-xs break-all">
                        {metadata.cbor}
                      </code>
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(metadata.cbor!, 'CBOR metadata')}
                      >
                        <Copy className="h-3 w-3 mr-2" />
                        Copy CBOR
                      </Button>
                    </div>
                  </div>
                )}
                
                {!metadata.json && !metadata.cbor && (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm">
                      No data available for this metadata entry.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
