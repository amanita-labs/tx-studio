// src/features/builder/tabs/DRepRetirementTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { buildDRepRetirementCert } from '@/lib/transaction-builder';
import { getDRepInfo } from '@/lib/wallet-connector';
import { WalletCredentialSelector } from '../components/WalletCredentialSelector';
import { UserMinus } from 'lucide-react';

export function DRepRetirementTab() {
  const { addCertificate, walletApi } = useAppStore();
  const [drepId, setDrepId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ drepId?: string }>({});

  // Auto-fill DRep ID from wallet if available
  useEffect(() => {
    const loadDRepId = async () => {
      if (walletApi && !drepId) {
        try {
          const drepInfo = await getDRepInfo(walletApi);
          if (drepInfo?.dRepIDCip105) {
            setDrepId(drepInfo.dRepIDCip105);
          }
        } catch (error) {
          // Silently fail - wallet might not have DRep info
        }
      }
    };
    loadDRepId();
  }, [walletApi, drepId]);

  const validate = (): boolean => {
    const newErrors: { drepId?: string } = {};

    if (!drepId.trim()) {
      newErrors.drepId = 'DRep ID is required';
    } else {
      const isBech32 = drepId.startsWith('drep1');
      const isHex = /^[0-9a-fA-F]+$/.test(drepId);
      if (!isBech32 && !isHex) {
        newErrors.drepId = 'DRep ID must be bech32 (drep1...) or hex format';
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
      const { cert, error } = buildDRepRetirementCert(drepId.trim());
      
      if (error || !cert) {
        toast.error(error?.message || 'Failed to build certificate');
        return;
      }

      const certificate: BuilderCertificate = {
        id: `drep-retirement-${Date.now()}`,
        type: 'DRepRetirement',
        data: {
          drepId: drepId.trim()
        }
      };

      addCertificate(certificate);
      toast.success('DRep retirement certificate added to transaction');
      
      // Reset form
      setDrepId('');
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
          <UserMinus className="h-5 w-5" />
          DRep Retirement
        </CardTitle>
        <CardDescription>
          Retire your DRep registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drep-id">DRep ID</Label>
          <div className="flex gap-2">
            <Input
              id="drep-id"
              placeholder="drep1... or hex"
              value={drepId}
              onChange={(e) => setDrepId(e.target.value)}
              aria-invalid={errors.drepId ? 'true' : 'false'}
              className="flex-1"
            />
            <WalletCredentialSelector
              credentialType="drep"
              onSelect={(value) => setDrepId(value)}
            />
          </div>
          {errors.drepId && (
            <p className="text-sm text-destructive">{errors.drepId}</p>
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

