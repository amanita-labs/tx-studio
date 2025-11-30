// src/features/builder/tabs/tx-body/governance/VotingProceduresTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import { toast } from 'sonner';
import { Vote } from 'lucide-react';

export function VotingProceduresTab() {
  const { addTxBodyElement } = useAppStore();
  const [proposalId, setProposalId] = useState('');
  const [drepId, setDrepId] = useState('');
  const [vote, setVote] = useState<'yes' | 'no' | 'abstain'>('yes');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ proposalId?: string; drepId?: string }>({});

  const validate = (): boolean => {
    const newErrors: { proposalId?: string; drepId?: string } = {};

    if (!proposalId.trim()) {
      newErrors.proposalId = 'Proposal ID is required';
    } else {
      const isHex = /^[0-9a-fA-F]+$/.test(proposalId);
      if (!isHex || proposalId.length !== 64) {
        newErrors.proposalId = 'Proposal ID must be 64 hex characters (32 bytes)';
      }
    }

    if (!drepId.trim()) {
      newErrors.drepId = 'DRep ID is required';
    } else {
      const isBech32 = drepId.startsWith('drep1');
      const isHex = /^[0-9a-fA-F]+$/.test(drepId);
      if (!isBech32 && !isHex) {
        newErrors.drepId = 'DRep ID must be bech32 (drep1...) or hex format';
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
        id: `voting-procedure-${Date.now()}`,
        type: 'VotingProcedures',
        data: {
          proposalId: proposalId.trim(),
          drepId: drepId.trim(),
          vote
        }
      };

      addTxBodyElement(element);
      toast.success('Voting procedure added');
      
      setProposalId('');
      setDrepId('');
      setVote('yes');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to add voting procedure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="h-5 w-5" />
          Voting Procedures
        </CardTitle>
        <CardDescription>
          Add voting procedures for governance proposals (Conway era)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="proposal-id">Proposal ID</Label>
          <Input
            id="proposal-id"
            placeholder="64 hex characters (32 bytes)"
            value={proposalId}
            onChange={(e) => setProposalId(e.target.value)}
            aria-invalid={errors.proposalId ? 'true' : 'false'}
          />
          {errors.proposalId && (
            <p className="text-sm text-destructive">{errors.proposalId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="drep-id">DRep ID</Label>
          <Input
            id="drep-id"
            placeholder="drep1... or hex"
            value={drepId}
            onChange={(e) => setDrepId(e.target.value)}
            aria-invalid={errors.drepId ? 'true' : 'false'}
          />
          {errors.drepId && (
            <p className="text-sm text-destructive">{errors.drepId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Vote</Label>
          <RadioGroup value={vote} onValueChange={(value) => setVote(value as 'yes' | 'no' | 'abstain')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="vote-yes" />
              <Label htmlFor="vote-yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="vote-no" />
              <Label htmlFor="vote-no" className="cursor-pointer">No</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="abstain" id="vote-abstain" />
              <Label htmlFor="vote-abstain" className="cursor-pointer">Abstain</Label>
            </div>
          </RadioGroup>
        </div>

        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Adding...' : 'Add Voting Procedure'}
        </Button>
      </CardContent>
    </Card>
  );
}

