// src/features/inspector/tabs/IoValueTab.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DomainTx } from '@/domain/tx';
import { formatAda, formatAssetQuantity } from '@/lib/utils/ada';
import { Copy, ArrowRight, Coins, Shield, ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BlockExplorerLink } from '@/components/block-explorer-link';
import { resolveAddressLabel } from '@/lib/labels';
import { KnownLabelHighlight } from '@/components/known-label-highlight';
import { useTokenRegistry } from '@/hooks/use-token-registry';
import { useInputSpentStatus, spentKey, type SpentStatus } from '@/hooks/use-input-spent-status';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { AssetDisplay } from '@/components/asset-display';
import { WalletSummaryCard } from './wallet-summary/WalletSummaryCard';

interface IoValueTabProps {
  tx: DomainTx;
}

function parseCoinValue(value: unknown): bigint {
  if (!value || value === '0') return 0n;
  try { return BigInt(String(value)); } catch { return 0n; }
}

function truncateAddress(address: string, startLength: number = 15, endLength: number = 4): string {
  if (address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/** Pill showing whether an input's UTXO has been spent or is still unspent. */
function SpentBadge({ status }: { status?: SpentStatus }) {
  if (!status || status === 'unknown') return null;
  if (status === 'checking') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        checking
      </span>
    );
  }
  if (status === 'unspent') {
    return (
      <Badge
        variant="outline"
        className={cn('border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}
      >
        Unspent
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn('border-muted-foreground/30 bg-muted text-muted-foreground')}
    >
      Spent
    </Badge>
  );
}

export function IoValueTab({ tx }: IoValueTabProps) {
  const { getMetadata } = useTokenRegistry(tx);
  const network = useAppStore((s) => s.network);
  const spentStatus = useInputSpentStatus(tx);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <WalletSummaryCard tx={tx} />

      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 rotate-180" />
            Inputs ({tx.inputs.filter(input => !input.isCollateral).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tx.inputs.filter(input => !input.isCollateral).length === 0 ? (
            <p className="text-muted-foreground text-sm">No regular inputs</p>
          ) : (
            <div className="space-y-3">
              {tx.inputs
                .filter(input => !input.isCollateral)
                .map((input, index) => {
                  const resolvedLabel = resolveAddressLabel(
                    { address: input.resolved?.address, addressCreds: input.resolved?.addressCreds },
                    network,
                  );

                  return (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Input #{index}</span>
                        <SpentBadge status={spentStatus.get(spentKey(input.txId, input.index))} />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Transaction ID</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {input.txId.slice(0, 16)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(input.txId, 'Transaction ID')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <BlockExplorerLink 
                              type="transaction" 
                              params={{ txHash: input.txId }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Index</span>
                          <span className="text-xs">{input.index}</span>
                        </div>
                        
                        {input.resolved?.address && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Address</span>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {truncateAddress(input.resolved.address)}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(input.resolved!.address!, 'Address')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <BlockExplorerLink 
                                  type="address" 
                                  params={{ address: input.resolved.address }}
                                />
                              </div>
                            </div>
                            {resolvedLabel && (
                              <KnownLabelHighlight category="address" label={resolvedLabel} />
                            )}
                          </div>
                        )}

                        {input.resolved?.value && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">ADA</span>
                              <span className="text-xs font-mono">{formatAda(input.resolved.value.ada)}</span>
                            </div>
                            
                            {input.resolved.value.assets.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Assets</span>
                                <div className="space-y-1">
                                  {input.resolved.value.assets.map((asset, assetIndex) => (
                                    <AssetDisplay
                                      key={assetIndex}
                                      asset={asset}
                                      metadata={getMetadata(asset.policyId, asset.assetName)}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collateral Inputs */}
      {tx.inputs.some(input => input.isCollateral) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Collateral Inputs ({tx.inputs.filter(input => input.isCollateral).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tx.inputs
                .filter(input => input.isCollateral)
                .map((input, index) => {
                  const collateralLabel = resolveAddressLabel(
                    { address: input.resolved?.address, addressCreds: input.resolved?.addressCreds },
                    network,
                  );

                  return (
                    <div key={index} className="border rounded-lg p-3 space-y-2 bg-orange-50 dark:bg-orange-950/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Collateral Input #{index}</span>
                        <div className="flex items-center gap-2">
                          <SpentBadge status={spentStatus.get(spentKey(input.txId, input.index))} />
                          <Badge variant="secondary">Collateral</Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Transaction ID</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {input.txId.slice(0, 16)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(input.txId, 'Transaction ID')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <BlockExplorerLink 
                              type="transaction" 
                              params={{ txHash: input.txId }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Index</span>
                          <span className="text-xs">{input.index}</span>
                        </div>
                        
                        {input.resolved?.address && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Address</span>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {truncateAddress(input.resolved.address)}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(input.resolved!.address!, 'Address')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <BlockExplorerLink 
                                  type="address" 
                                  params={{ address: input.resolved.address }}
                                />
                              </div>
                            </div>
                            {collateralLabel && (
                              <KnownLabelHighlight category="address" label={collateralLabel} />
                            )}
                          </div>
                        )}

                        {input.resolved?.value && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">ADA</span>
                              <span className="text-xs font-mono">{formatAda(input.resolved.value.ada)}</span>
                            </div>
                            
                            {input.resolved.value.assets.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Assets</span>
                                <div className="space-y-1">
                                  {input.resolved.value.assets.map((asset, assetIndex) => (
                                    <AssetDisplay
                                      key={assetIndex}
                                      asset={asset}
                                      metadata={getMetadata(asset.policyId, asset.assetName)}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Outputs ({tx.outputs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tx.outputs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No outputs</p>
          ) : (
            <div className="space-y-3">
              {tx.outputs.map((output, index) => {
                const outputLabel = resolveAddressLabel(
                  { address: output.address, addressCreds: output.addressCreds },
                  network,
                );

                return (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Output #{index}</span>
                      <div className="flex gap-1">
                        {output.datum && <Badge variant="outline">Datum</Badge>}
                        {output.scriptRef && <Badge variant="outline">Script</Badge>}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Address</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {truncateAddress(output.address)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(output.address, 'Address')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <BlockExplorerLink 
                              type="address" 
                              params={{ address: output.address }}
                            />
                          </div>
                        </div>
                        {outputLabel && (
                          <KnownLabelHighlight category="address" label={outputLabel} />
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">ADA</span>
                        <span className="text-xs font-mono">{formatAda(output.ada)}</span>
                      </div>
                      
                      {output.assets.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Assets</span>
                          <div className="space-y-1">
                            {output.assets.map((asset, assetIndex) => (
                              <AssetDisplay
                                key={assetIndex}
                                asset={asset}
                                metadata={getMetadata(asset.policyId, asset.assetName)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {output.datum && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Datum</span>
                          <div className="text-xs">
                            {output.datum.inline ? 'Inline' : 'Hash'}
                            {output.datum.hash && (
                              <code className="ml-2 bg-muted px-1 py-0.5 rounded">
                                {output.datum.hash.slice(0, 16)}...
                              </code>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mint */}
      {tx.mint && tx.mint.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Mint ({tx.mint.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tx.mint.map((mint, index) => {
                const assetId = `${mint.policyId}${mint.assetName}`;
                const assetNameDisplay = mint.assetName || '(empty - policy native token)';
                const mintMeta = getMetadata(mint.policyId, mint.assetName);
                const mintDecimals = mintMeta?.decimals ?? 0;
                return (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Minting Action {index + 1}</span>
                        {mintMeta && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {mintMeta.logo && (
                              <img
                                src={`data:image/png;base64,${mintMeta.logo}`}
                                alt={mintMeta.name}
                                className="h-4 w-4 rounded-sm"
                              />
                            )}
                            {mintMeta.ticker ?? mintMeta.name}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-mono">
                        {mint.quantity > BigInt(0) ? '+' : ''}{formatAssetQuantity(mint.quantity, mintDecimals)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Asset Name:</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all flex-1">
                            {assetNameDisplay}
                          </code>
                          {mint.assetName && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 flex-shrink-0"
                              onClick={() => copyToClipboard(mint.assetName, 'Asset Name')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Policy ID:</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all flex-1">
                            {mint.policyId}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 flex-shrink-0"
                            onClick={() => copyToClipboard(mint.policyId, 'Policy ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <BlockExplorerLink 
                            type="policy" 
                            params={{ policyId: mint.policyId }}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-1 pt-1 border-t">
                        <span className="text-xs text-muted-foreground">Asset ID:</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all flex-1">
                            {assetId}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 flex-shrink-0"
                            onClick={() => copyToClipboard(assetId, 'Asset ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <BlockExplorerLink 
                            type="asset" 
                            params={{ assetId, policyId: mint.policyId, assetName: mint.assetName }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reference Inputs */}
      {tx.referenceInputs && tx.referenceInputs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Reference Inputs ({tx.referenceInputs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Reference inputs provide data to Plutus scripts without consuming the UTXO. They can be read by scripts but don&apos;t affect the transaction&apos;s value transfer.
              </p>
              {tx.referenceInputs.map((refInput, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Reference Input #{index + 1}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Transaction ID</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {refInput.txId.slice(0, 16)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(refInput.txId, 'Reference input TX ID')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <BlockExplorerLink 
                          type="transaction" 
                          params={{ txHash: refInput.txId }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Index</span>
                      <span className="text-xs font-mono">{refInput.index}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collateral Return */}
      {tx.collateralReturn && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Collateral Return
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The collateral return output specifies where any unused collateral should be returned after script execution.
              </p>
              {(() => {
                const collateralReturnLabel = resolveAddressLabel(
                  { address: tx.collateralReturn.address, addressCreds: tx.collateralReturn.addressCreds },
                  network,
                );

                return (
                  <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Address</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {truncateAddress(tx.collateralReturn.address)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(tx.collateralReturn!.address, 'Collateral return address')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <BlockExplorerLink 
                      type="address" 
                      params={{ address: tx.collateralReturn.address }}
                    />
                  </div>
                </div>
                    {collateralReturnLabel && (
                      <KnownLabelHighlight category="address" label={collateralReturnLabel} />
                    )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ADA</span>
                  <span className="text-sm font-mono">
                    {formatAda(tx.collateralReturn.ada)}
                  </span>
                </div>
                
                {tx.collateralReturn.assets.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Assets</span>
                    <div className="space-y-1">
                      {tx.collateralReturn.assets.map((asset, index) => (
                        <AssetDisplay
                          key={index}
                          asset={asset}
                          metadata={getMetadata(asset.policyId, asset.assetName)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Implicit Outputs */}
      {(() => {
        const implicitOutputItems: Array<{ label: string; amount: bigint }> = [];

        implicitOutputItems.push({ label: 'Fee', amount: tx.feeLovelace });

        if (tx.treasuryDonation && tx.treasuryDonation > 0n) {
          implicitOutputItems.push({ label: 'Treasury Donation', amount: tx.treasuryDonation });
        }

        if (tx.certs) {
          for (const cert of tx.certs) {
            if (cert.type === 'StakeRegistration') {
              const deposit = parseCoinValue(cert.details.deposit);
              if (deposit > 0n) {
                implicitOutputItems.push({ label: 'Stake Registration Deposit', amount: deposit });
              }
            }
            if (cert.type === 'DRepRegistration') {
              const deposit = parseCoinValue(cert.details.deposit);
              if (deposit > 0n) {
                implicitOutputItems.push({ label: 'DRep Registration Deposit', amount: deposit });
              }
            }
            if (cert.type === 'Proposal') {
              const deposit = parseCoinValue(cert.details.deposit);
              if (deposit > 0n) {
                implicitOutputItems.push({ label: 'Proposal Deposit', amount: deposit });
              }
            }
          }
        }

        if (tx.governance?.proposals) {
          for (const proposal of tx.governance.proposals) {
            const deposit = parseCoinValue(proposal.details.deposit);
            if (deposit > 0n) {
              implicitOutputItems.push({ label: `Governance Action Deposit (${proposal.type})`, amount: deposit });
            }
          }
        }

        const implicitOutputTotal = implicitOutputItems.reduce((sum, item) => sum + item.amount, 0n);

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownRight className="h-5 w-5" />
                Implicit Outputs ({implicitOutputItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {implicitOutputItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-mono">{formatAda(item.amount)} ada</span>
                  </div>
                ))}
                {implicitOutputItems.length > 1 && (
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-sm font-mono font-medium">{formatAda(implicitOutputTotal)} ada</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Implicit Inputs */}
      {(() => {
        const implicitInputItems: Array<{ label: string; amount: bigint }> = [];

        if (tx.withdrawals) {
          for (const w of tx.withdrawals) {
            implicitInputItems.push({
              label: `Withdrawal (${truncateAddress(w.stakeAddr)})`,
              amount: w.amount,
            });
          }
        }

        if (tx.certs) {
          for (const cert of tx.certs) {
            if (cert.type === 'StakeDeregistration') {
              const refund = parseCoinValue(cert.details.refund);
              if (refund > 0n) {
                implicitInputItems.push({ label: 'Stake Deregistration Refund', amount: refund });
              }
            }
            if (cert.type === 'DRepDeregistration') {
              const refund = parseCoinValue(cert.details.refund);
              if (refund > 0n) {
                implicitInputItems.push({ label: 'DRep Deregistration Refund', amount: refund });
              }
            }
          }
        }

        if (implicitInputItems.length === 0) return null;

        const implicitInputTotal = implicitInputItems.reduce((sum, item) => sum + item.amount, 0n);

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5" />
                Implicit Inputs ({implicitInputItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {implicitInputItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-mono">{formatAda(item.amount)} ada</span>
                  </div>
                ))}
                {implicitInputItems.length > 1 && (
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-sm font-mono font-medium">{formatAda(implicitInputTotal)} ada</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
