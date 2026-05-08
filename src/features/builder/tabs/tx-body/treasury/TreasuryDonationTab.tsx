// src/features/builder/tabs/tx-body/treasury/TreasuryDonationTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Gift } from 'lucide-react';

export function TreasuryDonationTab() {
  const { addTxBodyElement } = useAppStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string }>({});

  const validate = (): boolean => {
    const newErrors: { amount?: string } = {};

    if (!amount.trim()) {
      newErrors.amount = 'Donation amount is required';
    } else {
      const amountNum = BigInt(amount);
      if (amountNum <= 0n) {
        newErrors.amount = 'Amount must be positive';
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
        id: `treasury-donation-${Date.now()}`,
        type: 'TreasuryDonation',
        data: {
          amount: amount.trim()
        }
      };

      addTxBodyElement(element);
      toast.success('Treasury donation amount set');
      
      setAmount('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to set donation amount: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Treasury Donation Amount
        </CardTitle>
        <CardDescription>
          Set treasury donation amount (Conway era, in Lovelace)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Donation Amount (Lovelace)</Label>
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
          onClick={handleSet}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Setting...' : 'Set Donation Amount'}
        </Button>
      </CardContent>
    </Card>
  );
}

