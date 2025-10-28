# Validation Framework Contributor Guide

This guide explains how to add new validation rules to the transaction inspector's validation system.

## Overview

The validation system is organized into three main categories:
- **Generic**: Rules that apply to all transactions (e.g., fee validation, balance checks)
- **Voter**: Rules specific to transactions containing governance votes
- **Proposer**: Rules specific to transactions containing governance proposals

## Adding a New Validation Rule

Follow these 4 simple steps to add a new validation rule:

### Step 1: Define the Rule

Add your rule to the `rules` array in `src/lib/transaction-validator.ts`:

```typescript
{
  id: 'my-new-validation',           // kebab-case unique identifier
  name: 'My Validation Check',       // Human-readable name
  description: 'Checks that something important is valid',
  severity: 'warning',               // 'error' | 'warning' | 'info'
  category: 'security',              // 'security' | 'performance' | 'compliance' | 'best-practice'
  validationType: 'generic',         // 'generic' | 'voter' | 'proposer'
  apply: (tx) => tx.someField !== undefined  // Optional: when to apply this rule
}
```

### Step 2: Implement the Validation Method

Add a private method to the `TransactionValidator` class:

```typescript
private validateMyNewRule(tx: DomainTx, rule: ValidationRule): ValidationResult {
  // Your validation logic here
  const passed = /* your validation condition */;
  
  return {
    rule,
    passed,
    message: passed 
      ? 'Success message explaining what was validated'
      : 'Failure message explaining what went wrong',
    details: { /* optional additional data for debugging */ }
  };
}
```

### Step 3: Register the Rule Handler

Add your rule case to the `runRule` method switch statement:

```typescript
case 'my-new-validation':
  return this.validateMyNewRule(tx, rule);
```

### Step 4: Test Your Rule

Test with various transaction types to ensure your rule behaves correctly.

## Rule Definition Guidelines

### ID Convention
- Use kebab-case (e.g., `vote-rationale-required`, `treasury-withdrawal-bounds`)
- Make it descriptive and unique
- Group related rules with consistent prefixes

### Severity Levels
- **error**: Transaction should be considered invalid (e.g., insufficient balance)
- **warning**: Potential issues or best practices (e.g., high fees, missing rationale)  
- **info**: Informational feedback (e.g., witness counts, transaction size)

### Categories
- **security**: Security vulnerabilities or risks
- **performance**: Network performance impact
- **compliance**: Protocol compliance issues
- **best-practice**: Recommended practices

### Validation Types
- **generic**: Apply to all transactions
- **voter**: Only apply when `tx.governance.drepVotes` or `tx.governance.committeeVotes` exist
- **proposer**: Only apply when `tx.governance.proposals` exist

## Helper Functions Available

The `TransactionValidator` class provides several helper methods:

```typescript
// Format amounts
this.formatLovelace(amount: bigint): string

// Governance detection
this.hasGovernanceVotes(tx: DomainTx): boolean
this.hasGovernanceProposals(tx: DomainTx): boolean
this.hasDRepVotes(tx: DomainTx): boolean
this.hasTreasuryWithdrawals(tx: DomainTx): boolean
this.hasParameterChanges(tx: DomainTx): boolean
```

## Accessing Transaction Data

The `DomainTx` type provides access to all transaction components:

```typescript
tx.id                    // Transaction ID
tx.sizeBytes            // Transaction size
tx.feeLovelace          // Fee amount
tx.inputs               // Transaction inputs
tx.outputs              // Transaction outputs
tx.governance           // Governance actions (votes, proposals)
tx.metadata             // Transaction metadata
tx.scripts              // Scripts
tx.witnesses            // Witness information
tx.signers              // Signer information
```

## Best Practices

### 1. Clear Messages
Provide actionable feedback in validation messages:
```typescript
// Good
message: 'DRep ID format invalid - must be 56+ hex characters'

// Bad  
message: 'Invalid DRep'
```

### 2. Detailed Context
Include relevant data in the `details` field for debugging:
```typescript
details: { 
  expectedMinimum: minAda, 
  actualAmount: output.ada,
  outputIndex: index 
}
```

### 3. Performance
Keep validation logic lightweight and fast:
```typescript
// Efficient
const hasVotes = tx.governance?.drepVotes?.length > 0;

// Less efficient
const hasVotes = tx.governance && tx.governance.drepVotes && 
                 tx.governance.drepVotes.length > 0;
```

### 4. Conditional Application
Use the `apply` function for rules that only apply in specific contexts:
```typescript
apply: (tx) => this.hasGovernanceVotes(tx)
```

## Examples

### Basic Generic Rule
```typescript
{
  id: 'output-count-reasonable',
  name: 'Reasonable Output Count',
  description: 'Transaction should not have an excessive number of outputs',
  severity: 'warning',
  category: 'performance',
  validationType: 'generic'
}

private validateOutputCountReasonable(tx: DomainTx, rule: ValidationRule): ValidationResult {
  const maxOutputs = 100;
  const outputCount = tx.outputs.length;
  const passed = outputCount <= maxOutputs;
  
  return {
    rule,
    passed,
    message: passed
      ? `Output count (${outputCount}) is reasonable`
      : `High output count (${outputCount}) may impact performance`,
    details: { outputCount, maxOutputs }
  };
}
```

### Governance-Specific Rule
```typescript
{
  id: 'committee-quorum-check',
  name: 'Committee Quorum Check',
  description: 'Committee votes should meet quorum requirements',
  severity: 'warning',
  category: 'compliance',
  validationType: 'voter',
  apply: (tx) => !!(tx.governance?.committeeVotes?.length)
}

private validateCommitteeQuorum(tx: DomainTx, rule: ValidationRule): ValidationResult {
  const committeeVotes = tx.governance?.committeeVotes || [];
  const minQuorum = 3; // Example threshold
  const passed = committeeVotes.length >= minQuorum;
  
  return {
    rule,
    passed,
    message: passed
      ? `Committee quorum met (${committeeVotes.length}/${minQuorum})`
      : `Committee quorum not met (${committeeVotes.length}/${minQuorum})`,
    details: { actualVotes: committeeVotes.length, requiredQuorum: minQuorum }
  };
}
```

## Contributing

1. Follow the 4-step process above
2. Ensure your validation logic is correct and handles edge cases
3. Test with various transaction types
4. Consider performance implications
5. Write clear, actionable messages
6. Submit a pull request with your changes

## Need Help?

Check the existing validation rules in `src/lib/transaction-validator.ts` for examples and patterns.
