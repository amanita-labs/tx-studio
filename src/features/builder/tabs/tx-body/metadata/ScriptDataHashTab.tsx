// src/features/builder/tabs/tx-body/metadata/ScriptDataHashTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Code } from 'lucide-react';

export function ScriptDataHashTab() {
  const { addTxBodyElement } = useAppStore();
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ hash?: string }>({});

  const validate = (): boolean => {
    const newErrors: { hash?: string } = {};

    if (!hash.trim()) {
      newErrors.hash = 'Hash is required';
    } else {
      const isHex = /^[0-9a-fA-F]+$/.test(hash);
      if (!isHex || hash.length !== 64) {
        newErrors.hash = 'Hash must be 64 hex characters (32 bytes)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSet = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const element: BuilderTxBodyElement = {
        id: `script-data-hash-${Date.now()}`,
        type: 'ScriptDataHash',
        data: {
          hash: hash.trim()
        }
      };

      addTxBodyElement(element);
      toast.success('Script data hash set');
      
      setHash('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to set hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          Script Data Hash
        </CardTitle>
        <CardDescription>
          Set the hash of script data (for Plutus scripts)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="hash">Hash (32 bytes)</Label>
          <Input
            id="hash"
            placeholder="64 hex characters"
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            aria-invalid={errors.hash ? 'true' : 'false'}
          />
          {errors.hash && (
            <p className="text-sm text-destructive">{errors.hash}</p>
          )}
        </div>

        <Button
          onClick={handleSet}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Setting...' : 'Set Hash'}
        </Button>
      </CardContent>
    </Card>
  );
}

