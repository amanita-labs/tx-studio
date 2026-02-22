// src/features/inspector/HexInputPanel.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HexEditor } from '@/components/hex-editor';
import { Copy, Download, AlertCircle, CheckCircle2, ChevronDown, Share2 } from 'lucide-react';
import { isValidHex } from '@/lib/utils/hex';
import { isValidTransactionHash } from '@/lib/blockfrost/config';
import { SAMPLE_TRANSACTIONS } from '@/lib/sample-data';
import { useCSLWorker } from '@/hooks/use-csl-worker';
import { useBlockfrost } from '@/hooks/use-blockfrost';
import { computeTransactionHash } from '@/lib/utils/tx-hash';
import { toast } from 'sonner';
import { BlockfrostFetch } from '@/components/blockfrost-fetch';
import { Network } from '@/domain/tx';

export function HexInputPanel() {
  const { txHex, parsedTx, network, setTxHex, setNetwork, setParsedTx, setLoading, setDetectingNetwork, setNetworkDetected, setIsOnChain, setError, clearTx } = useAppStore();
  const [localHex, setLocalHex] = useState(txHex);
  const [isValid, setIsValid] = useState(true);
  const [isSampleOpen, setIsSampleOpen] = useState(false);
  const { parseTransaction } = useCSLWorker();
  const { searchTransactionAcrossNetworks, detectNetworkFromInputs } = useBlockfrost();

  const validateHex = useCallback((hex: string) => {
    if (!hex) {
      setIsValid(true);
      return true;
    }
    const valid = isValidHex(hex) && hex.length >= 100;
    setIsValid(valid);
    return valid;
  }, []);

  // Sync localHex with txHex when it changes externally (e.g., from clearTx)
  useEffect(() => {
    setLocalHex(txHex);
    validateHex(txHex);
  }, [txHex, validateHex]);

  const handleHexChange = (value: string) => {
    setLocalHex(value);
    validateHex(value);
  };

  const handlePaste = useCallback(async (pastedValue: string) => {
    const trimmed = pastedValue.trim();
    
    // Check if it's a transaction hash (64 hex chars)
    if (isValidTransactionHash(trimmed)) {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch transaction hex first (needed for parsing)
        const result = await searchTransactionAcrossNetworks(trimmed);
        
        if (result.success && result.hex) {
          const hexToUse = result.hex;
          setLocalHex(hexToUse);
          setIsValid(true);
          setTxHex(hexToUse);
          
          // Parse immediately with detected network (or default to mainnet)
          const networkToUse = result.network || network;
          const parseResult = await parseTransaction(hexToUse, networkToUse);
          setParsedTx(parseResult);
          setLoading(false);
          
          if (parseResult.success) {
            toast.success('Transaction parsed successfully');
          } else {
            toast.error(`Parsing failed: ${parseResult.error}`);
          }
          
          // Update network if detected
          if (result.network) {
            setNetwork(result.network);
            setNetworkDetected(true);
            setIsOnChain(true);
          } else {
            setNetworkDetected(false);
            setIsOnChain(false);
          }
        } else {
          const errorMsg = result.success === false ? result.error : 'Transaction not found on any network';
          toast.error(errorMsg);
          setError(errorMsg);
          setNetworkDetected(false);
          setIsOnChain(false);
          setLoading(false);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        toast.error(`Search failed: ${errorMessage}`);
        setLoading(false);
      }
    }
    // Check if the pasted value is valid hex and long enough (full transaction)
    else if (pastedValue && isValidHex(pastedValue) && pastedValue.length >= 100) {
      // Set the hex value
      setLocalHex(pastedValue);
      setIsValid(true);
      setTxHex(pastedValue);
      
      // Parse immediately (don't wait for network detection)
      setLoading(true);
      setError(null);
      
      try {
        const parseResult = await parseTransaction(pastedValue, network);
        setParsedTx(parseResult);
        setLoading(false);
        
        if (parseResult.success) {
          toast.success('Transaction parsed successfully');
        } else {
          toast.error(`Parsing failed: ${parseResult.error}`);
        }
        
        // Detect network in background (don't block UI)
        setDetectingNetwork(true);
        setNetworkDetected(false); // Reset detection state
        setIsOnChain(false);       // Reset on-chain state
        (async () => {
          try {
            const hash = await computeTransactionHash(pastedValue);
            const result = await searchTransactionAcrossNetworks(hash);

            if (result.success && result.network) {
              setNetwork(result.network);
              setNetworkDetected(true);
              setIsOnChain(true);
              // Optionally update hex if fetched version is different
              if (result.hex && result.hex !== pastedValue) {
                setTxHex(result.hex);
                setLocalHex(result.hex);
                // Re-parse with detected network
                const reparseResult = await parseTransaction(result.hex, result.network);
                setParsedTx(reparseResult);
              }
            } else {
              // Fallback: detect network from first input's txId
              const currentParsedTx = useAppStore.getState().parsedTx;
              const firstInputTxId = currentParsedTx?.success
                ? currentParsedTx.tx.inputs[0]?.txId
                : undefined;

              if (firstInputTxId) {
                const detection = await detectNetworkFromInputs([firstInputTxId]);
                if (detection.success) {
                  const prevNetwork = useAppStore.getState().network;
                  setNetwork(detection.network);
                  setNetworkDetected(true);
                  // Re-parse with detected network if it differs from what we initially parsed with
                  if (detection.network !== prevNetwork) {
                    const reparseResult = await parseTransaction(pastedValue, detection.network);
                    setParsedTx(reparseResult);
                  }
                } else {
                  setNetworkDetected(false);
                }
              } else {
                setNetworkDetected(false);
              }
            }
          } catch (error) {
            // Network detection failed - transaction is already parsed
            console.warn('Network detection failed:', error);
            setNetworkDetected(false);
          } finally {
            setDetectingNetwork(false);
          }
        })();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        toast.error(`Parsing failed: ${errorMessage}`);
        setLoading(false);
      }
    }
  }, [network, setTxHex, setNetwork, setLoading, setDetectingNetwork, setNetworkDetected, setIsOnChain, setError, setParsedTx, parseTransaction, searchTransactionAcrossNetworks, detectNetworkFromInputs]);

  const handleDissect = useCallback(async () => {
    if (!localHex.trim()) {
      toast.error('Please enter a transaction hex');
      return;
    }
    
    const trimmedHex = localHex.trim();
    
    // Check if it's a transaction hash (64 hex chars)
    if (isValidTransactionHash(trimmedHex)) {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch transaction hex first
        const result = await searchTransactionAcrossNetworks(trimmedHex);
        
        if (result.success && result.hex) {
          const hexToUse = result.hex;
          setLocalHex(hexToUse);
          setIsValid(true);
          setTxHex(hexToUse);
          
          // Parse immediately with detected network (or default to mainnet)
          const networkToUse = result.network || network;
          const parseResult = await parseTransaction(hexToUse, networkToUse);
          setParsedTx(parseResult);
          setLoading(false);
          
          if (parseResult.success) {
            toast.success('Transaction parsed successfully');
          } else {
            toast.error(`Parsing failed: ${parseResult.error}`);
          }
          
          // Update network if detected
          if (result.network) {
            setNetwork(result.network);
            setNetworkDetected(true);
            setIsOnChain(true);
          } else {
            setNetworkDetected(false);
            setIsOnChain(false);
          }
        } else {
          const errorMsg = result.success === false ? result.error : 'Transaction not found on any network';
          toast.error(errorMsg);
          setError(errorMsg);
          setNetworkDetected(false);
          setIsOnChain(false);
          setLoading(false);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        toast.error(`Search failed: ${errorMessage}`);
        setLoading(false);
      }
      return;
    }
    
    if (!isValid) {
      toast.error('Invalid hex format');
      return;
    }

    // Full transaction hex - parse immediately
    setTxHex(trimmedHex);
    setLoading(true);
    setError(null);

    try {
      // Parse immediately (don't wait for network detection)
      const parseResult = await parseTransaction(trimmedHex, network);
      setParsedTx(parseResult);
      setLoading(false);
      
      if (parseResult.success) {
        toast.success('Transaction parsed successfully');
      } else {
        toast.error(`Parsing failed: ${parseResult.error}`);
      }
      
      // Detect network in background (don't block UI)
      setDetectingNetwork(true);
      setNetworkDetected(false); // Reset detection state
      setIsOnChain(false);       // Reset on-chain state
      (async () => {
        try {
          const hash = await computeTransactionHash(trimmedHex);
          const result = await searchTransactionAcrossNetworks(hash);

          if (result.success && result.network) {
            setNetwork(result.network);
            setNetworkDetected(true);
            setIsOnChain(true);
            // Optionally update hex if fetched version is different
            if (result.hex && result.hex !== trimmedHex) {
              setTxHex(result.hex);
              setLocalHex(result.hex);
              // Re-parse with detected network
              const reparseResult = await parseTransaction(result.hex, result.network);
              setParsedTx(reparseResult);
            }
          } else {
            // Fallback: detect network from first input's txId
            const currentParsedTx = useAppStore.getState().parsedTx;
            const firstInputTxId = currentParsedTx?.success
              ? currentParsedTx.tx.inputs[0]?.txId
              : undefined;

            if (firstInputTxId) {
              const detection = await detectNetworkFromInputs([firstInputTxId]);
              if (detection.success) {
                const prevNetwork = useAppStore.getState().network;
                setNetwork(detection.network);
                setNetworkDetected(true);
                // Re-parse with detected network if it differs from what we initially parsed with
                if (detection.network !== prevNetwork) {
                  const reparseResult = await parseTransaction(trimmedHex, detection.network);
                  setParsedTx(reparseResult);
                }
              } else {
                setNetworkDetected(false);
              }
            } else {
              setNetworkDetected(false);
            }
          }
        } catch (error) {
          // Network detection failed - transaction is already parsed
          console.warn('Network detection failed:', error);
          setNetworkDetected(false);
        } finally {
          setDetectingNetwork(false);
        }
      })();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Parsing failed: ${errorMessage}`);
      setLoading(false);
    }
  }, [localHex, isValid, network, setTxHex, setNetwork, setLoading, setDetectingNetwork, setNetworkDetected, setIsOnChain, setError, setParsedTx, parseTransaction, searchTransactionAcrossNetworks, detectNetworkFromInputs]);


  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(txHex);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    if (!txHex) return;
    
    const blob = new Blob([txHex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-${txHex.slice(0, 8)}.hex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!parsedTx?.success) {
      toast.error('No transaction to share');
      return;
    }
    
    try {
      const shareUrl = `${window.location.origin}/${parsedTx.tx.id}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Shareable link copied to clipboard');
    } catch {
      toast.error('Failed to copy share link');
    }
  };

  const handleBlockfrostFetch = useCallback(async (hex: string, fetchedNetwork: Network) => {
    // Set the fetched hex
    setLocalHex(hex);
    setIsValid(true);
    
    // Update network - this came from Blockfrost, so it's detected
    setNetwork(fetchedNetwork);
    setNetworkDetected(true);
    setIsOnChain(true);

    // Set the hex and parse the transaction immediately
    setTxHex(hex);
    setLoading(true);
    setError(null);

    try {
      const result = await parseTransaction(hex, fetchedNetwork);
      setParsedTx(result);
      setLoading(false);

      if (result.success) {
        toast.success('Transaction fetched and parsed successfully');
      } else {
        toast.error(`Parsing failed: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Parsing failed: ${errorMessage}`);
      setLoading(false);
    }
  }, [setTxHex, setNetwork, setNetworkDetected, setIsOnChain, setLoading, setError, setParsedTx, parseTransaction]);

  const sampleTransactions = SAMPLE_TRANSACTIONS;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Transaction Input</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Blockfrost Fetch Component - Compact inline version */}
        <BlockfrostFetch
          onTransactionFetched={handleBlockfrostFetch}
        />

        <div className="space-y-2">
          <Label htmlFor="hex-input">Transaction Hex</Label>
          <div className="relative">
            <HexEditor
              value={localHex}
              onChange={handleHexChange}
              onPaste={handlePaste}
              placeholder="Paste your hex-encoded Cardano transaction here..."
              className={localHex && !isValid ? 'border-destructive' : ''}
            />
            {localHex && (
              <div className="absolute top-2 right-2 z-10">
                {isValid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
          {localHex && !isValid && (
            <p className="text-sm text-destructive">
              Invalid hex format. Must be valid hexadecimal with even length.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDissect} disabled={!localHex || !isValid}>
            Dissect Transaction
          </Button>
          {txHex && (
            <>
              <Button variant="outline" onClick={handleCopyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              {parsedTx?.success && (
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              )}
              <Button variant="outline" onClick={() => {
                clearTx();
                setLocalHex('');
                setIsValid(true);
              }}>
                Clear
              </Button>
            </>
          )}
        </div>

        <Collapsible open={isSampleOpen} onOpenChange={setIsSampleOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <Label className="cursor-pointer">Sample Transactions</Label>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSampleOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1 mt-2">
              {sampleTransactions.map((sample, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left h-auto p-2"
                  onClick={() => {
                    setLocalHex(sample.hex);
                    validateHex(sample.hex);
                    setNetwork(sample.network);
                    setNetworkDetected(false); // Reset detection state when loading sample
                  }}
                >
                  <div>
                    <div className="font-medium">{sample.name}</div>
                    <div className="text-xs text-muted-foreground">{sample.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
