// src/features/inspector/HexInputPanel.tsx
'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { isValidHex } from '@/lib/utils/hex';
import { SAMPLE_TRANSACTIONS } from '@/lib/sample-data';
import { toast } from 'sonner';

export function HexInputPanel() {
  const { txHex, network, setTxHex, setNetwork, setParsedTx, clearTx } = useAppStore();
  const [localHex, setLocalHex] = useState(txHex);
  const [isValid, setIsValid] = useState(true);

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

  const handleDissect = () => {
    if (!localHex.trim()) {
      toast.error('Please enter a transaction hex');
      return;
    }
    
    if (!isValid) {
      toast.error('Invalid hex format');
      return;
    }

    setTxHex(localHex.trim());
    
    // Mock transaction parsing for now
    const mockTx = {
      era: "Babbage" as const,
      id: localHex.slice(0, 64),
      sizeBytes: localHex.length / 2,
      feeLovelace: BigInt(200000),
      ttl: 12345678,
      slot: 12345678,
      validity: { start: null, end: null },
      inputs: [
        {
          txId: "beb8a292312bda23888bcb238bc465abffcbe464db4a3203c2396ecc822a7fc5",
          index: 0,
          isCollateral: false,
          resolved: {
            address: "addr1q9...",
            value: { ada: BigInt(1000000), assets: [] }
          }
        }
      ],
      outputs: [
        {
          address: "addr1q9...",
          ada: BigInt(800000),
          assets: [],
          datum: undefined,
          scriptRef: undefined
        }
      ],
      mint: undefined,
      certs: undefined,
      withdrawals: undefined,
      governance: null,
      metadata: [
        {
          label: "721",
          json: { "name": "Sample NFT", "description": "A sample NFT" },
          cbor: "a1190e6ca173646f6e6174696f6e4261736973506f696e747305"
        }
      ],
      scripts: [],
      redeemers: [],
      witnesses: { vkeyCount: 1, nativeCount: 0, plutusCount: 0 },
      warnings: []
    };

    setParsedTx({ success: true, tx: mockTx });
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
                <SelectItem value="testnet">Testnet</SelectItem>
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
            <Textarea
              id="hex-input"
              value={localHex}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="Paste your hex-encoded Cardano transaction here..."
              className={`min-h-[200px] font-mono text-sm ${
                localHex && !isValid ? 'border-destructive' : ''
              }`}
            />
            {localHex && (
              <div className="absolute top-2 right-2">
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
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
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
