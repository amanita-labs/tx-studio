// src/features/builder/tabs/certificates/StakeVoteRegDelegationTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { WalletCredentialSelector } from '../../components/WalletCredentialSelector';
import { Users } from 'lucide-react';

export function StakeVoteRegDelegationTab() {
  const { addCertificate } = useAppStore();
  const [stakeCredential, setStakeCredential] = useState('');
  const [poolId, setPoolId] = useState('');
  const [drepId, setDrepId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ stakeCredential?: string; poolId?: string; drepId?: string }>({});

  const validate = (): boolean => {
    const newErrors: { stakeCredential?: string; poolId?: string; drepId?: string } = {};

    if (!stakeCredential.trim()) {
      newErrors.stakeCredential = 'Stake credential is required';
    } else {
      const isBech32 = stakeCredential.startsWith('stake1');
      const isHex = /^[0-9a-fA-F]{56}$/.test(stakeCredential);
      if (!isBech32 && !isHex) {
        newErrors.stakeCredential = 'Stake credential must be bech32 (stake1...) or hex format (56 hex chars)';
      }
    }

    if (!poolId.trim()) {
      newErrors.poolId = 'Pool ID is required';
    } else {
      const isHex = /^[0-9a-fA-F]+$/.test(poolId);
      if (!isHex || poolId.length !== 64) {
        newErrors.poolId = 'Pool ID must be 64 hex characters (32 bytes)';
      }
    }

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
      // TODO: Implement buildStakeVoteRegDelegationCert in transaction-builder.ts
      const certificate: BuilderCertificate = {
        id: `stake-vote-reg-delegation-${Date.now()}`,
        type: 'StakeVoteRegDelegation',
        data: {
          stakeCredential: stakeCredential.trim(),
          poolId: poolId.trim(),
          drepId: drepId.trim()
        }
      };

      addCertificate(certificate);
      toast.success('Stake + Vote + Registration + Delegation certificate added to transaction');
      
      setStakeCredential('');
      setPoolId('');
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
          <Users className="h-5 w-5" />
          Stake + Vote + Registration + Delegation
        </CardTitle>
        <CardDescription>
          Combined certificate for stake registration, delegation, and vote delegation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="stake-credential">Stake Credential</Label>
          <div className="flex gap-2">
            <Input
              id="stake-credential"
              placeholder="stake1... or hex"
              value={stakeCredential}
              onChange={(e) => setStakeCredential(e.target.value)}
              aria-invalid={errors.stakeCredential ? 'true' : 'false'}
              className="flex-1"
            />
            <WalletCredentialSelector
              credentialType="stake"
              onSelect={(value) => setStakeCredential(value)}
            />
          </div>
          {errors.stakeCredential && (
            <p className="text-sm text-destructive">{errors.stakeCredential}</p>
          )}
        </div>

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

