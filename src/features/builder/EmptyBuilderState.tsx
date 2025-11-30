// src/features/builder/EmptyBuilderState.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Wallet, Loader2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { getAvailableWallets, connectWallet } from '@/lib/wallet-connector';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { WalletInfo } from '@/lib/wallet-connector';

export function EmptyBuilderState() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [selectedCIPs, setSelectedCIPs] = useState<number[]>([30, 95]); // Default: CIP-30 (required) and CIP-95 (governance)
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const { setWalletApi } = useAppStore();

  const cipOptions = [
    { value: 30, label: 'CIP-30', description: 'Base wallet API (required)', required: true },
    { value: 95, label: 'CIP-95', description: 'Governance features (DRep, voting)', required: false },
  ];

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

  const handleCIPToggle = (cip: number) => {
    if (cip === 30) {
      // CIP-30 is always required, don't allow unchecking
      return;
    }
    setSelectedCIPs(prev => 
      prev.includes(cip) 
        ? prev.filter(c => c !== cip)
        : [...prev, cip]
    );
  };

  const handleConnect = async (walletName: string) => {
    try {
      setConnecting(walletName);
      const wallet = await connectWallet(walletName, selectedCIPs);
      setWalletApi(wallet, walletName);
      toast.success(`Connected to ${walletName} with CIPs: ${selectedCIPs.join(', ')}`);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast.error(`Failed to connect to ${walletName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Connect Your Wallet
        </CardTitle>
        <CardDescription>
          Select CIP extensions to enable, then connect your wallet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CIP Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Enable CIP Extensions</Label>
          <div className="space-y-2">
            {cipOptions.map((cip) => (
              <div key={cip.value} className="flex items-start space-x-3">
                <Checkbox
                  id={`cip-${cip.value}`}
                  checked={selectedCIPs.includes(cip.value)}
                  onCheckedChange={() => handleCIPToggle(cip.value)}
                  disabled={cip.required}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`cip-${cip.value}`}
                    className="text-sm font-medium cursor-pointer flex items-center gap-2"
                  >
                    {cip.label}
                    {cip.required && (
                      <span className="text-xs text-muted-foreground">(required)</span>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cip.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              CIP-95 is recommended for governance transactions (DRep registration, voting, etc.)
            </p>
          </div>
        </div>

        <Separator />

        {/* Wallet List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading available wallets...</span>
          </div>
        ) : wallets.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            <p className="mb-2 text-sm">No wallets detected.</p>
            <p className="text-xs mb-4">Please install a Cardano wallet extension (e.g., Eternl, Nami, Lace) and refresh the page.</p>
            <Button onClick={loadWallets} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Available Wallets</Label>
            {wallets.map((wallet) => {
              const isExpanded = expandedWallet === wallet.name;
              const supportsCIP95 = wallet.supportedExtensions?.some(ext => ext.cip === 95) ?? false;
              const allSupportedCIPs = wallet.supportedExtensions?.map(ext => ext.cip) ?? [];
              
              // Check if selected CIPs are supported
              const unsupportedSelectedCIPs = selectedCIPs.filter(cip => {
                if (cip === 30) return false; // Always assume CIP-30 is supported
                return !wallet.supportedExtensions?.some(ext => ext.cip === cip);
              });
              
              const hasUnsupportedCIPs = unsupportedSelectedCIPs.length > 0;
              
              return (
                <div key={wallet.name} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 p-2">
                    <Button
                      onClick={() => {
                        if (hasUnsupportedCIPs) {
                          toast.warning(`${wallet.name} doesn't support CIP-${unsupportedSelectedCIPs.join(', CIP-')}. These will be ignored.`);
                        }
                        handleConnect(wallet.name);
                      }}
                      disabled={connecting === wallet.name || connecting !== null}
                      className="flex-1 justify-start"
                      variant={hasUnsupportedCIPs ? "outline" : "default"}
                      size="sm"
                    >
                      {connecting === wallet.name ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          {wallet.icon && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={wallet.icon}
                              alt={wallet.name}
                              className="h-4 w-4 mr-2"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <Wallet className="h-4 w-4 mr-2" />
                          <span className="capitalize text-sm">{wallet.name}</span>
                          {wallet.version && (
                            <span className="ml-auto text-xs text-muted-foreground">v{wallet.version}</span>
                          )}
                          {hasUnsupportedCIPs && (
                            <span className="ml-1 text-xs text-destructive">⚠️</span>
                          )}
                        </>
                      )}
                    </Button>
                    
                    {wallet.supportedExtensions && wallet.supportedExtensions.length > 0 && (
                      <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedWallet(open ? wallet.name : null)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="px-2">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-2 pb-2">
                          <div className="space-y-2 mt-2">
                            <div className="text-xs font-medium text-muted-foreground">Supported Extensions:</div>
                            <div className="flex flex-wrap gap-1">
                              {allSupportedCIPs.length > 0 ? (
                                allSupportedCIPs.map((cip) => {
                                  const isSelected = selectedCIPs.includes(cip);
                                  const isRequired = cip === 30;
                                  return (
                                    <Badge
                                      key={cip}
                                      variant={
                                        isRequired ? "default" : 
                                        cip === 95 ? "secondary" : 
                                        isSelected ? "default" : 
                                        "outline"
                                      }
                                      className="text-xs"
                                    >
                                      CIP-{cip}
                                      {isSelected && " ✓"}
                                    </Badge>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-muted-foreground">No extensions reported</span>
                              )}
                            </div>
                            
                            {hasUnsupportedCIPs && (
                              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                ⚠️ Selected CIP-{unsupportedSelectedCIPs.join(', CIP-')} {unsupportedSelectedCIPs.length === 1 ? 'is' : 'are'} not supported by this wallet
                              </div>
                            )}
                            
                            {!supportsCIP95 && selectedCIPs.includes(95) && (
                              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                ℹ️ CIP-95 not supported - governance features will be unavailable
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </div>
              );
            })}
            <Button onClick={loadWallets} variant="ghost" size="sm" className="w-full mt-2">
              Refresh Wallets
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

