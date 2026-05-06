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
import * as CSL from '@emurgo/cardano-serialization-lib-browser';

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

  // Calculate CIP-129 Hex DRep ID with header bytes
  // CIP-129 format: header bytes (0x22 = key hash variant) + public key hash
  const getCip129HexDRepId = (publicKeyHash: string): string | null => {
    try {
      if (!publicKeyHash || !/^[0-9a-fA-F]{56}$/i.test(publicKeyHash)) {
        return null;
      }
      
      // CIP-129 header byte: 0x22 = key hash variant (0x02 << 4 | 0x02)
      // Based on the example: 22 + hash = 226ae62dbabef2220b86ad8ae31c59cf70ef0074baad506cbc9d4171d1
      const headerByte = 0x22; // Key hash variant
      const hashBytes = Buffer.from(publicKeyHash.toLowerCase(), 'hex');
      
      if (hashBytes.length !== 28) {
        return null;
      }
      
      // Prepend header byte to hash
      const cip129Bytes = Buffer.concat([Buffer.from([headerByte]), hashBytes]);
      return cip129Bytes.toString('hex');
    } catch (error) {
      console.warn('Failed to calculate CIP-129 hex DRep ID:', error);
      return null;
    }
  };

  // Extract stake key hash from pubStakeKey or pubStakeKeyHash
  // pubStakeKeyHash is preferred (56 hex chars = 28 bytes hash)
  // pubStakeKey might be the hash (56 chars) or public key (64 chars)
  const getStakeKeyHash = (keyInfo: { pubStakeKey: string; pubStakeKeyHash?: string }): string | null => {
    // Prefer pubStakeKeyHash if available and valid
    if (keyInfo.pubStakeKeyHash && /^[0-9a-fA-F]{56}$/i.test(keyInfo.pubStakeKeyHash)) {
      return keyInfo.pubStakeKeyHash.toLowerCase();
    }
    
    // If pubStakeKey is 56 hex chars, treat it as a hash
    if (keyInfo.pubStakeKey && /^[0-9a-fA-F]{56}$/i.test(keyInfo.pubStakeKey)) {
      return keyInfo.pubStakeKey.toLowerCase();
    }
    
    // If pubStakeKey is 64 hex chars (public key), we can't hash it without blake2b
    // Return null - the hash should be provided by the wallet
    return null;
  };

  useEffect(() => {
    if (walletConnected && walletApi) {
      loadWalletInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch {
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
                    <span className="text-sm font-mono">{formatAda(BigInt(walletInfo.balance))} ada</span>
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
                          
                          {/* Public DRep Key */}
                          {drepInfo.publicKey && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Public DRep Key</div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                                  {drepInfo.publicKey}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(drepInfo.publicKey, 'Public DRep Key')}
                                >
                                  {copied === 'Public DRep Key' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* CIP-129 Hex DRep ID (with header bytes) */}
                          {drepInfo.publicKeyHash && (() => {
                            const cip129Hex = getCip129HexDRepId(drepInfo.publicKeyHash);
                            return cip129Hex ? (
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">CIP-129 Hex DRep ID</div>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                                    {cip129Hex}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(cip129Hex, 'CIP-129 Hex DRep ID')}
                                  >
                                    {copied === 'CIP-129 Hex DRep ID' ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ) : null;
                          })()}
                          
                          {/* CIP-129 Bech32 DRep ID */}
                          {drepInfo.dRepIDCip129 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">CIP-129 Bech32 DRep ID</div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                                  {drepInfo.dRepIDCip129}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => drepInfo.dRepIDCip129 && copyToClipboard(drepInfo.dRepIDCip129, 'CIP-129 DRep ID')}
                                >
                                  {copied === 'CIP-129 DRep ID' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Legacy CIP-105 Hex DRep ID */}
                          {drepInfo.publicKeyHash && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Legacy CIP-105 Hex DRep ID</div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                                  {drepInfo.publicKeyHash}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => drepInfo.publicKeyHash && copyToClipboard(drepInfo.publicKeyHash, 'Legacy CIP-105 Hex DRep ID')}
                                >
                                  {copied === 'Legacy CIP-105 Hex DRep ID' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Legacy CIP-105 Bech32 DRep ID */}
                          {drepInfo.dRepIDCip105 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Legacy CIP-105 Bech32 DRep ID</div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                                  {drepInfo.dRepIDCip105}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(drepInfo.dRepIDCip105, 'Legacy CIP-105 DRep ID')}
                                >
                                  {copied === 'Legacy CIP-105 DRep ID' ? (
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
                                Registered Stake Keys ({stakeKeys.registered.length})
                              </div>
                              <div className="space-y-3">
                                {stakeKeys.registered.map((keyInfo, idx) => {
                                  // Extract stake key hash from keyInfo
                                  const stakeKeyHash = getStakeKeyHash(keyInfo);
                                  const stakeAddress = stakeKeyHash ? getStakeAddress(stakeKeyHash) : null;
                                  
                                  return (
                                    <div key={idx} className="space-y-2 p-2 bg-muted/30 rounded-md">
                                      {/* Stake Address */}
                                      {stakeAddress && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Stake Address</div>
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
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
                                        </div>
                                      )}
                                      
                                      {/* Stake Key Hash */}
                                      {stakeKeyHash && stakeKeyHash.length === 56 && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Stake Key Hash</div>
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono text-muted-foreground">
                                              {stakeKeyHash}
                                            </code>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => copyToClipboard(stakeKeyHash, `stake-key-hash-registered-${idx}`)}
                                            >
                                              {copied === `stake-key-hash-registered-${idx}` ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                              ) : (
                                                <Copy className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Public Stake Key */}
                                      {keyInfo.pubStakeKey && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Public Stake Key</div>
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono text-muted-foreground">
                                              {keyInfo.pubStakeKey}
                                            </code>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => copyToClipboard(keyInfo.pubStakeKey, `pub-stake-key-registered-${idx}`)}
                                            >
                                              {copied === `pub-stake-key-registered-${idx}` ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                              ) : (
                                                <Copy className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {stakeKeys.unregistered.length > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-2">
                                Unregistered Stake Keys ({stakeKeys.unregistered.length})
                              </div>
                              <div className="space-y-3">
                                {stakeKeys.unregistered.map((keyInfo, idx) => {
                                  // Extract stake key hash from keyInfo
                                  const stakeKeyHash = getStakeKeyHash(keyInfo);
                                  const stakeAddress = stakeKeyHash ? getStakeAddress(stakeKeyHash) : null;
                                  
                                  return (
                                    <div key={idx} className="space-y-2 p-2 bg-muted/30 rounded-md">
                                      {/* Stake Address */}
                                      {stakeAddress && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Stake Address</div>
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
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
                                        </div>
                                      )}
                                      
                                      {/* Stake Key Hash */}
                                      {stakeKeyHash && stakeKeyHash.length === 56 && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Stake Key Hash</div>
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono text-muted-foreground">
                                              {stakeKeyHash}
                                            </code>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => copyToClipboard(stakeKeyHash, `stake-key-hash-unregistered-${idx}`)}
                                            >
                                              {copied === `stake-key-hash-unregistered-${idx}` ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                              ) : (
                                                <Copy className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Public Stake Key */}
                                      {keyInfo.pubStakeKey && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Public Stake Key</div>
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono text-muted-foreground">
                                              {keyInfo.pubStakeKey}
                                            </code>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => copyToClipboard(keyInfo.pubStakeKey, `pub-stake-key-unregistered-${idx}`)}
                                            >
                                              {copied === `pub-stake-key-unregistered-${idx}` ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                              ) : (
                                                <Copy className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
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

