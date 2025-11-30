// src/lib/transaction-search.ts
import { DomainTx } from '@/domain/tx';

export interface SearchFilter {
  query: string;
  type: 'all' | 'addresses' | 'amounts' | 'metadata' | 'scripts' | 'hex';
  caseSensitive: boolean;
  exactMatch: boolean;
}

export interface SearchResult {
  field: string;
  value: unknown;
  match: string;
  context: string;
  score: number;
}

export interface SearchResults {
  results: SearchResult[];
  totalMatches: number;
  query: string;
  executionTime: number;
}

export class TransactionSearch {
  private static instance: TransactionSearch;
  
  static getInstance(): TransactionSearch {
    if (!TransactionSearch.instance) {
      TransactionSearch.instance = new TransactionSearch();
    }
    return TransactionSearch.instance;
  }

  search(tx: DomainTx, txHex: string, filter: SearchFilter): SearchResults {
    const startTime = performance.now();
    const results: SearchResult[] = [];
    
    if (!filter.query.trim()) {
      return {
        results: [],
        totalMatches: 0,
        query: filter.query,
        executionTime: performance.now() - startTime
      };
    }

    const query = filter.caseSensitive ? filter.query : filter.query.toLowerCase();
    
    // Search based on type
    switch (filter.type) {
      case 'all':
        this.searchAll(tx, txHex, query, filter, results);
        break;
      case 'addresses':
        this.searchAddresses(tx, query, filter, results);
        break;
      case 'amounts':
        this.searchAmounts(tx, query, filter, results);
        break;
      case 'metadata':
        this.searchMetadata(tx, query, filter, results);
        break;
      case 'scripts':
        this.searchScripts(tx, query, filter, results);
        break;
      case 'hex':
        this.searchHex(txHex, query, filter, results);
        break;
    }

    // Sort by score (relevance)
    results.sort((a, b) => b.score - a.score);

    return {
      results,
      totalMatches: results.length,
      query: filter.query,
      executionTime: performance.now() - startTime
    };
  }

  private searchAll(tx: DomainTx, txHex: string, query: string, filter: SearchFilter, results: SearchResult[]) {
    this.searchAddresses(tx, query, filter, results);
    this.searchAmounts(tx, query, filter, results);
    this.searchMetadata(tx, query, filter, results);
    this.searchScripts(tx, query, filter, results);
    this.searchHex(txHex, query, filter, results);
    this.searchBasicFields(tx, query, filter, results);
  }

  private searchAddresses(tx: DomainTx, query: string, filter: SearchFilter, results: SearchResult[]) {
    // Search in input addresses
    tx.inputs.forEach((input, index) => {
      if (input.resolved?.address) {
        const address = filter.caseSensitive ? input.resolved.address : input.resolved.address.toLowerCase();
        if (this.matchesQuery(address, query, filter.exactMatch)) {
          results.push({
            field: `inputs[${index}].address`,
            value: input.resolved.address,
            match: input.resolved.address,
            context: `Input ${index + 1} address`,
            score: this.calculateScore(input.resolved.address, query)
          });
        }
      }
    });

    // Search in output addresses
    tx.outputs.forEach((output, index) => {
      const address = filter.caseSensitive ? output.address : output.address.toLowerCase();
      if (this.matchesQuery(address, query, filter.exactMatch)) {
        results.push({
          field: `outputs[${index}].address`,
          value: output.address,
          match: output.address,
          context: `Output ${index + 1} address`,
          score: this.calculateScore(output.address, query)
        });
      }
    });
  }

  private searchAmounts(tx: DomainTx, query: string, filter: SearchFilter, results: SearchResult[]) {
    const queryNum = parseFloat(query);
    if (isNaN(queryNum)) return;

    // Search in input amounts
    tx.inputs.forEach((input, index) => {
      if (input.resolved?.value?.ada) {
        const amount = Number(input.resolved.value.ada);
        if (this.matchesAmount(amount, queryNum, filter.exactMatch)) {
          results.push({
            field: `inputs[${index}].value.ada`,
            value: input.resolved.value.ada,
            match: input.resolved.value.ada.toString(),
            context: `Input ${index + 1} ADA amount`,
            score: this.calculateAmountScore(amount, queryNum)
          });
        }
      }
    });

    // Search in output amounts
    tx.outputs.forEach((output, index) => {
      const amount = Number(output.ada);
      if (this.matchesAmount(amount, queryNum, filter.exactMatch)) {
        results.push({
          field: `outputs[${index}].ada`,
          value: output.ada,
          match: output.ada.toString(),
          context: `Output ${index + 1} ADA amount`,
          score: this.calculateAmountScore(amount, queryNum)
        });
      }
    });

    // Search in asset quantities
    tx.outputs.forEach((output, outputIndex) => {
      output.assets.forEach((asset, assetIndex) => {
        const quantity = Number(asset.quantity);
        if (this.matchesAmount(quantity, queryNum, filter.exactMatch)) {
          results.push({
            field: `outputs[${outputIndex}].assets[${assetIndex}].quantity`,
            value: asset.quantity,
            match: asset.quantity.toString(),
            context: `Output ${outputIndex + 1} asset ${asset.assetName} quantity`,
            score: this.calculateAmountScore(quantity, queryNum)
          });
        }
      });
    });
  }

  private searchMetadata(tx: DomainTx, query: string, filter: SearchFilter, results: SearchResult[]) {
    if (!tx.metadata) return;

    tx.metadata.forEach((meta, index) => {
      // Search in label
      const label = filter.caseSensitive ? meta.label.toString() : meta.label.toString().toLowerCase();
      if (this.matchesQuery(label, query, filter.exactMatch)) {
        results.push({
          field: `metadata[${index}].label`,
          value: meta.label,
          match: meta.label.toString(),
          context: `Metadata label ${meta.label}`,
          score: this.calculateScore(meta.label.toString(), query)
        });
      }

      // Search in JSON data
      if (meta.json) {
        const jsonStr = JSON.stringify(meta.json);
        const searchStr = filter.caseSensitive ? jsonStr : jsonStr.toLowerCase();
        if (this.matchesQuery(searchStr, query, filter.exactMatch)) {
          results.push({
            field: `metadata[${index}].json`,
            value: meta.json,
            match: this.extractMatch(jsonStr, query),
            context: `Metadata ${meta.label} JSON data`,
            score: this.calculateScore(jsonStr, query)
          });
        }
      }

      // Search in CBOR data
      if (meta.cbor) {
        const cbor = filter.caseSensitive ? meta.cbor : meta.cbor.toLowerCase();
        if (this.matchesQuery(cbor, query, filter.exactMatch)) {
          results.push({
            field: `metadata[${index}].cbor`,
            value: meta.cbor,
            match: this.extractMatch(meta.cbor, query),
            context: `Metadata ${meta.label} CBOR data`,
            score: this.calculateScore(meta.cbor, query)
          });
        }
      }
    });
  }

  private searchScripts(tx: DomainTx, query: string, filter: SearchFilter, results: SearchResult[]) {
    if (!tx.scripts) return;

    tx.scripts.forEach((script, index) => {
      // Search in script hash
      if (script.hash) {
        const hash = filter.caseSensitive ? script.hash : script.hash.toLowerCase();
        if (this.matchesQuery(hash, query, filter.exactMatch)) {
          results.push({
            field: `scripts[${index}].hash`,
            value: script.hash,
            match: script.hash,
            context: `Script ${index + 1} hash`,
            score: this.calculateScore(script.hash, query)
          });
        }
      }

      // Search in script bytes (if available)
      const scriptWithBytes = script as { bytes?: string };
      if (scriptWithBytes.bytes) {
        const bytes = filter.caseSensitive ? scriptWithBytes.bytes : scriptWithBytes.bytes.toLowerCase();
        if (this.matchesQuery(bytes, query, filter.exactMatch)) {
          results.push({
            field: `scripts[${index}].bytes`,
            value: scriptWithBytes.bytes,
            match: this.extractMatch(scriptWithBytes.bytes, query),
            context: `Script ${index + 1} bytes`,
            score: this.calculateScore(scriptWithBytes.bytes, query)
          });
        }
      }
    });
  }

  private searchHex(txHex: string, query: string, filter: SearchFilter, results: SearchResult[]) {
    const hex = filter.caseSensitive ? txHex : txHex.toLowerCase();
    const searchQuery = filter.caseSensitive ? query : query.toLowerCase();
    
    if (this.matchesQuery(hex, searchQuery, filter.exactMatch)) {
      results.push({
        field: 'hex',
        value: txHex,
        match: this.extractMatch(txHex, query),
        context: 'Transaction hex data',
        score: this.calculateScore(txHex, query)
      });
    }
  }

  private searchBasicFields(tx: DomainTx, query: string, filter: SearchFilter, results: SearchResult[]) {
    // Search in transaction ID
    const id = filter.caseSensitive ? tx.id : tx.id.toLowerCase();
    if (this.matchesQuery(id, query, filter.exactMatch)) {
      results.push({
        field: 'id',
        value: tx.id,
        match: tx.id,
        context: 'Transaction ID',
        score: this.calculateScore(tx.id, query)
      });
    }
  }

  private matchesQuery(text: string, query: string, exactMatch: boolean): boolean {
    if (exactMatch) {
      return text === query;
    }
    return text.includes(query);
  }

  private matchesAmount(amount: number, query: number, exactMatch: boolean): boolean {
    if (exactMatch) {
      return amount === query;
    }
    // Allow for some tolerance in amount matching
    const tolerance = Math.abs(query) * 0.01; // 1% tolerance
    return Math.abs(amount - query) <= tolerance;
  }

  private calculateScore(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact match gets highest score
    if (textLower === queryLower) return 100;
    
    // Starts with query gets high score
    if (textLower.startsWith(queryLower)) return 80;
    
    // Contains query gets medium score
    if (textLower.includes(queryLower)) return 60;
    
    // Partial match gets low score
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    const matchingWords = queryWords.filter(qw => 
      textWords.some(tw => tw.includes(qw))
    ).length;
    
    return (matchingWords / queryWords.length) * 40;
  }

  private calculateAmountScore(amount: number, query: number): number {
    const diff = Math.abs(amount - query);
    const maxDiff = Math.max(amount, query);
    return Math.max(0, 100 - (diff / maxDiff) * 100);
  }

  private extractMatch(text: string, query: string): string {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return query;
    
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + query.length + 20);
    const match = text.slice(start, end);
    
    return start > 0 ? '...' + match : match + (end < text.length ? '...' : '');
  }
}
