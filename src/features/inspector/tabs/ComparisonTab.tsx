// src/features/inspector/tabs/ComparisonTab.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  GitCompare, 
  Plus, 
  Minus, 
  Edit, 
  CheckCircle2,
  AlertTriangle,
  Copy,
  FileText
} from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { TransactionDiffAnalyzer, TransactionDiff, DiffItem } from '@/lib/transaction-diff';
import { toast } from 'sonner';
import { safeStringify } from '@/lib/utils';

interface ComparisonTabProps {
  tx: DomainTx;
  txHex: string;
}

export function ComparisonTab({ tx }: ComparisonTabProps) {
  const [compareHex, setCompareHex] = useState('');
  const [diff, setDiff] = useState<TransactionDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!compareHex.trim()) {
      toast.error('Please enter a transaction hex to compare');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Parse the comparison transaction (simplified - in real app would use proper parser)
      const mockCompareTx: DomainTx = {
        id: 'mock-comparison-tx',
        sizeBytes: compareHex.length / 2,
        feeLovelace: BigInt(200000),
        ttl: 12345678,
        slot: 12345678,
        validity: { start: null, end: null },
        inputs: [],
        outputs: [],
        mint: undefined,
        certs: undefined,
        withdrawals: undefined,
        governance: null,
        metadata: [],
        scripts: [],
        redeemers: [],
        witnesses: { vkeyCount: 0, nativeCount: 0, plutusCount: 0 },
        warnings: []
      };

      // Perform comparison
      const analyzer = TransactionDiffAnalyzer.getInstance();
      const result = analyzer.compare(tx, mockCompareTx);
      setDiff(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyDiff = async () => {
    if (!diff) return;
    
    try {
      await navigator.clipboard.writeText(safeStringify(diff, 2));
      toast.success('Comparison result copied to clipboard');
    } catch {
      toast.error('Failed to copy comparison');
    }
  };


  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Transaction Comparison</h3>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={copyDiff} disabled={!diff}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Diff
          </Button>
        </div>
      </div>

      {/* Comparison Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <GitCompare className="h-5 w-5 mr-2" />
            Compare with Another Transaction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="compare-hex">Transaction Hex to Compare</Label>
            <Input
              id="compare-hex"
              placeholder="Enter hex-encoded transaction to compare..."
              value={compareHex}
              onChange={(e) => setCompareHex(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={handleCompare} disabled={!compareHex.trim() || isLoading}>
            {isLoading ? 'Comparing...' : 'Compare Transactions'}
          </Button>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Comparison Failed</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Results */}
      {diff && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Comparison Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{diff.summary.added}</div>
                  <div className="text-sm text-muted-foreground">Added</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{diff.summary.removed}</div>
                  <div className="text-sm text-muted-foreground">Removed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{diff.summary.modified}</div>
                  <div className="text-sm text-muted-foreground">Modified</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{diff.summary.unchanged}</div>
                  <div className="text-sm text-muted-foreground">Unchanged</div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <Badge variant="outline" className="text-lg">
                  Similarity: {diff.score}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Changes */}
          <Tabs defaultValue="all" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All Changes</TabsTrigger>
              <TabsTrigger value="added">Added</TabsTrigger>
              <TabsTrigger value="modified">Modified</TabsTrigger>
              <TabsTrigger value="removed">Removed</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="flex-1 overflow-auto">
              <div className="space-y-2 p-4">
                {diff.changes.map((change, index) => (
                  <DiffItemCard key={index} change={change} />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="added" className="flex-1 overflow-auto">
              <div className="space-y-2 p-4">
                {diff.changes
                  .filter(change => change.type === 'added')
                  .map((change, index) => (
                    <DiffItemCard key={index} change={change} />
                  ))}
              </div>
            </TabsContent>
            
            <TabsContent value="modified" className="flex-1 overflow-auto">
              <div className="space-y-2 p-4">
                {diff.changes
                  .filter(change => change.type === 'modified')
                  .map((change, index) => (
                    <DiffItemCard key={index} change={change} />
                  ))}
              </div>
            </TabsContent>
            
            <TabsContent value="removed" className="flex-1 overflow-auto">
              <div className="space-y-2 p-4">
                {diff.changes
                  .filter(change => change.type === 'removed')
                  .map((change, index) => (
                    <DiffItemCard key={index} change={change} />
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

interface DiffItemCardProps {
  change: DiffItem;
}

function DiffItemCard({ change }: DiffItemCardProps) {
  const getDiffIcon = (type: string) => {
    switch (type) {
      case 'added': return <Plus className="h-4 w-4 text-green-500" />;
      case 'removed': return <Minus className="h-4 w-4 text-red-500" />;
      case 'modified': return <Edit className="h-4 w-4 text-yellow-500" />;
      case 'unchanged': return <CheckCircle2 className="h-4 w-4 text-gray-500" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getDiffColor = (type: string) => {
    switch (type) {
      case 'added': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'removed': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      case 'modified': return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
      case 'unchanged': return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20';
      default: return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20';
    }
  };

  return (
    <Card className={`border-l-4 ${getDiffColor(change.type)}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {getDiffIcon(change.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium">{change.path}</h4>
              <Badge variant="outline" className="capitalize">
                {change.type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {change.description}
            </p>
            {(change.oldValue !== undefined || change.newValue !== undefined) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {change.oldValue !== undefined && (
                  <div>
                    <span className="font-medium text-red-600">Old Value:</span>
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded mt-1">
                      <code className="text-xs break-all">
                        {typeof change.oldValue === 'object' 
                          ? safeStringify(change.oldValue, 2)
                          : String(change.oldValue)
                        }
                      </code>
                    </div>
                  </div>
                )}
                {change.newValue !== undefined && (
                  <div>
                    <span className="font-medium text-green-600">New Value:</span>
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded mt-1">
                      <code className="text-xs break-all">
                        {typeof change.newValue === 'object' 
                          ? safeStringify(change.newValue, 2)
                          : String(change.newValue)
                        }
                      </code>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
