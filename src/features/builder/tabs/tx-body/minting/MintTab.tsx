// src/features/builder/tabs/tx-body/minting/MintTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Coins } from 'lucide-react';

export function MintTab() {
  const { addTxBodyElement } = useAppStore();
  const [policyId, setPolicyId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ policyId?: string; assetName?: string; quantity?: string }>({});

  const validate = (): boolean => {
    const newErrors: { policyId?: string; assetName?: string; quantity?: string } = {};

    if (!policyId.trim()) {
      newErrors.policyId = 'Policy ID is required';
    } else {
      const isHex = /^[0-9a-fA-F]+$/.test(policyId);
      if (!isHex || policyId.length !== 56) {
        newErrors.policyId = 'Policy ID must be 56 hex characters (28 bytes)';
      }
    }

    if (assetName.trim()) {
      const isHex = /^[0-9a-fA-F]*$/.test(assetName);
      if (!isHex) {
        newErrors.assetName = 'Asset name must be hex format';
      }
    }

    if (!quantity.trim()) {
      newErrors.quantity = 'Quantity is required';
    } else {
      try {
        const qty = BigInt(quantity);
        if (qty === 0n) {
          newErrors.quantity = 'Quantity cannot be zero (use positive for mint, negative for burn)';
        }
      } catch {
        newErrors.quantity = 'Quantity must be a valid number';
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
        id: `mint-${Date.now()}`,
        type: 'Mint',
        data: {
          policyId: policyId.trim(),
          assetName: assetName.trim() || '',
          quantity: quantity.trim()
        }
      };

      addTxBodyElement(element);
      toast.success('Mint asset added');
      
      setPolicyId('');
      setAssetName('');
      setQuantity('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to add mint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Mint
        </CardTitle>
        <CardDescription>
          Mint or burn native tokens (negative quantity = burn)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="policy-id">Policy ID</Label>
          <Input
            id="policy-id"
            placeholder="56 hex characters (28 bytes)"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            aria-invalid={errors.policyId ? 'true' : 'false'}
          />
          {errors.policyId && (
            <p className="text-sm text-destructive">{errors.policyId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="asset-name">Asset Name (hex, optional)</Label>
          <Input
            id="asset-name"
            placeholder="Hex string (empty for ADA)"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            aria-invalid={errors.assetName ? 'true' : 'false'}
          />
          {errors.assetName && (
            <p className="text-sm text-destructive">{errors.assetName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            placeholder="1000000 (positive = mint, negative = burn)"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={errors.quantity ? 'true' : 'false'}
          />
          {errors.quantity && (
            <p className="text-sm text-destructive">{errors.quantity}</p>
          )}
        </div>

        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Adding...' : 'Add Mint Asset'}
        </Button>
      </CardContent>
    </Card>
  );
}

