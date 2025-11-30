// src/lib/transaction-diff.ts
import { DomainTx } from '@/domain/tx';

export interface DiffItem {
  path: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
}

export interface TransactionDiff {
  hasChanges: boolean;
  changes: DiffItem[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
  score: number; // 0-100 similarity score
}

export class TransactionDiffAnalyzer {
  private static instance: TransactionDiffAnalyzer;
  
  static getInstance(): TransactionDiffAnalyzer {
    if (!TransactionDiffAnalyzer.instance) {
      TransactionDiffAnalyzer.instance = new TransactionDiffAnalyzer();
    }
    return TransactionDiffAnalyzer.instance;
  }

  compare(tx1: DomainTx, tx2: DomainTx): TransactionDiff {
    const changes: DiffItem[] = [];
    
    // Compare basic properties
    this.compareBasicProperties(tx1, tx2, changes);
    
    // Compare inputs
    this.compareInputs(tx1.inputs, tx2.inputs, changes);
    
    // Compare outputs
    this.compareOutputs(tx1.outputs, tx2.outputs, changes);
    
    // Compare metadata
    this.compareMetadata(tx1.metadata || [], tx2.metadata || [], changes);
    
    // Compare scripts
    this.compareScripts(tx1.scripts || [], tx2.scripts || [], changes);
    
    // Compare redeemers
    this.compareRedeemers(tx1.redeemers || [], tx2.redeemers || [], changes);
    
    // Calculate summary
    const summary = this.calculateSummary(changes);
    
    // Calculate similarity score
    const score = this.calculateSimilarityScore(changes);
    
    return {
      hasChanges: changes.length > 0,
      changes,
      summary,
      score
    };
  }

  private compareBasicProperties(tx1: DomainTx, tx2: DomainTx, changes: DiffItem[]) {
    const basicProps = [
      'id', 'sizeBytes', 'feeLovelace', 'ttl', 'slot'
    ] as const;

    for (const prop of basicProps) {
      if (tx1[prop] !== tx2[prop]) {
        changes.push({
          path: prop,
          type: 'modified',
          oldValue: tx1[prop],
          newValue: tx2[prop],
          description: `${prop} changed from ${tx1[prop]} to ${tx2[prop]}`
        });
      } else {
        changes.push({
          path: prop,
          type: 'unchanged',
          description: `${prop} unchanged`
        });
      }
    }
  }

  private compareInputs(inputs1: DomainTx['inputs'], inputs2: DomainTx['inputs'], changes: DiffItem[]) {
    const maxLength = Math.max(inputs1.length, inputs2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const input1 = inputs1[i];
      const input2 = inputs2[i];
      
      if (!input1 && input2) {
        changes.push({
          path: `inputs[${i}]`,
          type: 'added',
          newValue: input2,
          description: `Input ${i} added`
        });
      } else if (input1 && !input2) {
        changes.push({
          path: `inputs[${i}]`,
          type: 'removed',
          oldValue: input1,
          description: `Input ${i} removed`
        });
      } else if (input1 && input2) {
        this.compareInput(input1, input2, i, changes);
      }
    }
  }

  private compareInput(input1: DomainTx['inputs'][number], input2: DomainTx['inputs'][number], index: number, changes: DiffItem[]) {
    const inputProps = ['txId', 'index', 'isCollateral'] as const;
    let hasChanges = false;
    
    for (const prop of inputProps) {
      if (input1[prop] !== input2[prop]) {
        hasChanges = true;
        changes.push({
          path: `inputs[${index}].${prop}`,
          type: 'modified',
          oldValue: input1[prop],
          newValue: input2[prop],
          description: `Input ${index} ${prop} changed`
        });
      }
    }
    
    if (!hasChanges) {
      changes.push({
        path: `inputs[${index}]`,
        type: 'unchanged',
        description: `Input ${index} unchanged`
      });
    }
  }

  private compareOutputs(outputs1: DomainTx['outputs'], outputs2: DomainTx['outputs'], changes: DiffItem[]) {
    const maxLength = Math.max(outputs1.length, outputs2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const output1 = outputs1[i];
      const output2 = outputs2[i];
      
      if (!output1 && output2) {
        changes.push({
          path: `outputs[${i}]`,
          type: 'added',
          newValue: output2,
          description: `Output ${i} added`
        });
      } else if (output1 && !output2) {
        changes.push({
          path: `outputs[${i}]`,
          type: 'removed',
          oldValue: output1,
          description: `Output ${i} removed`
        });
      } else if (output1 && output2) {
        this.compareOutput(output1, output2, i, changes);
      }
    }
  }

  private compareOutput(output1: DomainTx['outputs'][number], output2: DomainTx['outputs'][number], index: number, changes: DiffItem[]) {
    const outputProps = ['address', 'ada'] as const;
    let hasChanges = false;
    
    for (const prop of outputProps) {
      if (output1[prop] !== output2[prop]) {
        hasChanges = true;
        changes.push({
          path: `outputs[${index}].${prop}`,
          type: 'modified',
          oldValue: output1[prop],
          newValue: output2[prop],
          description: `Output ${index} ${prop} changed`
        });
      }
    }
    
    // Compare assets
    if (JSON.stringify(output1.assets) !== JSON.stringify(output2.assets)) {
      hasChanges = true;
      changes.push({
        path: `outputs[${index}].assets`,
        type: 'modified',
        oldValue: output1.assets,
        newValue: output2.assets,
        description: `Output ${index} assets changed`
      });
    }
    
    if (!hasChanges) {
      changes.push({
        path: `outputs[${index}]`,
        type: 'unchanged',
        description: `Output ${index} unchanged`
      });
    }
  }

  private compareMetadata(metadata1: NonNullable<DomainTx['metadata']>, metadata2: NonNullable<DomainTx['metadata']>, changes: DiffItem[]) {
    const maxLength = Math.max(metadata1.length, metadata2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const meta1 = metadata1[i];
      const meta2 = metadata2[i];
      
      if (!meta1 && meta2) {
        changes.push({
          path: `metadata[${i}]`,
          type: 'added',
          newValue: meta2,
          description: `Metadata ${i} added`
        });
      } else if (meta1 && !meta2) {
        changes.push({
          path: `metadata[${i}]`,
          type: 'removed',
          oldValue: meta1,
          description: `Metadata ${i} removed`
        });
      } else if (meta1 && meta2) {
        this.compareMetadataItem(meta1, meta2, i, changes);
      }
    }
  }

  private compareMetadataItem(meta1: NonNullable<DomainTx['metadata']>[number], meta2: NonNullable<DomainTx['metadata']>[number], index: number, changes: DiffItem[]) {
    if (meta1.label !== meta2.label) {
      changes.push({
        path: `metadata[${index}].label`,
        type: 'modified',
        oldValue: meta1.label,
        newValue: meta2.label,
        description: `Metadata ${index} label changed`
      });
    }
    
    if (JSON.stringify(meta1.json) !== JSON.stringify(meta2.json)) {
      changes.push({
        path: `metadata[${index}].json`,
        type: 'modified',
        oldValue: meta1.json,
        newValue: meta2.json,
        description: `Metadata ${index} JSON changed`
      });
    }
  }

  private compareScripts(scripts1: NonNullable<DomainTx['scripts']>, scripts2: NonNullable<DomainTx['scripts']>, changes: DiffItem[]) {
    const maxLength = Math.max(scripts1.length, scripts2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const script1 = scripts1[i];
      const script2 = scripts2[i];
      
      if (!script1 && script2) {
        changes.push({
          path: `scripts[${i}]`,
          type: 'added',
          newValue: script2,
          description: `Script ${i} added`
        });
      } else if (script1 && !script2) {
        changes.push({
          path: `scripts[${i}]`,
          type: 'removed',
          oldValue: script1,
          description: `Script ${i} removed`
        });
      } else if (script1 && script2) {
        this.compareScript(script1, script2, i, changes);
      }
    }
  }

  private compareScript(script1: NonNullable<DomainTx['scripts']>[number], script2: NonNullable<DomainTx['scripts']>[number], index: number, changes: DiffItem[]) {
    if (JSON.stringify(script1) !== JSON.stringify(script2)) {
      changes.push({
        path: `scripts[${index}]`,
        type: 'modified',
        oldValue: script1,
        newValue: script2,
        description: `Script ${index} changed`
      });
    } else {
      changes.push({
        path: `scripts[${index}]`,
        type: 'unchanged',
        description: `Script ${index} unchanged`
      });
    }
  }

  private compareRedeemers(redeemers1: NonNullable<DomainTx['redeemers']>, redeemers2: NonNullable<DomainTx['redeemers']>, changes: DiffItem[]) {
    const maxLength = Math.max(redeemers1.length, redeemers2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const redeemer1 = redeemers1[i];
      const redeemer2 = redeemers2[i];
      
      if (!redeemer1 && redeemer2) {
        changes.push({
          path: `redeemers[${i}]`,
          type: 'added',
          newValue: redeemer2,
          description: `Redeemer ${i} added`
        });
      } else if (redeemer1 && !redeemer2) {
        changes.push({
          path: `redeemers[${i}]`,
          type: 'removed',
          oldValue: redeemer1,
          description: `Redeemer ${i} removed`
        });
      } else if (redeemer1 && redeemer2) {
        this.compareRedeemer(redeemer1, redeemer2, i, changes);
      }
    }
  }

  private compareRedeemer(redeemer1: NonNullable<DomainTx['redeemers']>[number], redeemer2: NonNullable<DomainTx['redeemers']>[number], index: number, changes: DiffItem[]) {
    if (JSON.stringify(redeemer1) !== JSON.stringify(redeemer2)) {
      changes.push({
        path: `redeemers[${index}]`,
        type: 'modified',
        oldValue: redeemer1,
        newValue: redeemer2,
        description: `Redeemer ${index} changed`
      });
    } else {
      changes.push({
        path: `redeemers[${index}]`,
        type: 'unchanged',
        description: `Redeemer ${index} unchanged`
      });
    }
  }

  private calculateSummary(changes: DiffItem[]) {
    return {
      added: changes.filter(c => c.type === 'added').length,
      removed: changes.filter(c => c.type === 'removed').length,
      modified: changes.filter(c => c.type === 'modified').length,
      unchanged: changes.filter(c => c.type === 'unchanged').length
    };
  }

  private calculateSimilarityScore(changes: DiffItem[]): number {
    const total = changes.length;
    if (total === 0) return 100;
    
    const unchanged = changes.filter(c => c.type === 'unchanged').length;
    return Math.round((unchanged / total) * 100);
  }
}
