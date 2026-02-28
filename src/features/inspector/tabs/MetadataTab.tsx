// src/features/inspector/tabs/MetadataTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Download, Hash, AlertTriangle, FileText, Image, Coins, Vote, Settings, Eye, EyeOff } from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { MetadataParser, MetadataAnalysis, ParsedMetadata } from '@/lib/metadata-parser';
import { JsonViewer } from '@/components/json-viewer';
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

          {/* Metadata Entries */}
          <div className="flex-1 overflow-auto">
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
          </div>
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
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {parsed.cip10Description ?? parsed.description}
            </p>
            {parsed.cip10Description && (
              <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
                CIP-10
              </Badge>
            )}
          </div>
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
          <JsonViewer
            data={metadata.json}
            title="JSON Data"
            label={metadata.label}
            category={parsed?.category}
            onCopy={onCopy}
          />
        ) : null}

        {parsed?.decodedCbor ? (
          <JsonViewer
            data={parsed.decodedCbor}
            title="CBOR Data (Decoded to JSON)"
            label={metadata.label}
            category={parsed?.category}
            onCopy={onCopy}
          />
        ) : null}
        
        {metadata.cbor && (
          <CborViewer
            cborData={metadata.cbor}
            onCopy={onCopy}
          />
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

interface CborViewerProps {
  cborData: string;
  onCopy: (text: string, label: string) => void;
}

function CborViewer({ cborData, onCopy }: CborViewerProps) {
  const [showCbor, setShowCbor] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            CBOR Data
            <Badge variant="outline" className="text-xs">
              Raw Format
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCbor(!showCbor)}
            >
              {showCbor ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showCbor ? 'Hide' : 'Show'} CBOR
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(cborData, 'CBOR metadata')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy CBOR
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Raw CBOR data in hexadecimal format. Use the toggle to show/hide the data.
        </p>
      </CardHeader>
      {showCbor && (
        <CardContent>
          <div className="bg-muted rounded-lg p-3">
            <code className="text-xs break-all whitespace-pre-wrap">
              {cborData}
            </code>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
