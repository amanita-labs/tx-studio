// src/features/builder/tabs/tx-body/fees/FeeTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Coins } from 'lucide-react';

export function FeeTab() {
  const { addTxBodyElement } = useAppStore();
  const [fee, setFee] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ fee?: string }>({});

  const validate = (): boolean => {
    const newErrors: { fee?: string } = {};

    if (!fee.trim()) {
      newErrors.fee = 'Fee is required';
    } else {
      const feeNum = BigInt(fee);
      if (feeNum <= 0n) {
        newErrors.fee = 'Fee must be positive';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSet = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const element: BuilderTxBodyElement = {
        id: `fee-${Date.now()}`,
        type: 'Fee',
        data: {
          fee: fee.trim()
        }
      };

      addTxBodyElement(element);
      toast.success('Fee set');
      
      setFee('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to set fee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Fee
        </CardTitle>
        <CardDescription>
          Set transaction fee (in Lovelace)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fee">Fee (Lovelace)</Label>
          <Input
            id="fee"
            type="number"
            placeholder="170000"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            aria-invalid={errors.fee ? 'true' : 'false'}
          />
          {errors.fee && (
            <p className="text-sm text-destructive">{errors.fee}</p>
          )}
        </div>

        <Button
          onClick={handleSet}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Setting...' : 'Set Fee'}
        </Button>
      </CardContent>
    </Card>
  );
}

