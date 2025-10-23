// src/features/inspector/tabs/ScriptsTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Code, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Download,
  FileCode,
  Cpu,
  HardDrive,
  Clock,
  Hash,
  Info
} from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { ScriptAnalyzer, ScriptAnalysis, ScriptInfo, RedeemerInfo } from '@/lib/script-analyzer';
import { toast } from 'sonner';

interface ScriptsTabProps {
  tx: DomainTx;
}

export function ScriptsTab({ tx }: ScriptsTabProps) {
  const [analysis, setAnalysis] = useState<ScriptAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyzeScripts();
  }, [tx]);

  const analyzeScripts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const analyzer = ScriptAnalyzer.getInstance();
      const result = await analyzer.analyze(tx);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Script analysis failed');
    } finally {
      setIsLoading(false);
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

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'spend': return <Zap className="h-4 w-4" />;
      case 'mint': return <Hash className="h-4 w-4" />;
      case 'cert': return <CheckCircle2 className="h-4 w-4" />;
      case 'reward': return <Cpu className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const copyAnalysis = async () => {
    if (!analysis) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(analysis, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
      toast.success('Script analysis copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy analysis');
    }
  };

  const downloadAnalysis = () => {
    if (!analysis) return;
    
    const data = {
      transaction: tx,
      scriptAnalysis: analysis,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Script analysis downloaded');
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyzing scripts...</p>
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
            <Button onClick={analyzeScripts} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
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
          <h3 className="text-lg font-semibold">Script Analysis</h3>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {analysis.totalScripts} scripts
            </Badge>
            <Badge variant="outline">
              {analysis.totalRedeemers} redeemers
            </Badge>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={copyAnalysis}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Analysis
          </Button>
          <Button variant="outline" size="sm" onClick={downloadAnalysis}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Complexity Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Cpu className="h-5 w-5 mr-2" />
            Complexity Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Progress value={analysis.complexityScore} className="flex-1" />
              <span className="text-2xl font-bold">{analysis.complexityScore}/100</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{analysis.totalScripts}</div>
                <div className="text-muted-foreground">Scripts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{analysis.totalRedeemers}</div>
                <div className="text-muted-foreground">Redeemers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(analysis.totalExecutionUnits.memory / 1000000)}MB
                </div>
                <div className="text-muted-foreground">Memory</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings and Recommendations */}
      {(analysis.warnings.length > 0 || analysis.recommendations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-yellow-600 mb-2">Warnings</h4>
                {analysis.warnings.map((warning, index) => (
                  <div key={index} className="flex items-start space-x-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
            {analysis.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-blue-600 mb-2">Recommendations</h4>
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

      {/* Scripts and Redeemers */}
      <Tabs defaultValue="scripts" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="redeemers">Redeemers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="scripts" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {analysis.scripts.map((script, index) => (
              <ScriptCard key={index} script={script} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="redeemers" className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {analysis.redeemers.map((redeemer, index) => (
              <RedeemerCard key={index} redeemer={redeemer} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ScriptCardProps {
  script: ScriptInfo;
}

function ScriptCard({ script }: ScriptCardProps) {
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

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getScriptTypeIcon(script.type)}
            <span>Script {script.hash.slice(0, 8)}...</span>
            <Badge className={getScriptTypeColor(script.type)}>
              {script.type.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{script.size} bytes</Badge>
            <Badge variant="outline" className={getComplexityColor(script.complexity)}>
              {script.complexity} complexity
            </Badge>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{script.description}</p>
      </CardHeader>
      <CardContent>
        {script.warnings.length > 0 && (
          <div className="space-y-1 mb-4">
            {script.warnings.map((warning, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Purpose:</span>
            <span className="ml-2 capitalize">{script.purpose}</span>
          </div>
          <div>
            <span className="font-medium">Hash:</span>
            <code className="ml-2 text-xs">{script.hash}</code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RedeemerCardProps {
  redeemer: RedeemerInfo;
}

function RedeemerCard({ redeemer }: RedeemerCardProps) {
  const getPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'spend': return <Zap className="h-4 w-4" />;
      case 'mint': return <Hash className="h-4 w-4" />;
      case 'cert': return <CheckCircle2 className="h-4 w-4" />;
      case 'reward': return <Cpu className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getPurposeIcon(redeemer.purpose)}
            <span>Redeemer {redeemer.index}</span>
            <Badge variant="outline" className="capitalize">
              {redeemer.purpose}
            </Badge>
          </div>
          {redeemer.executionUnits && (
            <div className="flex items-center space-x-2 text-sm">
              <div className="flex items-center space-x-1">
                <HardDrive className="h-4 w-4" />
                <span>{redeemer.executionUnits.memory.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{redeemer.executionUnits.steps.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {redeemer.warnings.length > 0 && (
          <div className="space-y-1 mb-4">
            {redeemer.warnings.map((warning, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Script Hash:</span>
            <code className="ml-2 text-xs">{redeemer.scriptHash}</code>
          </div>
          <div>
            <span className="font-medium">Data Size:</span>
            <span className="ml-2">{redeemer.data.length} bytes</span>
          </div>
        </div>
        {redeemer.data && (
          <div className="mt-4">
            <span className="font-medium text-sm">Data:</span>
            <div className="bg-muted rounded p-2 mt-1">
              <code className="text-xs break-all">{redeemer.data}</code>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
