// src/features/builder/tabs/VoteDelegationTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { buildVoteDelegationCert } from '@/lib/transaction-builder';
import { Users } from 'lucide-react';

export function VoteDelegationTab() {
  const { addCertificate } = useAppStore();
  const [drepId, setDrepId] = useState('');
  const [stakeCredential, setStakeCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ drepId?: string; stakeCredential?: string }>({});

  const validate = (): boolean => {
    const newErrors: { drepId?: string; stakeCredential?: string } = {};

    if (!drepId.trim()) {
      newErrors.drepId = 'DRep ID is required';
    } else {
      // Validate bech32 or hex format
      const isBech32 = drepId.startsWith('drep1');
      const isHex = /^[0-9a-fA-F]+$/.test(drepId);
      if (!isBech32 && !isHex) {
        newErrors.drepId = 'DRep ID must be bech32 (drep1...) or hex format';
      }
    }

    if (!stakeCredential.trim()) {
      newErrors.stakeCredential = 'Stake credential is required';
    } else {
      // Validate bech32 or hex format
      const isBech32 = stakeCredential.startsWith('stake1');
      const isHex = /^[0-9a-fA-F]+$/.test(stakeCredential);
      if (!isBech32 && !isHex) {
        newErrors.stakeCredential = 'Stake credential must be bech32 (stake1...) or hex format';
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
      const { cert, error } = buildVoteDelegationCert(drepId.trim(), stakeCredential.trim());
      
      if (error || !cert) {
        toast.error(error?.message || 'Failed to build certificate');
        return;
      }

      const certificate: BuilderCertificate = {
        id: `vote-delegation-${Date.now()}`,
        type: 'VoteDelegation',
        data: {
          drepId: drepId.trim(),
          stakeCredential: stakeCredential.trim()
        }
      };

      addCertificate(certificate);
      toast.success('Vote delegation certificate added to transaction');
      
      // Reset form
      setDrepId('');
      setStakeCredential('');
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
          Vote Delegation
        </CardTitle>
        <CardDescription>
          Delegate your voting power to a DRep (Delegation Representative)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drep-id">Target DRep ID</Label>
          <Input
            id="drep-id"
            placeholder="drep1... or hex"
            value={drepId}
            onChange={(e) => setDrepId(e.target.value)}
            aria-invalid={errors.drepId ? 'true' : 'false'}
          />
          {errors.drepId && (
            <p className="text-sm text-destructive">{errors.drepId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="stake-credential">Stake Credential</Label>
          <Input
            id="stake-credential"
            placeholder="stake1... or hex"
            value={stakeCredential}
            onChange={(e) => setStakeCredential(e.target.value)}
            aria-invalid={errors.stakeCredential ? 'true' : 'false'}
          />
          {errors.stakeCredential && (
            <p className="text-sm text-destructive">{errors.stakeCredential}</p>
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

