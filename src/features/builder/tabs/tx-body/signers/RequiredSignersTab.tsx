// src/features/builder/tabs/tx-body/signers/RequiredSignersTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Key } from 'lucide-react';

export function RequiredSignersTab() {
  const { addTxBodyElement } = useAppStore();
  const [keyHash, setKeyHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ keyHash?: string }>({});

  const validate = (): boolean => {
    const newErrors: { keyHash?: string } = {};

    if (!keyHash.trim()) {
      newErrors.keyHash = 'Key hash is required';
    } else {
      const isHex = /^[0-9a-fA-F]+$/.test(keyHash);
      if (!isHex || keyHash.length !== 56) {
        newErrors.keyHash = 'Key hash must be 56 hex characters (28 bytes)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const element: BuilderTxBodyElement = {
        id: `required-signer-${Date.now()}`,
        type: 'RequiredSigners',
        data: {
          keyHash: keyHash.trim()
        }
      };

      addTxBodyElement(element);
      toast.success('Required signer added');
      
      setKeyHash('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to add signer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Required Signers
        </CardTitle>
        <CardDescription>
          Add required signers (key hashes) for multi-signature transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="key-hash">Key Hash</Label>
          <Input
            id="key-hash"
            placeholder="56 hex characters (28 bytes)"
            value={keyHash}
            onChange={(e) => setKeyHash(e.target.value)}
            aria-invalid={errors.keyHash ? 'true' : 'false'}
          />
          {errors.keyHash && (
            <p className="text-sm text-destructive">{errors.keyHash}</p>
          )}
        </div>

        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Adding...' : 'Add Required Signer'}
        </Button>
      </CardContent>
    </Card>
  );
}

