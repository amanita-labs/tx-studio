// src/features/builder/TransactionActions.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { assembleTransaction, serializeTransaction, calculateFee, freeTransactionBody } from '@/lib/transaction-builder';
import { getUTXOs, signTransaction, submitTransaction } from '@/lib/wallet-connector';
import { toast } from 'sonner';
import { Wrench, FileSignature, Send, Copy, Eye, Download, Loader2 } from 'lucide-react';
import { ExportDialog } from '@/components/export-dialog';
import { useCSLWorker } from '@/hooks/use-csl-worker';

// CIP-30 wallet error: user pressed Cancel in the wallet popup.
// TxSignError.UserDeclined = 2 ; TxSendError.Refused = 1.
// Some wallets put the code on the thrown object, others stringify it.
function isUserDeclined(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (code === 1 || code === 2) return true;
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /user declined|user rejected|user cancelled|user canceled/i.test(msg);
}

export function TransactionActions() {
  const router = useRouter();
  const {
    builderCertificates,
    builderTxBodyElements,
    walletApi,
    builtTxHex,
    signedTxHex,
    setBuiltTxHex,
    setSignedTxHex,
    network,
    setNetwork
  } = useAppStore();
  const [building, setBuilding] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { parseTransaction } = useCSLWorker();

  const handleBuild = async () => {
    console.group('Building Transaction');

    if (!walletApi) {
      console.error('Wallet not connected');
      toast.error('Wallet not connected');
      console.groupEnd();
      return;
    }

    if (builderCertificates.length === 0 && builderTxBodyElements.length === 0) {
      console.error('No certificates or transaction body elements to build');
      toast.error('Add at least one certificate or transaction body element');
      console.groupEnd();
      return;
    }

    setBuilding(true);
    try {
      // Derive network from wallet rather than trusting the store value,
      // which can drift if the user switches wallet networks mid-session.
      console.log('Step 1: Detecting wallet network...');
      const networkId = await walletApi.getNetworkId();
      const buildNetwork: typeof network = networkId === 1 ? 'mainnet' : 'preprod';
      if (buildNetwork !== network) {
        console.log(`Network override: store=${network} -> wallet=${buildNetwork}`);
        setNetwork(buildNetwork);
      }
      console.log('Network:', buildNetwork);
      console.log('Certificates to build:', builderCertificates.length);
      console.log('Transaction body elements:', builderTxBodyElements.length);

      console.log('Step 2: Getting UTXOs from wallet...');
      const utxos = await getUTXOs(walletApi);
      console.log(`Retrieved ${utxos.length} UTXO(s)`);

      if (utxos.length === 0) {
        console.error('No UTXOs available');
        toast.error('No UTXOs available in wallet');
        console.groupEnd();
        return;
      }

      console.log('Step 3: Getting change address...');
      const changeAddress = await walletApi.getChangeAddress();
      console.log('Change address:', changeAddress);

      const allCertificates = [...builderCertificates];

      console.log('Step 4: Assembling transaction...');
      const { txBody, txWitnessSet, error } = assembleTransaction({
        certificates: allCertificates,
        txBodyElements: builderTxBodyElements,
        utxos: utxos as Parameters<typeof assembleTransaction>[0]['utxos'],
        changeAddress: changeAddress,
        network: buildNetwork,
      });

      if (error || !txBody) {
        console.error('Transaction assembly failed:', error);
        console.error('Assembly params:', {
          certificateCount: allCertificates.length,
          utxoCount: utxos.length,
          changeAddress,
          network: buildNetwork,
        });
        toast.error(error?.message || 'Failed to build transaction');
        console.groupEnd();
        return;
      }

      console.log('Step 5: Calculating fee...');
      const fee = calculateFee(txBody, buildNetwork);
      console.log('Fee calculated:', fee.toString());

      console.log('Step 6: Serializing transaction...');
      const txHex = serializeTransaction(txBody, txWitnessSet);
      console.log('Transaction serialized, hex length:', txHex.length);

      freeTransactionBody(txBody);

      setBuiltTxHex(txHex);
      console.log('Transaction built successfully');
      toast.success('Transaction built successfully');
      console.groupEnd();
    } catch (error) {
      console.error('Unexpected error building transaction:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          certificateCount: builderCertificates.length,
          network,
          walletConnected: !!walletApi,
        },
      });
      toast.error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.groupEnd();
    } finally {
      setBuilding(false);
    }
  };

  const handleSign = async () => {
    if (!walletApi || !builtTxHex) {
      toast.error('Transaction not built');
      return;
    }

    setSigning(true);
    try {
      const signedTx = await signTransaction(walletApi, builtTxHex);
      setSignedTxHex(signedTx);
      toast.success('Transaction signed successfully');
    } catch (error) {
      // CIP-30 TxSignError.UserDeclined = 2 — user pressed Cancel in the
      // wallet popup. Treat as a benign no-op rather than an error.
      if (isUserDeclined(error)) {
        toast('Signing cancelled');
        return;
      }
      console.error('Error signing transaction:', error);
      toast.error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSigning(false);
    }
  };

  const handleSubmit = async () => {
    if (!walletApi || !signedTxHex) {
      toast.error('Transaction not signed');
      return;
    }

    setSubmitting(true);
    try {
      const txHash = await submitTransaction(walletApi, signedTxHex);
      toast.success(`Transaction submitted! Hash: ${txHash.slice(0, 16)}...`);
      // Optionally navigate to inspector with the signed tx
    } catch (error) {
      if (isUserDeclined(error)) {
        toast('Submission cancelled');
        return;
      }
      console.error('Error submitting transaction:', error);
      toast.error(`Failed to submit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyHex = async () => {
    const hex = signedTxHex || builtTxHex;
    if (!hex) {
      toast.error('No transaction hex available');
      return;
    }

    try {
      await navigator.clipboard.writeText(hex);
      toast.success('Transaction hex copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleInspect = async () => {
    const hex = signedTxHex || builtTxHex;
    if (!hex) {
      toast.error('No transaction hex available');
      return;
    }

    router.push(`/?hex=${encodeURIComponent(hex)}`);
  };

  const canBuild = walletApi && (builderCertificates.length > 0 || builderTxBodyElements.length > 0);
  const canSign = walletApi && builtTxHex && !signedTxHex;
  const canSubmit = walletApi && signedTxHex;

  // Parse transaction for export dialog
  const [parsedTx, setParsedTx] = useState<import('@/domain/tx').DomainTx | null>(null);
  const [isParsingForExport, setIsParsingForExport] = useState(false);
  
  // Parse transaction when hex becomes available
  useEffect(() => {
    const parseForExport = async () => {
      const hex = signedTxHex || builtTxHex;
      if (!hex || parsedTx) return;
      
      setIsParsingForExport(true);
      try {
        const result = await parseTransaction(hex, network);
        if (result.success) {
          setParsedTx(result.tx);
        }
      } catch (error) {
        console.error('Error parsing transaction:', error);
      } finally {
        setIsParsingForExport(false);
      }
    };
    
    parseForExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedTxHex, builtTxHex, network]);

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        {!walletApi && (
          <div className="mb-2 p-3 bg-muted rounded-md text-sm text-muted-foreground text-center">
            Connect a wallet to build transactions
          </div>
        )}
        <Button
          onClick={handleBuild}
          disabled={!canBuild || building}
          className="w-full"
          title={!walletApi ? 'Connect a wallet first' : !builderCertificates.length && !builderTxBodyElements.length ? 'Add at least one certificate or transaction body element' : undefined}
        >
          {building ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Building...
            </>
          ) : (
            <>
              <Wrench className="h-4 w-4 mr-2" />
              Build Transaction
            </>
          )}
        </Button>

        <Button
          onClick={handleSign}
          disabled={!canSign || signing}
          variant="outline"
          className="w-full"
        >
          {signing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <FileSignature className="h-4 w-4 mr-2" />
              Sign Transaction
            </>
          )}
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          variant="outline"
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Transaction
            </>
          )}
        </Button>

        <div className="flex gap-2">
          <Button
            onClick={handleCopyHex}
            disabled={!builtTxHex && !signedTxHex}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Hex
          </Button>

          <Button
            onClick={handleInspect}
            disabled={!builtTxHex && !signedTxHex}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            Inspect
          </Button>
        </div>

        {parsedTx ? (
          <ExportDialog
            tx={parsedTx}
            txHex={signedTxHex || builtTxHex || ''}
          >
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isParsingForExport}
            >
              <Download className="h-4 w-4 mr-2" />
              {isParsingForExport ? 'Parsing...' : 'Export'}
            </Button>
          </ExportDialog>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!builtTxHex && !signedTxHex}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

