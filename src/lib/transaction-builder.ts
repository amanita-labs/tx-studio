// src/lib/transaction-builder.ts
// Core transaction building logic using CSL

import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import * as bech32Buffer from 'bech32-buffer';
import { Network } from '@/domain/tx';
import { BuilderCertificate } from '@/lib/store';

export type BuildError = {
  message: string;
  field?: string;
};

export type Anchor = {
  url?: string;
  hash?: string;
};

/**
 * Decode bech32 DRep ID to hex hash
 */
function decodeDRepId(drepId: string): string {
  try {
    // If it's already hex, return as is
    if (/^[0-9a-fA-F]{56}$/.test(drepId)) {
      return drepId.toLowerCase();
    }
    
    // Try to decode bech32
    if (drepId.startsWith('drep1')) {
      const decoded = bech32Buffer.decode(drepId);
      return Buffer.from(decoded.data).toString('hex');
    }
    
    throw new Error('Invalid DRep ID format');
  } catch (error) {
    throw new Error(`Failed to decode DRep ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decode bech32 stake credential to hex hash
 */
function decodeStakeCredential(credential: string): { hash: string; isKey: boolean } {
  try {
    // If it's already hex, assume it's a key hash
    if (/^[0-9a-fA-F]{56}$/.test(credential)) {
      return { hash: credential.toLowerCase(), isKey: true };
    }
    
    // Try to decode bech32 stake address
    if (credential.startsWith('stake1')) {
      const decoded = bech32Buffer.decode(credential);
      const hashBytes = Buffer.from(decoded.data);
      // Stake address has network byte + credential, skip first byte
      const hash = hashBytes.slice(1).toString('hex');
      return { hash, isKey: true }; // Assume key hash for now
    }
    
    throw new Error('Invalid stake credential format');
  } catch (error) {
    throw new Error(`Failed to decode stake credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create anchor from URL and hash
 */
function createAnchor(anchor?: Anchor): CSL.Anchor | null {
  if (!anchor || (!anchor.url && !anchor.hash)) {
    return null;
  }
  
  const url = anchor.url || '';
  const hashHex = anchor.hash || '';
  
  if (!hashHex || hashHex.length !== 64) {
    // If no hash provided, create empty anchor
    if (!url) return null;
    // For now, return null if hash is missing (CSL requires hash)
    return null;
  }
  
  try {
    const hashBytes = Buffer.from(hashHex, 'hex');
    const anchorHash = CSL.AnchorHash.from_bytes(hashBytes);
    const anchorUrl = CSL.URL.new(url);
    return CSL.Anchor.new(anchorUrl, anchorHash);
  } catch (error) {
    throw new Error(`Failed to create anchor: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build Vote Delegation certificate
 */
export function buildVoteDelegationCert(
  drepId: string,
  stakeCredential: string
): { cert: CSL.Certificate; error?: BuildError } {
  try {
    const drepHash = decodeDRepId(drepId);
    const stakeInfo = decodeStakeCredential(stakeCredential);
    
    // Create DRep credential
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    const drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    const drepCredential = CSL.Credential.from_keyhash(drepKeyHash);
    const drep = CSL.DRep.from_key_hash(drepKeyHash);
    
    // Create stake credential
    const stakeHashBytes = Buffer.from(stakeInfo.hash, 'hex');
    const stakeKeyHash = CSL.Ed25519KeyHash.from_bytes(stakeHashBytes);
    const stakeCred = CSL.Credential.from_keyhash(stakeKeyHash);
    
    // Create vote delegation certificate
    const voteDelegation = CSL.VoteDelegation.new(stakeCred, drep);
    const cert = CSL.Certificate.new_vote_delegation(voteDelegation);
    
    return { cert };
  } catch (error) {
    return {
      cert: null as any,
      error: {
        message: error instanceof Error ? error.message : 'Failed to build vote delegation certificate',
        field: 'drepId'
      }
    };
  }
}

/**
 * Build DRep Registration certificate
 */
export function buildDRepRegistrationCert(
  drepId: string,
  anchor?: Anchor
): { cert: CSL.Certificate; error?: BuildError } {
  try {
    const drepHash = decodeDRepId(drepId);
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    const drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    const drep = CSL.DRep.from_key_hash(drepKeyHash);
    
    const anchorObj = createAnchor(anchor);
    
    // Create DRep registration certificate
    const drepRegistration = CSL.DRepRegistration.new(drep, anchorObj);
    const cert = CSL.Certificate.new_drep_registration(drepRegistration);
    
    return { cert };
  } catch (error) {
    return {
      cert: null as any,
      error: {
        message: error instanceof Error ? error.message : 'Failed to build DRep registration certificate',
        field: 'drepId'
      }
    };
  }
}

/**
 * Build DRep Update certificate
 */
export function buildDRepUpdateCert(
  drepId: string,
  anchor?: Anchor
): { cert: CSL.Certificate; error?: BuildError } {
  try {
    const drepHash = decodeDRepId(drepId);
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    const drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    const drep = CSL.DRep.from_key_hash(drepKeyHash);
    
    const anchorObj = createAnchor(anchor);
    
    // Create DRep update certificate
    const drepUpdate = CSL.DRepUpdate.new(drep, anchorObj);
    const cert = CSL.Certificate.new_drep_update(drepUpdate);
    
    return { cert };
  } catch (error) {
    return {
      cert: null as any,
      error: {
        message: error instanceof Error ? error.message : 'Failed to build DRep update certificate',
        field: 'drepId'
      }
    };
  }
}

/**
 * Build DRep Retirement certificate
 */
export function buildDRepRetirementCert(
  drepId: string
): { cert: CSL.Certificate; error?: BuildError } {
  try {
    const drepHash = decodeDRepId(drepId);
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    const drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    const drep = CSL.DRep.from_key_hash(drepKeyHash);
    
    // Create DRep retirement certificate
    const drepRetirement = CSL.DRepRetirement.new(drep);
    const cert = CSL.Certificate.new_drep_retirement(drepRetirement);
    
    return { cert };
  } catch (error) {
    return {
      cert: null as any,
      error: {
        message: error instanceof Error ? error.message : 'Failed to build DRep retirement certificate',
        field: 'drepId'
      }
    };
  }
}

/**
 * Build Vote certificate (for voting on proposals)
 */
export function buildVoteCert(
  proposalId: string,
  vote: 'yes' | 'no' | 'abstain',
  anchor?: Anchor
): { cert: CSL.Certificate; error?: BuildError } {
  try {
    // Proposal ID should be hex (64 chars for txId + 2 for index = 66 chars)
    // Or bech32 gov_action1 format
    let txId: string;
    let index: number;
    
    if (proposalId.startsWith('gov_action1')) {
      // Decode bech32 governance action ID
      const decoded = bech32Buffer.decode(proposalId);
      const data = Buffer.from(decoded.data);
      txId = data.slice(0, 32).toString('hex');
      index = data[32];
    } else if (proposalId.length === 66) {
      // Hex format: 64 chars txId + 2 chars index
      txId = proposalId.slice(0, 64);
      index = parseInt(proposalId.slice(64), 16);
    } else if (proposalId.length === 64) {
      // Just txId, assume index 0
      txId = proposalId;
      index = 0;
    } else {
      throw new Error('Invalid proposal ID format');
    }
    
    const txIdBytes = Buffer.from(txId, 'hex');
    const txIdHash = CSL.TransactionHash.from_bytes(txIdBytes);
    const govActionId = CSL.GovernanceActionId.new(txIdHash, index);
    
    // Map vote to CSL enum
    let voteEnum: CSL.Vote;
    switch (vote) {
      case 'yes':
        voteEnum = CSL.Vote.new_yes();
        break;
      case 'no':
        voteEnum = CSL.Vote.new_no();
        break;
      case 'abstain':
        voteEnum = CSL.Vote.new_abstain();
        break;
      default:
        throw new Error('Invalid vote value');
    }
    
    const anchorObj = createAnchor(anchor);
    
    // Create vote certificate
    const voteCert = CSL.Vote.new(govActionId, voteEnum, anchorObj);
    const cert = CSL.Certificate.new_vote(voteCert);
    
    return { cert };
  } catch (error) {
    return {
      cert: null as any,
      error: {
        message: error instanceof Error ? error.message : 'Failed to build vote certificate',
        field: 'proposalId'
      }
    };
  }
}

/**
 * Build certificate from builder certificate data
 */
export function buildCertificateFromData(certData: BuilderCertificate): { cert: CSL.Certificate; error?: BuildError } {
  switch (certData.type) {
    case 'VoteDelegation':
      return buildVoteDelegationCert(
        certData.data.drepId as string,
        certData.data.stakeCredential as string
      );
    case 'DRepRegistration':
      return buildDRepRegistrationCert(
        certData.data.drepId as string,
        certData.data.anchor as Anchor | undefined
      );
    case 'DRepUpdate':
      return buildDRepUpdateCert(
        certData.data.drepId as string,
        certData.data.anchor as Anchor | undefined
      );
    case 'DRepRetirement':
      return buildDRepRetirementCert(
        certData.data.drepId as string
      );
    case 'Vote':
      return buildVoteCert(
        certData.data.proposalId as string,
        certData.data.vote as 'yes' | 'no' | 'abstain',
        certData.data.anchor as Anchor | undefined
      );
    default:
      return {
        cert: null as any,
        error: { message: `Unknown certificate type: ${certData.type}` }
      };
  }
}

/**
 * Assemble transaction from certificates and UTXOs
 */
export function assembleTransaction(params: {
  certificates: BuilderCertificate[];
  utxos: any[];
  changeAddress: string;
  network: Network;
  fee?: bigint;
}): { txBody: CSL.TransactionBody; error?: BuildError } {
  try {
    const { certificates, utxos, changeAddress, network, fee } = params;
    
    if (certificates.length === 0) {
      return {
        txBody: null as any,
        error: { message: 'No certificates to build transaction' }
      };
    }
    
    // Build certificate list
    const certList = CSL.Certificates.new();
    const errors: BuildError[] = [];
    
    for (const certData of certificates) {
      const { cert, error } = buildCertificateFromData(certData);
      if (error) {
        errors.push(error);
        continue;
      }
      certList.add(cert);
    }
    
    if (errors.length > 0) {
      return {
        txBody: null as any,
        error: { message: `Failed to build certificates: ${errors.map(e => e.message).join(', ')}` }
      };
    }
    
    // Create transaction inputs
    const inputs = CSL.TransactionInputs.new();
    let totalInput = BigInt(0);
    
    for (const utxo of utxos) {
      const txId = CSL.TransactionHash.from_bytes(Buffer.from(utxo.input.txHash, 'hex'));
      const index = utxo.input.outputIndex;
      const input = CSL.TransactionInput.new(txId, index);
      inputs.add(input);
      
      // Calculate total input value
      const amounts = utxo.output.amount || [];
      const lovelaceAmount = amounts.find((a: any) => a.unit === 'lovelace');
      if (lovelaceAmount) {
        totalInput += BigInt(lovelaceAmount.quantity);
      }
    }
    
    // Create transaction outputs
    const outputs = CSL.TransactionOutputs.new();
    
    // Calculate output value (total input - fee - certificates deposit if any)
    const calculatedFee = fee || BigInt(200000); // Default fee estimate
    const outputValue = totalInput - calculatedFee;
    
    if (outputValue > 0) {
      const address = CSL.Address.from_bech32(changeAddress);
      const value = CSL.Value.new(CSL.BigNum.from_str(outputValue.toString()));
      const output = CSL.TransactionOutput.new(address, value);
      outputs.add(output);
    }
    
    // Create transaction body
    const txBody = CSL.TransactionBody.new(inputs, outputs);
    
    // Set fee
    txBody.set_fee(CSL.BigNum.from_str(calculatedFee.toString()));
    
    // Set certificates
    txBody.set_certs(certList);
    
    // Set TTL (validity interval end) - set to current slot + 3600 (1 hour)
    const currentSlot = Math.floor(Date.now() / 1000) + 3600; // Rough estimate
    txBody.set_ttl_bignum(CSL.BigNum.from_str(currentSlot.toString()));
    
    return { txBody };
  } catch (error) {
    return {
      txBody: null as any,
      error: {
        message: error instanceof Error ? error.message : 'Failed to assemble transaction'
      }
    };
  }
}

/**
 * Serialize transaction to hex
 */
export function serializeTransaction(txBody: CSL.TransactionBody): string {
  return txBody.to_hex();
}

/**
 * Calculate estimated transaction fee
 */
export function calculateFee(
  txBody: CSL.TransactionBody,
  network: Network
): bigint {
  // Simple fee calculation: base fee + (size * fee per byte)
  // This is a simplified version - real fee calculation requires protocol parameters
  const baseFee = BigInt(170000);
  const feePerByte = BigInt(44);
  const size = txBody.to_bytes().length;
  return baseFee + (BigInt(size) * feePerByte);
}
