// src/features/builder/tabs/tx-body/withdrawals/WithdrawalsTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';

export function WithdrawalsTab() {
  const { addTxBodyElement } = useAppStore();
  const [stakeAddress, setStakeAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ stakeAddress?: string; amount?: string }>({});

  const validate = (): boolean => {
    const newErrors: { stakeAddress?: string; amount?: string } = {};

    if (!stakeAddress.trim()) {
      newErrors.stakeAddress = 'Stake address is required';
    } else {
      const isBech32 = stakeAddress.startsWith('stake1');
      if (!isBech32) {
        newErrors.stakeAddress = 'Stake address must be bech32 format (stake1...)';
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
        id: `withdrawal-${Date.now()}`,
        type: 'Withdrawals',
        data: {
          stakeAddress: stakeAddress.trim(),
          amount: amount.trim()
        }
      };

      addTxBodyElement(element);
      toast.success('Withdrawal added');
      
      setStakeAddress('');
      setAmount('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to add withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Withdrawals
        </CardTitle>
        <CardDescription>
          Add withdrawals from stake reward addresses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="stake-address">Stake Address</Label>
          <Input
            id="stake-address"
            placeholder="stake1..."
            value={stakeAddress}
            onChange={(e) => setStakeAddress(e.target.value)}
            aria-invalid={errors.stakeAddress ? 'true' : 'false'}
          />
          {errors.stakeAddress && (
            <p className="text-sm text-destructive">{errors.stakeAddress}</p>
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
          {loading ? 'Adding...' : 'Add Withdrawal'}
        </Button>
      </CardContent>
    </Card>
  );
}

