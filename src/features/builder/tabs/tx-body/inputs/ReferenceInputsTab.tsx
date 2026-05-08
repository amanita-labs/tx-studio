// src/features/builder/tabs/tx-body/inputs/ReferenceInputsTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { BookOpen } from 'lucide-react';

export function ReferenceInputsTab() {
  const { addTxBodyElement } = useAppStore();
  const [txId, setTxId] = useState('');
  const [index, setIndex] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ txId?: string; index?: string }>({});

  const validate = (): boolean => {
    const newErrors: { txId?: string; index?: string } = {};

    if (!txId.trim()) {
      newErrors.txId = 'Transaction ID is required';
    } else {
      const isHex = /^[0-9a-fA-F]+$/.test(txId);
      if (!isHex || txId.length !== 64) {
        newErrors.txId = 'Transaction ID must be 64 hex characters (32 bytes)';
      }
    }

    if (!index.trim()) {
      newErrors.index = 'Output index is required';
    } else {
      const indexNum = parseInt(index, 10);
      if (isNaN(indexNum) || indexNum < 0) {
        newErrors.index = 'Output index must be a non-negative number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const element: BuilderTxBodyElement = {
        id: `reference-input-${Date.now()}`,
        type: 'ReferenceInputs',
        data: {
          txId: txId.trim(),
          index: parseInt(index, 10)
        }
      };

      addTxBodyElement(element);
      toast.success('Reference input added');
      
      setTxId('');
      setIndex('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to add reference input: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Reference Inputs
        </CardTitle>
        <CardDescription>
          Add reference inputs for Plutus scripts (read-only UTXOs)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tx-id">Transaction ID</Label>
          <Input
            id="tx-id"
            placeholder="64 hex characters (32 bytes)"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            aria-invalid={errors.txId ? 'true' : 'false'}
          />
          {errors.txId && (
            <p className="text-sm text-destructive">{errors.txId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="index">Output Index</Label>
          <Input
            id="index"
            type="number"
            placeholder="0"
            value={index}
            onChange={(e) => setIndex(e.target.value)}
            aria-invalid={errors.index ? 'true' : 'false'}
          />
          {errors.index && (
            <p className="text-sm text-destructive">{errors.index}</p>
          )}
        </div>

        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Adding...' : 'Add Reference Input'}
        </Button>
      </CardContent>
    </Card>
  );
}

