// src/components/export-dialog.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, FileCode, FileSpreadsheet, FileImage, File, FileJson, FileType } from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { ExportManager, ExportOptions } from '@/lib/export-manager';
import { toast } from 'sonner';

interface ExportDialogProps {
  tx: DomainTx;
  txHex: string;
  children?: React.ReactNode;
}

export function ExportDialog({ tx, txHex, children }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'json',
    includeHex: true,
    includeMetadata: true,
    includeScripts: true,
    includeValidation: false,
    includeCbor: false,
    prettyPrint: true,
    timestamp: true
  });

  const exportManager = ExportManager.getInstance();

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const blob = await exportManager.exportTransaction(tx, txHex, options);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cardano-tx-${tx.id.slice(0, 8)}-${options.format}.${options.format === 'txt' ? 'txt' : options.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Transaction exported as ${options.format.toUpperCase()}`);
      setOpen(false);
    } catch (error) {
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'json': return <FileJson className="h-4 w-4" />;
      case 'yaml': return <FileCode className="h-4 w-4" />;
      case 'csv': return <FileSpreadsheet className="h-4 w-4" />;
      case 'xml': return <FileCode className="h-4 w-4" />;
      case 'txt': return <FileText className="h-4 w-4" />;
      case 'html': return <FileCode className="h-4 w-4" />;
      case 'pdf': return <FileImage className="h-4 w-4" />;
      default: return <File className="h-4 w-4" />;
    }
  };

  const supportedFormats = exportManager.getSupportedFormats();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Export Transaction
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Export Format</Label>
            <div className="grid grid-cols-2 gap-3">
              {supportedFormats.map((format) => (
                <Card 
                  key={format}
                  className={`cursor-pointer transition-all ${
                    options.format === format 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setOptions(prev => ({ ...prev, format: format as any }))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      {getFormatIcon(format)}
                      <div className="flex-1">
                        <div className="font-medium capitalize">{format}</div>
                        <div className="text-sm text-muted-foreground">
                          {exportManager.getFormatDescription(format)}
                        </div>
                      </div>
                      {options.format === format && (
                        <Badge variant="secondary">Selected</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Export Options</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-hex"
                  checked={options.includeHex}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeHex: !!checked }))
                  }
                />
                <Label htmlFor="include-hex" className="text-sm">
                  Include transaction hex
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-metadata"
                  checked={options.includeMetadata}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeMetadata: !!checked }))
                  }
                />
                <Label htmlFor="include-metadata" className="text-sm">
                  Include metadata
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-scripts"
                  checked={options.includeScripts}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeScripts: !!checked }))
                  }
                />
                <Label htmlFor="include-scripts" className="text-sm">
                  Include scripts
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-validation"
                  checked={options.includeValidation}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeValidation: !!checked }))
                  }
                />
                <Label htmlFor="include-validation" className="text-sm">
                  Include validation results
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-cbor"
                  checked={options.includeCbor}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeCbor: !!checked }))
                  }
                />
                <Label htmlFor="include-cbor" className="text-sm">
                  Include CBOR data
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pretty-print"
                  checked={options.prettyPrint}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, prettyPrint: !!checked }))
                  }
                />
                <Label htmlFor="pretty-print" className="text-sm">
                  Pretty print (JSON/YAML)
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timestamp"
                  checked={options.timestamp}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, timestamp: !!checked }))
                  }
                />
                <Label htmlFor="timestamp" className="text-sm">
                  Include timestamp
                </Label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Export Preview</Label>
            <div className="bg-muted rounded-lg p-4 text-sm">
              <div className="font-medium">File: cardano-tx-{tx.id.slice(0, 8)}-{options.format}.{options.format === 'txt' ? 'txt' : options.format}</div>
              <div className="text-muted-foreground mt-1">
                Format: {options.format.toUpperCase()} • 
                Size: ~{Math.round(txHex.length / 2 / 1024)}KB • 
                Includes: {[
                  options.includeHex && 'Hex',
                  options.includeMetadata && 'Metadata',
                  options.includeScripts && 'Scripts',
                  options.includeValidation && 'Validation',
                  options.includeCbor && 'CBOR'
                ].filter(Boolean).join(', ') || 'Basic data'}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Transaction
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
