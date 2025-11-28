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
  ExternalLink,
  Settings,
  Zap,
  Banknote,
  XCircle,
  ScrollText,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { slotToLocalTime, getTimeRemaining } from '@/lib/utils/slot-time';
import { formatLovelace, formatAda } from '@/lib/utils/ada';
import { toast } from 'sonner';
import { BlockExplorerLink } from '@/components/block-explorer-link';
import { getKnownAddressLabel, getKnownSignerLabel } from '@/lib/labels';
import { KnownLabelHighlight } from '@/components/known-label-highlight';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as bech32Buffer from 'bech32-buffer';

// Helper function to create CIP-129 committee cold credential bech32 ID
function createCommitteeColdCredentialId(hash: string, type: 'Key' | 'Script'): string | null {
  if (!hash || hash.length !== 56) return null; // 28 bytes = 56 hex chars
  
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    if (hashBuffer.length !== 28) return null;
    
    // CIP-0129: Committee cold credentials use 'cc_cold' prefix
    // Header byte: Cold = 0x01, Key Hash = 0x02, Script Hash = 0x03
    const keyType = 0x01; // Cold = 1
    const credentialType = type === 'Key' ? 0x02 : 0x03; // Key Hash = 2, Script Hash = 3
    const headerByte = (keyType << 4) | credentialType;
    
    // Prepend header byte to hash
    const dataWithHeader = Buffer.concat([Buffer.from([headerByte]), hashBuffer]);
    return bech32Buffer.encode('cc_cold', dataWithHeader).toString();
  } catch (error) {
    console.warn('Error creating committee cold credential ID:', error);
    return null;
  }
}

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

// Component for individual governance action item
function GovernanceActionItem({ 
  action, 
  index, 
  copyToClipboard,
  protocolParamNames,
  formatProtocolParamValue
}: { 
  action: any; 
  index: number; 
  copyToClipboard: (text: string, label: string) => Promise<void>;
  protocolParamNames: Record<number, string>;
  formatProtocolParamValue: (key: number, value: any) => string;
}) {
  const [isRawDataOpen, setIsRawDataOpen] = useState(false);
  
  // Check if this is a proposal (has governanceActionId)
  const isProposal = action.details?.governanceActionId !== undefined;
  const governanceActionId = action.details?.governanceActionId || action.details?.proposalId;
  
  const isMemberId = (key: string, value: any) => key === 'memberId' && value !== 'N/A' && (
    String(value).startsWith('cc_hot1') || 
    String(value).startsWith('cc_cold1') || 
    String(value).startsWith('cc1')
  );
  const isDrepId = (key: string, value: any) => key === 'drepId' && value !== 'N/A' && String(value).startsWith('drep1');
  const isProposalId = (key: string) => key === 'proposalId' || key === 'parentActionId';
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {action.icon}
            <span>{action.type}</span>
            {action.type !== 'Constitution' && action.type !== 'Committee' && (
              <Badge className={action.color} variant="outline">
                Governance
              </Badge>
            )}
          </div>
        </CardTitle>
        {action.description && action.description !== action.type && (
          <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
        )}
      </CardHeader>
      <CardContent>
        {action.details && Object.keys(action.details).length > 0 ? (
          <div className="space-y-4">
            {/* Highlighted Key Information Section */}
            {(() => {
              // Helper function to format ADA with commas and proper decimals
              const formatAdaDisplay = (adaValue: string | number): string => {
                const numValue = typeof adaValue === 'string' ? parseFloat(adaValue) : adaValue;
                if (isNaN(numValue)) return String(adaValue);
                
                // If it's a whole number, don't show decimals
                if (numValue % 1 === 0) {
                  return Math.floor(numValue).toLocaleString('en-US');
                }
                // Otherwise show up to 6 decimals but remove trailing zeros
                return numValue.toLocaleString('en-US', {
                  maximumFractionDigits: 6,
                  minimumFractionDigits: 0
                });
              };
              
              // Extract fields from details or raw data
              // Prefer formatted value from details, otherwise format raw value
              let deposit: string | undefined;
              if (action.details?.deposit) {
                // Already formatted by formatCommonProposalFields (as ADA string)
                deposit = formatAdaDisplay(action.details.deposit);
              } else {
                // Extract raw value and format it
                const rawDeposit = action.data?.details?.deposit || action.data?.raw?.deposit;
                if (rawDeposit !== undefined && rawDeposit !== null) {
                  try {
                    const depositValue = typeof rawDeposit === 'bigint' ? rawDeposit : BigInt(rawDeposit);
                    const adaFormatted = formatAda(depositValue);
                    deposit = formatAdaDisplay(adaFormatted);
                  } catch {
                    deposit = String(rawDeposit);
                  }
                }
              }
              const rewardAccount = action.details?.rewardAccount || action.data?.details?.rewardAccount || action.data?.raw?.reward_account;
              const anchorUrl = action.details?.anchorUrl || action.data?.details?.anchor?.url || action.data?.raw?.anchor?.anchor_url;
              const anchorHash = action.details?.anchorHash || action.data?.details?.anchor?.hash || action.data?.raw?.anchor?.anchor_data_hash;
              
              // Show section if governance action ID exists or any other fields exist
              const hasGovernanceActionId = isProposal && governanceActionId && governanceActionId !== 'N/A';
              if (!hasGovernanceActionId && !deposit && !rewardAccount && !anchorUrl && !anchorHash) {
                return null;
              }
              
              return (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Governance Action ID */}
                  {isProposal && governanceActionId && governanceActionId !== 'N/A' && (
                    <div className="col-span-2">
                      <div className="font-medium mb-1">Governance Action ID:</div>
                      <div className="font-mono text-xs mt-1 break-all flex items-center gap-2">
                        <span>{String(governanceActionId)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(String(governanceActionId), 'Governance Action ID')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <BlockExplorerLink 
                          type="proposal" 
                          params={{ proposalId: String(governanceActionId) }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Deposit Amount */}
                  {deposit && (
                    <div>
                      <div className="font-medium mb-1">Deposit Amount:</div>
                      <div className="font-mono text-xs mt-1 break-all flex items-center gap-2">
                        <span>{deposit} ada</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(`${deposit} ada`, 'Deposit Amount')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Deposit Return Address */}
                  {rewardAccount && (
                    <div className="col-span-2">
                      <div className="font-medium mb-1">Deposit Return Address:</div>
                      <div className="font-mono text-xs mt-1 break-all flex items-center gap-2">
                        <span>{String(rewardAccount)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(String(rewardAccount), 'Deposit Return Address')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <BlockExplorerLink 
                          type="stakeKey" 
                          params={{ stakeKey: String(rewardAccount) }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Metadata URI */}
                  {anchorUrl && (() => {
                    // Convert IPFS URI to HTTP gateway URL
                    const urlString = String(anchorUrl);
                    let href = urlString;
                    if (urlString.startsWith('ipfs://')) {
                      const ipfsHash = urlString.replace('ipfs://', '');
                      href = `https://ipfs.io/ipfs/${ipfsHash}`;
                    }
                    
                    return (
                      <div className="col-span-2">
                        <div className="font-medium mb-1">Metadata URI:</div>
                        <div className="font-mono text-xs mt-1 break-all flex items-center gap-2">
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 underline flex-1"
                          >
                            {urlString}
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(urlString, 'Metadata URI')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Metadata Hash */}
                  {anchorHash && (
                    <div className="col-span-2">
                      <div className="font-medium mb-1">Metadata Hash:</div>
                      <div className="font-mono text-xs mt-1 break-all flex items-center gap-2">
                        <span>{String(anchorHash)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(String(anchorHash), 'Metadata Hash')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              {Object.entries(action.details).map(([key, value]) => {
                // Skip governanceActionId as it's shown prominently above
                if (key === 'governanceActionId') {
                  return null;
                }
                
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
                
                // Skip anchor fields - they're shown in highlighted section above
                if (key === 'anchorUrl' || key === 'anchorHash' || key === 'anchorBytes') {
                  return null;
                }
                
                // Skip deposit and rewardAccount - they're shown in highlighted section above
                if (key === 'deposit' || key === 'rewardAccount') {
                  return null;
                }
                
                // Skip governanceActionId - it's shown in highlighted section above
                if (key === 'governanceActionId') {
                  return null;
                }
                
                if (value === null || value === undefined || String(value) === 'N/A') {
                  return null;
                }
                
                const isParentActionId = key === 'parentActionId';
                
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
                  'parentActionId': 'Previous Governance Action ID',
                  'deposit': 'Deposit',
                  'rewardAccount': 'Deposit Return Address',
                  'epoch': 'Epoch',
                  'protocolVersion': 'Protocol Version',
                  'constitutionHash': 'Constitution Hash',
                  'constitutionUrl': 'Constitution URI',
                  'scriptHash': 'Guardrails Script Hash',
                  'membersToRemove': 'Members to Remove',
                  'membersToAdd': 'Members to Add',
                  'threshold': 'Threshold'
                };
                
                const displayLabel = customLabels[key] || key.replace(/([A-Z])/g, ' $1').trim();
                
                // Handle constitutionUrl - show as clickable link similar to metadata URI
                if (key === 'constitutionUrl') {
                  const urlString = String(value);
                  let href = urlString;
                  if (urlString.startsWith('ipfs://')) {
                    const ipfsHash = urlString.replace('ipfs://', '');
                    href = `https://ipfs.io/ipfs/${ipfsHash}`;
                  }
                  
                  return (
                    <div key={key} className="col-span-2">
                      <div className="font-medium mb-1">{displayLabel}:</div>
                      <div className="font-mono text-xs mt-1 break-all flex items-center gap-2">
                        <a 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600 underline flex-1"
                        >
                          {urlString}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(urlString, 'Constitution URI')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  );
                }
                
                // Format action value
                const actionValue = String(value);
                const actionColors: Record<string, string> = {
                  'VoteYes': 'text-green-600 font-semibold',
                  'VoteNo': 'text-red-600 font-semibold',
                  'Abstain': 'text-yellow-600 font-semibold'
                };
                
                // Handle parameter changes object
                if (key === 'parameterChanges' && typeof value === 'object') {
                  // Helper to convert camelCase to readable format
                  const formatParamName = (name: string): string => {
                    return name
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, str => str.toUpperCase())
                      .trim();
                  };
                  
                  return (
                    <div key={key} className="col-span-2">
                      <div className="font-medium mb-2">{displayLabel}:</div>
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {Object.entries(value as Record<string, any>).map(([paramName, paramValue]) => {
                          const readableName = formatParamName(paramName);
                          
                          // Handle execution units (objects with mem and steps)
                          if (paramValue && typeof paramValue === 'object' && !Array.isArray(paramValue)) {
                            if (paramValue.mem !== undefined || paramValue.steps !== undefined) {
                              return (
                                <div key={paramName} className="space-y-1.5">
                                  <div className="font-medium text-xs">{readableName}:</div>
                                  <div className="pl-3 space-y-1 text-xs">
                                    {paramValue.mem !== undefined && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Memory:</span>
                                        <span className="font-mono font-semibold">{Number(paramValue.mem).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {paramValue.steps !== undefined && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Steps:</span>
                                        <span className="font-mono font-semibold">{Number(paramValue.steps).toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          }
                          // Handle regular parameter values
                          return (
                            <div key={paramName} className="flex items-center justify-between text-xs">
                              <span className="font-medium">{readableName}:</span>
                              <span className="font-mono font-semibold">{String(paramValue)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                
                // Handle membersToRemove array
                if (key === 'membersToRemove' && Array.isArray(value)) {
                  return (
                    <div key={key} className="col-span-2">
                      <div className="font-medium mb-2">{displayLabel}:</div>
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {value.map((member: any, idx: number) => {
                          const memberType = member.type || (member.Key ? 'Key' : member.Script ? 'Script' : 'Unknown');
                          const memberHash = member.hash || member.Key || member.Script || '';
                          const memberBech32 = member.bech32 || member.credential?.bech32;
                          
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="font-medium text-xs mb-1">Member {idx + 1}:</div>
                              <div className="pl-3 space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Type:</span>
                                  <span className="font-semibold">{memberType}</span>
                                </div>
                                {memberBech32 ? (
                                  <>
                                    <div className="font-mono text-xs break-all flex items-center gap-2">
                                      <span className="flex-1">{memberBech32}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2"
                                        onClick={() => copyToClipboard(memberBech32, 'Member ID')}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <BlockExplorerLink 
                                        type="committee" 
                                        params={{ memberId: memberBech32 }}
                                      />
                                    </div>
                                    {memberHash && memberHash !== memberBech32 && (
                                      <div className="text-[10px] text-muted-foreground font-mono break-all">
                                        Hash: {memberHash}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="font-mono text-xs break-all flex items-center gap-2">
                                    <span className="flex-1">{memberHash}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2"
                                      onClick={() => copyToClipboard(memberHash, 'Member Hash')}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                
                // Handle membersToAdd array
                if (key === 'membersToAdd' && Array.isArray(value)) {
                  const isFullCommittee = action.details?.isFullCommittee;
                  const sectionLabel = isFullCommittee ? 'Committee Members' : displayLabel;
                  
                  return (
                    <div key={key} className="col-span-2">
                      <div className="font-medium mb-2">{sectionLabel}:</div>
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {value.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No members to add</div>
                        ) : (
                          value.map((member: any, idx: number) => {
                            const memberType = member.type || (member.Key ? 'Key' : member.Script ? 'Script' : 'Unknown');
                            const memberHash = member.hash || member.Key || member.Script || '';
                            const memberBech32 = member.bech32 || member.credential?.bech32;
                            const termLimit = member.termLimit !== undefined ? member.termLimit : null;
                            
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="font-medium text-xs mb-1">Member {idx + 1}:</div>
                                <div className="pl-3 space-y-1 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Type:</span>
                                    <span className="font-semibold">{memberType}</span>
                                  </div>
                                  {memberBech32 ? (
                                    <>
                                      <div className="font-mono text-xs break-all flex items-center gap-2">
                                        <span className="flex-1">{memberBech32}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2"
                                          onClick={() => copyToClipboard(memberBech32, 'Member ID')}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                        <BlockExplorerLink 
                                          type="committee" 
                                          params={{ memberId: memberBech32 }}
                                        />
                                      </div>
                                      {memberHash && memberHash !== memberBech32 && (
                                        <div className="text-[10px] text-muted-foreground font-mono break-all">
                                          Hash: {memberHash}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="font-mono text-xs break-all flex items-center gap-2">
                                      <span className="flex-1">{memberHash}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2"
                                        onClick={() => copyToClipboard(memberHash, 'Member Hash')}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  {termLimit !== null && termLimit !== undefined && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Term Limit:</span>
                                      <span className="font-semibold">Epoch {termLimit.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                }
                
                // Handle withdrawals object
                if (key === 'withdrawals' && typeof value === 'object') {
                  // Helper function to format ADA with commas and proper decimals
                  const formatAdaDisplay = (adaValue: string | number): string => {
                    const numValue = typeof adaValue === 'string' ? parseFloat(adaValue) : adaValue;
                    if (isNaN(numValue)) return String(adaValue);
                    
                    // If it's a whole number, don't show decimals
                    if (numValue % 1 === 0) {
                      return Math.floor(numValue).toLocaleString('en-US');
                    }
                    // Otherwise show up to 6 decimals but remove trailing zeros
                    return numValue.toLocaleString('en-US', {
                      maximumFractionDigits: 6,
                      minimumFractionDigits: 0
                    });
                  };
                  
                  return (
                    <div key={key} className="col-span-2">
                      <div className="font-medium mb-2">{displayLabel}:</div>
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {Object.entries(value as Record<string, any>).map(([account, amount]) => {
                          const formattedAmount = formatAdaDisplay(String(amount));
                          return (
                            <div key={account} className="space-y-1">
                              <div className="font-medium text-xs mb-1">Destination:</div>
                              <div className="font-mono text-xs break-all flex items-center gap-2 mb-2">
                                <span className="flex-1">{account}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => copyToClipboard(account, 'Stake Address')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <BlockExplorerLink 
                                  type="stakeKey" 
                                  params={{ stakeKey: account }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground text-xs">Amount:</span>
                                <span className="font-mono font-semibold text-xs">{formattedAmount} ada</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div key={key} className={isParentActionId ? 'col-span-2' : ''}>
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
                        <span>{actionValue}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(String(value), key)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {isMemberId(key, value) && (
                          <BlockExplorerLink 
                            type="committee" 
                            params={{ memberId: String(value) }}
                          />
                        )}
                        {isDrepId(key, value) && (
                          <BlockExplorerLink 
                            type="drep" 
                            params={{ drepId: String(value) }}
                          />
                        )}
                        {isProposalId(key) && (
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
            
            {/* Expandable Raw Data Section */}
            {action.data && (
              <Collapsible open={isRawDataOpen} onOpenChange={setIsRawDataOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {isRawDataOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>Raw Data</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(action.data, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            )}
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

  // Protocol parameter name mapping based on CDDL
  const PROTOCOL_PARAM_NAMES: Record<number, string> = {
    0: 'minFeeA',
    1: 'minFeeB',
    2: 'maxBlockBodySize',
    3: 'maxTransactionSize',
    4: 'maxBlockHeaderSize',
    5: 'keyDeposit',
    6: 'poolDeposit',
    7: 'maximumEpoch',
    8: 'nOpt',
    9: 'poolPledgeInfluence',
    10: 'expansionRate',
    11: 'treasuryGrowthRate',
    16: 'minPoolCost',
    17: 'adaPerUtxoByte',
    18: 'costModels',
    19: 'executionUnitPrices',
    20: 'maxTxExecutionUnits',
    21: 'maxBlockExecutionUnits',
    22: 'maxValueSize',
    23: 'collateralPercentage',
    24: 'maxCollateralInputs',
    25: 'poolVotingThresholds',
    26: 'drepVotingThresholds',
    27: 'minCommitteeSize',
    28: 'committeeTermLimit',
    29: 'governanceActionValidityPeriod',
    30: 'governanceActionDeposit',
    31: 'drepDeposit',
    32: 'drepInactivityPeriod',
    33: 'minFeeRefScriptCoinsPerByte'
  };

  // Helper function to format protocol parameter value
  const formatProtocolParamValue = (key: number, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    
    // Handle coin values (0, 1, 5, 6, 16, 17, 30, 31)
    if ([0, 1, 5, 6, 16, 17, 30, 31].includes(key)) {
      try {
        const bigintValue = typeof value === 'bigint' ? value : BigInt(value);
        return formatAda(bigintValue);
      } catch {
        return String(value);
      }
    }
    
    // Handle unit intervals (9, 10, 11, 25, 26)
    if ([9, 10, 11].includes(key) || (key === 25 || key === 26)) {
      if (Array.isArray(value) && value.length === 2) {
        const [numerator, denominator] = value;
        const percentage = (Number(numerator) / Number(denominator)) * 100;
        return `${percentage.toFixed(2)}%`;
      }
      return String(value);
    }
    
    // Handle protocol version (for HardForkInitiation)
    if (Array.isArray(value) && value.length === 2) {
      return `${value[0]}.${value[1]}`;
    }
    
    return String(value);
  };

  // Helper function to extract common proposal fields
  const formatCommonProposalFields = (proposal: any): Record<string, any> => {
    const details: Record<string, any> = {};
    const proposalDetails = proposal.details || {};
    const rawData = proposalDetails.raw || {};
    
    // Extract governance action ID - try multiple sources
    let governanceActionId = proposal.id || null;
    
    // If not found, try to extract from raw governance_action structure
    if (!governanceActionId || governanceActionId === 'N/A') {
      const govAction = rawData.governance_action;
      if (govAction) {
        // Check each action type for gov_action_id
        const actionTypes = ['ParameterChangeAction', 'HardForkInitiationAction', 'TreasuryWithdrawalsAction', 
                          'NoConfidenceAction', 'NewConstitutionAction', 'UpdateCommitteeAction', 'InfoAction'];
        for (const actionType of actionTypes) {
          if (govAction[actionType]?.gov_action_id) {
            const govActionId = govAction[actionType].gov_action_id;
            const txId = govActionId.transaction_id || '';
            const actionIndex = govActionId.index !== undefined ? govActionId.index : 0;
            // Format as txId#index (the worker should have already encoded it as CIP-129, but if not, show this format)
            if (txId) {
              governanceActionId = `${txId}#${actionIndex}`;
            }
            break;
          }
        }
      }
    }
    
    // Always include governance action ID prominently
    details.governanceActionId = governanceActionId || 'N/A';
    
    // Extract deposit - check multiple locations
    const depositValue = proposalDetails.deposit !== undefined 
      ? proposalDetails.deposit 
      : rawData.deposit !== undefined 
        ? rawData.deposit 
        : undefined;
    
    if (depositValue !== undefined) {
      try {
        const deposit = typeof depositValue === 'bigint' 
          ? depositValue 
          : BigInt(depositValue);
        details.deposit = formatAda(deposit);
      } catch {
        details.deposit = String(depositValue);
      }
    }
    
    // Extract reward account - check multiple locations
    details.rewardAccount = proposalDetails.rewardAccount 
      || rawData.reward_account 
      || null;
    
    // Extract anchor information - check multiple locations
    const anchor = proposalDetails.anchor 
      || rawData.anchor 
      || null;
    
    if (anchor) {
      // Handle different anchor structures
      if (anchor.url) {
        details.anchorUrl = anchor.url;
      } else if (anchor.anchor_url) {
        details.anchorUrl = anchor.anchor_url;
      }
      
      if (anchor.hash) {
        details.anchorHash = anchor.hash;
      } else if (anchor.anchor_data_hash) {
        details.anchorHash = anchor.anchor_data_hash;
      } else if (anchor.data_hash) {
        details.anchorHash = anchor.data_hash;
      }
      
      if (anchor.bytes) {
        details.anchorBytes = anchor.bytes;
      } else if (anchor.cbor) {
        details.anchorBytes = anchor.cbor;
      }
    } else if (proposalDetails.anchorMissing) {
      details.anchorStatus = 'No anchor provided';
    }
    
    // Extract parent action ID if present
    if (proposalDetails.parentActionId) {
      details.parentActionId = proposalDetails.parentActionId;
    }
    
    return details;
  };

  // Format ParameterChange proposal
  const formatParameterChangeProposal = (proposal: any): Record<string, any> => {
    const details = formatCommonProposalFields(proposal);
    const proposalDetails = proposal.details || {};
    const rawData = proposalDetails.raw || {};
    
    // Extract parameter changes - prefer raw data structure which has better field names
    let paramChanges: Record<string, any> = {};
    
    // First try to get from raw protocol_param_updates (has snake_case names like max_tx_ex_units)
    if (rawData.governance_action?.ParameterChangeAction?.protocol_param_updates) {
      const rawParams = rawData.governance_action.ParameterChangeAction.protocol_param_updates;
      Object.entries(rawParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          // Map snake_case to readable names
          const paramNameMap: Record<string, string> = {
            'minfee_a': 'minFeeA',
            'minfee_b': 'minFeeB',
            'max_block_body_size': 'maxBlockBodySize',
            'max_tx_size': 'maxTransactionSize',
            'max_block_header_size': 'maxBlockHeaderSize',
            'key_deposit': 'keyDeposit',
            'pool_deposit': 'poolDeposit',
            'max_epoch': 'maximumEpoch',
            'n_opt': 'nOpt',
            'pool_pledge_influence': 'poolPledgeInfluence',
            'expansion_rate': 'expansionRate',
            'treasury_growth_rate': 'treasuryGrowthRate',
            'min_pool_cost': 'minPoolCost',
            'ada_per_utxo_byte': 'adaPerUtxoByte',
            'cost_models': 'costModels',
            'execution_costs': 'executionUnitPrices',
            'max_tx_ex_units': 'maxTxExecutionUnits',
            'max_block_ex_units': 'maxBlockExecutionUnits',
            'max_value_size': 'maxValueSize',
            'collateral_percentage': 'collateralPercentage',
            'max_collateral_inputs': 'maxCollateralInputs',
            'pool_voting_thresholds': 'poolVotingThresholds',
            'drep_voting_thresholds': 'drepVotingThresholds',
            'min_committee_size': 'minCommitteeSize',
            'committee_term_limit': 'committeeTermLimit',
            'governance_action_validity_period': 'governanceActionValidityPeriod',
            'governance_action_deposit': 'governanceActionDeposit',
            'drep_deposit': 'drepDeposit',
            'drep_inactivity_period': 'drepInactivityPeriod',
            'ref_script_coins_per_byte': 'minFeeRefScriptCoinsPerByte'
          };
          
          const readableName = paramNameMap[key] || key;
          
          // Keep execution units as objects (don't format them)
          if (key === 'max_tx_ex_units' || key === 'max_block_ex_units') {
            paramChanges[readableName] = value;
          } else {
            // Format other parameters
            const paramKeyMap: Record<string, number> = {
              'minfee_a': 0, 'minfee_b': 1, 'max_block_body_size': 2, 'max_tx_size': 3,
              'max_block_header_size': 4, 'key_deposit': 5, 'pool_deposit': 6,
              'max_epoch': 7, 'n_opt': 8, 'pool_pledge_influence': 9, 'expansion_rate': 10,
              'treasury_growth_rate': 11, 'min_pool_cost': 16, 'ada_per_utxo_byte': 17,
              'cost_models': 18, 'execution_costs': 19, 'max_tx_ex_units': 20,
              'max_block_ex_units': 21, 'max_value_size': 22, 'collateral_percentage': 23,
              'max_collateral_inputs': 24, 'pool_voting_thresholds': 25, 'drep_voting_thresholds': 26,
              'min_committee_size': 27, 'committee_term_limit': 28,
              'governance_action_validity_period': 29, 'governance_action_deposit': 30,
              'drep_deposit': 31, 'drep_inactivity_period': 32, 'ref_script_coins_per_byte': 33
            };
            const paramKey = paramKeyMap[key];
            if (paramKey !== undefined) {
              paramChanges[readableName] = formatProtocolParamValue(paramKey, value);
            } else {
              paramChanges[readableName] = value;
            }
          }
        }
      });
    } else if (proposalDetails.parameterChanges) {
      // Fallback to already parsed parameterChanges
      Object.entries(proposalDetails.parameterChanges).forEach(([key, value]) => {
        const paramKeyNum = parseInt(key);
        const paramName = PROTOCOL_PARAM_NAMES[paramKeyNum] || `Parameter ${key}`;
        // Keep execution units as objects
        if ((paramKeyNum === 20 || paramKeyNum === 21) && value && typeof value === 'object' && !Array.isArray(value)) {
          paramChanges[paramName] = value;
        } else {
          paramChanges[paramName] = formatProtocolParamValue(paramKeyNum, value);
        }
      });
    }
    
    if (Object.keys(paramChanges).length > 0) {
      details.parameterChanges = paramChanges;
    }
    
    if (proposalDetails.epoch !== null && proposalDetails.epoch !== undefined) {
      details.epoch = proposalDetails.epoch;
    }
    
    return details;
  };

  // Format HardForkInitiation proposal
  const formatHardForkProposal = (proposal: any): Record<string, any> => {
    const details = formatCommonProposalFields(proposal);
    const proposalDetails = proposal.details || {};
    const rawData = proposalDetails.raw || {};
    
    // Extract protocol version - handle multiple formats
    let protocolVersion: string | null = null;
    
    // First try proposalDetails.protocolVersion
    if (proposalDetails.protocolVersion) {
      const version = proposalDetails.protocolVersion;
      if (Array.isArray(version) && version.length === 2) {
        protocolVersion = `${version[0]}.${version[1]}`;
      } else if (typeof version === 'object' && version !== null) {
        // Handle object format: { major: 11, minor: 0 }
        const major = version.major !== undefined ? version.major : version[0];
        const minor = version.minor !== undefined ? version.minor : version[1];
        if (major !== undefined && minor !== undefined) {
          protocolVersion = `${major}.${minor}`;
        }
      } else {
        protocolVersion = String(version);
      }
    }
    
    // Also check raw data structure
    if (!protocolVersion) {
      const rawVersion = rawData.governance_action?.HardForkInitiationAction?.protocol_version;
      if (rawVersion) {
        if (Array.isArray(rawVersion) && rawVersion.length === 2) {
          protocolVersion = `${rawVersion[0]}.${rawVersion[1]}`;
        } else if (typeof rawVersion === 'object' && rawVersion !== null) {
          const major = rawVersion.major !== undefined ? rawVersion.major : rawVersion[0];
          const minor = rawVersion.minor !== undefined ? rawVersion.minor : rawVersion[1];
          if (major !== undefined && minor !== undefined) {
            protocolVersion = `${major}.${minor}`;
          }
        } else {
          protocolVersion = String(rawVersion);
        }
      }
    }
    
    if (protocolVersion) {
      details.protocolVersion = protocolVersion;
    }
    
    if (proposalDetails.epoch !== null && proposalDetails.epoch !== undefined) {
      details.epoch = proposalDetails.epoch;
    }
    
    return details;
  };

  // Format TreasuryWithdrawals proposal
  const formatTreasuryWithdrawalsProposal = (proposal: any): Record<string, any> => {
    const details = formatCommonProposalFields(proposal);
    const proposalDetails = proposal.details || {};
    const rawData = proposalDetails.raw || {};
    
    // Extract withdrawals - handle both object format (stake address -> lovelace) and array format
    const withdrawals: Record<string, string> = {};
    
    // First try raw data structure (object format: stake address -> lovelace amount)
    const rawWithdrawals = rawData.governance_action?.TreasuryWithdrawalsAction?.withdrawals;
    if (rawWithdrawals && typeof rawWithdrawals === 'object' && !Array.isArray(rawWithdrawals)) {
      Object.entries(rawWithdrawals).forEach(([account, amount]) => {
        try {
          const bigintAmount = typeof amount === 'bigint' ? amount : BigInt(String(amount));
          withdrawals[account] = formatAda(bigintAmount);
        } catch {
          withdrawals[account] = String(amount);
        }
      });
    }
    
    // Also check proposalDetails.withdrawals (could be object or array)
    if (proposalDetails.withdrawals) {
      if (Array.isArray(proposalDetails.withdrawals)) {
        // Array format
        proposalDetails.withdrawals.forEach((withdrawal: any) => {
          if (withdrawal.reward_account || withdrawal.account) {
            const account = withdrawal.reward_account || withdrawal.account;
            const amount = withdrawal.amount || withdrawal.coin || 0;
            try {
              const bigintAmount = typeof amount === 'bigint' ? amount : BigInt(amount);
              withdrawals[account] = formatAda(bigintAmount);
            } catch {
              withdrawals[account] = String(amount);
            }
          }
        });
      } else if (typeof proposalDetails.withdrawals === 'object') {
        // Object format: stake address -> lovelace amount
        Object.entries(proposalDetails.withdrawals).forEach(([account, amount]) => {
          try {
            const bigintAmount = typeof amount === 'bigint' ? amount : BigInt(String(amount));
            withdrawals[account] = formatAda(bigintAmount);
          } catch {
            withdrawals[account] = String(amount);
          }
        });
      }
    }
    
    if (Object.keys(withdrawals).length > 0) {
      details.withdrawals = withdrawals;
    }
    
    if (proposalDetails.epoch !== null && proposalDetails.epoch !== undefined) {
      details.epoch = proposalDetails.epoch;
    }
    
    return details;
  };

  // Format NoConfidence proposal
  const formatNoConfidenceProposal = (proposal: any): Record<string, any> => {
    const details = formatCommonProposalFields(proposal);
    const proposalDetails = proposal.details || {};
    
    if (proposalDetails.epoch !== null && proposalDetails.epoch !== undefined) {
      details.epoch = proposalDetails.epoch;
    }
    
    return details;
  };

  // Format NewConstitution proposal
  const formatNewConstitutionProposal = (proposal: any): Record<string, any> => {
    const details = formatCommonProposalFields(proposal);
    const proposalDetails = proposal.details || {};
    const rawData = proposalDetails.raw || {};
    
    // Extract constitution anchor URL and hash from constitution object
    const constitution = proposalDetails.constitution || rawData.governance_action?.NewConstitutionAction?.constitution;
    
    if (constitution) {
      // Extract constitution anchor URL
      const constitutionAnchorUrl = constitution.anchor?.anchor_url 
        || constitution.anchor?.url
        || constitution.anchor_url
        || null;
      
      if (constitutionAnchorUrl) {
        details.constitutionUrl = constitutionAnchorUrl;
      }
      
      // Extract constitution anchor hash
      const constitutionAnchorHash = constitution.anchor?.anchor_data_hash
        || constitution.anchor?.hash
        || constitution.anchor?.data_hash
        || constitution.anchor_data_hash
        || constitution.hash
        || null;
      
      if (constitutionAnchorHash) {
        details.constitutionHash = constitutionAnchorHash;
      }
    }
    
    // Fallback: try proposalDetails.constitutionHash
    if (!details.constitutionHash && proposalDetails.constitutionHash) {
      details.constitutionHash = proposalDetails.constitutionHash;
    }
    
    // Extract script hash
    if (proposalDetails.scriptHash) {
      details.scriptHash = proposalDetails.scriptHash;
    } else if (constitution?.script_hash) {
      details.scriptHash = constitution.script_hash;
    } else if (rawData.governance_action?.NewConstitutionAction?.constitution?.script_hash) {
      details.scriptHash = rawData.governance_action.NewConstitutionAction.constitution.script_hash;
    }
    
    if (proposalDetails.epoch !== null && proposalDetails.epoch !== undefined) {
      details.epoch = proposalDetails.epoch;
    }
    
    return details;
  };

  // Format UpdateCommittee proposal
  const formatUpdateCommitteeProposal = (proposal: any): Record<string, any> => {
    const details = formatCommonProposalFields(proposal);
    const proposalDetails = proposal.details || {};
    const rawData = proposalDetails.raw || {};
    
    // Extract members to remove with detailed information
    const membersToRemove: Array<{ type: string; hash: string; bech32?: string; credential?: any }> = [];
    
    // First try raw data structure
    const rawMembersToRemove = rawData.governance_action?.UpdateCommitteeAction?.members_to_remove;
    if (rawMembersToRemove && Array.isArray(rawMembersToRemove)) {
      rawMembersToRemove.forEach((member: any) => {
        const credential = member.stake_credential || member;
        const credentialType = credential.Key ? 'Key' : credential.Script ? 'Script' : 'Unknown';
        const credentialHash = credential.Key || credential.Script || credential.hash || '';
        if (credentialHash) {
          // Create CIP-129 bech32 ID for cold credential
          const bech32Id = (credentialType === 'Key' || credentialType === 'Script') 
            ? createCommitteeColdCredentialId(credentialHash, credentialType as 'Key' | 'Script')
            : null;
          
          membersToRemove.push({
            type: credentialType,
            hash: credentialHash,
            bech32: bech32Id || undefined,
            credential: credential
          });
        }
      });
    }
    
    // Also check proposalDetails.membersToRemove
    if (proposalDetails.membersToRemove && Array.isArray(proposalDetails.membersToRemove)) {
      if (membersToRemove.length === 0) {
        // Only use this if raw data didn't have it
        proposalDetails.membersToRemove.forEach((member: any) => {
          const credentialType = member.Key ? 'Key' : member.Script ? 'Script' : 'Unknown';
          const credentialHash = member.Key || member.Script || member.hash || '';
          if (credentialHash) {
            // Create CIP-129 bech32 ID for cold credential
            const bech32Id = (credentialType === 'Key' || credentialType === 'Script') 
              ? createCommitteeColdCredentialId(credentialHash, credentialType as 'Key' | 'Script')
              : null;
            
            membersToRemove.push({
              type: credentialType,
              hash: credentialHash,
              bech32: bech32Id || undefined,
              credential: member
            });
          }
        });
      }
    }
    
    if (membersToRemove.length > 0) {
      details.membersToRemove = membersToRemove;
    }
    
    // Extract committee members with detailed information (including term limits)
    // Note: committee.members represents the full committee AFTER the update
    // This includes both existing and newly added members
    const committeeMembers: Array<{ type: string; hash: string; bech32?: string; termLimit?: number; credential?: any }> = [];
    
    // First try raw data structure - committee.members shows the full committee
    const rawCommittee = rawData.governance_action?.UpdateCommitteeAction?.committee;
    if (rawCommittee?.members && Array.isArray(rawCommittee.members)) {
      rawCommittee.members.forEach((member: any) => {
        const credential = member.stake_credential || member;
        const credentialType = credential.Key ? 'Key' : credential.Script ? 'Script' : 'Unknown';
        const credentialHash = credential.Key || credential.Script || credential.hash || '';
        const termLimit = member.term_limit !== undefined ? member.term_limit : null;
        if (credentialHash) {
          // Create CIP-129 bech32 ID for cold credential
          const bech32Id = (credentialType === 'Key' || credentialType === 'Script') 
            ? createCommitteeColdCredentialId(credentialHash, credentialType as 'Key' | 'Script')
            : null;
          
          committeeMembers.push({
            type: credentialType,
            hash: credentialHash,
            bech32: bech32Id || undefined,
            termLimit: termLimit !== null ? Number(termLimit) : undefined,
            credential: credential
          });
        }
      });
    }
    
    // Also check proposalDetails.membersToAdd (if explicitly provided as an array of new members)
    if (proposalDetails.membersToAdd && Array.isArray(proposalDetails.membersToAdd) && proposalDetails.membersToAdd.length > 0) {
      // If proposalDetails has membersToAdd, use that instead (it's more specific - just new members)
      committeeMembers.length = 0; // Clear and replace
      proposalDetails.membersToAdd.forEach((member: any) => {
        const credential = member.stake_credential || member;
        const credentialType = credential?.Key ? 'Key' : credential?.Script ? 'Script' : (member.Key ? 'Key' : member.Script ? 'Script' : 'Unknown');
        const credentialHash = credential?.Key || credential?.Script || member.Key || member.Script || member.hash || '';
        const termLimit = member.term_limit !== undefined ? member.term_limit : null;
        if (credentialHash) {
          // Create CIP-129 bech32 ID for cold credential
          const bech32Id = (credentialType === 'Key' || credentialType === 'Script') 
            ? createCommitteeColdCredentialId(credentialHash, credentialType as 'Key' | 'Script')
            : null;
          
          committeeMembers.push({
            type: credentialType,
            hash: credentialHash,
            bech32: bech32Id || undefined,
            termLimit: termLimit !== null ? Number(termLimit) : undefined,
            credential: credential || member
          });
        }
      });
    }
    
    // Store as membersToAdd for display (will show as "Committee Members" if from committee.members)
    if (committeeMembers.length > 0) {
      details.membersToAdd = committeeMembers;
      // Add a flag to indicate if this is the full committee or just additions
      details.isFullCommittee = !!rawCommittee?.members;
    }
    
    // Extract threshold from raw data
    const rawThreshold = rawCommittee?.quorum_threshold;
    if (rawThreshold && rawThreshold.numerator && rawThreshold.denominator) {
      details.threshold = `${rawThreshold.numerator}/${rawThreshold.denominator}`;
    } else if (proposalDetails.threshold !== null && proposalDetails.threshold !== undefined) {
      details.threshold = proposalDetails.threshold;
    }
    
    if (proposalDetails.epoch !== null && proposalDetails.epoch !== undefined) {
      details.epoch = proposalDetails.epoch;
    }
    
    return details;
  };

  // Format InfoAction proposal
  const formatInfoActionProposal = (proposal: any): Record<string, any> => {
    const details = formatCommonProposalFields(proposal);
    const proposalDetails = proposal.details || {};
    
    if (proposalDetails.info) {
      details.info = proposalDetails.info;
    }
    
    return details;
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
        let extractedDetails: Record<string, any> = {};
        let icon = <FileText className="h-4 w-4" />;
        let color = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        let description = `Governance action: ${proposal.type}`;
        
        // Format based on proposal type
        switch (proposal.type) {
          case 'ParameterChange':
            extractedDetails = formatParameterChangeProposal(proposal);
            icon = <Settings className="h-4 w-4" />;
            color = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            description = `Proposes changes to protocol parameters`;
            break;
          case 'HardForkInitiation':
            extractedDetails = formatHardForkProposal(proposal);
            icon = <Zap className="h-4 w-4" />;
            color = 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            description = `Initiates a protocol hard fork`;
            break;
          case 'TreasuryWithdrawals':
            extractedDetails = formatTreasuryWithdrawalsProposal(proposal);
            icon = <Banknote className="h-4 w-4" />;
            color = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            description = `Requests withdrawals from the treasury`;
            break;
          case 'NoConfidence':
            extractedDetails = formatNoConfidenceProposal(proposal);
            icon = <XCircle className="h-4 w-4" />;
            color = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            description = `Motion of no confidence in the Constitutional Committee`;
            break;
          case 'NewConstitution':
            extractedDetails = formatNewConstitutionProposal(proposal);
            icon = <ScrollText className="h-4 w-4" />;
            color = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
            description = `Updates the on-chain constitution and or guardrails script hash`;
            break;
          case 'UpdateCommittee':
            extractedDetails = formatUpdateCommitteeProposal(proposal);
            icon = <Users className="h-4 w-4" />;
            color = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
            description = `Updates Constitutional Committee membership or threshold`;
            break;
          case 'InfoAction':
            extractedDetails = formatInfoActionProposal(proposal);
            icon = <Info className="h-4 w-4" />;
            color = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
            description = `Informational action for gauging sentiment`;
            break;
          default:
            extractedDetails = formatCommonProposalFields(proposal);
            description = `Governance action: ${proposal.type}`;
        }
        
        // Create cleaner type names
        const actionTypeNames: Record<string, string> = {
          'ParameterChange': 'Parameter Change',
          'HardForkInitiation': 'Hard Fork Initiation',
          'TreasuryWithdrawals': 'Treasury Withdrawals',
          'NoConfidence': 'Motion of No Confidence',
          'NewConstitution': 'New Constitution',
          'UpdateCommittee': 'Update Committee',
          'InfoAction': 'Info Action'
        };
        
        const cleanType = actionTypeNames[proposal.type] || proposal.type;
        
        items.push({
          index,
          type: cleanType,
          description,
          data: proposal,
          details: extractedDetails,
          icon,
          color,
          anchorMissing: proposal.details?.anchorMissing || false
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
                <GovernanceActionItem 
                  key={index} 
                  action={action} 
                  index={index} 
                  copyToClipboard={copyToClipboard}
                  protocolParamNames={PROTOCOL_PARAM_NAMES}
                  formatProtocolParamValue={formatProtocolParamValue}
                />
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
                    {tx.signers.filter(s => s.isRequired && !s.isWitness).map((signer, index) => {
                      const signerLabel = getKnownSignerLabel(signer.hash);
                      const signerAddressLabel = getKnownAddressLabel(signer.address);

                      return (
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
                              {signerLabel && (
                                <KnownLabelHighlight category="signer" label={signerLabel} />
                              )}
                              {signer.address && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Linked Address</span>
                                    <div className="flex items-center gap-2">
                                      <code className="text-xs bg-muted px-2 py-1 rounded">
                                        {signer.address.slice(0, 16)}...
                                      </code>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(signer.address!, 'Signer address')}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <BlockExplorerLink 
                                        type="address" 
                                        params={{ address: signer.address }}
                                      />
                                    </div>
                                  </div>
                                  {signerAddressLabel && (
                                    <KnownLabelHighlight category="address" label={signerAddressLabel} />
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
                    {tx.signers.filter(s => s.isWitness).map((signer, index) => {
                      const signerLabel = getKnownSignerLabel(signer.hash);
                      const signerAddressLabel = getKnownAddressLabel(signer.address);

                      return (
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
                              {signerLabel && (
                                <KnownLabelHighlight category="signer" label={signerLabel} />
                              )}
                              
                              {signer.address && (
                                <div className="space-y-2">
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
                                  {signerAddressLabel && (
                                    <KnownLabelHighlight category="address" label={signerAddressLabel} />
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
