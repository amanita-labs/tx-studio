// src/features/builder/tabs/tx-body/governance/ProposalProceduresTab.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore, BuilderTxBodyElement } from '@/lib/store';
import {
  parseCostModelsJson,
  computeScriptHashHex,
  buildInfoProposalCbor,
  buildParameterChangeProposalCbor,
} from '@/lib/transaction-builder';
import { getRewardAddressBech32 } from '@/lib/wallet-connector';
import { MAINNET_GUARDRAILS_SCRIPT } from '@/lib/governance/guardrails';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import * as CSL from '@emurgo/cardano-serialization-lib-browser';

type Kind = 'info' | 'parameter-change' | 'cbor';
type GuardrailsLang = 'V1' | 'V2' | 'V3';

const DEFAULT_DEPOSIT = '100000000000';

export function ProposalProceduresTab() {
  const { addTxBodyElement, walletApi } = useAppStore();

  const [kind, setKind] = useState<Kind>('info');
  const [deposit, setDeposit] = useState(DEFAULT_DEPOSIT);
  const [rewardAddress, setRewardAddress] = useState('');
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataHash, setMetadataHash] = useState('');

  const [costModelsJson, setCostModelsJson] = useState('');
  const [prevTxHash, setPrevTxHash] = useState('');
  const [prevTxIndex, setPrevTxIndex] = useState('');
  const [guardrailsLang, setGuardrailsLang] = useState<GuardrailsLang>('V3');
  const [guardrailsScript, setGuardrailsScript] = useState('');

  const [pastedCbor, setPastedCbor] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Auto-fill reward address from connected wallet on first load.
  // Intentionally omit `rewardAddress` from deps so user edits stick.
  useEffect(() => {
    if (!walletApi) return;
    let cancelled = false;
    getRewardAddressBech32(walletApi)
      .then((addr) => {
        if (!cancelled && addr) {
          setRewardAddress((current) => current || addr);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletApi]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};

    if (kind === 'cbor') {
      const cbor = pastedCbor.trim();
      if (!cbor) {
        e.pastedCbor = 'Proposal CBOR is required';
      } else if (!/^[0-9a-fA-F]+$/.test(cbor) || cbor.length % 2 !== 0) {
        e.pastedCbor = 'Must be even-length hex';
      } else {
        try {
          const probe = CSL.VotingProposal.from_hex(cbor);
          probe.free();
        } catch (err) {
          e.pastedCbor = `Invalid VotingProposal CBOR: ${err instanceof Error ? err.message : 'parse failed'}`;
        }
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    }

    // Common fields for info + parameter-change.
    if (!/^[0-9]+$/.test(deposit.trim())) {
      e.deposit = 'Deposit must be a non-negative integer';
    } else {
      try {
        if (BigInt(deposit) <= 0n) e.deposit = 'Deposit must be greater than 0';
      } catch {
        e.deposit = 'Deposit is not a valid integer';
      }
    }

    const stake = rewardAddress.trim();
    if (!stake) {
      e.rewardAddress = 'Deposit return address is required';
    } else if (!/^stake(_test)?1/.test(stake)) {
      e.rewardAddress = 'Must be a stake (reward) address (stake1.../stake_test1...)';
    }

    if (!metadataUrl.trim()) {
      e.metadataUrl = 'Metadata URL is required';
    } else {
      try {
        new URL(metadataUrl.trim());
        if (metadataUrl.trim().length > 128) e.metadataUrl = 'URL must be ≤128 characters';
      } catch {
        e.metadataUrl = 'Invalid URL';
      }
    }

    if (!/^[0-9a-fA-F]{64}$/.test(metadataHash.trim())) {
      e.metadataHash = 'Metadata hash must be 64 hex characters (32 bytes)';
    }

    if (kind === 'parameter-change') {
      if (!costModelsJson.trim()) {
        e.costModelsJson = 'Cost models JSON is required';
      } else {
        const { error } = parseCostModelsJson(costModelsJson);
        if (error) e.costModelsJson = error.message;
      }

      const hasHash = prevTxHash.trim().length > 0;
      const hasIdx = prevTxIndex.trim().length > 0;
      if (hasHash !== hasIdx) {
        if (!hasHash) e.prevTxHash = 'Required when index is set';
        if (!hasIdx) e.prevTxIndex = 'Required when hash is set';
      } else if (hasHash) {
        if (!/^[0-9a-fA-F]{64}$/.test(prevTxHash.trim())) {
          e.prevTxHash = 'Must be 64 hex characters';
        }
        if (!/^[0-9]+$/.test(prevTxIndex.trim())) {
          e.prevTxIndex = 'Must be a non-negative integer';
        } else if (Number(prevTxIndex) >= 2 ** 32) {
          e.prevTxIndex = 'Must be less than 2^32';
        }
      }

      const script = guardrailsScript.trim();
      if (script) {
        if (!/^[0-9a-fA-F]+$/.test(script) || script.length % 2 !== 0) {
          e.guardrailsScript = 'Must be even-length hex';
        }
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setDeposit(DEFAULT_DEPOSIT);
    setMetadataUrl('');
    setMetadataHash('');
    setCostModelsJson('');
    setPrevTxHash('');
    setPrevTxIndex('');
    setGuardrailsScript('');
    setPastedCbor('');
    setErrors({});
    // Keep rewardAddress so the user doesn't have to refill from the wallet.
  };

  const handleAdd = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      let element: BuilderTxBodyElement | null = null;

      if (kind === 'cbor') {
        element = {
          id: `proposal-procedure-${Date.now()}`,
          type: 'ProposalProcedures',
          data: { kind: 'cbor', proposalData: pastedCbor.trim() },
        };
      } else if (kind === 'info') {
        const { hex, error } = buildInfoProposalCbor({
          depositLovelace: BigInt(deposit),
          rewardAddressBech32: rewardAddress.trim(),
          metadataUrl: metadataUrl.trim(),
          metadataHashHex: metadataHash.trim(),
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        element = {
          id: `proposal-procedure-${Date.now()}`,
          type: 'ProposalProcedures',
          data: {
            kind: 'info',
            proposalData: hex,
            deposit: deposit.trim(),
            rewardAddress: rewardAddress.trim(),
            metadataUrl: metadataUrl.trim(),
            metadataHash: metadataHash.trim(),
          },
        };
      } else {
        // parameter-change
        const { models, error: parseErr } = parseCostModelsJson(costModelsJson);
        if (parseErr || !models) {
          toast.error(parseErr?.message ?? 'Invalid cost models');
          return;
        }

        let guardrailsScriptHashHex: string | undefined;
        if (guardrailsScript.trim()) {
          const { hashHex, error: hashErr } = computeScriptHashHex(guardrailsScript.trim(), guardrailsLang);
          if (hashErr) {
            toast.error(hashErr.message);
            return;
          }
          guardrailsScriptHashHex = hashHex;
        }

        const prevAction = prevTxHash.trim()
          ? { txHash: prevTxHash.trim(), index: Number(prevTxIndex) }
          : undefined;

        const { hex, error } = buildParameterChangeProposalCbor({
          depositLovelace: BigInt(deposit),
          rewardAddressBech32: rewardAddress.trim(),
          metadataUrl: metadataUrl.trim(),
          metadataHashHex: metadataHash.trim(),
          costModels: models,
          prevAction,
          guardrailsScriptHashHex,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        element = {
          id: `proposal-procedure-${Date.now()}`,
          type: 'ProposalProcedures',
          data: {
            kind: 'parameter-change',
            proposalData: hex,
            deposit: deposit.trim(),
            rewardAddress: rewardAddress.trim(),
            metadataUrl: metadataUrl.trim(),
            metadataHash: metadataHash.trim(),
            costModels: models,
            prevTxHash: prevAction?.txHash,
            prevTxIndex: prevAction?.index,
            // The raw script bytes are needed at assembleTransaction time to
            // attach the script witness + {} redeemer + collateral.
            guardrailsScriptHex: guardrailsScriptHashHex ? guardrailsScript.trim() : undefined,
            guardrailsLanguage: guardrailsScriptHashHex ? guardrailsLang : undefined,
            guardrailsScriptHashHex,
          },
        };
      }

      if (element) {
        addTxBodyElement(element);
        toast.success(
          kind === 'info' ? 'Info action added' :
          kind === 'parameter-change' ? 'Parameter change action added' :
          'Proposal procedure added'
        );
        resetForm();
      }
    } catch (err) {
      toast.error(`Failed to add proposal: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const showCommon = kind !== 'cbor';
  const showParamChange = kind === 'parameter-change';
  const showCbor = kind === 'cbor';

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Proposal Procedure
        </CardTitle>
        <CardDescription>
          Build a Conway-era governance proposal. Info & Parameter Change have guided forms; use Paste CBOR for other action types.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="action-type">Action Type</Label>
          <Select value={kind} onValueChange={(v) => { setKind(v as Kind); setErrors({}); }}>
            <SelectTrigger id="action-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info Action</SelectItem>
              <SelectItem value="parameter-change">Parameter Change Action</SelectItem>
              <SelectItem value="cbor">Paste CBOR (advanced)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showCommon && (
          <>
            <Separator />

            <div className="space-y-2">
              <Label htmlFor="deposit">Governance Action Deposit Amount (lovelace)</Label>
              <Input
                id="deposit"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                aria-invalid={errors.deposit ? 'true' : 'false'}
                placeholder="100000000000"
              />
              <p className="text-xs text-muted-foreground">Should align with current protocol parameters.</p>
              {errors.deposit && <p className="text-sm text-destructive">{errors.deposit}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward-address">Deposit Return Address</Label>
              <Input
                id="reward-address"
                value={rewardAddress}
                onChange={(e) => setRewardAddress(e.target.value)}
                aria-invalid={errors.rewardAddress ? 'true' : 'false'}
                placeholder="stake1... or stake_test1..."
              />
              <p className="text-xs text-muted-foreground">Auto-filled from your wallet. The deposit will be returned here when the action is enacted or expired.</p>
              {errors.rewardAddress && <p className="text-sm text-destructive">{errors.rewardAddress}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="metadata-url">Metadata URL</Label>
              <Input
                id="metadata-url"
                value={metadataUrl}
                onChange={(e) => setMetadataUrl(e.target.value)}
                aria-invalid={errors.metadataUrl ? 'true' : 'false'}
                placeholder="https://..."
              />
              {errors.metadataUrl && <p className="text-sm text-destructive">{errors.metadataUrl}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="metadata-hash">Metadata Hash</Label>
              <Input
                id="metadata-hash"
                value={metadataHash}
                onChange={(e) => setMetadataHash(e.target.value)}
                aria-invalid={errors.metadataHash ? 'true' : 'false'}
                placeholder="64 hex chars"
              />
              {errors.metadataHash && <p className="text-sm text-destructive">{errors.metadataHash}</p>}
            </div>
          </>
        )}

        {showParamChange && (
          <>
            <Separator />

            <div className="space-y-2">
              <Label htmlFor="cost-models">Plutus Cost Models (JSON, positional arrays)</Label>
              <Textarea
                id="cost-models"
                rows={6}
                className="font-mono text-xs"
                value={costModelsJson}
                onChange={(e) => setCostModelsJson(e.target.value)}
                aria-invalid={errors.costModelsJson ? 'true' : 'false'}
                placeholder={'{\n  "PlutusV3": [100788, 420, ...]\n}'}
              />
              <p className="text-xs text-muted-foreground">
                Keys: PlutusV1/V2/V3 or plutus_v1/v2/v3. Values are positional integer arrays (numbers or numeric strings). A wrapping <code>protocol_param_update.cost_models</code> or <code>cost_models</code> object is auto-unwrapped.
              </p>
              {errors.costModelsJson && <p className="text-sm text-destructive">{errors.costModelsJson}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prev-tx-hash">Optional: Previously enacted update parameter action tx hash</Label>
              <Input
                id="prev-tx-hash"
                value={prevTxHash}
                onChange={(e) => setPrevTxHash(e.target.value)}
                aria-invalid={errors.prevTxHash ? 'true' : 'false'}
                placeholder="64 hex chars"
              />
              <p className="text-xs text-muted-foreground">Required if there has been an update parameter action enacted before.</p>
              {errors.prevTxHash && <p className="text-sm text-destructive">{errors.prevTxHash}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prev-tx-index">Optional: Previously enacted update parameter action tx index</Label>
              <Input
                id="prev-tx-index"
                value={prevTxIndex}
                onChange={(e) => setPrevTxIndex(e.target.value)}
                aria-invalid={errors.prevTxIndex ? 'true' : 'false'}
                placeholder="0"
              />
              {errors.prevTxIndex && <p className="text-sm text-destructive">{errors.prevTxIndex}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="guardrails-lang">Guard Rails Script Language</Label>
              <Select value={guardrailsLang} onValueChange={(v) => setGuardrailsLang(v as GuardrailsLang)}>
                <SelectTrigger id="guardrails-lang">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="V1">Plutus V1</SelectItem>
                  <SelectItem value="V2">Plutus V2</SelectItem>
                  <SelectItem value="V3">Plutus V3 (default)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="guardrails-script">Optional: Guard Rails Script (Hex)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={() => {
                    setGuardrailsScript(MAINNET_GUARDRAILS_SCRIPT.cborHex);
                    setGuardrailsLang(MAINNET_GUARDRAILS_SCRIPT.language);
                    toast.success('Mainnet guard rails script loaded');
                  }}
                >
                  Use mainnet script
                </Button>
              </div>
              <Textarea
                id="guardrails-script"
                rows={3}
                className="font-mono text-xs"
                value={guardrailsScript}
                onChange={(e) => setGuardrailsScript(e.target.value)}
                aria-invalid={errors.guardrailsScript ? 'true' : 'false'}
                placeholder="Plutus script hex (we hash it)"
              />
              <p className="text-xs text-muted-foreground">Required if a guard rails script is currently ratified on-chain.</p>
              {errors.guardrailsScript && <p className="text-sm text-destructive">{errors.guardrailsScript}</p>}
            </div>
          </>
        )}

        {showCbor && (
          <>
            <Separator />

            <div className="space-y-2">
              <Label htmlFor="proposal-cbor">Proposal Procedure CBOR (hex)</Label>
              <Textarea
                id="proposal-cbor"
                rows={6}
                className="font-mono text-xs"
                value={pastedCbor}
                onChange={(e) => setPastedCbor(e.target.value)}
                aria-invalid={errors.pastedCbor ? 'true' : 'false'}
                placeholder="84..."
              />
              {errors.pastedCbor && <p className="text-sm text-destructive">{errors.pastedCbor}</p>}
            </div>
          </>
        )}

        <Button onClick={handleAdd} disabled={loading} className="w-full">
          {loading ? 'Adding...' : 'Add Proposal Procedure'}
        </Button>
      </CardContent>
    </Card>
  );
}
