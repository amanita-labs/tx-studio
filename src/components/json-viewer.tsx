// src/components/json-viewer.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface JsonViewerProps {
  data: any;
  title?: string;
  label?: string | number;
  category?: string;
  description?: string;
  onCopy?: (text: string, label: string) => void;
  className?: string;
}

export function JsonViewer({ 
  data, 
  title = "JSON Data", 
  label,
  category,
  description,
  onCopy,
  className = ""
}: JsonViewerProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [showRaw, setShowRaw] = useState(false);

  const toggleKey = (key: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (onCopy) {
      onCopy(text, label);
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
      } catch (error) {
        toast.error('Failed to copy to clipboard');
      }
    }
  };

  const formatValue = (value: any, key: string = '', depth: number = 0): JSX.Element => {
    const indent = '  '.repeat(depth);
    const keyStr = key ? `"${key}": ` : '';
    
    if (value === null) {
      return <span className="text-gray-500">null</span>;
    }
    
    if (value === undefined) {
      return <span className="text-gray-500">undefined</span>;
    }
    
    if (typeof value === 'boolean') {
      return <span className="text-blue-600">{value.toString()}</span>;
    }
    
    if (typeof value === 'number') {
      return <span className="text-green-600">{value}</span>;
    }
    
    if (typeof value === 'string') {
      // Check if it's a URL or hash
      if (value.startsWith('http') || value.startsWith('ipfs://')) {
        return (
          <span className="text-blue-500 underline cursor-pointer hover:text-blue-700" 
                onClick={() => window.open(value, '_blank')}>
            "{value}"
          </span>
        );
      }
      if (value.match(/^[a-fA-F0-9]{64}$/)) {
        return <span className="text-purple-600 font-mono">"{value}"</span>;
      }
      return <span className="text-orange-600">"{value}"</span>;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-500">[]</span>;
      }
      
      const arrayKey = key ? `${key}[]` : 'array';
      const isExpanded = expandedKeys.has(arrayKey);
      
      return (
        <div>
          <span 
            className="cursor-pointer hover:text-blue-600"
            onClick={() => toggleKey(arrayKey)}
          >
            {isExpanded ? <ChevronDown className="inline h-3 w-3 mr-1" /> : <ChevronRight className="inline h-3 w-3 mr-1" />}
            [
          </span>
          {isExpanded && (
            <div className="ml-4">
              {value.map((item, index) => (
                <div key={index} className="flex">
                  <span className="text-gray-400 mr-2">{index}:</span>
                  {formatValue(item, '', depth + 1)}
                  {index < value.length - 1 && <span className="text-gray-500">,</span>}
                </div>
              ))}
            </div>
          )}
          {!isExpanded && <span className="text-gray-500">...{value.length} items]</span>}
          {isExpanded && <span>]</span>}
        </div>
      );
    }
    
    if (typeof value === 'object') {
      const objectKey = key || 'object';
      const isExpanded = expandedKeys.has(objectKey);
      const keys = Object.keys(value);
      
      if (keys.length === 0) {
        return <span className="text-gray-500">{}</span>;
      }
      
      return (
        <div>
          <span 
            className="cursor-pointer hover:text-blue-600"
            onClick={() => toggleKey(objectKey)}
          >
            {isExpanded ? <ChevronDown className="inline h-3 w-3 mr-1" /> : <ChevronRight className="inline h-3 w-3 mr-1" />}
            {'{'}
          </span>
          {isExpanded && (
            <div className="ml-4">
              {keys.map((k, index) => (
                <div key={k} className="flex">
                  <span className="text-blue-600 mr-2">"{k}":</span>
                  {formatValue(value[k], '', depth + 1)}
                  {index < keys.length - 1 && <span className="text-gray-500">,</span>}
                </div>
              ))}
            </div>
          )}
          {!isExpanded && <span className="text-gray-500">...{keys.length} properties{'}'}</span>}
          {isExpanded && <span>{'}'}</span>}
        </div>
      );
    }
    
    return <span className="text-gray-500">{String(value)}</span>;
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'nft': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'token': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'governance': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'custom': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {title}
            {label && (
              <Badge variant="outline" className="text-xs">
                Label {label}
              </Badge>
            )}
            {category && (
              <Badge className={`text-xs ${getCategoryColor(category)}`}>
                {category}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRaw(!showRaw)}
            >
              {showRaw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(
                JSON.stringify(data, null, 2),
                'JSON metadata'
              )}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="bg-muted rounded-lg p-4 overflow-auto max-h-96">
          {showRaw ? (
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <div className="text-sm font-mono">
              {formatValue(data)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
