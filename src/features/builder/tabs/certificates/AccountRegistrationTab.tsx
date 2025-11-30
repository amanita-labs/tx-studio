// src/features/builder/tabs/certificates/AccountRegistrationTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { UserCheck } from 'lucide-react';

export function AccountRegistrationTab() {
  const { addCertificate } = useAppStore();
  const [stakeCredential, setStakeCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ stakeCredential?: string }>({});

  const validate = (): boolean => {
    const newErrors: { stakeCredential?: string } = {};

    if (!stakeCredential.trim()) {
      newErrors.stakeCredential = 'Stake credential is required';
    } else {
      const isBech32 = stakeCredential.startsWith('stake1');
      const isHex = /^[0-9a-fA-F]{56}$/.test(stakeCredential);
      if (!isBech32 && !isHex) {
        newErrors.stakeCredential = 'Stake credential must be bech32 (stake1...) or hex format (56 hex chars)';
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
      // TODO: Implement buildAccountRegistrationCert in transaction-builder.ts
      const certificate: BuilderCertificate = {
        id: `account-registration-${Date.now()}`,
        type: 'AccountRegistration',
        data: {
          stakeCredential: stakeCredential.trim()
        }
      };

      addCertificate(certificate);
      toast.success('Account registration certificate added to transaction');
      
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
          <UserCheck className="h-5 w-5" />
          Account Registration
        </CardTitle>
        <CardDescription>
          Register an account (Conway era feature)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

