// src/features/builder/TransactionSummary.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Copy, CheckCircle2, FileText, Vote } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

export function TransactionSummary() {
  const { builderCertificates, builtTxHex, removeCertificate } = useAppStore();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getCertificateLabel = (type: string) => {
    switch (type) {
      case 'VoteDelegation': return 'Vote Delegation';
      case 'DRepRegistration': return 'DRep Registration';
      case 'DRepUpdate': return 'DRep Update';
      case 'DRepRetirement': return 'DRep Retirement';
      case 'Vote': return 'Vote';
      default: return type;
    }
  };

  // Separate votes from other certificates for display
  const votes = builderCertificates.filter(c => c.type === 'Vote');
  const certificates = builderCertificates.filter(c => c.type !== 'Vote');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Transaction Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Certificates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Certificates ({certificates.length})
              </h3>
            </div>
            <ScrollArea className="h-32">
              {certificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No certificates added</p>
              ) : (
                <div className="space-y-2">
                  {certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className="mr-2">
                          {getCertificateLabel(cert.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {cert.data.drepId || cert.data.stakeCredential || 'Certificate'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCertificate(cert.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Votes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Vote className="h-4 w-4" />
                Votes ({votes.length})
              </h3>
            </div>
            <ScrollArea className="h-32">
              {votes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No votes added</p>
              ) : (
                <div className="space-y-2">
                  {votes.map((vote) => (
                    <div
                      key={vote.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className="mr-2 capitalize">
                          {vote.data.vote as string}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate font-mono">
                          {(vote.data.proposalId as string)?.slice(0, 16)}...
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCertificate(vote.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Separator />

          {/* Transaction Hex */}
          {builtTxHex && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Transaction Hex</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(builtTxHex, 'Transaction Hex')}
                >
                  {copied === 'Transaction Hex' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <ScrollArea className="flex-1 border rounded-md p-2">
                <code className="text-xs break-all">{builtTxHex}</code>
              </ScrollArea>
            </div>
          )}

          {!builtTxHex && builderCertificates.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Add certificates or votes to build a transaction
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

