// src/features/builder/tabs/VoteTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppStore, BuilderCertificate } from '@/lib/store';
import { toast } from 'sonner';
import { buildVoteCert } from '@/lib/transaction-builder';
import { Vote } from 'lucide-react';

export function VoteTab() {
  const { addCertificate } = useAppStore();
  const [proposalId, setProposalId] = useState('');
  const [vote, setVote] = useState<'yes' | 'no' | 'abstain'>('yes');
  const [anchorUrl, setAnchorUrl] = useState('');
  const [anchorHash, setAnchorHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ proposalId?: string; anchorHash?: string }>({});

  const validate = (): boolean => {
    const newErrors: { proposalId?: string; anchorHash?: string } = {};

    if (!proposalId.trim()) {
      newErrors.proposalId = 'Proposal ID is required';
    } else {
      const isHex = /^[0-9a-fA-F]+$/.test(proposalId);
      if (!isHex) {
        newErrors.proposalId = 'Proposal ID must be hex format';
      } else if (proposalId.length !== 64) {
        newErrors.proposalId = 'Proposal ID must be 64 hex characters (32 bytes)';
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

      const { cert, error } = buildVoteCert(proposalId.trim(), vote, anchor);
      
      if (error || !cert) {
        toast.error(error?.message || 'Failed to build vote certificate');
        return;
      }

      const certificate: BuilderCertificate = {
        id: `vote-${Date.now()}`,
        type: 'Vote',
        data: {
          proposalId: proposalId.trim(),
          vote,
          anchor
        }
      };

      addCertificate(certificate);
      toast.success('Vote certificate added to transaction');
      
      // Reset form
      setProposalId('');
      setVote('yes');
      setAnchorUrl('');
      setAnchorHash('');
      setErrors({});
    } catch (error) {
      toast.error(`Failed to add vote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="h-5 w-5" />
          Vote
        </CardTitle>
        <CardDescription>
          Vote on a governance proposal (Yes, No, or Abstain)
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
          {loading ? 'Adding...' : 'Build cert, add to Tx'}
        </Button>
      </CardContent>
    </Card>
  );
}

