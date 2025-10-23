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
  Download,
  Info,
  CheckCircle2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { toast } from 'sonner';

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

    const items = tx.certs.map((cert, index) => {
      let type = 'Unknown';
      let description = 'Certificate';
      let icon = <Award className="h-4 w-4" />;
      let color = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';

      // Determine certificate type based on structure
      const certType = (cert as any).type || 'Unknown';
      
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
        color = 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      } else if (certType === 'PoolRetirement') {
        type = 'Pool Retirement';
        description = 'Retires a stake pool';
        icon = <Clock className="h-4 w-4" />;
        color = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      } else {
        type = certType;
        description = 'Certificate';
        icon = <Award className="h-4 w-4" />;
        color = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      }

      return {
        index,
        type,
        description,
        icon,
        color,
        data: cert,
        details: {
          stakeKey: (cert as any).stakeKey || 'N/A',
          poolId: (cert as any).poolId || 'N/A',
          epoch: (cert as any).epoch || 'N/A',
          rewardAccount: (cert as any).rewardAccount || 'N/A'
        }
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
    
    // Analyze governance actions
    if ((tx.governance as any).votingProcedures) {
      (tx.governance as any).votingProcedures.forEach((procedure: any, index: number) => {
        items.push({
          type: 'Voting Procedure',
          description: `Vote on governance proposal`,
          data: procedure,
          icon: <Vote className="h-4 w-4" />,
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        });
      });
    }

    if ((tx.governance as any).proposalProcedures) {
      (tx.governance as any).proposalProcedures.forEach((procedure: any, index: number) => {
        items.push({
          type: 'Proposal Procedure',
          description: `Submit governance proposal`,
          data: procedure,
          icon: <FileText className="h-4 w-4" />,
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        });
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

  const downloadContents = () => {
    if (!contents) return;
    
    const data = {
      transaction: tx,
      contents: contents,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-contents-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Transaction contents downloaded');
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
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={downloadContents}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Contents Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{contents.certificates.count}</div>
            <div className="text-sm text-muted-foreground">Certificates</div>
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
      </div>

      {/* Detailed Contents */}
      <Tabs defaultValue="certificates" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
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
                      {Object.entries(cert.details).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                          <div className="font-mono text-xs mt-1 break-all">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(JSON.stringify(cert.data, null, 2), 'Certificate data')}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="withdrawals" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {contents.withdrawals.count === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Coins className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No withdrawals found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              contents.withdrawals.items.map((withdrawal: any, index: number) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Withdrawal {withdrawal.index + 1}</h4>
                        <p className="text-sm text-muted-foreground">{withdrawal.description}</p>
                      </div>
                      <Badge variant="outline">
                        {Number(withdrawal.amount).toLocaleString()} lovelace
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Reward Account:</span>
                        <div className="font-mono text-xs mt-1 break-all">{withdrawal.rewardAccount}</div>
                      </div>
                      <div>
                        <span className="font-medium">Amount:</span>
                        <div className="font-mono text-xs mt-1">{withdrawal.amount} lovelace</div>
                      </div>
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
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {action.icon}
                        <span className="font-medium">{action.type}</span>
                        <Badge className={action.color}>
                          Governance Action
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{action.description}</p>
                    <div className="mt-4">
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(action.data, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="other" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {/* Minting */}
            {contents.minting.count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Hash className="h-5 w-5 mr-2" />
                    Minting Actions ({contents.minting.count})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {contents.minting.items.map((mint: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">{mint.assetName}</span>
                          <div className="text-sm text-muted-foreground">
                            Policy: {mint.policyId.slice(0, 8)}...
                          </div>
                        </div>
                        <Badge variant={Number(mint.quantity) > 0 ? "default" : "destructive"}>
                          {Number(mint.quantity) > 0 ? '+' : ''}{mint.quantity}
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
                    <div className="font-mono">{contents.validity.ttl}</div>
                  </div>
                  <div>
                    <span className="font-medium">Slot:</span>
                    <div className="font-mono">{contents.validity.slot}</div>
                  </div>
                  {contents.validity.validityStart && (
                    <div>
                      <span className="font-medium">Valid From:</span>
                      <div className="font-mono">{contents.validity.validityStart}</div>
                    </div>
                  )}
                  {contents.validity.validityEnd && (
                    <div>
                      <span className="font-medium">Valid Until:</span>
                      <div className="font-mono">{contents.validity.validityEnd}</div>
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
                <div className="grid grid-cols-3 gap-4 text-center">
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
