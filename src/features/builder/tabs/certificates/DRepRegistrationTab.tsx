// src/features/builder/tabs/DRepRegistrationTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { buildDRepRegistrationCert } from '@/lib/transaction-builder';
import { getDRepInfo } from '@/lib/wallet-connector';
import { WalletCredentialSelector } from '../../components/WalletCredentialSelector';
import { UserPlus } from 'lucide-react';

export function DRepRegistrationTab() {
  const { addCertificate, walletApi } = useAppStore();
  const [drepId, setDrepId] = useState('');
  const [anchorUrl, setAnchorUrl] = useState('');
  const [anchorHash, setAnchorHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ drepId?: string; anchorHash?: string }>({});

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
    const newErrors: { drepId?: string; anchorHash?: string } = {};

    if (!drepId.trim()) {
      newErrors.drepId = 'DRep ID is required';
    } else {
      const isBech32 = drepId.startsWith('drep1');
      const isHex = /^[0-9a-fA-F]+$/.test(drepId);
      if (!isBech32 && !isHex) {
        newErrors.drepId = 'DRep ID must be bech32 (drep1...) or hex format';
      }
    }

    if (anchorHash.trim()) {
      const isHex = /^[0-9a-fA-F]+$/.test(anchorHash);
      if (!isHex) {
        newErrors.anchorHash = 'Anchor hash must be hex format';
      } else if (anchorHash.length !== 64) {
        newErrors.anchorHash = 'Anchor hash must be 64 hex characters (32 bytes)';
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
      const anchor = anchorUrl.trim() || anchorHash.trim() 
        ? { url: anchorUrl.trim() || undefined, hash: anchorHash.trim() || undefined }
        : undefined;

      const { cert, error } = buildDRepRegistrationCert(drepId.trim(), anchor);
      
      if (error || !cert) {
        toast.error(error?.message || 'Failed to build certificate');
        return;
      }

      const certificate: BuilderCertificate = {
        id: `drep-registration-${Date.now()}`,
        type: 'DRepRegistration',
        data: {
          drepId: drepId.trim(),
          anchor
        }
      };

      addCertificate(certificate);
      toast.success('DRep registration certificate added to transaction');
      
      // Reset form (keep DRep ID)
      setAnchorUrl('');
      setAnchorHash('');
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
          <UserPlus className="h-5 w-5" />
          DRep Registration
        </CardTitle>
        <CardDescription>
          Register as a DRep (Delegation Representative) to participate in governance
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

        <div className="space-y-2">
          <Label htmlFor="anchor-url">Anchor URL (optional)</Label>
          <Input
            id="anchor-url"
            placeholder="https://..."
            value={anchorUrl}
            onChange={(e) => setAnchorUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="anchor-hash">Anchor Hash (optional)</Label>
          <Input
            id="anchor-hash"
            placeholder="64 hex characters"
            value={anchorHash}
            onChange={(e) => setAnchorHash(e.target.value)}
            aria-invalid={errors.anchorHash ? 'true' : 'false'}
          />
          {errors.anchorHash && (
            <p className="text-sm text-destructive">{errors.anchorHash}</p>
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

