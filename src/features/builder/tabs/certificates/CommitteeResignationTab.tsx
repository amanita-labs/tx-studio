// src/features/builder/tabs/certificates/CommitteeResignationTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { ShieldX } from 'lucide-react';

export function CommitteeResignationTab() {
  const { addCertificate } = useAppStore();
  const [coldCredential, setColdCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ coldCredential?: string }>({});

  const validate = (): boolean => {
    const newErrors: { coldCredential?: string } = {};

    if (!coldCredential.trim()) {
      newErrors.coldCredential = 'Cold credential is required';
    } else {
      const isBech32 = coldCredential.startsWith('cc_cold1');
      const isHex = /^[0-9a-fA-F]+$/.test(coldCredential);
      if (!isBech32 && !isHex) {
        newErrors.coldCredential = 'Cold credential must be bech32 (cc_cold1...) or hex format';
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
      // TODO: Implement buildCommitteeResignationCert in transaction-builder.ts
      const certificate: BuilderCertificate = {
        id: `committee-resignation-${Date.now()}`,
        type: 'CommitteeResignation',
        data: {
          coldCredential: coldCredential.trim()
        }
      };

      addCertificate(certificate);
      toast.success('Committee resignation certificate added to transaction');
      
      setColdCredential('');
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
          <ShieldX className="h-5 w-5" />
          Committee Resignation
        </CardTitle>
        <CardDescription>
          Resign a committee cold credential (Conway era)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cold-credential">Cold Credential</Label>
          <Input
            id="cold-credential"
            placeholder="cc_cold1... or hex"
            value={coldCredential}
            onChange={(e) => setColdCredential(e.target.value)}
            aria-invalid={errors.coldCredential ? 'true' : 'false'}
          />
          {errors.coldCredential && (
            <p className="text-sm text-destructive">{errors.coldCredential}</p>
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

