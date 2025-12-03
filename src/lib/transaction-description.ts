// src/lib/transaction-description.ts
import { DomainTx } from '@/domain/tx';

/**
 * Generates a human-readable sentence describing what the transaction does
 */
export function generateTransactionDescription(tx: DomainTx): string {
  const parts: string[] = [];

  // Governance actions
  if (tx.governance) {
    const govParts: string[] = [];

    // CC votes (Constitutional Committee votes)
    if (tx.governance.committeeVotes && tx.governance.committeeVotes.length > 0) {
      const voteCount = tx.governance.committeeVotes.length;
      const voteText = voteCount === 1 ? 'a CC vote' : `${voteCount} CC votes`;
      govParts.push(`casts ${voteText}`);
    }

    // DRep votes
    if (tx.governance.drepVotes && tx.governance.drepVotes.length > 0) {
      const voteCount = tx.governance.drepVotes.length;
      const voteText = voteCount === 1 ? 'a DRep vote' : `${voteCount} DRep votes`;
      govParts.push(`casts ${voteText}`);
    }

    // Proposals
    if (tx.governance.proposals && tx.governance.proposals.length > 0) {
      const proposalCount = tx.governance.proposals.length;
      const proposalText = proposalCount === 1 ? 'a governance proposal' : `${proposalCount} governance proposals`;
      govParts.push(`submits ${proposalText}`);
    }

    // Constitution
    if (tx.governance.constitution) {
      govParts.push('updates the constitution');
    }

    // Committee updates
    if (tx.governance.committee) {
      govParts.push('updates the committee');
    }

    if (govParts.length > 0) {
      parts.push(govParts.join(', '));
    }
  }

  // Certificates
  if (tx.certs && tx.certs.length > 0) {
    const certTypes = new Set(tx.certs.map(c => c.type));
    const certParts: string[] = [];

    if (certTypes.has('Vote')) {
      certParts.push('casts a vote');
    }
    if (certTypes.has('StakeRegistration')) {
      certParts.push('registers stake');
    }
    if (certTypes.has('StakeDeregistration')) {
      certParts.push('deregisters stake');
    }
    if (certTypes.has('StakeDelegation')) {
      certParts.push('delegates stake');
    }
    if (certTypes.has('PoolRegistration')) {
      certParts.push('registers a stake pool');
    }
    if (certTypes.has('PoolRetirement')) {
      certParts.push('retires a stake pool');
    }
    if (certTypes.has('DRepRegistration')) {
      certParts.push('registers a DRep');
    }
    if (certTypes.has('DRepDeregistration')) {
      certParts.push('deregisters a DRep');
    }
    if (certTypes.has('DRepUpdate')) {
      certParts.push('updates a DRep');
    }

    if (certParts.length > 0) {
      parts.push(certParts.join(', '));
    }
  }

  // Script interactions
  const plutusCount = tx.witnesses.plutusCount || 0;
  const nativeCount = tx.witnesses.nativeCount || 0;
  const totalScriptCount = plutusCount + nativeCount;
  
  let scriptDescription: string | null = null;
  if (totalScriptCount > 0) {
    if (plutusCount > 0 && nativeCount === 0) {
      const scriptText = plutusCount === 1 ? 'a Plutus script' : `${plutusCount} Plutus scripts`;
      scriptDescription = `interacting with ${scriptText}`;
    } else if (nativeCount > 0 && plutusCount === 0) {
      const scriptText = nativeCount === 1 ? 'a native script' : `${nativeCount} native scripts`;
      scriptDescription = `interacting with ${scriptText}`;
    } else {
      // Both types present
      const scriptText = totalScriptCount === 1 ? 'a script' : `${totalScriptCount} scripts`;
      scriptDescription = `interacting with ${scriptText}`;
    }
  }

  // Minting
  if (tx.mint && tx.mint.length > 0) {
    const mintCount = tx.mint.length;
    const mintText = mintCount === 1 ? 'mints an asset' : `mints ${mintCount} assets`;
    parts.push(mintText);
  }

  // Withdrawals
  if (tx.withdrawals && tx.withdrawals.length > 0) {
    const withdrawalCount = tx.withdrawals.length;
    const withdrawalText = withdrawalCount === 1 ? 'withdraws rewards' : `makes ${withdrawalCount} withdrawals`;
    parts.push(withdrawalText);
  }

  // Combine script interactions with other parts
  if (scriptDescription) {
    if (parts.length > 0) {
      // Use "whilst" to connect script interactions with other actions
      parts.push(`whilst ${scriptDescription}`);
    } else {
      // If only script interactions, use "interacts" as the main verb
      parts.push(scriptDescription);
    }
  }

  // If no specific actions identified, provide a generic description
  if (parts.length === 0) {
    parts.push('performs a transaction');
  }

  // Add transaction structure information
  const structureParts: string[] = [];
  
  // Input/output counts (always include)
  const inputCount = tx.inputs.length;
  const outputCount = tx.outputs.length;
  if (inputCount > 0 || outputCount > 0) {
    const ioParts: string[] = [];
    if (inputCount > 0) {
      ioParts.push(`${inputCount} input${inputCount === 1 ? '' : 's'}`);
    }
    if (outputCount > 0) {
      ioParts.push(`${outputCount} output${outputCount === 1 ? '' : 's'}`);
    }
    structureParts.push(`with ${ioParts.join(' and ')}`);
  }
  
  // Required signers
  const requiredSigners = tx.signers?.filter(s => s.isRequired === true).length || 0;
  if (requiredSigners > 0) {
    structureParts.push(`requiring ${requiredSigners} signer${requiredSigners === 1 ? '' : 's'}`);
  }
  
  // Witnesses
  const hasWitnesses = (tx.witnesses.vkeyCount || 0) > 0 || 
                       (tx.witnesses.nativeCount || 0) > 0 || 
                       (tx.witnesses.plutusCount || 0) > 0;
  if (hasWitnesses) {
    structureParts.push('with witnesses');
  } else {
    structureParts.push('unsigned');
  }

  // Combine main description with structure information
  let description = parts.join(', ');
  if (structureParts.length > 0) {
    description += ` (${structureParts.join(', ')})`;
  }

  // Capitalize first letter and add period
  return description.charAt(0).toUpperCase() + description.slice(1) + '.';
}

