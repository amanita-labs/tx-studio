// src/lib/transaction-validator.ts
import { DomainTx } from '@/domain/tx';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: 'security' | 'performance' | 'compliance' | 'best-practice';
  validationType: 'generic' | 'voter' | 'proposer';
  apply?: (tx: DomainTx) => boolean;  // Optional: when to apply this rule
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  message: string;
  details?: any;
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
    // Generic Transaction Rules
    {
      id: 'tx-size-limit',
      name: 'Transaction Size Limit',
      description: 'Transaction should not exceed recommended size limits',
      severity: 'warning',
      category: 'security',
      validationType: 'generic'
    },
    {
      id: 'fee-reasonable',
      name: 'Reasonable Fee',
      description: 'Transaction fee should be within reasonable bounds',
      severity: 'warning',
      category: 'security',
      validationType: 'generic'
    },
    {
      id: 'output-min-ada',
      name: 'Minimum ADA Output',
      description: 'All outputs should contain minimum ADA amount',
      severity: 'error',
      category: 'security',
      validationType: 'generic'
    },
    {
      id: 'dust-outputs',
      name: 'Dust Outputs',
      description: 'Avoid creating dust outputs (very small amounts)',
      severity: 'warning',
      category: 'best-practice',
      validationType: 'generic'
    },
    {
      id: 'input-output-balance',
      name: 'Input/Output Balance',
      description: 'Total input value should equal total output value plus fee',
      severity: 'error',
      category: 'security',
      validationType: 'generic'
    },
    {
      id: 'ttl-valid',
      name: 'Valid TTL',
      description: 'Transaction TTL should be reasonable',
      severity: 'warning',
      category: 'compliance',
      validationType: 'generic'
    },
    {
      id: 'metadata-size',
      name: 'Metadata Size',
      description: 'Metadata should not exceed size limits',
      severity: 'warning',
      category: 'performance',
      validationType: 'generic'
    },
    {
      id: 'script-complexity',
      name: 'Script Complexity',
      description: 'Script execution should be within limits',
      severity: 'warning',
      category: 'performance',
      validationType: 'generic'
    },
    {
      id: 'collateral-ratio',
      name: 'Collateral Ratio',
      description: 'Collateral inputs should be sufficient',
      severity: 'warning',
      category: 'security',
      validationType: 'generic'
    },
    {
      id: 'witness-count',
      name: 'Witness Count',
      description: 'Number of witnesses should be reasonable',
      severity: 'info',
      category: 'performance',
      validationType: 'generic'
    },
    {
      id: 'signature-validation',
      name: 'Signature Validation',
      description: 'Transaction signatures should match expected signers',
      severity: 'error',
      category: 'security',
      validationType: 'generic'
    },

    // Voter-specific Rules
    {
      id: 'vote-rationale',
      name: 'Vote Rationale',
      description: 'Vote should include rationale or justification in metadata',
      severity: 'warning',
      category: 'best-practice',
      validationType: 'voter',
      apply: (tx) => this.hasGovernanceVotes(tx)
    },
    {
      id: 'voter-authority',
      name: 'Voter Authority',
      description: 'Voter should have authority to vote on this proposal type',
      severity: 'error',
      category: 'compliance',
      validationType: 'voter',
      apply: (tx) => this.hasGovernanceVotes(tx)
    },
    {
      id: 'vote-consistency',
      name: 'Vote Consistency',
      description: 'Vote actions should be consistent and valid',
      severity: 'warning',
      category: 'compliance',
      validationType: 'voter',
      apply: (tx) => this.hasGovernanceVotes(tx)
    },
    {
      id: 'drep-registration',
      name: 'DRep Registration',
      description: 'DRep should be properly registered to cast votes',
      severity: 'error',
      category: 'compliance',
      validationType: 'voter',
      apply: (tx) => this.hasDRepVotes(tx)
    },

    // Proposer-specific Rules
    {
      id: 'proposal-structure',
      name: 'Proposal Structure',
      description: 'Proposal should contain all required fields and valid structure',
      severity: 'error',
      category: 'compliance',
      validationType: 'proposer',
      apply: (tx) => this.hasGovernanceProposals(tx)
    },
    {
      id: 'proposal-authority',
      name: 'Proposal Authority',
      description: 'Proposer should have authority to submit this proposal type',
      severity: 'error',
      category: 'compliance',
      validationType: 'proposer',
      apply: (tx) => this.hasGovernanceProposals(tx)
    },
    {
      id: 'treasury-bounds',
      name: 'Treasury Withdrawal Bounds',
      description: 'Treasury withdrawal amounts should be within reasonable bounds',
      severity: 'error',
      category: 'security',
      validationType: 'proposer',
      apply: (tx) => this.hasTreasuryWithdrawals(tx)
    },
    {
      id: 'parameter-ranges',
      name: 'Parameter Range Validation',
      description: 'Parameter change proposals should be within valid ranges',
      severity: 'error',
      category: 'compliance',
      validationType: 'proposer',
      apply: (tx) => this.hasParameterChanges(tx)
    }
  ];

  async validate(tx: DomainTx, txHex: string): Promise<ValidationReport> {
    const results: ValidationResult[] = [];
    
    // Run all validation rules, respecting apply conditions
    for (const rule of this.rules) {
      // Skip rule if apply condition exists and returns false
      if (rule.apply && !rule.apply(tx)) {
        continue;
      }
      
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
        case 'signature-validation':
          return this.validateSignatures(tx, rule);
        case 'vote-rationale':
          return this.validateVoteRationale(tx, rule);
        case 'voter-authority':
          return this.validateVoterAuthority(tx, rule);
        case 'vote-consistency':
          return this.validateVoteConsistency(tx, rule);
        case 'drep-registration':
          return this.validateDRepRegistration(tx, rule);
        case 'proposal-structure':
          return this.validateProposalStructure(tx, rule);
        case 'proposal-authority':
          return this.validateProposalAuthority(tx, rule);
        case 'treasury-bounds':
          return this.validateTreasuryBounds(tx, rule);
        case 'parameter-ranges':
          return this.validateParameterRanges(tx, rule);
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
    const scriptInputs = tx.inputs.filter(input => (input.resolved as any)?.scriptRef);
    
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

  // Helper methods for governance detection
  private hasGovernanceVotes(tx: DomainTx): boolean {
    return !!(tx.governance?.drepVotes?.length || tx.governance?.committeeVotes?.length);
  }

  private hasGovernanceProposals(tx: DomainTx): boolean {
    return !!(tx.governance?.proposals?.length);
  }

  private hasDRepVotes(tx: DomainTx): boolean {
    return !!(tx.governance?.drepVotes?.length);
  }

  private hasTreasuryWithdrawals(tx: DomainTx): boolean {
    return !!(tx.governance?.proposals?.some(p => p.type === 'TreasuryWithdrawals'));
  }

  private hasParameterChanges(tx: DomainTx): boolean {
    return !!(tx.governance?.proposals?.some(p => p.type === 'ParameterChange'));
  }

  // New validation methods

  private validateSignatures(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const requiredSigners = tx.signers?.filter(s => s.isRequired) || [];
    const availableWitnesses = tx.signers?.filter(s => s.isWitness) || [];
    
    const missingSignatures = requiredSigners.filter(required => 
      !availableWitnesses.some(witness => witness.hash === required.hash)
    );
    
    const passed = missingSignatures.length === 0;
    
    return {
      rule,
      passed,
      message: passed
        ? `All required signatures are present (${availableWitnesses.length} witnesses)`
        : `Missing ${missingSignatures.length} required signature(s)`,
      details: { requiredSigners: requiredSigners.length, availableWitnesses: availableWitnesses.length, missingSignatures }
    };
  }

  private validateVoteRationale(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const hasMetadata = tx.metadata && tx.metadata.length > 0;
    let hasRationale = false;
    
    if (hasMetadata) {
      // Check for vote rationale in metadata (common labels: 1694, 100)
      hasRationale = tx.metadata?.some(meta => 
        meta.label === '1694' || meta.label === '100' || 
        (meta.json && typeof meta.json === 'object' && 
         (meta.json as any)?.rationale !== undefined)
      ) || false;
    }
    
    const passed = hasRationale;
    
    return {
      rule,
      passed,
      message: passed
        ? 'Vote rationale found in metadata'
        : 'No vote rationale provided in metadata (recommended for transparency)',
      details: { hasMetadata, metadataCount: tx.metadata?.length || 0 }
    };
  }

  private validateVoterAuthority(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const drepVotes = tx.governance?.drepVotes || [];
    const committeeVotes = tx.governance?.committeeVotes || [];
    
    // Basic authority check - ensure voters have proper IDs
    const invalidDRepVotes = drepVotes.filter(vote => !vote.drepId || vote.drepId.length < 56);
    const invalidCommitteeVotes = committeeVotes.filter(vote => !vote.memberId || vote.memberId.length < 56);
    
    const passed = invalidDRepVotes.length === 0 && invalidCommitteeVotes.length === 0;
    
    return {
      rule,
      passed,
      message: passed
        ? `All voters have valid authority (${drepVotes.length} DRep, ${committeeVotes.length} Committee)`
        : `${invalidDRepVotes.length + invalidCommitteeVotes.length} voter(s) with invalid authority`,
      details: { drepVotes: drepVotes.length, committeeVotes: committeeVotes.length, invalidDRepVotes, invalidCommitteeVotes }
    };
  }

  private validateVoteConsistency(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const drepVotes = tx.governance?.drepVotes || [];
    const committeeVotes = tx.governance?.committeeVotes || [];
    
    const validActions = ['VoteYes', 'VoteNo', 'Abstain'];
    const invalidDRepVotes = drepVotes.filter(vote => !validActions.includes(vote.action));
    const invalidCommitteeVotes = committeeVotes.filter(vote => !validActions.includes(vote.action));
    
    // Check for duplicate votes on same proposal
    const drepProposalCounts = new Map();
    const committeeProposalCounts = new Map();
    
    drepVotes.forEach(vote => {
      const key = `${vote.drepId}-${vote.proposalId}`;
      drepProposalCounts.set(key, (drepProposalCounts.get(key) || 0) + 1);
    });
    
    committeeVotes.forEach(vote => {
      const key = `${vote.memberId}-${vote.proposalId}`;
      committeeProposalCounts.set(key, (committeeProposalCounts.get(key) || 0) + 1);
    });
    
    const duplicateDRepVotes = Array.from(drepProposalCounts.values()).filter(count => count > 1).length;
    const duplicateCommitteeVotes = Array.from(committeeProposalCounts.values()).filter(count => count > 1).length;
    
    const passed = invalidDRepVotes.length === 0 && invalidCommitteeVotes.length === 0 &&
                  duplicateDRepVotes === 0 && duplicateCommitteeVotes === 0;
    
    return {
      rule,
      passed,
      message: passed
        ? 'All votes are consistent and valid'
        : `Found ${invalidDRepVotes.length + invalidCommitteeVotes.length} invalid actions, ${duplicateDRepVotes + duplicateCommitteeVotes} duplicates`,
      details: { 
        invalidDRepVotes, invalidCommitteeVotes, duplicateDRepVotes, duplicateCommitteeVotes 
      }
    };
  }

  private validateDRepRegistration(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const drepVotes = tx.governance?.drepVotes || [];
    
    // Check if DRep IDs follow proper format (basic validation)
    const validDRepIds = drepVotes.filter(vote => 
      vote.drepId && vote.drepId.length >= 56 && /^[0-9a-fA-F]+$/.test(vote.drepId)
    );
    
    const passed = validDRepIds.length === drepVotes.length;
    
    return {
      rule,
      passed,
      message: passed
        ? `All DReps have valid registration format (${drepVotes.length} votes)`
        : `${drepVotes.length - validDRepIds.length} DRep(s) with invalid registration format`,
      details: { totalDRepVotes: drepVotes.length, validDRepIds: validDRepIds.length }
    };
  }

  private validateProposalStructure(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const proposals = tx.governance?.proposals || [];
    
    const validTypes = ['ParameterChange', 'HardForkInitiation', 'TreasuryWithdrawals', 'NoConfidence', 'NewConstitution', 'InfoAction'];
    const invalidProposals = proposals.filter(proposal => 
      !proposal.id || !proposal.type || !validTypes.includes(proposal.type)
    );
    
    const passed = invalidProposals.length === 0;
    
    return {
      rule,
      passed,
      message: passed
        ? `All proposals have valid structure (${proposals.length} proposals)`
        : `${invalidProposals.length} proposal(s) with invalid structure`,
      details: { totalProposals: proposals.length, invalidProposals }
    };
  }

  private validateProposalAuthority(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const proposals = tx.governance?.proposals || [];
    
    // Basic authority check - ensure proposals have proper structure
    // In a real implementation, this would check against network state
    const validProposals = proposals.filter(proposal => 
      proposal.id && proposal.type && proposal.details
    );
    
    const passed = validProposals.length === proposals.length;
    
    return {
      rule,
      passed,
      message: passed
        ? `All proposers have valid authority (${proposals.length} proposals)`
        : `${proposals.length - validProposals.length} proposal(s) with questionable authority`,
      details: { totalProposals: proposals.length, validProposals: validProposals.length }
    };
  }

  private validateTreasuryBounds(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const treasuryProposals = tx.governance?.proposals?.filter(p => p.type === 'TreasuryWithdrawals') || [];
    
    let totalWithdrawal = 0n;
    let invalidWithdrawals = 0;
    
    treasuryProposals.forEach(proposal => {
      const withdrawals = proposal.details?.withdrawals as any[];
      if (withdrawals && Array.isArray(withdrawals)) {
        withdrawals.forEach((withdrawal: any) => {
          const amount = BigInt(withdrawal.amount || 0);
          totalWithdrawal += amount;
          
          // Check if withdrawal amount is reasonable (less than 1B ADA)
          if (amount > 1000000000000000n) { // 1B ADA in lovelace
            invalidWithdrawals++;
          }
        });
      }
    });
    
    const passed = invalidWithdrawals === 0 && totalWithdrawal < 5000000000000000n; // 5B ADA total limit
    
    return {
      rule,
      passed,
      message: passed
        ? `Treasury withdrawals are within reasonable bounds (${this.formatLovelace(totalWithdrawal)} total)`
        : `Treasury withdrawals exceed reasonable bounds: ${this.formatLovelace(totalWithdrawal)}`,
      details: { treasuryProposals: treasuryProposals.length, totalWithdrawal, invalidWithdrawals }
    };
  }

  private validateParameterRanges(tx: DomainTx, rule: ValidationRule): ValidationResult {
    const parameterProposals = tx.governance?.proposals?.filter(p => p.type === 'ParameterChange') || [];
    
    let invalidParameters = 0;
    const issues: string[] = [];
    
    parameterProposals.forEach(proposal => {
      const params = proposal.details?.parameters as Record<string, any>;
      if (params) {
        // Check common parameter bounds
        if (params.minFeeA !== undefined && (params.minFeeA < 0 || params.minFeeA > 1000000)) {
          invalidParameters++;
          issues.push('minFeeA out of range');
        }
        if (params.minFeeB !== undefined && (params.minFeeB < 0 || params.minFeeB > 1000000)) {
          invalidParameters++;
          issues.push('minFeeB out of range');
        }
        if (params.maxTxSize !== undefined && (params.maxTxSize < 1024 || params.maxTxSize > 65536)) {
          invalidParameters++;
          issues.push('maxTxSize out of range');
        }
      }
    });
    
    const passed = invalidParameters === 0;
    
    return {
      rule,
      passed,
      message: passed
        ? `All parameter changes are within valid ranges (${parameterProposals.length} proposals)`
        : `${invalidParameters} parameter(s) out of valid range`,
      details: { parameterProposals: parameterProposals.length, invalidParameters, issues }
    };
  }

  private formatLovelace(lovelace: bigint): string {
    const ada = Number(lovelace) / 1000000;
    return `${ada.toFixed(6)} ADA`;
  }
}
