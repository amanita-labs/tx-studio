// src/components/transaction-search.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  X, 
  Clock, 
  Hash, 
  MapPin, 
  Coins, 
  FileText, 
  Code,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { DomainTx } from '@/domain/tx';
import { TransactionSearch, SearchFilter, SearchResults, SearchResult } from '@/lib/transaction-search';
import { cn } from '@/lib/utils';

interface TransactionSearchProps {
  tx: DomainTx;
  txHex: string;
  onResultClick?: (result: SearchResult) => void;
}

export function TransactionSearchComponent({ tx, txHex, onResultClick }: TransactionSearchProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>({
    query: '',
    type: 'all',
    caseSensitive: false,
    exactMatch: false
  });
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  const searchEngine = TransactionSearch.getInstance();

  useEffect(() => {
    if (query.trim()) {
      performSearch();
    } else {
      setResults(null);
    }
  }, [query, filter]);

  const performSearch = async () => {
    setIsSearching(true);
    
    try {
      const searchResults = searchEngine.search(tx, txHex, {
        ...filter,
        query: query.trim()
      });
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    if (query.trim()) {
      performSearch();
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
  };

  const toggleResultExpansion = (index: number) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getResultIcon = (field: string) => {
    if (field.includes('address')) return <MapPin className="h-4 w-4" />;
    if (field.includes('ada') || field.includes('quantity')) return <Coins className="h-4 w-4" />;
    if (field.includes('metadata')) return <FileText className="h-4 w-4" />;
    if (field.includes('script')) return <Code className="h-4 w-4" />;
    if (field === 'hex') return <Hash className="h-4 w-4" />;
    return <Search className="h-4 w-4" />;
  };

  const getResultColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    if (score >= 60) return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Search Transaction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                placeholder="Search for addresses, amounts, metadata, scripts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="font-mono"
              />
            </div>
            <Button onClick={handleSearch} disabled={!query.trim() || isSearching}>
              {isSearching ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
            {query && (
              <Button variant="outline" onClick={clearSearch}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Search Options */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search Type</Label>
              <Select
                value={filter.type}
                onValueChange={(value: any) => setFilter(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  <SelectItem value="addresses">Addresses</SelectItem>
                  <SelectItem value="amounts">Amounts</SelectItem>
                  <SelectItem value="metadata">Metadata</SelectItem>
                  <SelectItem value="scripts">Scripts</SelectItem>
                  <SelectItem value="hex">Hex Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="case-sensitive"
                checked={filter.caseSensitive}
                onCheckedChange={(checked) => 
                  setFilter(prev => ({ ...prev, caseSensitive: !!checked }))
                }
              />
              <Label htmlFor="case-sensitive" className="text-sm">
                Case sensitive
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="exact-match"
                checked={filter.exactMatch}
                onCheckedChange={(checked) => 
                  setFilter(prev => ({ ...prev, exactMatch: !!checked }))
                }
              />
              <Label htmlFor="exact-match" className="text-sm">
                Exact match
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search Results</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {results.totalMatches} matches
                </Badge>
                <Badge variant="outline">
                  {results.executionTime.toFixed(2)}ms
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No matches found for "{query}"</p>
                <p className="text-sm">Try adjusting your search terms or filters</p>
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {results.results.map((result, index) => (
                    <Card 
                      key={index}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        getResultColor(result.score)
                      )}
                      onClick={() => onResultClick?.(result)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            {getResultIcon(result.field)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-medium text-sm">
                                  {result.context}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(result.score)}% match
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                Field: {result.field}
                              </div>
                              <div className="font-mono text-sm bg-muted/50 rounded p-2 break-all">
                                {result.match}
                              </div>
                              {typeof result.value === 'object' && (
                                <div className="mt-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleResultExpansion(index);
                                    }}
                                  >
                                    {expandedResults.has(index) ? (
                                      <ChevronDown className="h-4 w-4 mr-1" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 mr-1" />
                                    )}
                                    {expandedResults.has(index) ? 'Hide' : 'Show'} Full Value
                                  </Button>
                                  {expandedResults.has(index) && (
                                    <div className="mt-2 p-2 bg-muted/30 rounded text-xs font-mono break-all">
                                      {JSON.stringify(result.value, null, 2)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
