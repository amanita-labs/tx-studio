// src/features/builder/tabs/certificates/CommitteeAuthTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';

export function CommitteeAuthTab() {
  const { addCertificate } = useAppStore();
  const [hotCredential, setHotCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ hotCredential?: string }>({});

  const validate = (): boolean => {
    const newErrors: { hotCredential?: string } = {};

    if (!hotCredential.trim()) {
      newErrors.hotCredential = 'Hot credential is required';
    } else {
      const isBech32 = hotCredential.startsWith('cc_hot1');
      const isHex = /^[0-9a-fA-F]+$/.test(hotCredential);
      if (!isBech32 && !isHex) {
        newErrors.hotCredential = 'Hot credential must be bech32 (cc_hot1...) or hex format';
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
      // TODO: Implement buildCommitteeAuthCert in transaction-builder.ts
      const certificate: BuilderCertificate = {
        id: `committee-auth-${Date.now()}`,
        type: 'CommitteeAuth',
        data: {
          hotCredential: hotCredential.trim()
        }
      };

      addCertificate(certificate);
      toast.success('Committee authorization certificate added to transaction');
      
      setHotCredential('');
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
          <Shield className="h-5 w-5" />
          Committee Authorization
        </CardTitle>
        <CardDescription>
          Authorize a committee hot credential (Conway era)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="hot-credential">Hot Credential</Label>
          <Input
            id="hot-credential"
            placeholder="cc_hot1... or hex"
            value={hotCredential}
            onChange={(e) => setHotCredential(e.target.value)}
            aria-invalid={errors.hotCredential ? 'true' : 'false'}
          />
          {errors.hotCredential && (
            <p className="text-sm text-destructive">{errors.hotCredential}</p>
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

