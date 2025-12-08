// src/features/inspector/tabs/IoValueTab.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DomainTx } from '@/domain/tx';
import { formatAda, formatAssetQuantity } from '@/lib/utils/ada';
import { Copy, ArrowRight, Coins, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BlockExplorerLink } from '@/components/block-explorer-link';
import { getKnownAddressLabel } from '@/lib/labels';
import { KnownLabelHighlight } from '@/components/known-label-highlight';

interface IoValueTabProps {
  tx: DomainTx;
}

export function IoValueTab({ tx }: IoValueTabProps) {
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
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
                  const resolvedLabel = getKnownAddressLabel(input.resolved?.address);

                  return (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Input #{index}</span>
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
                                  {input.resolved.address.slice(0, 20)}...
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
                                    <div key={assetIndex} className="flex items-center justify-between text-xs">
                                      <span className="truncate">
                                        {asset.policyId.slice(0, 8)}...{asset.assetName}
                                      </span>
                                      <span className="font-mono">
                                        {formatAssetQuantity(asset.quantity)}
                                      </span>
                                    </div>
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
                  const collateralLabel = getKnownAddressLabel(input.resolved?.address);

                  return (
                    <div key={index} className="border rounded-lg p-3 space-y-2 bg-orange-50 dark:bg-orange-950/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Collateral Input #{index}</span>
                        <Badge variant="secondary">Collateral</Badge>
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
                                  {input.resolved.address.slice(0, 20)}...
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
                                    <div key={assetIndex} className="flex items-center justify-between text-xs">
                                      <span className="truncate">
                                        {asset.policyId.slice(0, 8)}...{asset.assetName}
                                      </span>
                                      <span className="font-mono">
                                        {formatAssetQuantity(asset.quantity)}
                                      </span>
                                    </div>
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
                const outputLabel = getKnownAddressLabel(output.address);

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
                              {output.address.slice(0, 20)}...
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
                              <div key={assetIndex} className="flex items-center justify-between text-xs">
                                <span className="truncate">
                                  {asset.policyId.slice(0, 8)}...{asset.assetName}
                                </span>
                                <span className="font-mono">
                                  {formatAssetQuantity(asset.quantity)}
                                </span>
                              </div>
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
                return (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Minting Action {index + 1}</span>
                      <span className="text-sm font-mono">
                        {mint.quantity > BigInt(0) ? '+' : ''}{formatAssetQuantity(mint.quantity)}
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
                Reference inputs provide data to Plutus scripts without consuming the UTXO. They can be read by scripts but don't affect the transaction's value transfer.
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
                const collateralReturnLabel = getKnownAddressLabel(tx.collateralReturn.address);

                return (
                  <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Address</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {tx.collateralReturn.address.slice(0, 20)}...
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
                        <div key={index} className="flex items-center justify-between">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {asset.policyId.slice(0, 8)}...{asset.assetName}
                          </code>
                          <span className="text-xs font-mono">
                            {formatAssetQuantity(asset.quantity)}
                          </span>
                        </div>
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
    </div>
  );
}
