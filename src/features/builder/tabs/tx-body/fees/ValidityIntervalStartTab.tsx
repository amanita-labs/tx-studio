// src/features/builder/tabs/tx-body/fees/ValidityIntervalStartTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';

export function ValidityIntervalStartTab() {
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
        id: `validity-start-${Date.now()}`,
        type: 'ValidityIntervalStart',
        data: {
          slot: parseInt(slot, 10)
        }
      };

      addTxBodyElement(element);
      toast.success('Validity interval start set');
      
      setSlot('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to set validity start: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Validity Interval Start
        </CardTitle>
        <CardDescription>
          Set the earliest slot when the transaction becomes valid
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
          {loading ? 'Setting...' : 'Set Validity Start'}
        </Button>
      </CardContent>
    </Card>
  );
}

