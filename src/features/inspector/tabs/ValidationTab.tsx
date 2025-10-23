// src/features/inspector/tabs/ValidationTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Shield, 
  Zap, 
  FileCheck, 
  Lightbulb,
  Copy,
  Download
} from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { TransactionValidator, ValidationReport, ValidationResult } from '@/lib/transaction-validator';
import { toast } from 'sonner';

interface ValidationTabProps {
  tx: DomainTx;
  txHex: string;
}

export function ValidationTab({ tx, txHex }: ValidationTabProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    validateTransaction();
  }, [tx, txHex]);

  const validateTransaction = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const validator = TransactionValidator.getInstance();
      const result = await validator.validate(tx, txHex);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-destructive';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-green-600';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security': return <Shield className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
      case 'compliance': return <FileCheck className="h-4 w-4" />;
      case 'best-practice': return <Lightbulb className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const copyReport = async () => {
    if (!report) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
      toast.success('Validation report copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy report');
    }
  };

  const downloadReport = () => {
    if (!report) return;
    
    const data = {
      transaction: tx,
      validation: report,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Validation report downloaded');
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Validating transaction...</p>
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
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Validation Failed</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={validateTransaction} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-muted-foreground">No validation data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedResults = report.results.reduce((acc, result) => {
    const category = result.rule.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(result);
    return acc;
  }, {} as Record<string, ValidationResult[]>);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Transaction Validation</h3>
          <div className="flex items-center space-x-2">
            <Badge variant={report.isValid ? "default" : "destructive"}>
              {report.isValid ? "Valid" : "Issues Found"}
            </Badge>
            <Badge variant="outline">
              Score: {report.score}/100
            </Badge>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={copyReport}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Report
          </Button>
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Score Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Validation Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Progress value={report.score} className="flex-1" />
              <span className="text-2xl font-bold">{report.score}/100</span>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{report.summary.passed}</div>
                <div className="text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">{report.summary.errors}</div>
                <div className="text-muted-foreground">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{report.summary.warnings}</div>
                <div className="text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{report.summary.info}</div>
                <div className="text-muted-foreground">Info</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Tabs defaultValue="all" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="best-practice">Best Practice</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="flex-1">
          <div className="space-y-2">
            {report.results.map((result, index) => (
              <ValidationResultCard key={index} result={result} />
            ))}
          </div>
        </TabsContent>
        
        {Object.entries(groupedResults).map(([category, results]) => (
          <TabsContent key={category} value={category} className="flex-1">
            <div className="space-y-2">
              {results.map((result, index) => (
                <ValidationResultCard key={index} result={result} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface ValidationResultCardProps {
  result: ValidationResult;
}

function ValidationResultCard({ result }: ValidationResultCardProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'border-destructive bg-destructive/5';
      case 'warning': return 'border-yellow-500 bg-yellow-500/5';
      case 'info': return 'border-blue-500 bg-blue-500/5';
      default: return 'border-green-500 bg-green-500/5';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security': return <Shield className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
      case 'compliance': return <FileCheck className="h-4 w-4" />;
      case 'best-practice': return <Lightbulb className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card className={`border-l-4 ${getSeverityColor(result.rule.severity)}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {getSeverityIcon(result.rule.severity)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium">{result.rule.name}</h4>
              <Badge variant="outline" className="text-xs">
                {result.rule.category}
              </Badge>
              {getCategoryIcon(result.rule.category)}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {result.rule.description}
            </p>
            <p className={`text-sm ${result.passed ? 'text-green-600' : 'text-destructive'}`}>
              {result.message}
            </p>
            {result.details && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  View Details
                </summary>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(result.details, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
