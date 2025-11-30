// src/features/builder/tabs/tx-body/governance/ProposalProceduresTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

export function ProposalProceduresTab() {
  const { addTxBodyElement } = useAppStore();
  const [proposalData, setProposalData] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ proposalData?: string }>({});

  const validate = (): boolean => {
    const newErrors: { proposalData?: string } = {};

    if (!proposalData.trim()) {
      newErrors.proposalData = 'Proposal data is required';
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
        id: `proposal-procedure-${Date.now()}`,
        type: 'ProposalProcedures',
        data: {
          proposalData: proposalData.trim()
        }
      };

      addTxBodyElement(element);
      toast.success('Proposal procedure added');
      
      setProposalData('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to add proposal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Proposal Procedures
        </CardTitle>
        <CardDescription>
          Add governance proposal procedures (Conway era) - JSON or hex CBOR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="proposal-data">Proposal Data</Label>
          <Input
            id="proposal-data"
            placeholder="JSON or hex CBOR"
            value={proposalData}
            onChange={(e) => setProposalData(e.target.value)}
            aria-invalid={errors.proposalData ? 'true' : 'false'}
          />
          {errors.proposalData && (
            <p className="text-sm text-destructive">{errors.proposalData}</p>
          )}
        </div>

        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Adding...' : 'Add Proposal Procedure'}
        </Button>
      </CardContent>
    </Card>
  );
}

