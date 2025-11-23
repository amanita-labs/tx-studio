// src/features/inspector/HexInputPanel.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HexEditor } from '@/components/hex-editor';
import { Copy, Download, Upload, AlertCircle, CheckCircle2, Share2, Loader2 } from 'lucide-react';
import { isValidHex } from '@/lib/utils/hex';
import { SAMPLE_TRANSACTIONS } from '@/lib/sample-data';
import { useCSLWorker } from '@/hooks/use-csl-worker';
import { toast } from 'sonner';

export function HexInputPanel() {
  const { txHex, network, setTxHex, setNetwork, setParsedTx, setLoading, setError, clearTx, isLoading } = useAppStore();
  const [localHex, setLocalHex] = useState(txHex);
  const [isValid, setIsValid] = useState(true);
  const { parseTransaction } = useCSLWorker();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDissectedHexRef = useRef<string>('');

  const validateHex = useCallback((hex: string) => {
    if (!hex) {
      setIsValid(true);
      return true;
    }
    const valid = isValidHex(hex) && hex.length >= 100;
    setIsValid(valid);
    return valid;
  }, []);

  // Sync localHex with txHex from store when it changes externally (e.g., from URL params)
  useEffect(() => {
    if (txHex !== localHex && txHex !== lastDissectedHexRef.current) {
      setLocalHex(txHex);
      validateHex(txHex);
    }
  }, [txHex, localHex, validateHex]);

  const handleHexChange = (value: string) => {
    setLocalHex(value);
    validateHex(value);
  };

  const handleDissect = useCallback(async (hexToDissect: string) => {
    const trimmedHex = hexToDissect.trim();
    
    if (!trimmedHex) {
      toast.error('Please enter a transaction hex');
      return;
    }
    
    if (!isValidHex(trimmedHex) || trimmedHex.length < 100) {
      toast.error('Invalid hex format');
      return;
    }

    // Don't dissect if we already dissected this exact hex
    if (lastDissectedHexRef.current === trimmedHex) {
      return;
    }

    setTxHex(trimmedHex);
    setLoading(true);
    setError(null);
    lastDissectedHexRef.current = trimmedHex;

    try {
      const result = await parseTransaction(trimmedHex, network);
      setParsedTx(result);
      
      if (result.success) {
        toast.success('Transaction parsed successfully');
      } else {
        toast.error(`Parsing failed: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Parsing failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [network, setTxHex, setParsedTx, setLoading, setError, parseTransaction]);

  // Handler for manual dissect button click
  const handleDissectClick = useCallback(() => {
    handleDissect(localHex);
  }, [localHex, handleDissect]);

  // Automatically dissect transaction when valid hex is entered (with debouncing)
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If hex is empty, clear the transaction
    if (!localHex.trim()) {
      if (txHex) {
        clearTx();
        lastDissectedHexRef.current = '';
      }
      return;
    }

    // Only auto-dissect if hex is valid
    if (isValid && localHex.trim().length >= 100) {
      // Debounce the dissection to avoid too many calls while user is typing
      debounceTimerRef.current = setTimeout(() => {
        handleDissect(localHex);
      }, 500); // 500ms debounce
    }

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localHex, isValid, handleDissect, clearTx, txHex]);

  // Helper function to clean hex from various formats
  const cleanHexString = useCallback((text: string): string => {
    // Remove common hex prefixes
    let cleaned = text.replace(/^0x/gi, '');
    
    // Remove byte offsets (e.g., "00000000: " or "0x0000: ")
    cleaned = cleaned.replace(/^[0-9a-fA-F]{1,8}:\s*/gm, '');
    
    // Remove all whitespace (spaces, newlines, tabs)
    cleaned = cleaned.replace(/\s/g, '');
    
    // Convert to lowercase
    cleaned = cleaned.toLowerCase();
    
    // Remove any non-hex characters
    cleaned = cleaned.replace(/[^0-9a-f]/g, '');
    
    return cleaned;
  }, []);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = cleanHexString(text);
      if (cleaned.length > 0) {
        setLocalHex(cleaned);
        validateHex(cleaned);
        toast.success('Pasted and cleaned hex from clipboard');
      } else {
        toast.error('No valid hex found in clipboard');
      }
    } catch (error) {
      toast.error('Failed to read clipboard');
    }
  };

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
    if (!txHex) return;
    
    const url = new URL(window.location.origin);
    url.searchParams.set('hex', txHex);
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Cardano Transaction Inspector',
          text: 'Check out this Cardano transaction',
          url: url.toString(),
        });
      } else {
        await navigator.clipboard.writeText(url.toString());
        toast.success('Share link copied to clipboard');
      }
    } catch (error) {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(url.toString());
        toast.success('Share link copied to clipboard');
      } catch (clipboardError) {
        toast.error('Failed to share');
      }
    }
  };

  const sampleTransactions = SAMPLE_TRANSACTIONS;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transaction Input</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={network} onValueChange={(value: any) => setNetwork(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mainnet">Mainnet</SelectItem>
                <SelectItem value="preprod">Preprod</SelectItem>
                <SelectItem value="preview">Preview</SelectItem>
              </SelectContent>
            </Select>
            {txHex && (
              <Button variant="outline" size="sm" onClick={clearTx}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="hex-input">Transaction Hex</Label>
            {localHex && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Parsing...</span>
                  </>
                ) : isValid ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>{Math.floor(localHex.length / 2)} bytes</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    <span>Invalid format</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <HexEditor
              value={localHex}
              onChange={handleHexChange}
              placeholder="Paste your hex-encoded Cardano transaction here..."
              className={localHex && !isValid ? 'border-destructive' : ''}
            />
          </div>
          {!localHex && (
            <p className="text-sm text-muted-foreground">
              Paste raw hex (with or without spaces, newlines, or 0x prefix) - it will be cleaned automatically
            </p>
          )}
          {localHex && !isValid && (
            <p className="text-sm text-destructive">
              Invalid hex format. Must be valid hexadecimal with even length (minimum 100 characters).
            </p>
          )}
          {localHex && isValid && localHex.length >= 100 && !isLoading && (
            <p className="text-sm text-muted-foreground">
              Transaction will be parsed automatically, or click "Dissect Transaction" to parse immediately.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button 
            onClick={handleDissectClick} 
            disabled={!localHex || !isValid || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parsing...
              </>
            ) : (
              'Dissect Transaction'
            )}
          </Button>
          <Button variant="outline" onClick={handlePasteFromClipboard}>
            <Upload className="h-4 w-4 mr-2" />
            Paste
          </Button>
          {txHex && (
            <>
              <Button variant="outline" onClick={handleCopyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Sample Transactions</Label>
          <div className="space-y-1">
            {sampleTransactions.map((sample, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-left h-auto p-2"
                onClick={() => {
                  setLocalHex(sample.hex);
                  validateHex(sample.hex);
                  // Auto-dissect will be triggered by useEffect
                }}
              >
                <div>
                  <div className="font-medium">{sample.name}</div>
                  <div className="text-xs text-muted-foreground">{sample.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
