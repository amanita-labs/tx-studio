// src/features/builder/tabs/tx-body/fees/ValidityIntervalEndTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';

export function ValidityIntervalEndTab() {
  const { addTxBodyElement } = useAppStore();
  const [slot, setSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ slot?: string }>({});

  const validate = (): boolean => {
    const newErrors: { slot?: string } = {};

    if (!slot.trim()) {
      newErrors.slot = 'Slot is required';
    } else {
      const slotNum = parseInt(slot, 10);
      if (isNaN(slotNum) || slotNum < 0) {
        newErrors.slot = 'Slot must be a non-negative number';
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
        id: `validity-end-${Date.now()}`,
        type: 'ValidityIntervalEnd',
        data: {
          slot: parseInt(slot, 10)
        }
      };

      addTxBodyElement(element);
      toast.success('Validity interval end (TTL) set');
      
      setSlot('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to set validity end: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Validity Interval End (TTL)
        </CardTitle>
        <CardDescription>
          Set the latest slot when the transaction expires (TTL)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slot">Slot Number</Label>
          <Input
            id="slot"
            type="number"
            placeholder="0"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            aria-invalid={errors.slot ? 'true' : 'false'}
          />
          {errors.slot && (
            <p className="text-sm text-destructive">{errors.slot}</p>
          )}
        </div>

        <Button
          onClick={handleSet}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Setting...' : 'Set Validity End'}
        </Button>
      </CardContent>
    </Card>
  );
}

