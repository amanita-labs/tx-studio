// src/features/builder/TransactionSummary.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Copy, CheckCircle2, FileText, Vote, Settings } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

export function TransactionSummary() {
  const { builderCertificates, builderTxBodyElements, builtTxHex, removeCertificate, removeTxBodyElement } = useAppStore();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getCertificateLabel = (type: string) => {
    switch (type) {
      case 'StakeRegistration': return 'Stake Registration';
      case 'StakeDeregistration': return 'Stake Deregistration';
      case 'StakeDelegation': return 'Stake Delegation';
      case 'PoolRegistration': return 'Pool Registration';
      case 'PoolRetirement': return 'Pool Retirement';
      case 'AccountRegistration': return 'Account Registration';
      case 'AccountUnregistration': return 'Account Unregistration';
      case 'VoteDelegation': return 'Vote Delegation';
      case 'StakeVoteDelegation': return 'Stake + Vote Delegation';
      case 'StakeRegDelegation': return 'Stake Reg + Delegation';
      case 'VoteRegDelegation': return 'Vote Reg + Delegation';
      case 'StakeVoteRegDelegation': return 'Stake + Vote + Reg + Delegation';
      case 'CommitteeAuth': return 'Committee Authorization';
      case 'CommitteeResignation': return 'Committee Resignation';
      case 'DRepRegistration': return 'DRep Registration';
      case 'DRepUpdate': return 'DRep Update';
      case 'DRepRetirement': return 'DRep Retirement';
      case 'Vote': return 'Vote';
      default: return type;
    }
  };

  const getTxBodyElementLabel = (type: string) => {
    switch (type) {
      case 'TransactionInputs': return 'Transaction Input';
      case 'CollateralInputs': return 'Collateral Input';
      case 'ReferenceInputs': return 'Reference Input';
      case 'TransactionOutputs': return 'Transaction Output';
      case 'CollateralReturn': return 'Collateral Return';
      case 'Fee': return 'Fee';
      case 'ValidityIntervalStart': return 'Validity Start';
      case 'ValidityIntervalEnd': return 'Validity End';
      case 'TotalCollateral': return 'Total Collateral';
      case 'Withdrawals': return 'Withdrawal';
      case 'Mint': return 'Mint';
      case 'AuxiliaryDataHash': return 'Aux Data Hash';
      case 'ScriptDataHash': return 'Script Data Hash';
      case 'RequiredSigners': return 'Required Signer';
      case 'VotingProcedures': return 'Voting Procedure';
      case 'ProposalProcedures': return 'Proposal Procedure';
      case 'TreasuryAmount': return 'Treasury Amount';
      case 'TreasuryDonation': return 'Treasury Donation';
      default: return type;
    }
  };

  // Group transaction body elements by category
  const groupedTxBodyElements = {
    inputs: builderTxBodyElements.filter(e => ['TransactionInputs', 'CollateralInputs', 'ReferenceInputs'].includes(e.type)),
    outputs: builderTxBodyElements.filter(e => ['TransactionOutputs', 'CollateralReturn'].includes(e.type)),
    fees: builderTxBodyElements.filter(e => ['Fee', 'ValidityIntervalStart', 'ValidityIntervalEnd', 'TotalCollateral'].includes(e.type)),
    withdrawals: builderTxBodyElements.filter(e => e.type === 'Withdrawals'),
    minting: builderTxBodyElements.filter(e => e.type === 'Mint'),
    metadata: builderTxBodyElements.filter(e => ['AuxiliaryDataHash', 'ScriptDataHash'].includes(e.type)),
    signers: builderTxBodyElements.filter(e => e.type === 'RequiredSigners'),
    governance: builderTxBodyElements.filter(e => ['VotingProcedures', 'ProposalProcedures'].includes(e.type)),
    treasury: builderTxBodyElements.filter(e => ['TreasuryAmount', 'TreasuryDonation'].includes(e.type)),
  };

  // Separate votes from other certificates for display
  const votes = builderCertificates.filter(c => c.type === 'Vote');
  const certificates = builderCertificates.filter(c => c.type !== 'Vote');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Transaction Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Certificates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Certificates ({certificates.length})
              </h3>
            </div>
            <ScrollArea className="h-32">
              {certificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No certificates added</p>
              ) : (
                <div className="space-y-2">
                  {certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className="mr-2">
                          {getCertificateLabel(cert.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {cert.data.drepId || cert.data.stakeCredential || 'Certificate'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCertificate(cert.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Votes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Vote className="h-4 w-4" />
                Votes ({votes.length})
              </h3>
            </div>
            <ScrollArea className="h-32">
              {votes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No votes added</p>
              ) : (
                <div className="space-y-2">
                  {votes.map((vote) => (
                    <div
                      key={vote.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className="mr-2 capitalize">
                          {vote.data.vote as string}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate font-mono">
                          {(vote.data.proposalId as string)?.slice(0, 16)}...
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCertificate(vote.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Separator />

          {/* Transaction Body Elements */}
          {builderTxBodyElements.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Transaction Body Elements ({builderTxBodyElements.length})
                </h3>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-3">
                  {groupedTxBodyElements.inputs.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Inputs ({groupedTxBodyElements.inputs.length})</div>
                      <div className="space-y-1">
                        {groupedTxBodyElements.inputs.map((el) => (
                          <div key={el.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <div className="flex-1 min-w-0">
                              <Badge variant="outline" className="mr-2 text-xs">
                                {getTxBodyElementLabel(el.type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate font-mono">
                                {el.data.txId ? `${(el.data.txId as string).slice(0, 8)}...` : 'Input'}
                              </span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeTxBodyElement(el.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {groupedTxBodyElements.outputs.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Outputs ({groupedTxBodyElements.outputs.length})</div>
                      <div className="space-y-1">
                        {groupedTxBodyElements.outputs.map((el) => (
                          <div key={el.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <div className="flex-1 min-w-0">
                              <Badge variant="outline" className="mr-2 text-xs">
                                {getTxBodyElementLabel(el.type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate">
                                {el.data.address ? `${(el.data.address as string).slice(0, 20)}...` : 'Output'}
                              </span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeTxBodyElement(el.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {groupedTxBodyElements.fees.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Fees & Validity ({groupedTxBodyElements.fees.length})</div>
                      <div className="space-y-1">
                        {groupedTxBodyElements.fees.map((el) => (
                          <div key={el.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <div className="flex-1 min-w-0">
                              <Badge variant="outline" className="mr-2 text-xs">
                                {getTxBodyElementLabel(el.type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate">
                                {el.data.fee || el.data.slot || el.data.amount || 'Value'}
                              </span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeTxBodyElement(el.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.entries(groupedTxBodyElements).filter(([key, items]) => 
                    !['inputs', 'outputs', 'fees'].includes(key) && items.length > 0
                  ).map(([key, items]) => (
                    <div key={key}>
                      <div className="text-xs font-medium text-muted-foreground mb-1 capitalize">
                        {key} ({items.length})
                      </div>
                      <div className="space-y-1">
                        {items.map((el) => (
                          <div key={el.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <div className="flex-1 min-w-0">
                              <Badge variant="outline" className="mr-2 text-xs">
                                {getTxBodyElementLabel(el.type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate">
                                {Object.values(el.data)[0] ? String(Object.values(el.data)[0]).slice(0, 20) : 'Element'}
                              </span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeTxBodyElement(el.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <Separator />

          {/* Transaction Hex */}
          {builtTxHex && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Transaction Hex</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(builtTxHex, 'Transaction Hex')}
                >
                  {copied === 'Transaction Hex' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <ScrollArea className="flex-1 border rounded-md p-2">
                <code className="text-xs break-all">{builtTxHex}</code>
              </ScrollArea>
            </div>
          )}

          {!builtTxHex && builderCertificates.length === 0 && builderTxBodyElements.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Add certificates or transaction body elements to build a transaction
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

