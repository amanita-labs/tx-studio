// src/features/inspector/tabs/SearchTab.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DomainTx } from '@/domain/tx';
import { TransactionSearchComponent } from '@/components/transaction-search';
import { SearchResult } from '@/lib/transaction-search';
import { toast } from 'sonner';
import { safeStringify } from '@/lib/utils';

interface SearchTabProps {
  tx: DomainTx;
  txHex: string;
}

export function SearchTab({ tx, txHex }: SearchTabProps) {
  const handleResultClick = (result: SearchResult) => {
    // Copy the matched value to clipboard
    const valueToCopy = typeof result.value === 'object' 
      ? safeStringify(result.value, 2)
      : String(result.value);
    
    navigator.clipboard.writeText(valueToCopy).then(() => {
      toast.success('Value copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  return (
    <div className="h-full">
      <TransactionSearchComponent 
        tx={tx} 
        txHex={txHex}
        onResultClick={handleResultClick}
      />
    </div>
  );
}
