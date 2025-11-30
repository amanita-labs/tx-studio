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
import { WalletCredentialSelector } from '../../components/WalletCredentialSelector';
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
      console.log('❌ Validation failed:', errors);
      return;
    }

    const drepIdValue = drepId.trim();
    const stakeCredValue = stakeCredential.trim();
    
    console.group('📝 Building Vote Delegation Certificate');
    console.log('Form values:', { drepId: drepIdValue, stakeCredential: stakeCredValue });
    
    setLoading(true);
    try {
      const { cert, error } = buildVoteDelegationCert(drepIdValue, stakeCredValue);
      
      if (error || !cert) {
        console.error('❌ Certificate build failed:', error);
        console.error('Input values:', { drepId: drepIdValue, stakeCredential: stakeCredValue });
        toast.error(error?.message || 'Failed to build certificate');
        console.groupEnd();
        return;
      }

      const certificate: BuilderCertificate = {
        id: `vote-delegation-${Date.now()}`,
        type: 'VoteDelegation',
        data: {
          drepId: drepIdValue,
          stakeCredential: stakeCredValue
        }
      };

      addCertificate(certificate);
      console.log('✅ Certificate added to transaction:', certificate);
      toast.success('Vote delegation certificate added to transaction');
      
      // Reset form
      setDrepId('');
      setStakeCredential('');
      setErrors({});
      console.groupEnd();
    } catch (error) {
      console.error('❌ Unexpected error building certificate:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        formValues: { drepId: drepIdValue, stakeCredential: stakeCredValue },
      });
      toast.error(`Failed to build certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.groupEnd();
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

