'use client';

import { Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatAda } from '@/lib/utils/ada';

interface Props {
  amount: bigint;
}

export function TreasuryDonationRow({ amount }: Props) {
  return (
    <div className="border rounded-lg px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="secondary" className="gap-1 flex-shrink-0">
          <Landmark className="h-3.5 w-3.5" />
          Treasury
        </Badge>
        <span className="text-xs font-medium truncate">Cardano Treasury</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">ada Received</span>
        <span className="text-sm font-mono text-green-600 dark:text-green-500">
          +{formatAda(amount)} ada
        </span>
      </div>
    </div>
  );
}
