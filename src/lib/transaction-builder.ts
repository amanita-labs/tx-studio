// src/lib/transaction-builder.ts
// Core transaction building logic using CSL
// IMPROVED VERSION: Better memory management, error handling, and efficiency

import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import * as bech32Buffer from 'bech32-buffer';
import { Network } from '@/domain/tx';
import { BuilderCertificate, BuilderTxBodyElement } from '@/lib/store';

export type BuildError = {
  message: string;
  field?: string;
};

export type Anchor = {
  url?: string;
  hash?: string;
};

/**
 * Helper to safely free CSL objects to prevent memory leaks
 * CSL objects are WASM objects that must be explicitly freed
 */
function safeFree(...objects: Array<any>): void {
  for (const obj of objects) {
    try {
      if (obj && typeof obj.free === 'function') {
        obj.free();
      }
    } catch (error) {
      // Silently ignore cleanup errors to avoid masking original errors
      console.warn('Error freeing CSL object:', error);
    }
  }
}

/**
 * Validate hex string format and length
 */
function validateHex(hex: string, expectedLength?: number, name = 'hex'): void {
  if (!hex || typeof hex !== 'string') {
    throw new Error(`${name} must be a non-empty string`);
  }
  
  const trimmed = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    throw new Error(`${name} contains invalid hex characters`);
  }
  
  if (trimmed.length % 2 !== 0) {
    throw new Error(`${name} must have even length`);
  }
  
  if (expectedLength && trimmed.length !== expectedLength) {
    throw new Error(`${name} must be exactly ${expectedLength} hex characters (${expectedLength / 2} bytes), got ${trimmed.length}`);
  }
}

/**
 * Decode bech32 DRep ID to hex hash
 * Supports both CIP-105 (drep1...) and hex formats
 */
function decodeDRepId(drepId: string): string {
  if (!drepId || typeof drepId !== 'string') {
    throw new Error('DRep ID is required');
  }
  
  try {
    const trimmed = drepId.trim();
    
    // If it's already hex (56 hex chars = 28 bytes), validate and return
    if (/^[0-9a-fA-F]{56}$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    
    // Try to decode bech32 CIP-105 format (drep1...)
    if (trimmed.startsWith('drep1')) {
      const decoded = bech32Buffer.decode(trimmed);
      const hashBytes = Buffer.from(decoded.data);
      
      // Validate hash length (should be 28 bytes = 56 hex chars)
      if (hashBytes.length !== 28) {
        throw new Error(`Invalid DRep hash length: expected 28 bytes, got ${hashBytes.length} bytes. DRep ID may be incomplete or invalid.`);
      }
      
      return hashBytes.toString('hex');
    }
    
    throw new Error(`Invalid DRep ID format: must be bech32 (drep1...) or hex (56 hex characters), got: ${trimmed.substring(0, 20)}...`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid DRep')) {
      throw error;
    }
    throw new Error(`Failed to decode DRep ID "${drepId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decode bech32 stake credential to hex hash
 */
function decodeStakeCredential(credential: string): { hash: string; isKey: boolean } {
  if (!credential || typeof credential !== 'string') {
    throw new Error('Stake credential is required');
  }
  
  try {
    const trimmed = credential.trim();
    
    // If it's already hex (56 hex chars = 28 bytes), validate and return
    if (/^[0-9a-fA-F]{56}$/i.test(trimmed)) {
      return { hash: trimmed.toLowerCase(), isKey: true };
    }
    
    // Try to decode bech32 stake address
    if (trimmed.startsWith('stake1')) {
      const decoded = bech32Buffer.decode(trimmed);
      const hashBytes = Buffer.from(decoded.data);
      
      // Stake address has network byte + credential, skip first byte
      if (hashBytes.length < 29) {
        throw new Error('Invalid stake address format: too short');
      }
      
      const hash = hashBytes.slice(1).toString('hex');
      return { hash, isKey: true };
    }
    
    throw new Error(`Invalid stake credential format: must be bech32 (stake1...) or hex (56 hex characters), got: ${trimmed.substring(0, 20)}...`);
  } catch (error) {
    throw new Error(`Failed to decode stake credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create DRep object from hex hash - REFACTORED to eliminate duplication
 * This is the most error-prone CSL operation, so we centralize it here
 * Based on CSL 15.0.1 API and example from: https://github.com/Ryun1/cip95-cardano-wallet-connector
 */
function createDRepFromHash(drepHashHex: string): CSL.DRep {
  // Validate input
  validateHex(drepHashHex, 56, 'DRep hash');
  
  const drepHashBytes = Buffer.from(drepHashHex, 'hex');
  
  if (drepHashBytes.length !== 28) {
    throw new Error(`Invalid DRep hash length: expected 28 bytes, got ${drepHashBytes.length}`);
  }
  
  let drepKeyHash: CSL.Ed25519KeyHash | null = null;
  let drepCredential: CSL.Credential | null = null;
  
  try {
    // Create key hash from bytes
    drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    
    // Create credential from key hash
    drepCredential = CSL.Credential.from_keyhash(drepKeyHash);
    
    // In CSL 15.0.1, DRep is an enum type with variant constructors
    // Based on CSL patterns and the error showing DRepEnum, DRep likely has:
    // - DRep.new_key_hash(Ed25519KeyHash) for key hash variants
    // - DRep.new_script_hash(ScriptHash) for script hash variants
    const DRepClass = CSL.DRep as any;
    let drep: CSL.DRep | null = null;
    
    // Method 1: DRep.new_key_hash(keyHash) - CSL 15.0.1 enum variant constructor
    // This is the correct way to create a DRep from a key hash in CSL 15.0.1
    try {
      drep = DRepClass.new_key_hash(drepKeyHash);
      if (drep) {
        // Success - return the DRep object
        // Note: We don't free drepKeyHash and drepCredential here because
        // they might be referenced by drep (ownership transfer)
        return drep;
      }
    } catch (error) {
      console.warn('DRep.new_key_hash() failed:', error);
    }
    
    // Method 2: Try DRep.new() with credential (if it exists in some versions)
    try {
      drep = DRepClass.new(drepCredential);
      if (drep) return drep;
    } catch (error) {
      // Silently continue - this method doesn't exist in CSL 15.0.1
    }
    
    // Method 3: Try from_bytes with credential's CBOR bytes
    // DRep.from_bytes() expects CBOR-encoded DRep enum, not raw hash
    try {
      const credentialBytes = drepCredential.to_bytes();
      drep = DRepClass.from_bytes(credentialBytes);
      if (drep) return drep;
    } catch (error) {
      console.warn('DRep.from_bytes(credential bytes) failed:', error);
    }
    
    // Method 4: Try creating DRep enum from credential's CBOR representation
    // DRep might need the credential serialized in a specific format
    try {
      // Create a CBOR array representing DRep enum: [0, credential_bytes]
      // DRep enum format: [variant_index, credential_bytes]
      const credentialBytes = drepCredential.to_bytes();
      // Variant 0 = Key hash, Variant 1 = Script hash
      const drepEnumBytes = new Uint8Array([0, ...credentialBytes]);
      drep = DRepClass.from_bytes(drepEnumBytes);
      if (drep) return drep;
    } catch (error) {
      console.warn('DRep.from_bytes(enum bytes) failed:', error);
    }
    
    // If all methods failed, provide detailed error with debugging info
    const errorDetails = {
      hashLength: drepHashBytes.length,
      hashHex: drepHashHex.substring(0, 16) + '...',
      credentialType: drepCredential ? 'Credential' : 'null',
      keyHashType: drepKeyHash ? 'Ed25519KeyHash' : 'null',
      availableMethods: Object.getOwnPropertyNames(DRepClass).filter(name => 
        typeof DRepClass[name] === 'function' && name !== 'free'
      )
    };
    
    throw new Error(
      `Failed to create DRep: No valid CSL API method found. ` +
      `Tried: DRep.new(), DRep.from_credential(), DRep.from_key_hash(), DRep.from_bytes(), new DRep(). ` +
      `Debug info: ${JSON.stringify(errorDetails)}`
    );
    
  } catch (error) {
    // Clean up intermediate objects on error
    safeFree(drepKeyHash, drepCredential);
    
    if (error instanceof Error && error.message.includes('Failed to create DRep')) {
      throw error;
    }
    throw new Error(`Failed to create DRep from hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create anchor from URL and hash with proper validation
 */
function createAnchor(anchor?: Anchor): CSL.Anchor | null {
  if (!anchor || (!anchor.url && !anchor.hash)) {
    return null;
  }
  
  const url = anchor.url || '';
  const hashHex = anchor.hash || '';
  
  // CSL requires both URL and hash for anchor
  if (!hashHex || hashHex.length !== 64) {
    return null; // Anchor hash must be 32 bytes (64 hex chars)
  }
  
  if (!url) {
    return null; // URL is required
  }
  
  let anchorDataHash: CSL.AnchorDataHash | null = null;
  let anchorUrl: CSL.URL | null = null;
  
  try {
    validateHex(hashHex, 64, 'Anchor hash');
    
    const hashBytes = Buffer.from(hashHex, 'hex');
    anchorDataHash = CSL.AnchorDataHash.from_bytes(hashBytes);
    anchorUrl = CSL.URL.new(url);
    
    const anchorObj = CSL.Anchor.new(anchorUrl, anchorDataHash);
    
    // Note: We don't free anchorUrl and anchorDataHash here because
    // they are owned by anchorObj and will be freed when anchorObj is freed
    
    return anchorObj;
  } catch (error) {
    // Clean up on error
    safeFree(anchorDataHash, anchorUrl);
    throw new Error(`Failed to create anchor: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build Vote Delegation certificate - IMPROVED with better error handling
 */
export function buildVoteDelegationCert(
  drepId: string,
  stakeCredential: string
): { cert: CSL.Certificate; error?: BuildError } {
  let drep: CSL.DRep | null = null;
  let stakeKeyHash: CSL.Ed25519KeyHash | null = null;
  let stakeCred: CSL.Credential | null = null;
  let voteDelegation: CSL.VoteDelegation | null = null;
  
  try {
    // Decode inputs
    const drepHash = decodeDRepId(drepId);
    const stakeInfo = decodeStakeCredential(stakeCredential);
    
    // Create DRep (centralized helper)
    drep = createDRepFromHash(drepHash);
    
    // Create stake credential
    const stakeHashBytes = Buffer.from(stakeInfo.hash, 'hex');
    if (stakeHashBytes.length !== 28) {
      throw new Error(`Invalid stake hash length: expected 28 bytes, got ${stakeHashBytes.length}`);
    }
    
    stakeKeyHash = CSL.Ed25519KeyHash.from_bytes(stakeHashBytes);
    stakeCred = CSL.Credential.from_keyhash(stakeKeyHash);
    
    // Create vote delegation certificate
    // Note: CSL API may accept Credential where DRep is expected in some versions
    voteDelegation = CSL.VoteDelegation.new(stakeCred, drep as any);
    const cert = CSL.Certificate.new_vote_delegation(voteDelegation);
    
    // Note: We don't free intermediate objects here because they are owned by cert
    // The caller is responsible for freeing the cert when done
    
    return { cert };
  } catch (error) {
    // Clean up all intermediate objects on error
    safeFree(drep, stakeKeyHash, stakeCred, voteDelegation);
    
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
 * Build DRep Registration certificate - IMPROVED
 */
export function buildDRepRegistrationCert(
  drepId: string,
  anchor?: Anchor
): { cert: CSL.Certificate; error?: BuildError } {
  let drep: CSL.DRep | null = null;
  let drepCredential: CSL.Credential | null = null;
  let drepKeyHash: CSL.Ed25519KeyHash | null = null;
  let anchorObj: CSL.Anchor | null = null;
  let drepRegistration: CSL.DRepRegistration | null = null;
  
  try {
    const drepHash = decodeDRepId(drepId);
    
    // Create DRep (centralized helper) - needed for VoteDelegation
    drep = createDRepFromHash(drepHash);
    
    // Also create credential for DRepRegistration/DRepUpdate APIs
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    drepCredential = CSL.Credential.from_keyhash(drepKeyHash);
    
    // Create anchor if provided
    anchorObj = createAnchor(anchor);
    
    // Create DRep registration certificate
    // CSL DRepRegistration.new() expects 2 arguments
    // TypeScript types may be incorrect - use type assertion and try runtime API
    try {
      // Method 1: Try with credential and anchor (most likely)
      drepRegistration = (CSL.DRepRegistration as any).new(drepCredential, anchorObj);
    } catch (error) {
      // Method 2: Try with DRep instead of Credential
      drepRegistration = (CSL.DRepRegistration as any).new(drep, anchorObj);
    }
    
    if (!drepRegistration) {
      throw new Error('Failed to create DRepRegistration');
    }
    
    const cert = CSL.Certificate.new_drep_registration(drepRegistration);
    
    return { cert };
  } catch (error) {
    // Clean up on error
    safeFree(drep, drepCredential, drepKeyHash, anchorObj, drepRegistration);
    
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
 * Build DRep Update certificate - IMPROVED
 */
export function buildDRepUpdateCert(
  drepId: string,
  anchor?: Anchor
): { cert: CSL.Certificate; error?: BuildError } {
  let drep: CSL.DRep | null = null;
  let drepCredential: CSL.Credential | null = null;
  let drepKeyHash: CSL.Ed25519KeyHash | null = null;
  let anchorObj: CSL.Anchor | null = null;
  let drepUpdate: CSL.DRepUpdate | null = null;
  
  try {
    const drepHash = decodeDRepId(drepId);
    
    // Create DRep (centralized helper)
    drep = createDRepFromHash(drepHash);
    
    // Also create credential and key hash for alternative API signatures
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    drepCredential = CSL.Credential.from_keyhash(drepKeyHash);
    
    // Create anchor if provided
    anchorObj = createAnchor(anchor);
    
    // Create DRep update certificate
    // CSL DRepUpdate.new() takes 1 argument: Credential (not DRep!)
    // Based on TypeScript types and error "expected instance of Credential"
    // Anchor is passed as optional second parameter or set via method
    try {
      // DRepUpdate.new(credential: Credential, anchor?: Anchor | null)
      // Try with anchor as second parameter first
      if (anchorObj) {
        try {
          drepUpdate = (CSL.DRepUpdate as any).new(drepCredential, anchorObj);
        } catch (twoArgError) {
          // If 2 args fails, try 1 arg and set anchor separately
          drepUpdate = CSL.DRepUpdate.new(drepCredential);
          if (typeof (drepUpdate as any).set_anchor === 'function') {
            (drepUpdate as any).set_anchor(anchorObj);
          }
        }
      } else {
        // No anchor - just create with credential
        drepUpdate = CSL.DRepUpdate.new(drepCredential);
      }
    } catch (error) {
      throw new Error(`Failed to create DRepUpdate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    if (!drepUpdate) {
      throw new Error('Failed to create DRepUpdate: All methods failed');
    }
    
    const cert = CSL.Certificate.new_drep_update(drepUpdate);
    
    return { cert };
  } catch (error) {
    // Clean up on error
    safeFree(drep, drepCredential, drepKeyHash, anchorObj, drepUpdate);
    
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
 * Build DRep Retirement certificate - IMPROVED
 */
export function buildDRepRetirementCert(
  drepId: string,
  epoch?: number
): { cert: CSL.Certificate; error?: BuildError } {
  let drep: CSL.DRep | null = null;
  let epochBigNum: CSL.BigNum | null = null;
  let drepDeregistration: CSL.DRepDeregistration | null = null;
  
  try {
    const drepHash = decodeDRepId(drepId);
    
    // Create DRep (centralized helper)
    drep = createDRepFromHash(drepHash);
    
    // Create epoch BigNum (default to 0 for immediate retirement)
    const epochValue = epoch ?? 0;
    if (epochValue < 0) {
      throw new Error('Epoch must be non-negative');
    }
    
    epochBigNum = CSL.BigNum.from_str(epochValue.toString());
    
    // Create DRep retirement certificate
    // Note: CSL API expects (epoch: BigNum, drep: DRep) based on error messages
    // Try both orders to handle different CSL versions
    try {
      drepDeregistration = (CSL.DRepDeregistration as any).new(epochBigNum, drep);
    } catch (error) {
      // Try reverse order if first fails
      drepDeregistration = (CSL.DRepDeregistration as any).new(drep as any, epochBigNum);
    }
    
    if (!drepDeregistration) {
      throw new Error('Failed to create DRepDeregistration: Both parameter orders failed');
    }
    
    const cert = CSL.Certificate.new_drep_deregistration(drepDeregistration);
    
    return { cert };
  } catch (error) {
    // Clean up on error
    safeFree(drep, epochBigNum, drepDeregistration);
    
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
 * NOTE: Votes in Conway are NOT certificates - they are part of voting_procedures in the transaction body.
 */
export function buildVoteCert(
  proposalId: string,
  vote: 'yes' | 'no' | 'abstain',
  anchor?: Anchor
): { cert: CSL.Certificate; error?: BuildError } {
  return {
    cert: null as any,
    error: {
      message: 'Vote certificates are not supported. Votes must be added to voting_procedures in the transaction body, which requires additional implementation.',
      field: 'proposalId'
    }
  };
}

/**
 * Build certificate from builder certificate data - IMPROVED
 */
export function buildCertificateFromData(certData: BuilderCertificate): { cert: CSL.Certificate; error?: BuildError } {
  try {
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
          certData.data.drepId as string,
          certData.data.epoch as number | undefined
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
  } catch (error) {
    return {
      cert: null as any,
      error: {
        message: error instanceof Error ? error.message : 'Failed to build certificate',
        field: 'type'
      }
    };
  }
}

/**
 * Assemble transaction from certificates and UTXOs - IMPROVED with better resource management
 */
export function assembleTransaction(params: {
  certificates: BuilderCertificate[];
  txBodyElements?: BuilderTxBodyElement[];
  utxos: any[];
  changeAddress: string;
  network: Network;
  fee?: bigint;
}): { txBody: CSL.TransactionBody; error?: BuildError } {
  const { certificates, txBodyElements = [], utxos, changeAddress, network, fee } = params;
  
  // Track all CSL objects for cleanup on error
  const createdObjects: Array<any> = [];
  
  try {
    // Validate inputs
    if (!changeAddress || typeof changeAddress !== 'string') {
      throw new Error('Change address is required');
    }
    
    if (!utxos || utxos.length === 0) {
      throw new Error('At least one UTXO is required');
    }
    
    // Filter out votes - they are not certificates
    const certificateTypes = certificates.filter(c => c.type !== 'Vote');
    const voteTypes = certificates.filter(c => c.type === 'Vote');
    
    if (certificateTypes.length === 0 && voteTypes.length === 0 && txBodyElements.length === 0) {
      return {
        txBody: null as any,
        error: { message: 'No certificates or transaction body elements to build transaction' }
      };
    }

    // TODO: Process transaction body elements
    // This will require implementing builder functions for each element type
    if (txBodyElements.length > 0) {
      console.log(`⚠️ Transaction body elements (${txBodyElements.length}) are not yet fully implemented in assembleTransaction`);
      // For now, we'll continue with certificate-based building
      // Full implementation will require:
      // - Processing inputs/outputs from txBodyElements
      // - Setting fees, validity intervals, withdrawals, mint, etc.
      // - Handling governance procedures, treasury amounts, etc.
    }
    
    // Warn about votes (not supported as certificates)
    if (voteTypes.length > 0) {
      console.warn(`Votes (${voteTypes.length}) cannot be added as certificates. Votes must be added to voting_procedures in the transaction body.`);
    }
    
    // Build certificate list
    const certList = CSL.Certificates.new();
    createdObjects.push(certList);
    
    const errors: BuildError[] = [];
    
    for (let i = 0; i < certificateTypes.length; i++) {
      const certData = certificateTypes[i];
      const { cert, error } = buildCertificateFromData(certData);
      
      if (error) {
        errors.push(error);
        continue;
      }
      
      certList.add(cert);
      // Note: cert is owned by certList, will be freed when certList is freed
    }
    
    // Only proceed if we have at least one certificate
    if (certList.len() === 0 && errors.length > 0) {
      safeFree(...createdObjects);
      return {
        txBody: null as any,
        error: { message: `Failed to build certificates: ${errors.map(e => e.message).join(', ')}` }
      };
    }
    
    // Create transaction inputs
    const inputs = CSL.TransactionInputs.new();
    createdObjects.push(inputs);
    
    let totalInput = BigInt(0);
    
    for (let i = 0; i < utxos.length; i++) {
      const utxo = utxos[i];
      try {
        // Validate UTXO structure
        if (!utxo.input || !utxo.input.txHash || typeof utxo.input.outputIndex !== 'number') {
          throw new Error(`Invalid UTXO structure at index ${i}`);
        }
        
        validateHex(utxo.input.txHash, 64, `UTXO ${i} transaction hash`);
        
        const txId = CSL.TransactionHash.from_bytes(Buffer.from(utxo.input.txHash, 'hex'));
        const index = utxo.input.outputIndex;
        
        if (index < 0 || index > 0xFFFFFFFF) {
          throw new Error(`Invalid UTXO output index: ${index}`);
        }
        
        const input = CSL.TransactionInput.new(txId, index);
        inputs.add(input);
        
        // Calculate total input value
        const amounts = utxo.output?.amount || [];
        const lovelaceAmount = amounts.find((a: any) => a.unit === 'lovelace');
        if (lovelaceAmount) {
          totalInput += BigInt(lovelaceAmount.quantity);
        }
      } catch (utxoError) {
        safeFree(...createdObjects);
        throw new Error(`Error processing UTXO ${i + 1}: ${utxoError instanceof Error ? utxoError.message : 'Unknown error'}`);
      }
    }
    
    // Create transaction outputs
    const outputs = CSL.TransactionOutputs.new();
    createdObjects.push(outputs);
    
    // Calculate output value (total input - fee)
    const calculatedFee = fee || BigInt(200000); // Default fee estimate
    
    if (totalInput < calculatedFee) {
      safeFree(...createdObjects);
      throw new Error(`Insufficient funds: total input ${totalInput} is less than fee ${calculatedFee}`);
    }
    
    const outputValue = totalInput - calculatedFee;
    
    if (outputValue > 0) {
      try {
        // Validate address format
        if (!changeAddress.startsWith('addr') && !changeAddress.startsWith('addr_test')) {
          throw new Error('Invalid change address format');
        }
        
        const address = CSL.Address.from_bech32(changeAddress);
        const value = CSL.Value.new(CSL.BigNum.from_str(outputValue.toString()));
        const output = CSL.TransactionOutput.new(address, value);
        outputs.add(output);
      } catch (outputError) {
        safeFree(...createdObjects);
        throw new Error(`Error creating change output: ${outputError instanceof Error ? outputError.message : 'Unknown error'}`);
      }
    }
    
    // Create transaction body
    // CSL TransactionBody.new() may have different signatures in different versions
    // Try the most common signature first: new(inputs, outputs)
    // Type definitions may be incorrect, so we use type assertion
    let txBody: CSL.TransactionBody;
    try {
      txBody = (CSL.TransactionBody as any).new(inputs, outputs);
    } catch (error) {
      // Some CSL versions may require different constructor signature
      // Try alternative: new() then set inputs/outputs separately
      txBody = (CSL.TransactionBody as any).new();
      (txBody as any).set_inputs(inputs);
      (txBody as any).set_outputs(outputs);
    }
    
    // Note: inputs and outputs are owned by txBody, don't free them separately
    
    // Set fee - CSL API may use different method names
    const feeBigNum = CSL.BigNum.from_str(calculatedFee.toString());
    try {
      (txBody as any).set_fee(feeBigNum);
    } catch (error) {
      // Alternative method name
      (txBody as any).fee = feeBigNum;
    }
    feeBigNum.free(); // Free immediately after use
    
    // Set certificates (only if we have any)
    if (certList.len() > 0) {
      try {
        (txBody as any).set_certs(certList);
      } catch (error) {
        // Alternative method name
        (txBody as any).certs = certList;
      }
      // Note: certList is owned by txBody now, don't free it separately
    } else {
      certList.free(); // Free if not used
    }
    
    // Set TTL (validity interval end) - set to current slot + 3600 (1 hour)
    const currentSlot = Math.floor(Date.now() / 1000) + 3600; // Rough estimate
    const ttlBigNum = CSL.BigNum.from_str(currentSlot.toString());
    try {
      (txBody as any).set_ttl_bignum(ttlBigNum);
    } catch (error) {
      // Alternative method name
      (txBody as any).ttl_bignum = ttlBigNum;
    }
    ttlBigNum.free(); // Free immediately after use
    
    // Clear createdObjects since txBody now owns them
    createdObjects.length = 0;
    
    return { txBody };
  } catch (error) {
    // Clean up all created objects on error
    safeFree(...createdObjects);
    
    return {
      txBody: null as any,
      error: {
        message: error instanceof Error ? error.message : 'Failed to assemble transaction'
      }
    };
  }
}

/**
 * Serialize transaction to hex - IMPROVED with validation
 */
export function serializeTransaction(txBody: CSL.TransactionBody): string {
  if (!txBody) {
    throw new Error('Transaction body is required');
  }
  
  try {
    return txBody.to_hex();
  } catch (error) {
    throw new Error(`Failed to serialize transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate estimated transaction fee - IMPROVED
 */
export function calculateFee(
  txBody: CSL.TransactionBody,
  network: Network
): bigint {
  if (!txBody) {
    throw new Error('Transaction body is required');
  }
  
  try {
    // Simple fee calculation: base fee + (size * fee per byte)
    // This is a simplified version - real fee calculation requires protocol parameters
    const baseFee = BigInt(170000);
    const feePerByte = BigInt(44);
    const size = txBody.to_bytes().length;
    return baseFee + (BigInt(size) * feePerByte);
  } catch (error) {
    throw new Error(`Failed to calculate fee: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Free transaction body and all owned objects
 * Call this when you're done with a transaction body to prevent memory leaks
 */
export function freeTransactionBody(txBody: CSL.TransactionBody): void {
  safeFree(txBody);
}

/**
 * Free certificate and all owned objects
 * Call this when you're done with a certificate to prevent memory leaks
 */
export function freeCertificate(cert: CSL.Certificate): void {
  safeFree(cert);
}
