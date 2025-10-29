// src/features/inspector/tabs/ScriptsTab.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, FileCode, Code, Hash, Zap, CheckCircle2, Cpu } from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { toast } from 'sonner';
import { BlockExplorerLink } from '@/components/block-explorer-link';

interface ScriptsTabProps {
  tx: DomainTx;
}

export function ScriptsTab({ tx }: ScriptsTabProps) {
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getScriptTypeIcon = (type: string) => {
    switch (type) {
      case 'native': return <FileCode className="h-4 w-4" />;
      case 'plutus-v1': return <Code className="h-4 w-4" />;
      case 'plutus-v2': return <Code className="h-4 w-4" />;
      default: return <FileCode className="h-4 w-4" />;
    }
  };

  const getScriptTypeColor = (type: string) => {
    switch (type) {
      case 'native': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'plutus-v1': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'plutus-v2': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'spend': return <Zap className="h-4 w-4" />;
      case 'mint': return <Hash className="h-4 w-4" />;
      case 'cert': return <CheckCircle2 className="h-4 w-4" />;
      case 'reward': return <Cpu className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const copyScripts = async () => {
    try {
      // Safely serialize scripts and redeemers, handling WebAssembly objects
      const safeScripts = (tx.scripts || []).map(script => ({
        type: String(script.type || ''),
        hash: String(script.hash || ''),
        bytesLen: isNaN(Number(script.bytesLen)) ? 0 : Number(script.bytesLen)
      }));
      
      const safeRedeemers = (tx.redeemers || []).map(redeemer => ({
        purpose: String(redeemer.purpose || ''),
        index: isNaN(Number(redeemer.index)) ? 0 : Number(redeemer.index),
        exUnits: redeemer.exUnits ? {
          mem: isNaN(Number(redeemer.exUnits.mem)) ? 0 : Number(redeemer.exUnits.mem),
          steps: isNaN(Number(redeemer.exUnits.steps)) ? 0 : Number(redeemer.exUnits.steps)
        } : undefined
      }));
      
      const scriptsData = {
        scripts: safeScripts,
        redeemers: safeRedeemers,
        timestamp: new Date().toISOString()
      };
      
      await navigator.clipboard.writeText(JSON.stringify(scriptsData, null, 2));
      toast.success('Scripts data copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy scripts data');
    }
  };

  const hasScripts = (tx.scripts && tx.scripts.length > 0) || (tx.redeemers && tx.redeemers.length > 0);

  // Calculate total execution units from all redeemers
  const totalExecutionUnits = tx.redeemers?.reduce((acc, redeemer) => {
    if (redeemer.exUnits) {
      const mem = isNaN(Number(redeemer.exUnits.mem)) ? 0 : Number(redeemer.exUnits.mem);
      const steps = isNaN(Number(redeemer.exUnits.steps)) ? 0 : Number(redeemer.exUnits.steps);
      return {
        mem: acc.mem + mem,
        steps: acc.steps + steps
      };
    }
    return acc;
  }, { mem: 0, steps: 0 }) || { mem: 0, steps: 0 };

  // Helper to check if data is JSON and parse it
  const tryParseJSON = (str: string): { isJSON: boolean; parsed?: any } => {
    try {
      const parsed = JSON.parse(str);
      return { isJSON: true, parsed };
    } catch {
      return { isJSON: false };
    }
  };

  if (!hasScripts) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Code className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Scripts Found</h3>
            <p className="text-muted-foreground">
              This transaction contains no scripts or redeemers.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Scripts</h3>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {tx.scripts?.length || 0} scripts
            </Badge>
            <Badge variant="outline">
              {tx.redeemers?.length || 0} redeemers
            </Badge>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={copyScripts}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Data
          </Button>
        </div>
      </div>

      {/* Total Execution Units - Highlighted */}
      {tx.redeemers && tx.redeemers.length > 0 && (totalExecutionUnits.mem > 0 || totalExecutionUnits.steps > 0) && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Total Execution Units
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Memory</div>
                <div className="text-2xl font-mono font-bold">
                  {totalExecutionUnits.mem.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">memory units</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Steps</div>
                <div className="text-2xl font-mono font-bold">
                  {totalExecutionUnits.steps.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">CPU steps</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Script Data Hash and Total Collateral */}
      {(tx.scriptDataHash || tx.totalCollateral) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tx.scriptDataHash && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Script Data Hash
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 mr-2">
                    {tx.scriptDataHash.slice(0, 32)}...
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(tx.scriptDataHash!, 'Script data hash')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {tx.totalCollateral && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Total Collateral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-mono">
                  {Number(tx.totalCollateral).toLocaleString()} lovelace
                </div>
                <div className="text-sm text-muted-foreground">
                  {(Number(tx.totalCollateral) / 1000000).toFixed(6)} ADA
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Scripts */}
      {tx.scripts && tx.scripts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Scripts ({tx.scripts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tx.scripts.map((script, index) => {
                // Safely extract values, handling potential WebAssembly objects
                const safeType = String(script?.type || 'unknown');
                const safeHash = String(script?.hash || '');
                const safeSize = script?.bytesLen && !isNaN(Number(script.bytesLen)) ? Number(script.bytesLen) : null;
                
                return (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Script #{index + 1}</span>
                      <Badge className={getScriptTypeColor(safeType)}>
                        {getScriptTypeIcon(safeType)}
                        <span className="ml-1">{safeType}</span>
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Hash</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[120px]">
                            {safeHash.slice(0, 12)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(safeHash);
                              toast.success('Script hash copied');
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <BlockExplorerLink
                            type="script"
                            params={{ scriptHash: safeHash }}
                          />
                        </div>
                      </div>
                      
                      {safeSize && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Size</span>
                          <span className="text-xs">{safeSize} bytes</span>
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

      {/* Redeemers */}
      {tx.redeemers && tx.redeemers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Redeemers ({tx.redeemers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tx.redeemers.map((redeemer, index) => {
                // Safely extract values, handling potential WebAssembly objects
                const safePurpose = String(redeemer?.purpose || 'unknown');
                const safeIndex = isNaN(Number(redeemer?.index)) ? 0 : Number(redeemer.index);
                const safeData = redeemer?.data ? String(redeemer.data) : null;
                const safeScriptHash = redeemer?.scriptHash ? String(redeemer.scriptHash) : null;
                const safeExUnits = redeemer?.exUnits ? {
                  mem: isNaN(Number(redeemer.exUnits.mem)) ? 0 : Number(redeemer.exUnits.mem),
                  steps: isNaN(Number(redeemer.exUnits.steps)) ? 0 : Number(redeemer.exUnits.steps)
                } : null;
                
                return (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Redeemer #{index + 1}</span>
                      <div className="flex items-center gap-1">
                        {getPurposeIcon(safePurpose)}
                        <span className="text-xs capitalize">{safePurpose}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Index</span>
                        <span className="text-xs">{safeIndex}</span>
                      </div>
                      
                      {safeExUnits && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Memory</span>
                            <span className="font-mono">{safeExUnits.mem.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Steps</span>
                            <span className="font-mono">{safeExUnits.steps.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      {safeData && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Data</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(safeData);
                                toast.success('Redeemer data copied');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {(() => {
                            const { isJSON, parsed } = tryParseJSON(safeData);
                            if (isJSON && parsed) {
                              return (
                                <code className="text-xs bg-muted px-2 py-1 rounded block whitespace-pre-wrap break-all">
                                  {JSON.stringify(parsed, null, 2)}
                                </code>
                              );
                            }
                            // If not JSON or hex string, show truncated
                            return (
                              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                                {safeData.length > 64 ? `${safeData.slice(0, 64)}...` : safeData}
                              </code>
                            );
                          })()}
                        </div>
                      )}
                      
                      {safeScriptHash && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Script Hash</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {safeScriptHash.slice(0, 16)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(safeScriptHash);
                                toast.success('Script hash copied');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
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
    </div>
  );
}