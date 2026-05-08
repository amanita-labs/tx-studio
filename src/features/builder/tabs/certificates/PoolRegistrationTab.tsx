// src/features/builder/tabs/certificates/PoolRegistrationTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';

export function PoolRegistrationTab() {
  const { addCertificate } = useAppStore();
  const [poolParams, setPoolParams] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ poolParams?: string }>({});

  const validate = (): boolean => {
    const newErrors: { poolParams?: string } = {};

    if (!poolParams.trim()) {
      newErrors.poolParams = 'Pool parameters are required';
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
      // TODO: Implement buildPoolRegistrationCert in transaction-builder.ts
      const certificate: BuilderCertificate = {
        id: `pool-registration-${Date.now()}`,
        type: 'PoolRegistration',
        data: {
          poolParams: poolParams.trim()
        }
      };

      addCertificate(certificate);
      toast.success('Pool registration certificate added to transaction');
      
      setPoolParams('');
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
          <Building2 className="h-5 w-5" />
          Pool Registration
        </CardTitle>
        <CardDescription>
          Register a new stake pool (requires pool parameters JSON/CBOR)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pool-params">Pool Parameters</Label>
          <Input
            id="pool-params"
            placeholder="Pool parameters (JSON or hex CBOR)"
            value={poolParams}
            onChange={(e) => setPoolParams(e.target.value)}
            aria-invalid={errors.poolParams ? 'true' : 'false'}
          />
          {errors.poolParams && (
            <p className="text-sm text-destructive">{errors.poolParams}</p>
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

