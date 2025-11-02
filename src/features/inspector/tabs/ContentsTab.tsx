// src/features/inspector/tabs/ContentsTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Award, 
  Vote, 
  FileText, 
  Coins, 
  Users, 
  Shield, 
  Clock,
  Hash,
  Copy,
  Info,
  CheckCircle2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { slotToLocalTime, getTimeRemaining } from '@/lib/utils/slot-time';
import { formatLovelace, formatAda } from '@/lib/utils/ada';
import { toast } from 'sonner';
import { BlockExplorerLink } from '@/components/block-explorer-link';

// Helper component for time remaining
function ValidityTimeRemaining({ slot }: { slot: number }) {
  const timeInfo = getTimeRemaining(slot);
  
  if (timeInfo.isExpired) {
    return (
      <div className="text-xs text-red-500 font-medium">
        Expired
      </div>
    );
  }
  
  return (
    <div className="text-xs text-muted-foreground">
      {timeInfo.timeRemaining} remaining
    </div>
  );
}

interface ContentsTabProps {
  tx: DomainTx;
}

export function ContentsTab({ tx }: ContentsTabProps) {
  const [contents, setContents] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    analyzeContents();
  }, [tx]);

  const analyzeContents = async () => {
    setIsLoading(true);
    
    try {
      // Analyze transaction contents
      const analysis = {
        certificates: analyzeCertificates(tx),
        withdrawals: analyzeWithdrawals(tx),
        governance: analyzeGovernance(tx),
        minting: analyzeMinting(tx),
        collateral: analyzeCollateral(tx),
        validity: analyzeValidity(tx),
        witnesses: analyzeWitnesses(tx)
      };
      
      setContents(analysis);
    } catch (error) {
      console.error('Content analysis failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeCertificates = (tx: DomainTx) => {
    if (!tx.certs || tx.certs.length === 0) {
      return { count: 0, items: [], summary: 'No certificates found' };
    }

    const formatAmountDetail = (value: any) => {
      if (value === undefined || value === null) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      try {
        const bigintValue = typeof value === 'bigint' ? value : BigInt(value);
        return `${formatAda(bigintValue)} ada`;
      } catch {
        try {
          return String(value);
        } catch {
          return null;
        }
      }
    };

    const addAnchorDetails = (
      anchorInfo: any,
      isAnchorMissing: boolean | undefined,
      details: Record<string, any>
    ) => {
      if (anchorInfo) {
        if (anchorInfo.url) {
          details.anchorUrl = anchorInfo.url;
        }
        if (anchorInfo.hash) {
          details.anchorHash = anchorInfo.hash;
        }
        if (anchorInfo.bytes) {
          details.anchorBytes = anchorInfo.bytes;
        }
      } else if (isAnchorMissing) {
        details.anchorStatus = 'No anchor provided';
      }
    };

    const items = tx.certs.map((cert, index) => {
      let type = 'Unknown';
      let description = 'Certificate';
      let icon = <Award className="h-4 w-4" />;
      let color = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';

      // Determine certificate type based on structure
      const certType = (cert as any).type || 'Unknown';
      const certDetails = (cert as any).details || {};
      
      if (certType === 'StakeRegistration') {
        type = 'Stake Registration';
        description = 'Registers a stake key for delegation';
        icon = <Shield className="h-4 w-4" />;
        color = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      } else if (certType === 'StakeDeregistration') {
        type = 'Stake Deregistration';
        description = 'Deregisters a stake key';
        icon = <Shield className="h-4 w-4" />;
        color = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      } else if (certType === 'StakeDelegation') {
        type = 'Stake Delegation';
        description = 'Delegates stake to a pool';
        icon = <Users className="h-4 w-4" />;
        color = 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      } else if (certType === 'PoolRegistration') {
        type = 'Pool Registration';
        description = 'Registers a stake pool';
        icon = <Users className="h-4 w-4" />;
        color = 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-purple-200';
      } else if (certType === 'PoolRetirement') {
        type = 'Pool Retirement';
        description = 'Retires a stake pool';
        icon = <Clock className="h-4 w-4" />;
        color = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      } else if (certType === 'VoteDelegation') {
        type = 'Vote Delegation';
        description = 'Delegates voting rights to a DRep';
        icon = <Vote className="h-4 w-4" />;
        color = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      } else if (certType === 'DRepRegistration') {
        type = 'DRep Registration';
        description = 'Registers a DRep';
        icon = <Shield className="h-4 w-4" />;
        color = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      } else if (certType === 'DRepDeregistration') {
        type = 'DRep Deregistration';
        description = 'Deregisters a DRep';
        icon = <Shield className="h-4 w-4" />;
        color = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      } else if (certType === 'DRepUpdate') {
        type = 'DRep Update';
        description = 'Updates a DReps metadata';
        icon = <Shield className="h-4 w-4" />;
        color = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      } else {
        type = certType;
        description = 'Certificate';
        icon = <Award className="h-4 w-4" />;
        color = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      }

      // Extract certificate details dynamically based on certificate type
      const extractedDetails: Record<string, any> = {};
      
      // Stake-related certificates
      if (certDetails.stakeCredential) {
        // Prefer bech32 representation if available
        const credHash = certDetails.stakeCredential.bech32 || certDetails.stakeCredential.hash || 'N/A';
        const credType = certDetails.stakeCredential.type || 'Unknown';
        extractedDetails.stakeKey = credHash;
        extractedDetails.stakeKeyType = credType === 'KeyHash' ? 'Key' : credType === 'ScriptHash' ? 'Script' : credType;
      }
      
      // Vote delegation
      if (certDetails.drepCredential) {
        // Prefer bech32 representation if available
        const drepId = certDetails.drepId || certDetails.drepCredential.bech32 || certDetails.drepCredential.hash || 'N/A';
        const drepType = certDetails.drepCredential.type || 'Unknown';
        extractedDetails.drepId = drepId;
        extractedDetails.drepIdType = drepType === 'KeyHash' ? 'Key' : drepType === 'ScriptHash' ? 'Script' : drepType;
        
        // If bech32 differs from hash, include both representations
        const drepBech32 = certDetails.drepCredential.bech32;
        const drepHash = certDetails.drepCredential.hash;
        if (drepBech32 && drepHash && drepBech32 !== drepHash && drepBech32 !== drepId) {
          extractedDetails.drepHash = drepHash;
        }
        
        if (certDetails.stakeCredential) {
          const credHash = certDetails.stakeCredential.bech32 || certDetails.stakeCredential.hash || 'N/A';
          const credType = certDetails.stakeCredential.type || 'Unknown';
          extractedDetails.stakeKey = credHash;
          extractedDetails.stakeKeyType = credType === 'KeyHash' ? 'Key' : credType === 'ScriptHash' ? 'Script' : credType;
        }
      }
      
      // Pool-related
      if (certDetails.poolId) {
        extractedDetails.poolId = certDetails.poolId;
      }
      
      // Epoch (for pool retirement)
      if (certDetails.epoch) {
        extractedDetails.epoch = certDetails.epoch;
      }
      
      // Reward account
      if (certDetails.rewardAccount) {
        extractedDetails.rewardAccount = certDetails.rewardAccount;
      }

      if (certType === 'DRepRegistration') {
        const depositFormatted = formatAmountDetail(certDetails.deposit ?? certDetails.coin);
        if (depositFormatted) {
          extractedDetails.deposit = depositFormatted;
        }

        const coinFormatted = formatAmountDetail(certDetails.coin);
        if (coinFormatted && coinFormatted !== depositFormatted) {
          extractedDetails.coin = coinFormatted;
        }

        addAnchorDetails(certDetails.anchor, certDetails.anchorMissing, extractedDetails);
      }

      if (certType === 'DRepDeregistration') {
        const refundFormatted = formatAmountDetail(certDetails.refund ?? certDetails.coin);
        if (refundFormatted) {
          extractedDetails.refund = refundFormatted;
        }
      }

      if (certType === 'DRepUpdate') {
        addAnchorDetails(certDetails.anchor, certDetails.anchorMissing, extractedDetails);
      }

      // Committee Hot Auth
      if (certType === 'CommitteeHotAuth' && certDetails.hotCredential) {
        // Prefer bech32 representation if available
        const hotCred = certDetails.hotCredential.bech32 || certDetails.hotCredential.hash || 'N/A';
        const hotType = certDetails.hotCredential.type || 'Unknown';
        extractedDetails.hotCredential = hotCred;
        extractedDetails.hotCredentialType = hotType === 'KeyHash' ? 'Key' : hotType === 'ScriptHash' ? 'Script' : hotType;
        
        // Include hash if it differs from bech32
        if (certDetails.hotCredential.hash && certDetails.hotCredential.bech32 && 
            certDetails.hotCredential.hash !== certDetails.hotCredential.bech32) {
          extractedDetails.hotCredentialHash = certDetails.hotCredential.hash;
        }
        
        // Committee member ID (prefer bech32)
        if (certDetails.committeeMember) {
          extractedDetails.committeeMember = certDetails.committeeMember;
        }
        
        // Epoch
        if (certDetails.epoch !== undefined) {
          extractedDetails.epoch = certDetails.epoch;
        }
      }

      // Committee Cold Resign
      if (certType === 'CommitteeColdResign' && certDetails.coldCredential) {
        // Prefer bech32 representation if available
        const coldCred = certDetails.coldCredential.bech32 || certDetails.coldCredential.hash || 'N/A';
        const coldType = certDetails.coldCredential.type || 'Unknown';
        extractedDetails.coldCredential = coldCred;
        extractedDetails.coldCredentialType = coldType === 'KeyHash' ? 'Key' : coldType === 'ScriptHash' ? 'Script' : coldType;
        
        // Include hash if it differs from bech32
        if (certDetails.coldCredential.hash && certDetails.coldCredential.bech32 && 
            certDetails.coldCredential.hash !== certDetails.coldCredential.bech32) {
          extractedDetails.coldCredentialHash = certDetails.coldCredential.hash;
        }
        
        // Committee member ID (prefer bech32)
        if (certDetails.committeeMember) {
          extractedDetails.committeeMember = certDetails.committeeMember;
        }
        
        // Epoch
        if (certDetails.epoch !== undefined) {
          extractedDetails.epoch = certDetails.epoch;
        }
      }

      return {
        index,
        type,
        description,
        icon,
        color,
        data: cert,
        details: extractedDetails
      };
    });

    return {
      count: items.length,
      items,
      summary: `${items.length} certificate(s) found`
    };
  };

  const analyzeWithdrawals = (tx: DomainTx) => {
    if (!tx.withdrawals || tx.withdrawals.length === 0) {
      return { count: 0, items: [], summary: 'No withdrawals found' };
    }

    const items = tx.withdrawals.map((withdrawal, index) => ({
      index,
      rewardAccount: (withdrawal as any).rewardAccount || (withdrawal as any).stakeAddr || 'N/A',
      amount: withdrawal.amount,
      description: `Withdrawal of ${withdrawal.amount} lovelace from reward account`
    }));

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      count: items.length,
      items,
      totalAmount,
      summary: `${items.length} withdrawal(s) totaling ${totalAmount} lovelace`
    };
  };

  const analyzeGovernance = (tx: DomainTx) => {
    if (!tx.governance) {
      return { count: 0, items: [], summary: 'No governance actions found' };
    }

    const items: any[] = [];
    
    // Analyze DRep votes
    if (tx.governance.drepVotes && tx.governance.drepVotes.length > 0) {
      tx.governance.drepVotes.forEach((vote: any, index: number) => {
        const extractedDetails: Record<string, any> = {};
        
        // Extract DRep details
        if (vote.drepCredential) {
          const cred = vote.drepCredential;
          extractedDetails.drepId = cred.bech32 || vote.drepId || cred.hash || 'N/A';
          extractedDetails.drepIdType = cred.type === 'KeyHash' ? 'Key' : cred.type === 'ScriptHash' ? 'Script' : cred.type;
          if (cred.hash && cred.hash !== extractedDetails.drepId) {
            extractedDetails.drepHash = cred.hash;
          }
        } else if (vote.drepId) {
          extractedDetails.drepId = vote.drepId;
        }
        
        // Extract action
        extractedDetails.action = vote.action || 'Unknown';
        
        // Extract proposal ID
        extractedDetails.proposalId = vote.proposalId || 'N/A';
        
        // Extract anchor details
        if (vote.anchor) {
          if (vote.anchor.url) {
            extractedDetails.anchorUrl = vote.anchor.url;
          }
          if (vote.anchor.hash) {
            extractedDetails.anchorHash = vote.anchor.hash;
          }
          if (vote.anchor.bytes) {
            extractedDetails.anchorBytes = vote.anchor.bytes;
          }
        } else if (vote.anchorMissing) {
          extractedDetails.anchorStatus = 'No anchor provided';
        }
        
        items.push({
          index,
          type: 'DRep Vote',
          description: `DRep ${(extractedDetails.drepId || 'unknown').toString().slice(0, 8)}... voted ${extractedDetails.action} on governance action ${extractedDetails.proposalId.toString().slice(0, 16)}...`,
          data: vote,
          details: extractedDetails,
          icon: <Vote className="h-4 w-4" />,
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          anchorMissing: vote.anchorMissing
        });
      });
    }

    // Analyze Committee votes
    if (tx.governance.committeeVotes && tx.governance.committeeVotes.length > 0) {
      tx.governance.committeeVotes.forEach((vote: any, index: number) => {
        const extractedDetails: Record<string, any> = {};
        
        // Extract Committee member details
        if (vote.memberCredential) {
          const cred = vote.memberCredential;
          extractedDetails.memberId = cred.bech32 || vote.memberId || cred.hash || 'N/A';
          extractedDetails.memberIdType = cred.type === 'KeyHash' ? 'Key' : cred.type === 'ScriptHash' ? 'Script' : cred.type;
        } else if (vote.memberId) {
          extractedDetails.memberId = vote.memberId;
        }
        
        // Extract action
        extractedDetails.action = vote.action || 'Unknown';
        
        // Extract proposal ID
        extractedDetails.proposalId = vote.proposalId || 'N/A';
        
        // Extract anchor details
        if (vote.anchor) {
          if (vote.anchor.url) {
            extractedDetails.anchorUrl = vote.anchor.url;
          }
          if (vote.anchor.hash) {
            extractedDetails.anchorHash = vote.anchor.hash;
          }
          if (vote.anchor.bytes) {
            extractedDetails.anchorBytes = vote.anchor.bytes;
          }
        } else if (vote.anchorMissing) {
          extractedDetails.anchorStatus = 'No anchor provided';
        }
        
        items.push({
          index,
          type: 'Committee Vote',
          description: `Committee member ${(extractedDetails.memberId || 'unknown').toString().slice(0, 8)}... voted ${extractedDetails.action} on governance action ${extractedDetails.proposalId.toString().slice(0, 16)}...`,
          data: vote,
          details: extractedDetails,
          icon: <Users className="h-4 w-4" />,
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
          anchorMissing: vote.anchorMissing
        });
      });
    }

    // Analyze governance proposals
    if (tx.governance.proposals && tx.governance.proposals.length > 0) {
      tx.governance.proposals.forEach((proposal: any, index: number) => {
        items.push({
          type: `${proposal.type} Governance Action`,
          description: `Governance action: ${proposal.type}`,
          data: proposal,
          icon: <FileText className="h-4 w-4" />,
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        });
      });
    }

    // Analyze constitution
    if (tx.governance.constitution) {
      items.push({
        type: 'Constitution',
        description: `Constitution hash: ${tx.governance.constitution.hash.slice(0, 16)}...`,
        data: tx.governance.constitution,
        icon: <Shield className="h-4 w-4" />,
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      });
    }

    // Analyze committee
    if (tx.governance.committee) {
      items.push({
        type: 'Committee',
        description: `Committee with ${tx.governance.committee.members.length} members`,
        data: tx.governance.committee,
        icon: <Users className="h-4 w-4" />,
        color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      });
    }

    return {
      count: items.length,
      items,
      summary: `${items.length} governance action(s) found`
    };
  };

  const analyzeMinting = (tx: DomainTx) => {
    if (!tx.mint || tx.mint.length === 0) {
      return { count: 0, items: [], summary: 'No minting found' };
    }

    const items = tx.mint.map((mint, index) => ({
      index,
      policyId: mint.policyId,
      assetName: mint.assetName,
      quantity: mint.quantity,
      description: `${mint.quantity > 0n ? 'Mint' : 'Burn'} ${Math.abs(Number(mint.quantity))} of ${mint.assetName}`
    }));

    const totalMinted = items.reduce((sum, item) => sum + Number(item.quantity), 0);

    return {
      count: items.length,
      items,
      totalMinted,
      summary: `${items.length} minting action(s) found`
    };
  };

  const analyzeCollateral = (tx: DomainTx) => {
    const collateralInputs = tx.inputs.filter(input => input.isCollateral);
    
    if (collateralInputs.length === 0) {
      return { count: 0, items: [], summary: 'No collateral inputs found' };
    }

    const items = collateralInputs.map((input, index) => ({
      index,
      txId: input.txId,
      address: input.resolved?.address || 'N/A',
      value: input.resolved?.value?.ada || 0n,
      description: `Collateral input of ${input.resolved?.value?.ada || 0} lovelace`
    }));

    const totalCollateral = items.reduce((sum, item) => sum + Number(item.value), 0);

    return {
      count: items.length,
      items,
      totalCollateral,
      summary: `${items.length} collateral input(s) totaling ${totalCollateral} lovelace`
    };
  };

  const analyzeValidity = (tx: DomainTx) => {
    return {
      ttl: tx.ttl,
      slot: tx.slot,
      validityStart: tx.validity.start,
      validityEnd: tx.validity.end,
      hasValidityInterval: tx.validity.start !== null || tx.validity.end !== null,
      description: tx.validity.start !== null || tx.validity.end !== null 
        ? 'Transaction has validity interval'
        : 'Transaction uses TTL only'
    };
  };

  const analyzeWitnesses = (tx: DomainTx) => {
    return {
      vkeyCount: tx.witnesses.vkeyCount,
      nativeCount: tx.witnesses.nativeCount,
      plutusCount: tx.witnesses.plutusCount,
      totalWitnesses: tx.witnesses.vkeyCount + tx.witnesses.nativeCount + tx.witnesses.plutusCount,
      description: `${tx.witnesses.vkeyCount} VKey, ${tx.witnesses.nativeCount} Native Script, ${tx.witnesses.plutusCount} Plutus Script witnesses`
    };
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };


  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyzing transaction contents...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!contents) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Contents Found</h3>
            <p className="text-muted-foreground">
              This transaction contains no certificates, withdrawals, or governance actions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Transaction Contents</h3>
      </div>

      {/* Contents Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{contents.certificates.count}</div>
            <div className="text-sm text-muted-foreground">Certificates</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Vote className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold">{contents.governance.count}</div>
            <div className="text-sm text-muted-foreground">Governance</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Hash className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold">{contents.minting.count}</div>
            <div className="text-sm text-muted-foreground">Minting</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Coins className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{contents.withdrawals.count}</div>
            <div className="text-sm text-muted-foreground">Withdrawals</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
            <div className="text-2xl font-bold">{tx.signers?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Signers</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Contents */}
      <Tabs defaultValue="certificates" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
          <TabsTrigger value="minting">Minting</TabsTrigger>
          <TabsTrigger value="signers">Signers</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>
        
        <TabsContent value="certificates" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {contents.certificates.count === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Award className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No certificates found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              contents.certificates.items.map((cert: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {cert.icon}
                        <span>{cert.type}</span>
                        <Badge className={cert.color}>
                          Certificate {cert.index + 1}
                        </Badge>
                      </div>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{cert.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {Object.keys(cert.details).length === 0 ? (
                        <div className="col-span-2 text-center text-muted-foreground py-4">
                          No additional details available
                        </div>
                      ) : (
                        Object.entries(cert.details).map(([key, value]) => {
                          if (key === 'anchorStatus') {
                            if (!value) {
                              return null;
                            }

                            return (
                              <div key={key} className="col-span-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>{String(value)}</span>
                                </div>
                              </div>
                            );
                          }

                          if (value === null || value === undefined || String(value) === 'N/A') {
                            return null;
                          }
                          
                          // Skip type fields (we'll display them as badges next to their values)
                          if (key.endsWith('Type')) {
                            return null;
                          }
                          
                          const isPoolId = key === 'poolId' && value !== 'N/A';
                          const isStakeKey = key === 'stakeKey' && value !== 'N/A' && String(value).startsWith('stake1');
                          const isDrepId = key === 'drepId' && value !== 'N/A' && String(value).startsWith('drep1');
                          const isRewardAccount = key === 'rewardAccount' && value !== 'N/A';
                          const isDrepHash = key === 'drepHash' && value !== 'N/A';
                          const isHotCredential = key === 'hotCredential' && value !== 'N/A' && String(value).startsWith('cc_hot1');
                          const isColdCredential = key === 'coldCredential' && value !== 'N/A' && String(value).startsWith('cc_cold1');
                          const isCommitteeMember = key === 'committeeMember' && value !== 'N/A' && (String(value).startsWith('cc_hot1') || String(value).startsWith('cc_cold1'));
                          
                          // Get the type badge for this field
                          const typeKey = `${key}Type`;
                          const typeValue = cert.details[typeKey];
                          
                          // Custom label formatting for specific fields
                          const customLabels: Record<string, string> = {
                            'drepId': 'DRep ID',
                            'poolId': 'Pool ID',
                            'stakeKey': 'Stake Credential',
                            'rewardAccount': 'Reward Account',
                            'drepHash': 'DRep Hash',
                            'hotCredential': 'Hot Credential',
                            'hotCredentialHash': 'Hot Credential Hash',
                            'coldCredential': 'Cold Credential',
                            'coldCredentialHash': 'Cold Credential Hash',
                            'committeeMember': 'Committee Member',
                            'anchorUrl': 'Anchor URL',
                            'anchorHash': 'Anchor Hash',
                            'anchorBytes': 'Anchor Bytes'
                          };
                          
                          const displayLabel = customLabels[key] || key.replace(/([A-Z])/g, ' $1').trim();
                          
                          return (
                            <div key={key}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{displayLabel}:</span>
                                {typeValue && (
                                  <Badge variant="outline" className="text-xs">
                                    {typeValue}
                                  </Badge>
                                )}
                              </div>
                              <div className="font-mono text-xs mt-1 break-all flex items-center gap-2">
                                <span>{String(value)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => copyToClipboard(String(value), key)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                {isPoolId && (
                                  <BlockExplorerLink 
                                    type="stakePool" 
                                    params={{ poolId: String(value) }}
                                  />
                                )}
                                {isStakeKey && (
                                  <BlockExplorerLink 
                                    type="stakeKey" 
                                    params={{ stakeKey: String(value) }}
                                  />
                                )}
                                  {isDrepId && (
                                    <BlockExplorerLink 
                                      type="drep" 
                                      params={{ drepId: String(value) }}
                                    />
                                  )}
                                  {isRewardAccount && (
                                    <BlockExplorerLink 
                                      type="address" 
                                      params={{ address: String(value) }}
                                    />
                                  )}
                                  {isHotCredential && (
                                    <BlockExplorerLink 
                                      type="committee" 
                                      params={{ memberId: String(value) }}
                                    />
                                  )}
                                  {isColdCredential && (
                                    <BlockExplorerLink 
                                      type="committee" 
                                      params={{ memberId: String(value) }}
                                    />
                                  )}
                                  {isCommitteeMember && (
                                    <BlockExplorerLink 
                                      type="committee" 
                                      params={{ memberId: String(value) }}
                                    />
                                  )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="governance" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {contents.governance.count === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Vote className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No governance actions found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              contents.governance.items.map((action: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {action.icon}
                        <span>{action.type}</span>
                        <Badge className={action.color}>
                          Governance Action
                        </Badge>
                      </div>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </CardHeader>
                  <CardContent>
                    {action.details && Object.keys(action.details).length > 0 ? (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {Object.entries(action.details).map(([key, value]) => {
                          // Skip type fields (we'll display them as badges next to their values)
                          if (key.endsWith('Type')) {
                            return null;
                          }
                          
                          // Handle anchor status warning (similar to certificates)
                          if (key === 'anchorStatus') {
                            if (!value) {
                              return null;
                            }

                            return (
                              <div key={key} className="col-span-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>{String(value)}</span>
                                </div>
                              </div>
                            );
                          }
                          
                          if (value === null || value === undefined || String(value) === 'N/A') {
                            return null;
                          }
                          
                          const isMemberId = key === 'memberId' && value !== 'N/A' && (
                            String(value).startsWith('cc_hot1') || 
                            String(value).startsWith('cc_cold1') || 
                            String(value).startsWith('cc1')
                          );
                          const isDrepId = key === 'drepId' && value !== 'N/A' && String(value).startsWith('drep1');
                          const isProposalId = key === 'proposalId' && value !== 'N/A';
                          const isAnchorUrl = key === 'anchorUrl' && value !== 'N/A';
                          
                          // Get the type badge for this field
                          const typeKey = `${key}Type`;
                          const typeValue = action.details[typeKey];
                          
                          // Custom label formatting
                          const customLabels: Record<string, string> = {
                            'memberId': 'Committee Member',
                            'drepId': 'DRep ID',
                            'drepHash': 'DRep Hash',
                            'action': 'Action',
                            'proposalId': 'Governance Action ID',
                            'anchorUrl': 'Anchor URL',
                            'anchorHash': 'Anchor Hash',
                            'anchorBytes': 'Anchor Bytes'
                          };
                          
                          const displayLabel = customLabels[key] || key.replace(/([A-Z])/g, ' $1').trim();
                          
                          // Format action value
                          const actionValue = String(value);
                          const actionColors: Record<string, string> = {
                            'VoteYes': 'text-green-600 font-semibold',
                            'VoteNo': 'text-red-600 font-semibold',
                            'Abstain': 'text-yellow-600 font-semibold'
                          };
                          
                          return (
                            <div key={key}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{displayLabel}:</span>
                                {typeValue && (
                                  <Badge variant="outline" className="text-xs">
                                    {typeValue}
                                  </Badge>
                                )}
                                {key === 'action' && (
                                  <span className={actionColors[actionValue] || ''}>
                                    {actionValue}
                                  </span>
                                )}
                              </div>
                              {key !== 'action' && (
                                <div className="font-mono text-xs mt-1 break-all flex items-center gap-2">
                                  {isAnchorUrl ? (
                                    <a 
                                      href={String(value)} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-500 underline hover:text-blue-700"
                                    >
                                      {String(value)}
                                    </a>
                                  ) : (
                                    <span>{actionValue}</span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={() => copyToClipboard(String(value), key)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  {isMemberId && (
                                    <BlockExplorerLink 
                                      type="committee" 
                                      params={{ memberId: String(value) }}
                                    />
                                  )}
                                  {isDrepId && (
                                    <BlockExplorerLink 
                                      type="drep" 
                                      params={{ drepId: String(value) }}
                                    />
                                  )}
                                  {isProposalId && (
                                    <BlockExplorerLink 
                                      type="proposal" 
                                      params={{ proposalId: String(value) }}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(action.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="minting" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {contents.minting.count === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Hash className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No minting actions found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              contents.minting.items.map((mint: any, index: number) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Minting Action {mint.index + 1}</h4>
                        <p className="text-sm text-muted-foreground">{mint.description}</p>
                      </div>
                      <Badge variant={Number(mint.quantity) > 0 ? "default" : "destructive"}>
                        {Number(mint.quantity) > 0 ? '+' : ''}{mint.quantity}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Asset Name:</span>
                        <div className="font-mono text-xs mt-1">{mint.assetName}</div>
                      </div>
                      <div>
                        <span className="font-medium">Policy ID:</span>
                        <div className="font-mono text-xs mt-1 break-all">{mint.policyId}</div>
                      </div>
                      <div>
                        <span className="font-medium">Quantity:</span>
                        <div className="font-mono text-xs mt-1">{mint.quantity}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="signers" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {(!tx.signers || tx.signers.length === 0) ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No signers found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Required Signers Section */}
                {tx.signers.filter(s => s.isRequired && !s.isWitness).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <Shield className="h-5 w-5 text-red-600" />
                      Required Signers ({tx.signers.filter(s => s.isRequired && !s.isWitness).length})
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      These signers must provide signatures for the transaction to be valid.
                    </p>
                    {tx.signers.filter(s => s.isRequired && !s.isWitness).map((signer, index) => (
                      <Card key={`required-${index}`}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="h-5 w-5 text-red-600" />
                              <span className="capitalize">{signer.type} Signer</span>
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Hash</span>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {signer.hash.slice(0, 16)}...
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(signer.hash, 'Required signer hash')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Witnesses Section */}
                {tx.signers.filter(s => s.isWitness).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Provided Witnesses ({tx.signers.filter(s => s.isWitness).length})
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      These signatures and scripts have been provided with the transaction.
                    </p>
                    {tx.signers.filter(s => s.isWitness).map((signer, index) => (
                      <Card key={`witness-${index}`}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {signer.type === 'vkey' && <Users className="h-5 w-5 text-blue-600" />}
                              {signer.type === 'native' && <Shield className="h-5 w-5 text-green-600" />}
                              {signer.type === 'plutus' && <Hash className="h-5 w-5 text-purple-600" />}
                              <span className="capitalize">{signer.type} Witness</span>
                              <Badge variant="secondary" className="text-xs">
                                Witness
                              </Badge>
                              {signer.isRequired && (
                                <Badge variant="destructive" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Type</span>
                              <Badge className={
                                signer.type === 'vkey' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                signer.type === 'native' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              }>
                                {signer.type}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Hash</span>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {signer.hash.slice(0, 16)}...
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(signer.hash, 'Witness hash')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
                            {signer.address && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Address</span>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-muted px-2 py-1 rounded">
                                    {signer.address.slice(0, 16)}...
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(signer.address!, 'Witness address')}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <BlockExplorerLink 
                                    type="address" 
                                    params={{ address: signer.address }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="other" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {/* Withdrawals */}
            {contents.withdrawals.count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Coins className="h-5 w-5 mr-2" />
                    Withdrawals ({contents.withdrawals.count})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {contents.withdrawals.items.map((withdrawal: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">Withdrawal {withdrawal.index + 1}</span>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            Account: {withdrawal.rewardAccount.slice(0, 20)}...
                            <BlockExplorerLink 
                              type="address" 
                              params={{ address: withdrawal.rewardAccount }}
                            />
                          </div>
                        </div>
                        <Badge variant="outline">
                          {Number(withdrawal.amount).toLocaleString()} lovelace
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Collateral */}
            {contents.collateral.count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Collateral Inputs ({contents.collateral.count})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {contents.collateral.items.map((input: any, index: number) => (
                      <div key={index} className="p-2 bg-muted rounded">
                        <div className="font-medium">Collateral Input {input.index + 1}</div>
                        <div className="text-sm text-muted-foreground">
                          Value: {input.value} lovelace
                        </div>
                        <div className="text-xs font-mono break-all mt-1">
                          {input.txId}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Validity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Transaction Validity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">TTL:</span>
                    <div className="font-mono">{contents.validity.ttl?.toLocaleString()}</div>
                    {contents.validity.ttl && (
                      <div className="text-xs text-muted-foreground">{slotToLocalTime(contents.validity.ttl)}</div>
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Slot:</span>
                    <div className="font-mono">{contents.validity.slot?.toLocaleString()}</div>
                    {contents.validity.slot && (
                      <div className="text-xs text-muted-foreground">{slotToLocalTime(contents.validity.slot)}</div>
                    )}
                  </div>
                  {contents.validity.validityStart && (
                    <div>
                      <span className="font-medium">Valid From:</span>
                      <div className="font-mono">{contents.validity.validityStart.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{slotToLocalTime(contents.validity.validityStart)}</div>
                      <ValidityTimeRemaining slot={contents.validity.validityStart} />
                    </div>
                  )}
                  {contents.validity.validityEnd && (
                    <div>
                      <span className="font-medium">Valid Until:</span>
                      <div className="font-mono">{contents.validity.validityEnd.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{slotToLocalTime(contents.validity.validityEnd)}</div>
                      <ValidityTimeRemaining slot={contents.validity.validityEnd} />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <Badge variant="outline">
                    {contents.validity.description}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Witnesses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Witnesses ({contents.witnesses.totalWitnesses})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{contents.witnesses.vkeyCount}</div>
                    <div className="text-sm text-muted-foreground">VKey Witnesses</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{contents.witnesses.nativeCount}</div>
                    <div className="text-sm text-muted-foreground">Native Scripts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{contents.witnesses.plutusCount}</div>
                    <div className="text-sm text-muted-foreground">Plutus Scripts</div>
                  </div>
                </div>
                
                {/* Required Signers Summary */}
                {tx.signers && tx.signers.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Signers ({tx.signers.length})
                    </h4>
                    <div className="space-y-2">
                      {tx.signers.slice(0, 3).map((signer, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {signer.type === 'vkey' && <Users className="h-3 w-3 text-blue-600" />}
                            {signer.type === 'native' && <Shield className="h-3 w-3 text-green-600" />}
                            {signer.type === 'plutus' && <Hash className="h-3 w-3 text-purple-600" />}
                            <span className="capitalize">{signer.type}</span>
                            {signer.isRequired && (
                              <Badge variant="destructive" className="text-xs px-1 py-0">
                                Required
                              </Badge>
                            )}
                            {signer.isWitness && (
                              <Badge variant="secondary" className="text-xs px-1 py-0">
                                Witness
                              </Badge>
                            )}
                          </div>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {signer.hash.slice(0, 12)}...
                          </code>
                        </div>
                      ))}
                      {tx.signers.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{tx.signers.length - 3} more signers
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="mt-4 text-sm text-muted-foreground">
                  {contents.witnesses.description}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
