// src/features/inspector/tabs/scripts/OutputDatumsInfo.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database } from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { DatumOutputCard } from './DatumOutputCard';

interface OutputDatumsInfoProps {
  tx: DomainTx;
}

export function OutputDatumsInfo({ tx }: OutputDatumsInfoProps) {
  const outputsWithDatum = tx.outputs
    .map((output, index) => ({ output, index }))
    .filter(({ output }) => output.datum);

  if (outputsWithDatum.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Datums
          <Badge variant="outline">
            {outputsWithDatum.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {outputsWithDatum.map(({ output, index }, i) => (
            <DatumOutputCard
              key={index}
              index={index}
              address={output.address}
              datum={output.datum!}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
