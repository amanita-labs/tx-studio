// src/features/inspector/HexInputPanel.tsx
'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HexEditor } from '@/components/hex-editor';
import { Copy, Download, Upload, AlertCircle, CheckCircle2, Share2 } from 'lucide-react';
import { isValidHex } from '@/lib/utils/hex';
import { SAMPLE_TRANSACTIONS } from '@/lib/sample-data';
import { useCSLWorker } from '@/hooks/use-csl-worker';
import { toast } from 'sonner';

export function HexInputPanel() {
  const { txHex, network, setTxHex, setNetwork, setParsedTx, setLoading, setError, clearTx } = useAppStore();
  const [localHex, setLocalHex] = useState(txHex);
  const [isValid, setIsValid] = useState(true);
  const { parseTransaction } = useCSLWorker();

  const validateHex = useCallback((hex: string) => {
    if (!hex) {
      setIsValid(true);
      return true;
    }
    const valid = isValidHex(hex) && hex.length >= 100;
    setIsValid(valid);
    return valid;
  }, []);

  const handleHexChange = (value: string) => {
    setLocalHex(value);
    validateHex(value);
  };

  const handleDissect = async () => {
    if (!localHex.trim()) {
      toast.error('Please enter a transaction hex');
      return;
    }
    
    if (!isValid) {
      toast.error('Invalid hex format');
      return;
    }

    setTxHex(localHex.trim());
    setLoading(true);
    setError(null);

    try {
      const result = await parseTransaction(localHex.trim(), network);
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
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      setLocalHex(trimmed);
      validateHex(trimmed);
      toast.success('Pasted from clipboard');
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
          <Label htmlFor="hex-input">Transaction Hex</Label>
          <div className="relative">
            <HexEditor
              value={localHex}
              onChange={handleHexChange}
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
