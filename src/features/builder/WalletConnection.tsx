// src/features/builder/WalletConnection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Wallet, LogOut, Copy, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getWalletInfo, getDRepInfo, getStakeKeys, type DRepInfo, type StakeKeysInfo } from '@/lib/wallet-connector';
import { toast } from 'sonner';
import { formatAda } from '@/lib/utils/ada';
import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';

export function WalletConnection() {
  const { walletApi, walletName, walletConnected, setWalletApi } = useAppStore();
  const [walletInfo, setWalletInfo] = useState<{
    name: string;
    networkId: number;
    balance: string;
    network: string;
  } | null>(null);
  const { network } = useAppStore();
  const [drepInfo, setDrepInfo] = useState<DRepInfo | null>(null);
  const [stakeKeys, setStakeKeys] = useState<StakeKeysInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showKeyDetails, setShowKeyDetails] = useState(false);
  
  // Convert stake key hash to stake address (stake1...)
  const getStakeAddress = (stakeKeyHash: string): string | null => {
    try {
      // Validate hex format
      if (!/^[0-9a-fA-F]{56}$/.test(stakeKeyHash)) {
        return null;
      }
      
      const networkId = network === 'mainnet' ? 1 : 0;
      const hashBytes = Buffer.from(stakeKeyHash, 'hex');
      
      if (hashBytes.length !== 28) {
        return null;
      }
      
      const keyHash = CSL.Ed25519KeyHash.from_bytes(hashBytes);
      const stakeCredential = CSL.Credential.from_keyhash(keyHash);
      const rewardAddress = CSL.RewardAddress.new(networkId, stakeCredential);
      const stakeAddress = rewardAddress.to_address().to_bech32();
      
      // Clean up CSL objects
      keyHash.free();
      stakeCredential.free();
      rewardAddress.free();
      
      return stakeAddress;
    } catch (error) {
      console.warn('Failed to convert stake key hash to address:', error);
      return null;
    }
  };

  useEffect(() => {
    if (walletConnected && walletApi) {
      loadWalletInfo();
    }
  }, [walletConnected, walletApi]);

  const loadWalletInfo = async () => {
    if (!walletApi) return;

    try {
      setLoading(true);
      const [info, drep, keys] = await Promise.all([
        getWalletInfo(walletApi),
        getDRepInfo(walletApi),
        getStakeKeys(walletApi)
      ]);
      setWalletInfo(info);
      setDrepInfo(drep);
      setStakeKeys(keys);
    } catch (error) {
      console.error('Error loading wallet info:', error);
      toast.error('Failed to load wallet information');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setWalletApi(null, null);
    setWalletInfo(null);
    setDrepInfo(null);
    setStakeKeys(null);
    toast.success('Wallet disconnected');
  };

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

  if (!walletConnected || !walletApi) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connected Wallet
          </CardTitle>
          <Button onClick={handleDisconnect} variant="ghost" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Wallet</span>
                <Badge variant="outline" className="capitalize">{walletName}</Badge>
              </div>
              {walletInfo && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Network</span>
                    <Badge variant="outline">
                      {walletInfo.networkId === 1 ? 'Mainnet' : 'Testnet'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Balance</span>
                    <span className="text-sm font-mono">{formatAda(BigInt(walletInfo.balance))} ADA</span>
                  </div>
                </>
              )}
            </div>

            {(drepInfo?.dRepIDCip129 || stakeKeys) && (
              <>
                <Separator />
                <div>
                  {/* Default view: Only CIP-129 DRep ID */}
                  {drepInfo?.dRepIDCip129 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">DRep ID</span>
                        <Badge variant="secondary">CIP-95</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                          {drepInfo.dRepIDCip129}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => drepInfo.dRepIDCip129 && copyToClipboard(drepInfo.dRepIDCip129, 'DRep ID')}
                        >
                          {copied === 'DRep ID' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Collapsible section for all key details */}
                  <Collapsible open={showKeyDetails} onOpenChange={setShowKeyDetails}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        {showKeyDetails ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Hide All Key Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Show All Key Details
                          </>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-4">
                      {/* DRep Key Details */}
                      {drepInfo && (
                        <div className="space-y-3 pt-2 border-t">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            DRep Credentials
                          </div>
                          
                          {drepInfo.publicKey && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">pubDrepKey</div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                                  {drepInfo.publicKey}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(drepInfo.publicKey, 'pubDrepKey')}
                                >
                                  {copied === 'pubDrepKey' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {drepInfo.publicKeyHash && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Public Key Hash</div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                                  {drepInfo.publicKeyHash}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => drepInfo.publicKeyHash && copyToClipboard(drepInfo.publicKeyHash, 'pubDrepKeyHash')}
                                >
                                  {copied === 'pubDrepKeyHash' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {drepInfo.dRepIDCip105 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">DRep ID (CIP-105)</div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                                  {drepInfo.dRepIDCip105}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(drepInfo.dRepIDCip105, 'DRep ID CIP-105')}
                                >
                                  {copied === 'DRep ID CIP-105' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Stake Key Details */}
                      {stakeKeys && (stakeKeys.registered.length > 0 || stakeKeys.unregistered.length > 0) && (
                        <div className="space-y-3 pt-2 border-t">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Stake Credentials
                          </div>
                          
                          {stakeKeys.registered.length > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-2">
                                Registered Stake Addresses ({stakeKeys.registered.length})
                              </div>
                              <div className="space-y-2">
                                {stakeKeys.registered.map((keyInfo, idx) => {
                                  const stakeKeyHash = keyInfo.pubStakeKeyHash || keyInfo.pubStakeKey;
                                  const stakeAddress = getStakeAddress(stakeKeyHash);
                                  
                                  return (
                                    <div key={idx} className="space-y-1">
                                      {stakeAddress && (
                                        <div className="flex items-center gap-2">
                                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                                            {stakeAddress}
                                          </code>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(stakeAddress, `stake-address-registered-${idx}`)}
                                          >
                                            {copied === `stake-address-registered-${idx}` ? (
                                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            ) : (
                                              <Copy className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate text-muted-foreground">
                                          {keyInfo.pubStakeKey}
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => copyToClipboard(keyInfo.pubStakeKey, `pubStakeKey-registered-${idx}`)}
                                        >
                                          {copied === `pubStakeKey-registered-${idx}` ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {stakeKeys.unregistered.length > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-2">
                                Unregistered Stake Addresses ({stakeKeys.unregistered.length})
                              </div>
                              <div className="space-y-2">
                                {stakeKeys.unregistered.map((keyInfo, idx) => {
                                  const stakeKeyHash = keyInfo.pubStakeKeyHash || keyInfo.pubStakeKey;
                                  const stakeAddress = getStakeAddress(stakeKeyHash);
                                  
                                  return (
                                    <div key={idx} className="space-y-1">
                                      {stakeAddress && (
                                        <div className="flex items-center gap-2">
                                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                                            {stakeAddress}
                                          </code>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(stakeAddress, `stake-address-unregistered-${idx}`)}
                                          >
                                            {copied === `stake-address-unregistered-${idx}` ? (
                                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            ) : (
                                              <Copy className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate text-muted-foreground">
                                          {keyInfo.pubStakeKey}
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => copyToClipboard(keyInfo.pubStakeKey, `pubStakeKey-unregistered-${idx}`)}
                                        >
                                          {copied === `pubStakeKey-unregistered-${idx}` ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </>
            )}

            <Button onClick={loadWalletInfo} variant="outline" size="sm" className="w-full">
              Refresh Info
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

