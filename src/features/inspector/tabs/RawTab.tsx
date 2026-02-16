// src/features/inspector/tabs/RawTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { CBORAnnotator, CBORNode, CBORAnnotation } from '@/lib/cbor-annotator';
import { ByteGutter } from '@/components/byte-gutter';
import { AnnotatedTree } from '@/components/annotated-tree';
import { JsonViewer } from '@/components/json-viewer';
import { toast } from 'sonner';
import { safeStringify } from '@/lib/utils';
import { DomainTx } from '@/domain/tx';

interface RawTabProps {
  tx: DomainTx;
  txHex: string;
}

export function RawTab({ tx, txHex }: RawTabProps) {
  const [annotation, setAnnotation] = useState<CBORAnnotation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CBORNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<CBORNode | null>(null);

  useEffect(() => {
    if (txHex) {
      annotateTransaction();
    }
  }, [txHex]);

  const annotateTransaction = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const annotator = CBORAnnotator.getInstance();
      const result = await annotator.annotate(txHex);
      setAnnotation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to annotate CBOR');
    } finally {
      setIsLoading(false);
    }
  };

  const getHighlightedRanges = (): Array<{ start: number; end: number; color: string; label: string }> => {
    if (!annotation || !hoveredNode) return [];

    return [{
      start: hoveredNode.startByte,
      end: hoveredNode.endByte - 1,
      color: 'bg-blue-200 dark:bg-blue-800',
      label: hoveredNode.label || 'Selected node'
    }];
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadJson = () => {
    const jsonString = safeStringify(tx, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-${tx.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Raw Transaction Data</h3>
          {annotation && (
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {annotation.totalBytes} bytes
              </Badge>
              {annotation.warnings.length > 0 && (
                <Badge variant="destructive">
                  {annotation.warnings.length} warnings
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {annotation && annotation.warnings.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {annotation.warnings.map((warning, index) => (
                <li key={index} className="text-sm text-destructive">
                  • {warning}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="json" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="tree">Annotated Tree</TabsTrigger>
          <TabsTrigger value="bytes">Byte View</TabsTrigger>
        </TabsList>

        <TabsContent value="json" className="flex-1 flex flex-col">
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadJson}
            >
              <Download className="h-4 w-4 mr-2" />
              Download JSON
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <JsonViewer
              data={tx}
              title="Transaction JSON"
            />
          </div>
        </TabsContent>

        <TabsContent value="tree" className="flex-1 flex flex-col">
          {isLoading ? (
            <Card className="flex-1">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Analyzing CBOR structure...</p>
                </div>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="flex-1">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">CBOR Analysis Failed</h3>
                  <p className="text-muted-foreground mb-4">{error}</p>
                  <Button onClick={annotateTransaction} variant="outline">
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : annotation ? (
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>CBOR Structure</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(safeStringify(annotation, 2), 'CBOR annotation')}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <AnnotatedTree
                  nodes={annotation.nodes}
                  onNodeHover={setHoveredNode}
                  onNodeClick={setSelectedNode}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex-1">
              <CardContent className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No CBOR data to analyze</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bytes" className="flex-1 flex flex-col">
          {isLoading ? (
            <Card className="flex-1">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Analyzing CBOR structure...</p>
                </div>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="flex-1">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">CBOR Analysis Failed</h3>
                  <p className="text-muted-foreground mb-4">{error}</p>
                  <Button onClick={annotateTransaction} variant="outline">
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : annotation ? (
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Byte-level View</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <ByteGutter
                  hex={txHex}
                  highlightedRanges={getHighlightedRanges()}
                  onByteHover={(byteIndex) => {
                    const node = findNodeByByteIndex(annotation.nodes, byteIndex);
                    if (node) {
                      setHoveredNode(node);
                    }
                  }}
                  onByteClick={(byteIndex) => {
                    const node = findNodeByByteIndex(annotation.nodes, byteIndex);
                    if (node) {
                      setSelectedNode(node);
                    }
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex-1">
              <CardContent className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No CBOR data to analyze</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              Selected Node Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium">Type:</span>
                  <span className="ml-2 text-sm">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">Range:</span>
                  <span className="ml-2 text-sm">{selectedNode.startByte}-{selectedNode.endByte - 1}</span>
                </div>
              </div>
              {selectedNode.label && (
                <div>
                  <span className="text-sm font-medium">Label:</span>
                  <span className="ml-2 text-sm">{selectedNode.label}</span>
                </div>
              )}
              {selectedNode.description && (
                <div>
                  <span className="text-sm font-medium">Description:</span>
                  <span className="ml-2 text-sm">{selectedNode.description}</span>
                </div>
              )}
              {selectedNode.semanticTag && (
                <div>
                  <span className="text-sm font-medium">Semantic Tag:</span>
                  <span className="ml-2 text-sm">{selectedNode.semanticTag}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to find node by byte index
function findNodeByByteIndex(nodes: CBORNode[], byteIndex: number): CBORNode | null {
  for (const node of nodes) {
    if (byteIndex >= node.startByte && byteIndex < node.endByte) {
      if (node.children) {
        const child = findNodeByByteIndex(node.children, byteIndex);
        if (child) return child;
      }
      return node;
    }
  }
  return null;
}
