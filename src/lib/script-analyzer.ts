// src/lib/script-analyzer.ts
import { DomainTx } from '@/domain/tx';

export interface ScriptInfo {
  type: 'native' | 'plutus-v1' | 'plutus-v2' | 'unknown';
  hash: string;
  size: number;
  purpose: 'spend' | 'mint' | 'cert' | 'reward' | 'unknown';
  complexity: 'low' | 'medium' | 'high';
  description: string;
  warnings: string[];
}

export interface RedeemerInfo {
  purpose: 'spend' | 'mint' | 'cert' | 'reward';
  scriptHash: string;
  data: string;
  executionUnits: {
    memory: number;
    steps: number;
  } | null;
  index: number;
  warnings: string[];
}

export interface ScriptAnalysis {
  scripts: ScriptInfo[];
  redeemers: RedeemerInfo[];
  totalScripts: number;
  totalRedeemers: number;
  totalExecutionUnits: {
    memory: number;
    steps: number;
  };
  complexityScore: number; // 0-100
  warnings: string[];
  recommendations: string[];
}

export class ScriptAnalyzer {
  private static instance: ScriptAnalyzer;
  
  static getInstance(): ScriptAnalyzer {
    if (!ScriptAnalyzer.instance) {
      ScriptAnalyzer.instance = new ScriptAnalyzer();
    }
    return ScriptAnalyzer.instance;
  }

  async analyze(tx: DomainTx): Promise<ScriptAnalysis> {
    const scripts: ScriptInfo[] = [];
    const redeemers: RedeemerInfo[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Analyze scripts
    if (tx.scripts && tx.scripts.length > 0) {
      for (const script of tx.scripts) {
        try {
          const scriptInfo = this.analyzeScript(script);
          scripts.push(scriptInfo);
        } catch (error) {
          warnings.push(`Failed to analyze script: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Analyze redeemers
    if (tx.redeemers && tx.redeemers.length > 0) {
      for (let i = 0; i < tx.redeemers.length; i++) {
        try {
          const redeemerInfo = this.analyzeRedeemer(tx.redeemers[i], i);
          redeemers.push(redeemerInfo);
        } catch (error) {
          warnings.push(`Failed to analyze redeemer ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Calculate total execution units
    const totalExecutionUnits = redeemers.reduce(
      (total, redeemer) => ({
        memory: total.memory + (redeemer.executionUnits?.memory || 0),
        steps: total.steps + (redeemer.executionUnits?.steps || 0)
      }),
      { memory: 0, steps: 0 }
    );

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(scripts, redeemers, totalExecutionUnits);

    // Generate recommendations
    this.generateRecommendations(scripts, redeemers, totalExecutionUnits, recommendations);

    return {
      scripts,
      redeemers,
      totalScripts: scripts.length,
      totalRedeemers: redeemers.length,
      totalExecutionUnits,
      complexityScore,
      warnings,
      recommendations
    };
  }

  private analyzeScript(script: { hash?: string; size?: number; purpose?: 'spend' | 'mint' | 'cert' | 'reward' | 'unknown' }): ScriptInfo {
    // This is a simplified analysis - in a real implementation,
    // you would parse the actual script bytes and analyze the Plutus code
    const hash = script.hash || 'unknown';
    const size = script.size || 0;
    
    // Determine script type based on size and other heuristics
    let type: 'native' | 'plutus-v1' | 'plutus-v2' | 'unknown' = 'unknown';
    let purpose: 'spend' | 'mint' | 'cert' | 'reward' | 'unknown' = 'unknown';
    let complexity: 'low' | 'medium' | 'high' = 'low';
    let description = '';
    const warnings: string[] = [];

    // Size-based heuristics
    if (size < 1000) {
      type = 'native';
      description = 'Native Script (Multi-signature or Time-based)';
      complexity = 'low';
    } else if (size < 10000) {
      type = 'plutus-v1';
      description = 'Plutus V1 Script';
      complexity = 'medium';
    } else if (size < 50000) {
      type = 'plutus-v2';
      description = 'Plutus V2 Script';
      complexity = 'high';
    } else {
      type = 'plutus-v2';
      description = 'Large Plutus V2 Script';
      complexity = 'high';
      warnings.push('Very large script - may have high execution costs');
    }

    // Purpose detection (simplified)
    if (script.purpose) {
      purpose = script.purpose;
    } else {
      // Try to infer purpose from context
      purpose = 'spend'; // Default assumption
    }

    // Additional warnings
    if (size > 16384) {
      warnings.push('Script size exceeds recommended limit');
    }

    if (type === 'plutus-v1') {
      warnings.push('Plutus V1 script - consider upgrading to V2 for better performance');
    }

    return {
      type,
      hash,
      size,
      purpose,
      complexity,
      description,
      warnings
    };
  }

  private analyzeRedeemer(redeemer: { purpose?: 'spend' | 'mint' | 'cert' | 'reward'; scriptHash?: string; data?: string; executionUnits?: { memory?: number; steps?: number } }, index: number): RedeemerInfo {
    const purpose = redeemer.purpose || 'spend';
    const scriptHash = redeemer.scriptHash || 'unknown';
    const data = redeemer.data || '';
    
    // Parse execution units
    let executionUnits = null;
    if (redeemer.executionUnits) {
      executionUnits = {
        memory: redeemer.executionUnits.memory || 0,
        steps: redeemer.executionUnits.steps || 0
      };
    }

    const warnings: string[] = [];

    // Check execution unit limits
    if (executionUnits) {
      if (executionUnits.memory > 14000000) {
        warnings.push('High memory usage - may exceed limits');
      }
      if (executionUnits.steps > 10000000000) {
        warnings.push('High step count - may exceed limits');
      }
    }

    // Check data size
    if (data.length > 10000) {
      warnings.push('Large redeemer data - may increase costs');
    }

    return {
      purpose,
      scriptHash,
      data,
      executionUnits,
      index,
      warnings
    };
  }

  private calculateComplexityScore(
    scripts: ScriptInfo[],
    redeemers: RedeemerInfo[],
    totalExecutionUnits: { memory: number; steps: number }
  ): number {
    let score = 0;

    // Script complexity
    const scriptComplexity = scripts.reduce((sum, script) => {
      switch (script.complexity) {
        case 'low': return sum + 10;
        case 'medium': return sum + 30;
        case 'high': return sum + 60;
        default: return sum + 5;
      }
    }, 0);

    // Redeemer complexity
    const redeemerComplexity = redeemers.length * 5;

    // Execution unit complexity
    const memoryComplexity = Math.min(totalExecutionUnits.memory / 1000000, 50);
    const stepComplexity = Math.min(totalExecutionUnits.steps / 100000000, 50);

    score = Math.min(scriptComplexity + redeemerComplexity + memoryComplexity + stepComplexity, 100);

    return Math.round(score);
  }

  private generateRecommendations(
    scripts: ScriptInfo[],
    redeemers: RedeemerInfo[],
    totalExecutionUnits: { memory: number; steps: number },
    recommendations: string[]
  ): void {
    // Script recommendations
    const plutusV1Count = scripts.filter(s => s.type === 'plutus-v1').length;
    if (plutusV1Count > 0) {
      recommendations.push(`Consider upgrading ${plutusV1Count} Plutus V1 script(s) to V2 for better performance`);
    }

    const largeScripts = scripts.filter(s => s.size > 10000).length;
    if (largeScripts > 0) {
      recommendations.push(`Optimize ${largeScripts} large script(s) to reduce execution costs`);
    }

    // Execution unit recommendations
    if (totalExecutionUnits.memory > 10000000) {
      recommendations.push('High memory usage detected - consider optimizing script logic');
    }

    if (totalExecutionUnits.steps > 5000000000) {
      recommendations.push('High step count detected - consider optimizing script efficiency');
    }

    // Redeemer recommendations
    if (redeemers.length > 10) {
      recommendations.push('High number of redeemers - consider batching operations');
    }

    // General recommendations
    if (scripts.length === 0 && redeemers.length === 0) {
      recommendations.push('No scripts detected - this is a simple transaction');
    } else if (scripts.length > 5) {
      recommendations.push('Complex script usage - ensure proper testing and gas estimation');
    }
  }
}
