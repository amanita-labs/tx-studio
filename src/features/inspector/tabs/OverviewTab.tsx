// src/features/inspector/tabs/OverviewTab.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DomainTx } from '@/domain/tx';
import { formatAda, formatLovelace } from '@/lib/utils/ada';
import { formatSlotWithTime, slotToLocalTime, formatValidityWindow, getTimeRemaining } from '@/lib/utils/slot-time';
import { Copy, Hash, Calendar, Coins, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BlockExplorerLink } from '@/components/block-explorer-link';

// Helper component for validity status badge
function ValidityStatus({ startSlot, endSlot }: { startSlot: number; endSlot: number }) {
  const validityInfo = formatValidityWindow(startSlot, endSlot);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not-started':
        return <Badge variant="secondary" className="text-xs">Not Started</Badge>;
      case 'active':
        return <Badge variant="default" className="text-xs bg-green-500">Active</Badge>;
      case 'expired':
        return <Badge variant="destructive" className="text-xs">Expired</Badge>;
      default:
        return null;
    }
  };
  
  return getStatusBadge(validityInfo.status);
}

// Helper component for time remaining
function ValidityTimeRemaining({ slot }: { slot: number }) {
  const timeInfo = getTimeRemaining(slot);
  
  if (timeInfo.isExpired) {
    return (
      <div className="text-xs text-red-500 font-medium">
        Expired
      </div>
    );
  }
  
  return (
    <div className="text-xs text-muted-foreground">
      {timeInfo.timeRemaining} remaining
    </div>
  );
}

interface OverviewTabProps {
  tx: DomainTx;
}

export function OverviewTab({ tx }: OverviewTabProps) {
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
      {/* Transaction Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Transaction Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Transaction ID</span>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {tx.id.slice(0, 16)}...
              </code>
              <BlockExplorerLink 
                type="transaction" 
                params={{ txHash: tx.id }}
                variant="ghost"
                size="sm"
              >
                <Copy className="h-3 w-3" />
              </BlockExplorerLink>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Era</span>
            <Badge variant={tx.era === 'Unknown' ? 'destructive' : 'default'}>
              {tx.era}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Size</span>
            <span className="text-sm">{tx.sizeBytes.toLocaleString()} bytes</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Fee</span>
            <span className="text-sm font-mono">{formatAda(tx.feeLovelace)} ADA</span>
          </div>
        </CardContent>
      </Card>

      {/* Validity Window */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Validity Window
            {tx.validity.start && tx.validity.end && (
              <ValidityStatus startSlot={tx.validity.start} endSlot={tx.validity.end} />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tx.slot && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Slot</span>
              <div className="text-sm text-right">
                <div className="font-mono">{tx.slot.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{slotToLocalTime(tx.slot)}</div>
              </div>
            </div>
          )}
          
          {tx.ttl && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">TTL</span>
              <div className="text-sm text-right">
                <div className="font-mono">{tx.ttl.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{slotToLocalTime(tx.ttl)}</div>
              </div>
            </div>
          )}
          
          {tx.validity.start && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Valid From</span>
              <div className="text-sm text-right">
                <div className="font-mono">{tx.validity.start.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{slotToLocalTime(tx.validity.start)}</div>
                <ValidityTimeRemaining slot={tx.validity.start} />
              </div>
            </div>
          )}
          
          {tx.validity.end && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Valid Until</span>
              <div className="text-sm text-right">
                <div className="font-mono">{tx.validity.end.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{slotToLocalTime(tx.validity.end)}</div>
                <ValidityTimeRemaining slot={tx.validity.end} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Value Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Value Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Inputs</span>
            <span className="text-sm">{tx.inputs.length}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Outputs</span>
            <span className="text-sm">{tx.outputs.length}</span>
          </div>
          
          {tx.mint && tx.mint.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Mint</span>
              <span className="text-sm">{tx.mint.length} assets</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scripts & Witnesses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Scripts & Witnesses
            </div>
            {tx.witnesses.vkeyCount === 0 && tx.witnesses.nativeCount === 0 && tx.witnesses.plutusCount === 0 && (
              <Badge variant="secondary" className="text-xs">
                Unsigned Transaction
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Scripts</span>
            <span className="text-sm">{tx.scripts?.length || 0}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Redeemers</span>
            <span className="text-sm">{tx.redeemers?.length || 0}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">VKey Witnesses</span>
            <span className="text-sm">{tx.witnesses.vkeyCount}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Native Scripts</span>
            <span className="text-sm">{tx.witnesses.nativeCount}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Plutus Scripts</span>
            <span className="text-sm">{tx.witnesses.plutusCount}</span>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {tx.warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tx.warnings.map((warning, index) => (
                <li key={index} className="text-sm text-destructive">
                  • {warning}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
