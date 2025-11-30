// src/lib/transaction-validator.ts
import { DomainTx } from '@/domain/tx';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: 'security' | 'performance' | 'compliance' | 'best-practice';
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  message: string;
  details?: unknown;
}

export interface ValidationReport {
  isValid: boolean;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    errors: number;
    warnings: number;
    info: number;
  };
  score: number; // 0-100
}

export class TransactionValidator {
  private static instance: TransactionValidator;
  
  static getInstance(): TransactionValidator {
    if (!TransactionValidator.instance) {
      TransactionValidator.instance = new TransactionValidator();
    }
    return TransactionValidator.instance;
  }

  private rules: ValidationRule[] = [
    // Security Rules
    {
      id: 'tx-size-limit',
      name: 'Transaction Size Limit',
      description: 'Transaction should not exceed recommended size limits',
      severity: 'warning',
      category: 'security'
    },
    {
      id: 'fee-reasonable',
      name: 'Reasonable Fee',
      description: 'Transaction fee should be within reasonable bounds',
      severity: 'warning',
      category: 'security'
    },
    {
      id: 'output-min-ada',
      name: 'Minimum ADA Output',
      description: 'All outputs should contain minimum ADA amount',
      severity: 'error',
      category: 'security'
    },
    {
      id: 'dust-outputs',
      name: 'Dust Outputs',
      description: 'Avoid creating dust outputs (very small amounts)',
      severity: 'warning',
      category: 'best-practice'
    },
    {
      id: 'input-output-balance',
      name: 'Input/Output Balance',
      description: 'Total input value should equal total output value plus fee',
      severity: 'error',
      category: 'security'
    },
    {
      id: 'ttl-valid',
      name: 'Valid TTL',
      description: 'Transaction TTL should be reasonable',
      severity: 'warning',
      category: 'compliance'
    },
    {
      id: 'metadata-size',
      name: 'Metadata Size',
      description: 'Metadata should not exceed size limits',
      severity: 'warning',
      category: 'performance'
    },
    {
      id: 'script-complexity',
      name: 'Script Complexity',
      description: 'Script execution should be within limits',
      severity: 'warning',
      category: 'performance'
    },
    {
      id: 'collateral-ratio',
      name: 'Collateral Ratio',
      description: 'Collateral inputs should be sufficient',
      severity: 'warning',
      category: 'security'
    },
    {
      id: 'witness-count',
      name: 'Witness Count',
      description: 'Number of witnesses should be reasonable',
      severity: 'info',
      category: 'performance'
    }
  ];

  async validate(tx: DomainTx, txHex: string): Promise<ValidationReport> {
    const results: ValidationResult[] = [];
    
    // Run all validation rules
    for (const rule of this.rules) {
      const result = await this.runRule(rule, tx, txHex);
      results.push(result);
    }

    // Calculate summary
    const summary = this.calculateSummary(results);
    const score = this.calculateScore(results);
    const isValid = summary.errors === 0;

    return {
      isValid,
      results,
      summary,
      score
    };
  }

  private async runRule(rule: ValidationRule, tx: DomainTx, txHex: string): Promise<ValidationResult> {
    try {
      switch (rule.id) {
        case 'tx-size-limit':
          return this.validateTransactionSize(tx, rule);
        case 'fee-reasonable':
          return this.validateFee(tx, rule);
        case 'output-min-ada':
          return this.validateMinAdaOutputs(tx, rule);
        case 'dust-outputs':
          return this.validateDustOutputs(tx, rule);
        case 'input-output-balance':
          return this.validateInputOutputBalance(tx, rule);
        case 'ttl-valid':
          return this.validateTTL(tx, rule);
        case 'metadata-size':
          return this.validateMetadataSize(tx, rule);
        case 'script-complexity':
          return this.validateScriptComplexity(tx, rule);
        case 'collateral-ratio':
          return this.validateCollateralRatio(tx, rule);
        case 'witness-count':
          return this.validateWitnessCount(tx, rule);
        default:
          return {
            rule,
            passed: true,
            message: 'Rule not implemented'
          };
      }
    } catch (error) {
      return {
        rule,
        passed: false,
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }

  private validateTransactionSize(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const maxSize = 16384; // 16KB limit
    const currentSize = tx.sizeBytes;
    const passed = currentSize <= maxSize;
    
    return {
      rule,
      passed,
      message: passed 
        ? `Transaction size (${currentSize} bytes) is within limits`
        : `Transaction size (${currentSize} bytes) exceeds recommended limit of ${maxSize} bytes`,
      details: { currentSize, maxSize }
    };
  }

  private validateFee(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const fee = tx.feeLovelace;
    const minFee = 155381n; // Base fee
    const maxFee = 1000000000n; // 1000 ADA max fee (reasonable upper bound)
    
    const passed = fee >= minFee && fee <= maxFee;
    
    return {
      rule,
      passed,
      message: passed
        ? `Transaction fee (${this.formatLovelace(fee)}) is reasonable`
        : `Transaction fee (${this.formatLovelace(fee)}) is outside reasonable bounds`,
      details: { fee, minFee, maxFee }
    };
  }

  private validateMinAdaOutputs(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const minAda = 1000000n; // 1 ADA minimum
    const invalidOutputs = tx.outputs.filter(output => output.ada < minAda);
    const passed = invalidOutputs.length === 0;
    
    return {
      rule,
      passed,
      message: passed
        ? 'All outputs meet minimum ADA requirement'
        : `${invalidOutputs.length} output(s) below minimum ADA requirement`,
      details: { invalidOutputs, minAda }
    };
  }

  private validateDustOutputs(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const dustThreshold = 2000000n; // 2 ADA dust threshold
    const dustOutputs = tx.outputs.filter(output => output.ada < dustThreshold);
    const passed = dustOutputs.length === 0;
    
    return {
      rule,
      passed,
      message: passed
        ? 'No dust outputs detected'
        : `${dustOutputs.length} potential dust output(s) detected`,
      details: { dustOutputs, dustThreshold }
    };
  }

  private validateInputOutputBalance(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const totalInput = tx.inputs.reduce((sum, input) => {
      return sum + (input.resolved?.value?.ada || 0n);
    }, 0n);
    
    const totalOutput = tx.outputs.reduce((sum, output) => sum + output.ada, 0n);
    const totalFee = tx.feeLovelace;
    
    const expectedTotal = totalOutput + totalFee;
    const passed = totalInput === expectedTotal;
    
    return {
      rule,
      passed,
      message: passed
        ? 'Input/output balance is correct'
        : `Input/output balance mismatch: ${this.formatLovelace(totalInput)} in, ${this.formatLovelace(expectedTotal)} out + fee`,
      details: { totalInput, totalOutput, totalFee, expectedTotal }
    };
  }

  private validateTTL(tx: DomainTx, rule: ValidationRule): ValidationResult {
    if (!tx.ttl) {
      return {
        rule,
        passed: true,
        message: 'No TTL set (valid for some transaction types)'
      };
    }
    
    const currentSlot = Date.now() / 1000; // Approximate current slot
    const ttlSlot = tx.ttl;
    const passed = ttlSlot > currentSlot;
    
    return {
      rule,
      passed,
      message: passed
        ? `TTL (${ttlSlot}) is valid`
        : `TTL (${ttlSlot}) may have expired`,
      details: { ttlSlot, currentSlot }
    };
  }

  private validateMetadataSize(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const maxMetadataSize = 16384; // 16KB limit
    const totalMetadataSize = (tx.metadata || []).reduce((sum, meta) => {
      return sum + (meta.cbor?.length || 0);
    }, 0);
    
    const passed = totalMetadataSize <= maxMetadataSize;
    
    return {
      rule,
      passed,
      message: passed
        ? `Metadata size (${totalMetadataSize} bytes) is within limits`
        : `Metadata size (${totalMetadataSize} bytes) exceeds limit of ${maxMetadataSize} bytes`,
      details: { totalMetadataSize, maxMetadataSize }
    };
  }

  private validateScriptComplexity(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const scriptCount = tx.scripts?.length || 0;
    const redeemerCount = tx.redeemers?.length || 0;
    const passed = scriptCount < 10 && redeemerCount < 20; // Reasonable limits
    
    return {
      rule,
      passed,
      message: passed
        ? `Script complexity is reasonable (${scriptCount} scripts, ${redeemerCount} redeemers)`
        : `High script complexity: ${scriptCount} scripts, ${redeemerCount} redeemers`,
      details: { scriptCount, redeemerCount }
    };
  }

  private validateCollateralRatio(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const collateralInputs = tx.inputs.filter(input => input.isCollateral);
    const scriptInputs = tx.inputs.filter(input => {
      const resolved = input.resolved as { scriptRef?: unknown } | undefined;
      return resolved?.scriptRef !== undefined;
    });
    
    if (scriptInputs.length === 0) {
      return {
        rule,
        passed: true,
        message: 'No script inputs, collateral validation not applicable'
      };
    }
    
    const collateralRatio = collateralInputs.length / scriptInputs.length;
    const passed = collateralRatio >= 0.1; // At least 10% collateral
    
    return {
      rule,
      passed,
      message: passed
        ? `Collateral ratio (${(collateralRatio * 100).toFixed(1)}%) is adequate`
        : `Low collateral ratio: ${(collateralRatio * 100).toFixed(1)}%`,
      details: { collateralInputs: collateralInputs.length, scriptInputs: scriptInputs.length, collateralRatio }
    };
  }

  private validateWitnessCount(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const totalWitnesses = tx.witnesses.vkeyCount + tx.witnesses.nativeCount + tx.witnesses.plutusCount;
    const passed = totalWitnesses < 50; // Reasonable limit
    
    return {
      rule,
      passed,
      message: passed
        ? `Witness count (${totalWitnesses}) is reasonable`
        : `High witness count: ${totalWitnesses}`,
      details: { totalWitnesses, breakdown: tx.witnesses }
    };
  }

  private calculateSummary(results: ValidationResult[]) {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const errors = results.filter(r => !r.passed && r.rule.severity === 'error').length;
    const warnings = results.filter(r => !r.passed && r.rule.severity === 'warning').length;
    const info = results.filter(r => !r.passed && r.rule.severity === 'info').length;
    
    return { total, passed, errors, warnings, info };
  }

  private calculateScore(results: ValidationResult[]): number {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const errorWeight = 3;
    const warningWeight = 2;
    const infoWeight = 1;
    
    const errorPenalty = results.filter(r => !r.passed && r.rule.severity === 'error').length * errorWeight;
    const warningPenalty = results.filter(r => !r.passed && r.rule.severity === 'warning').length * warningWeight;
    const infoPenalty = results.filter(r => !r.passed && r.rule.severity === 'info').length * infoWeight;
    
    const maxPenalty = total * errorWeight;
    const penalty = errorPenalty + warningPenalty + infoPenalty;
    
    return Math.max(0, Math.round(100 - (penalty / maxPenalty) * 100));
  }

  private formatLovelace(lovelace: bigint): string {
    const ada = Number(lovelace) / 1000000;
    return `${ada.toFixed(6)} ADA`;
  }
}
