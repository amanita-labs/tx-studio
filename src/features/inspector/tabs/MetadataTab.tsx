// src/features/inspector/tabs/MetadataTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Hash, AlertTriangle, CheckCircle2, FileText, Image, Coins, Vote, Settings } from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { MetadataParser, MetadataAnalysis, ParsedMetadata } from '@/lib/metadata-parser';
import { toast } from 'sonner';

interface MetadataTabProps {
  tx: DomainTx;
}

export function MetadataTab({ tx }: MetadataTabProps) {
  const [analysis, setAnalysis] = useState<MetadataAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tx.metadata && tx.metadata.length > 0) {
      analyzeMetadata();
    }
  }, [tx.metadata]);

  const analyzeMetadata = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const parser = MetadataParser.getInstance();
      const result = await parser.analyze(tx);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Metadata analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'nft': return <Image className="h-4 w-4" />;
      case 'token': return <Coins className="h-4 w-4" />;
      case 'governance': return <Vote className="h-4 w-4" />;
      case 'custom': return <Settings className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'nft': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'token': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'governance': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'custom': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyzing metadata...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={analyzeMetadata} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {!tx.metadata || tx.metadata.length === 0 ? (
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Metadata</h3>
            <p className="text-muted-foreground">
              This transaction contains no metadata.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Analysis Overview */}
          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Metadata Analysis</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {analysis.totalSize} bytes
                    </Badge>
                    <Badge variant="outline">
                      {analysis.parsedMetadata.length} entries
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {Object.entries(analysis.categories).map(([category, count]) => (
                    <div key={category} className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        {getCategoryIcon(category)}
                      </div>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm text-muted-foreground capitalize">{category}</div>
                    </div>
                  ))}
                </div>
                
                {analysis.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-yellow-600">Warnings</h4>
                    {analysis.warnings.map((warning, index) => (
                      <div key={index} className="flex items-start space-x-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {analysis.recommendations.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="text-sm font-medium text-blue-600">Recommendations</h4>
                    {analysis.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start space-x-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{recommendation}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadata Entries */}
          <Tabs defaultValue="list" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="categorized">Categorized</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="flex-1 overflow-auto">
              <div className="space-y-4 p-4">
                {tx.metadata.map((metadata, index) => (
                  <MetadataCard 
                    key={index} 
                    metadata={metadata} 
                    parsed={analysis?.parsedMetadata[index]}
                    onCopy={copyToClipboard}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="categorized" className="flex-1 overflow-auto">
              <div className="space-y-4 p-4">
                {analysis && Object.entries(analysis.categories).map(([category, count]) => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      {getCategoryIcon(category)}
                      <span className="ml-2 capitalize">{category}</span>
                      <Badge variant="outline" className="ml-2">{count}</Badge>
                    </h3>
                    <div className="space-y-2">
                      {analysis.parsedMetadata
                        .filter(parsed => parsed.category === category)
                        .map((parsed, index) => {
                          const originalIndex = analysis.parsedMetadata.indexOf(parsed);
                          return (
                            <MetadataCard
                              key={index}
                              metadata={tx.metadata![originalIndex]}
                              parsed={parsed}
                              onCopy={copyToClipboard}
                            />
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

interface MetadataCardProps {
  metadata: any;
  parsed?: ParsedMetadata;
  onCopy: (text: string, label: string) => void;
}

function MetadataCard({ metadata, parsed, onCopy }: MetadataCardProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'nft': return <Image className="h-4 w-4" />;
      case 'token': return <Coins className="h-4 w-4" />;
      case 'governance': return <Vote className="h-4 w-4" />;
      case 'custom': return <Settings className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'nft': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'token': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'governance': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'custom': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            <span>Label {metadata.label}</span>
            {parsed && (
              <Badge className={getCategoryColor(parsed.category)}>
                {getCategoryIcon(parsed.category)}
                <span className="ml-1 capitalize">{parsed.category}</span>
              </Badge>
            )}
          </div>
          {parsed && (
            <Badge variant="outline">
              {parsed.size} bytes
            </Badge>
          )}
        </CardTitle>
        {parsed && (
          <p className="text-sm text-muted-foreground">{parsed.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {parsed && parsed.warnings.length > 0 && (
          <div className="space-y-1">
            {parsed.warnings.map((warning, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
        
        {metadata.json ? (
          <div>
            <h4 className="text-sm font-medium mb-2">JSON Data</h4>
            <div className="bg-muted rounded-lg p-3">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(metadata.json as any, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCopy(
                  JSON.stringify(metadata.json, null, 2),
                  'JSON metadata'
                )}
              >
                <Copy className="h-3 w-3 mr-2" />
                Copy JSON
              </Button>
            </div>
          </div>
        ) : null}
        
        {metadata.cbor && (
          <div>
            <h4 className="text-sm font-medium mb-2">CBOR Data</h4>
            <div className="bg-muted rounded-lg p-3">
              <code className="text-xs break-all">
                {metadata.cbor}
              </code>
            </div>
            <div className="flex justify-end mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCopy(metadata.cbor!, 'CBOR metadata')}
              >
                <Copy className="h-3 w-3 mr-2" />
                Copy CBOR
              </Button>
            </div>
          </div>
        )}
        
        {!metadata.json && !metadata.cbor && (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              No data available for this metadata entry.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
