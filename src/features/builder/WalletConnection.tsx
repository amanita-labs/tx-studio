// src/features/builder/WalletConnection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Wallet, LogOut, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getWalletInfo, getDRepInfo, getStakeKeys, type DRepInfo, type StakeKeysInfo } from '@/lib/wallet-connector';
import { toast } from 'sonner';
import { formatAda } from '@/lib/utils/ada';

export function WalletConnection() {
  const { walletApi, walletName, walletConnected, setWalletApi } = useAppStore();
  const [walletInfo, setWalletInfo] = useState<{
    name: string;
    networkId: number;
    balance: string;
    network: string;
  } | null>(null);
  const [drepInfo, setDrepInfo] = useState<DRepInfo | null>(null);
  const [stakeKeys, setStakeKeys] = useState<StakeKeysInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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

            {drepInfo && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">DRep ID (CIP-105)</span>
                    <Badge variant="secondary">CIP-95</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      {drepInfo.dRepIDCip105}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(drepInfo.dRepIDCip105, 'DRep ID')}
                    >
                      {copied === 'DRep ID' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {drepInfo.dRepIDCip129 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">DRep ID (CIP-129)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                          {drepInfo.dRepIDCip129}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(drepInfo.dRepIDCip129, 'DRep ID CIP-129')}
                        >
                          {copied === 'DRep ID CIP-129' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {stakeKeys && (stakeKeys.registered.length > 0 || stakeKeys.unregistered.length > 0) && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium mb-2">Stake Keys</div>
                  {stakeKeys.registered.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-muted-foreground mb-1">Registered ({stakeKeys.registered.length})</div>
                      <div className="space-y-1">
                        {stakeKeys.registered.slice(0, 2).map((key, idx) => (
                          <code key={idx} className="text-xs bg-muted px-2 py-1 rounded block truncate">
                            {key}
                          </code>
                        ))}
                        {stakeKeys.registered.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{stakeKeys.registered.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {stakeKeys.unregistered.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Unregistered ({stakeKeys.unregistered.length})</div>
                      <div className="space-y-1">
                        {stakeKeys.unregistered.slice(0, 2).map((key, idx) => (
                          <code key={idx} className="text-xs bg-muted px-2 py-1 rounded block truncate">
                            {key}
                          </code>
                        ))}
                        {stakeKeys.unregistered.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{stakeKeys.unregistered.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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

