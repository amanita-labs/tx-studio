// src/lib/metadata-parser.ts
import { DomainTx } from '@/domain/tx';
import { decode } from 'cbor-x';
import { ensureCip10Registry, getCip10Entry } from './cip10-registry';

export interface ParsedMetadata {
  label: number;
  type: 'json' | 'cbor' | 'unknown';
  data: any;
  size: number;
  description: string;
  cip10Description?: string;
  category: 'nft' | 'token' | 'governance' | 'custom' | 'unknown';
  warnings: string[];
  formattedData?: any;
  decodedCbor?: any; // JSON representation of CBOR data
  structure?: {
    hasContext?: boolean;
    hasHashAlgorithm?: boolean;
    hasTxAuthor?: boolean;
    hasInstance?: boolean;
    hasBody?: boolean;
    keyCount?: number;
    depth?: number;
  };
}

export interface MetadataAnalysis {
  totalSize: number;
  parsedMetadata: ParsedMetadata[];
  categories: Record<string, number>;
  warnings: string[];
  recommendations: string[];
}

export class MetadataParser {
  private static instance: MetadataParser;
  
  static getInstance(): MetadataParser {
    if (!MetadataParser.instance) {
      MetadataParser.instance = new MetadataParser();
    }
    return MetadataParser.instance;
  }

  async analyze(tx: DomainTx): Promise<MetadataAnalysis> {
    await ensureCip10Registry();

    const parsedMetadata: ParsedMetadata[] = [];
    const warnings: string[] = [];
    const categories: Record<string, number> = {};
    let totalSize = 0;

    for (const metadata of tx.metadata || []) {
      try {
        const parsed = await this.parseMetadataEntry(metadata);
        parsedMetadata.push(parsed);
        totalSize += parsed.size;
        
        // Count categories
        categories[parsed.category] = (categories[parsed.category] || 0) + 1;
        
        // Collect warnings
        warnings.push(...parsed.warnings);
      } catch (error) {
        warnings.push(`Failed to parse metadata label ${metadata.label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const recommendations = this.generateRecommendations(parsedMetadata, totalSize);

    return {
      totalSize,
      parsedMetadata,
      categories,
      warnings,
      recommendations
    };
  }

  private async parseMetadataEntry(metadata: any): Promise<ParsedMetadata> {
    const label = Number(metadata.label);
    const warnings: string[] = [];
    let data: any;
    let type: 'json' | 'cbor' | 'unknown' = 'unknown';
    let category: 'nft' | 'token' | 'governance' | 'custom' | 'unknown' = 'unknown';
    let description = '';

    // Determine type and parse data
    if (metadata.json) {
      type = 'json';
      data = metadata.json;
    } else if (metadata.cbor) {
      type = 'cbor';
      data = metadata.cbor;
    } else {
      warnings.push('No JSON or CBOR data found');
    }

    // Analyze content based on label and data
    let structure: any = {};
    let decodedCbor: any = undefined;
    
    if (type === 'json') {
      const analysis = this.analyzeJsonMetadata(label, data);
      category = analysis.category;
      description = analysis.description;
      warnings.push(...analysis.warnings);
      structure = analysis.structure || {};
    } else if (type === 'cbor') {
      const analysis = this.analyzeCborMetadata(label, data);
      category = analysis.category;
      description = analysis.description;
      warnings.push(...analysis.warnings);
      
      // Try to decode CBOR to JSON
      try {
        const cborBytes = this.hexToBytes(data);
        decodedCbor = decode(cborBytes);
        
        // Analyze the decoded CBOR structure
        if (typeof decodedCbor === 'object' && decodedCbor !== null) {
          structure = this.analyzeMetadataStructure(decodedCbor);
        }
      } catch (error) {
        warnings.push(`Failed to decode CBOR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const size = this.calculateMetadataSize(metadata);
    const cip10Description = getCip10Entry(label);

    return {
      label,
      type,
      data,
      size,
      description,
      cip10Description,
      category,
      warnings,
      structure,
      decodedCbor
    };
  }

  private analyzeJsonMetadata(label: number, data: any): { category: 'nft' | 'token' | 'governance' | 'custom' | 'unknown'; description: string; warnings: string[]; structure?: any } {
    const warnings: string[] = [];
    let category: 'nft' | 'token' | 'governance' | 'custom' | 'unknown' = 'unknown';
    let description = '';
    let structure: any = {};

    // Analyze structure
    if (typeof data === 'object' && data !== null) {
      structure = this.analyzeMetadataStructure(data);
    }

    // Known metadata labels
    switch (label) {
      case 721: // NFT metadata
        category = 'nft';
        description = 'NFT Metadata (CIP-25)';
        if (typeof data === 'object' && data !== null) {
          if (!data.name) warnings.push('NFT metadata missing name field');
          if (!data.image) warnings.push('NFT metadata missing image field');
          if (!data.description) warnings.push('NFT metadata missing description field');
        }
        break;
      
      case 20: // Token metadata
        category = 'token';
        description = 'Token Metadata (CIP-20)';
        if (typeof data === 'object' && data !== null) {
          if (!data.name) warnings.push('Token metadata missing name field');
          if (!data.ticker) warnings.push('Token metadata missing ticker field');
          if (!data.decimals && data.decimals !== 0) warnings.push('Token metadata missing decimals field');
        }
        break;
      
      case 61284: // Governance metadata
        category = 'governance';
        description = 'Governance Metadata (CIP-1694)';
        break;
      
      case 61285: // Governance metadata
        category = 'governance';
        description = 'Governance Metadata (CIP-1694)';
        break;
      
      default: {
        category = 'custom';
        description = `Custom Metadata (Label ${label})`;
        if (label < 100) {
          warnings.push('Using reserved metadata label (0-99)');
        }
        break;
      }
    }

    // Size warnings
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 8192) {
      warnings.push(`Large metadata entry: ${dataSize} bytes`);
    }

    return { category, description, warnings, structure };
  }

  private analyzeCborMetadata(label: number, cbor: string): { category: 'nft' | 'token' | 'governance' | 'custom' | 'unknown'; description: string; warnings: string[] } {
    const warnings: string[] = [];
    let category: 'nft' | 'token' | 'governance' | 'custom' | 'unknown' = 'unknown';
    let description = '';

    // For CBOR, we can only analyze the label and size
    switch (label) {
      case 721:
        category = 'nft';
        description = 'NFT Metadata (CIP-25) - CBOR Format';
        break;
      case 20:
        category = 'token';
        description = 'Token Metadata (CIP-20) - CBOR Format';
        break;
      case 61284:
      case 61285:
        category = 'governance';
        description = 'Governance Metadata (CIP-1694) - CBOR Format';
        break;
      default: {
        category = 'custom';
        description = `Custom Metadata (Label ${label}) - CBOR Format`;
        break;
      }
    }

    // CBOR size analysis
    const cborSize = cbor.length / 2; // Hex string, so divide by 2 for bytes
    if (cborSize > 8192) {
      warnings.push(`Large CBOR metadata: ${cborSize} bytes`);
    }

    return { category, description, warnings };
  }

  private calculateMetadataSize(metadata: any): number {
    let size = 0;
    
    if (metadata.json) {
      size += JSON.stringify(metadata.json).length;
    }
    
    if (metadata.cbor) {
      size += metadata.cbor.length / 2; // Hex string
    }
    
    return size;
  }

  private generateRecommendations(parsedMetadata: ParsedMetadata[], totalSize: number): string[] {
    const recommendations: string[] = [];

    // Size recommendations
    if (totalSize > 16384) {
      recommendations.push('Consider reducing metadata size to improve transaction performance');
    }

    // Category-specific recommendations
    const nftCount = parsedMetadata.filter(m => m.category === 'nft').length;
    const tokenCount = parsedMetadata.filter(m => m.category === 'token').length;
    const customCount = parsedMetadata.filter(m => m.category === 'custom').length;

    if (nftCount > 0) {
      recommendations.push('Ensure NFT metadata follows CIP-25 standard for better compatibility');
    }

    if (tokenCount > 0) {
      recommendations.push('Verify token metadata includes all required CIP-20 fields');
    }

    if (customCount > 0) {
      recommendations.push('Consider using standard metadata labels (721, 20, etc.) for better ecosystem compatibility');
    }

    // Warning-based recommendations
    const hasWarnings = parsedMetadata.some(m => m.warnings.length > 0);
    if (hasWarnings) {
      recommendations.push('Review metadata warnings to ensure proper formatting and completeness');
    }

    return recommendations;
  }

  private analyzeMetadataStructure(data: any, depth: number = 0): any {
    const structure: any = {
      keyCount: 0,
      depth: depth,
      hasContext: false,
      hasHashAlgorithm: false,
      hasTxAuthor: false,
      hasInstance: false,
      hasBody: false
    };

    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      structure.keyCount = keys.length;

      // Check for common metadata patterns
      if (data['@context'] || data.context) structure.hasContext = true;
      if (data.hashAlgorithm) structure.hasHashAlgorithm = true;
      if (data.txAuthor) structure.hasTxAuthor = true;
      if (data.instance) structure.hasInstance = true;
      if (data.body) structure.hasBody = true;

      // Analyze nested objects
      for (const key of keys) {
        if (typeof data[key] === 'object' && data[key] !== null) {
          const nestedStructure = this.analyzeMetadataStructure(data[key], depth + 1);
          structure[`${key}Structure`] = nestedStructure;
        }
      }
    }

    return structure;
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}
