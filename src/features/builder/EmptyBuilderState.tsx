// src/features/builder/EmptyBuilderState.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2 } from 'lucide-react';
import { getAvailableWallets, connectWallet } from '@/lib/wallet-connector';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import type { WalletInfo } from '@/lib/wallet-connector';

export function EmptyBuilderState() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const { setWalletApi } = useAppStore();

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    try {
      setLoading(true);
      const availableWallets = await getAvailableWallets();
      setWallets(availableWallets);
    } catch (error) {
      console.error('Error loading wallets:', error);
      toast.error('Failed to load available wallets');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (walletName: string) => {
    try {
      setConnecting(walletName);
      const wallet = await connectWallet(walletName);
      setWalletApi(wallet, walletName);
      toast.success(`Connected to ${walletName}`);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast.error(`Failed to connect to ${walletName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <Card className="h-full">
      <CardContent className="flex flex-col items-center justify-center h-full text-center p-8">
        <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          To build Cardano governance transactions, please connect a wallet that supports CIP-95.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading available wallets...</span>
          </div>
        ) : wallets.length === 0 ? (
          <div className="text-muted-foreground">
            <p className="mb-2">No wallets detected.</p>
            <p className="text-sm">Please install a Cardano wallet extension (e.g., Eternl, Nami, Lace) and refresh the page.</p>
            <Button onClick={loadWallets} variant="outline" className="mt-4">
              Refresh
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-2">
            {wallets.map((wallet) => (
              <Button
                key={wallet.name}
                onClick={() => handleConnect(wallet.name)}
                disabled={connecting === wallet.name}
                className="w-full justify-start"
                variant="outline"
              >
                {connecting === wallet.name ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    {wallet.icon && (
                      <img
                        src={wallet.icon}
                        alt={wallet.name}
                        className="h-5 w-5 mr-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <Wallet className="h-4 w-4 mr-2" />
                    <span className="capitalize">{wallet.name}</span>
                    {wallet.version && (
                      <span className="ml-auto text-xs text-muted-foreground">v{wallet.version}</span>
                    )}
                  </>
                )}
              </Button>
            ))}
            <Button onClick={loadWallets} variant="ghost" size="sm" className="mt-4">
              Refresh
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

