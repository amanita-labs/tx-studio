// src/features/builder/tabs/certificates/PoolRetirementTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

export function PoolRetirementTab() {
  const { addCertificate } = useAppStore();
  const [poolId, setPoolId] = useState('');
  const [epoch, setEpoch] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ poolId?: string; epoch?: string }>({});

  const validate = (): boolean => {
    const newErrors: { poolId?: string; epoch?: string } = {};

    if (!poolId.trim()) {
      newErrors.poolId = 'Pool ID is required';
    } else {
      const isHex = /^[0-9a-fA-F]+$/.test(poolId);
      if (!isHex || poolId.length !== 64) {
        newErrors.poolId = 'Pool ID must be 64 hex characters (32 bytes)';
      }
    }

    if (epoch.trim()) {
      const epochNum = parseInt(epoch, 10);
      if (isNaN(epochNum) || epochNum < 0) {
        newErrors.epoch = 'Epoch must be a non-negative number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBuild = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement buildPoolRetirementCert in transaction-builder.ts
      const certificate: BuilderCertificate = {
        id: `pool-retirement-${Date.now()}`,
        type: 'PoolRetirement',
        data: {
          poolId: poolId.trim(),
          epoch: epoch.trim() ? parseInt(epoch, 10) : undefined
        }
      };

      addCertificate(certificate);
      toast.success('Pool retirement certificate added to transaction');
      
      setPoolId('');
      setEpoch('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to build certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Pool Retirement
        </CardTitle>
        <CardDescription>
          Retire a stake pool (specify epoch for retirement)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pool-id">Pool ID</Label>
          <Input
            id="pool-id"
            placeholder="64 hex characters (32 bytes)"
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            aria-invalid={errors.poolId ? 'true' : 'false'}
          />
          {errors.poolId && (
            <p className="text-sm text-destructive">{errors.poolId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="epoch">Retirement Epoch (optional)</Label>
          <Input
            id="epoch"
            type="number"
            placeholder="Epoch number"
            value={epoch}
            onChange={(e) => setEpoch(e.target.value)}
            aria-invalid={errors.epoch ? 'true' : 'false'}
          />
          {errors.epoch && (
            <p className="text-sm text-destructive">{errors.epoch}</p>
          )}
        </div>

        <Button
          onClick={handleBuild}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Building...' : 'Build cert, add to Tx'}
        </Button>
      </CardContent>
    </Card>
  );
}

