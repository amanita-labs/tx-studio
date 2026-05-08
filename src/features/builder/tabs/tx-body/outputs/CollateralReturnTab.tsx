// src/features/builder/tabs/tx-body/outputs/CollateralReturnTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';

export function CollateralReturnTab() {
  const { addTxBodyElement } = useAppStore();
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ address?: string; amount?: string }>({});

  const validate = (): boolean => {
    const newErrors: { address?: string; amount?: string } = {};

    if (!address.trim()) {
      newErrors.address = 'Address is required';
    } else {
      const isBech32 = address.startsWith('addr') || address.startsWith('addr_test');
      if (!isBech32) {
        newErrors.address = 'Address must be bech32 format (addr... or addr_test...)';
      }
    }

    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amountNum = BigInt(amount);
      if (amountNum <= 0n) {
        newErrors.amount = 'Amount must be positive';
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
        id: `collateral-return-${Date.now()}`,
        type: 'CollateralReturn',
        data: {
          address: address.trim(),
          amount: amount.trim()
        }
      };

      addTxBodyElement(element);
      toast.success('Collateral return output added');
      
      setAddress('');
      setAmount('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to add collateral return: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Collateral Return
        </CardTitle>
        <CardDescription>
          Specify where unused collateral should be returned (for Plutus transactions)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address">Return Address</Label>
          <Input
            id="address"
            placeholder="addr1... or addr_test1..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-invalid={errors.address ? 'true' : 'false'}
          />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (Lovelace)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="1000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={errors.amount ? 'true' : 'false'}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{errors.amount}</p>
          )}
        </div>

        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Adding...' : 'Add Collateral Return'}
        </Button>
      </CardContent>
    </Card>
  );
}

