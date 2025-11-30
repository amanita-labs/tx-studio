// src/features/builder/components/WalletCredentialSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wallet, ChevronDown, Copy, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getDRepInfo, getStakeKeys } from '@/lib/wallet-connector';
import { toast } from 'sonner';
import type { DRepInfo, StakeKeysInfo, StakeKeyInfo } from '@/lib/wallet-connector';
import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import * as bech32Buffer from 'bech32-buffer';

interface WalletCredentialSelectorProps {
  onSelect: (value: string) => void;
  credentialType: 'drep' | 'stake';
  disabled?: boolean;
}

export function WalletCredentialSelector({ 
  onSelect, 
  credentialType,
  disabled = false 
}: WalletCredentialSelectorProps) {
  const { walletApi, walletConnected } = useAppStore();
  const { network } = useAppStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drepInfo, setDrepInfo] = useState<DRepInfo | null>(null);
  const [stakeKeys, setStakeKeys] = useState<StakeKeysInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  
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

  // Generate CIP-129 DRep ID from public key hash if not provided
  const generateCip129DRepId = (publicKeyHash: string): string | null => {
    try {
      // Validate hex format (28 bytes = 56 hex chars)
      if (!publicKeyHash || !/^[0-9a-fA-F]{56}$/i.test(publicKeyHash)) {
        return null;
      }
      
      const hashBytes = Buffer.from(publicKeyHash.toLowerCase(), 'hex');
      if (hashBytes.length !== 28) {
        return null;
      }
      
      // Use bech32-buffer to encode with 'drep' prefix (CIP-129)
      return bech32Buffer.encode('drep', hashBytes).toString();
    } catch (error) {
      console.warn('Failed to generate CIP-129 DRep ID:', error);
      return null;
    }
  };

  useEffect(() => {
    if (open && walletConnected && walletApi) {
      loadCredentials();
    }
  }, [open, walletConnected, walletApi]);

  const loadCredentials = async () => {
    if (!walletApi) return;

    try {
      setLoading(true);
      if (credentialType === 'drep') {
        const drep = await getDRepInfo(walletApi);
        setDrepInfo(drep);
      } else {
        const keys = await getStakeKeys(walletApi);
        setStakeKeys(keys);
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
      toast.error('Failed to load wallet credentials');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleSelect = (value: string) => {
    onSelect(value);
    setOpen(false);
  };

  if (!walletConnected || !walletApi) {
    return null;
  }

  // For DRep: if wallet supports CIP-95, we should always have a credential
  // Generate CIP-129 DRep ID from hash if not provided
  const drepIdCip129 = drepInfo?.dRepIDCip129 || 
    (drepInfo?.publicKeyHash ? generateCip129DRepId(drepInfo.publicKeyHash) : null);
  
  const hasCredentials = credentialType === 'drep' 
    ? drepInfo !== null && drepIdCip129 !== null
    : stakeKeys !== null && (stakeKeys.registered.length > 0 || stakeKeys.unregistered.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !walletConnected}
          className="whitespace-nowrap"
        >
          <Wallet className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Add wallet</span>
          <ChevronDown className="h-4 w-4 ml-1.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">
            {credentialType === 'drep' ? 'DRep Credentials' : 'Stake Credentials'}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Select a credential from your wallet
          </p>
        </div>
        <ScrollArea className="max-h-[300px]">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading credentials...
            </div>
          ) : !hasCredentials ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {credentialType === 'drep' 
                ? 'No DRep credentials found in wallet'
                : 'No stake credentials found in wallet'}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {credentialType === 'drep' && drepInfo && drepIdCip129 && (
                <>
                  {/* Only show CIP-129 DRep ID (canonical format) */}
                  <CredentialItem
                    label="DRep ID"
                    value={drepIdCip129}
                    onSelect={handleSelect}
                    onCopy={copyToClipboard}
                    copied={copied === drepIdCip129}
                  />
                </>
              )}
              {credentialType === 'stake' && stakeKeys && (
                <>
                  {stakeKeys.registered.length > 0 && (
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Registered Stake Addresses
                      </p>
                      {stakeKeys.registered.map((keyInfo, index) => {
                        const stakeKeyHash = keyInfo.pubStakeKeyHash || keyInfo.pubStakeKey;
                        const stakeAddress = getStakeAddress(stakeKeyHash);
                        
                        if (!stakeAddress) {
                          return null;
                        }
                        
                        return (
                          <CredentialItem
                            key={`registered-${index}`}
                            label={`Stake Address (Registered #${index + 1})`}
                            value={stakeAddress}
                            onSelect={handleSelect}
                            onCopy={copyToClipboard}
                            copied={copied === stakeAddress}
                          />
                        );
                      })}
                    </div>
                  )}
                  {stakeKeys.unregistered.length > 0 && (
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Unregistered Stake Addresses
                      </p>
                      {stakeKeys.unregistered.map((keyInfo, index) => {
                        const stakeKeyHash = keyInfo.pubStakeKeyHash || keyInfo.pubStakeKey;
                        const stakeAddress = getStakeAddress(stakeKeyHash);
                        
                        if (!stakeAddress) {
                          return null;
                        }
                        
                        return (
                          <CredentialItem
                            key={`unregistered-${index}`}
                            label={`Stake Address (Unregistered #${index + 1})`}
                            value={stakeAddress}
                            onSelect={handleSelect}
                            onCopy={copyToClipboard}
                            copied={copied === stakeAddress}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface CredentialItemProps {
  label: string;
  value: string;
  onSelect: (value: string) => void;
  onCopy: (value: string) => void;
  copied: boolean;
}

function CredentialItem({ label, value, onSelect, onCopy, copied }: CredentialItemProps) {
  const displayValue = value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-10)}` : value;

  return (
    <div className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors">
      <button
        onClick={() => onSelect(value)}
        className="flex-1 text-left min-w-0"
      >
        <div className="text-xs font-medium">{label}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {displayValue}
        </div>
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(value);
        }}
      >
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}

