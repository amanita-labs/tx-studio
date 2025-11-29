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
 * Supports both CIP-105 (drep1...) and hex formats
 */
function decodeDRepId(drepId: string): string {
  try {
    const trimmed = drepId.trim();
    
    // If it's already hex (56 hex chars = 28 bytes), return as is
    if (/^[0-9a-fA-F]{56}$/i.test(trimmed)) {
      const hash = trimmed.toLowerCase();
      console.log('DRep ID is hex format, length:', hash.length);
      return hash;
    }
    
    // Try to decode bech32 CIP-105 format (drep1...)
    if (trimmed.startsWith('drep1')) {
      console.log('Decoding CIP-105 DRep ID:', trimmed);
      const decoded = bech32Buffer.decode(trimmed);
      const hashBytes = Buffer.from(decoded.data);
      const hash = hashBytes.toString('hex');
      
      console.log('Decoded DRep hash:', hash, 'length:', hash.length, 'bytes:', hashBytes.length);
      
      // Validate hash length (should be 28 bytes = 56 hex chars)
      if (hashBytes.length !== 28) {
        throw new Error(`Invalid DRep hash length: expected 28 bytes, got ${hashBytes.length} bytes (${hash.length} hex chars). DRep ID may be incomplete or invalid.`);
      }
      
      return hash;
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
    const anchorDataHash = CSL.AnchorDataHash.from_bytes(hashBytes);
    const anchorUrl = CSL.URL.new(url);
    return CSL.Anchor.new(anchorUrl, anchorDataHash);
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
  console.group('🔨 Building Vote Delegation Certificate');
  console.log('Input:', { drepId, stakeCredential });
  
  try {
    console.log('Step 1: Decoding DRep ID...');
    const drepHash = decodeDRepId(drepId);
    console.log('✓ DRep hash:', drepHash);
    
    console.log('Step 2: Decoding stake credential...');
    const stakeInfo = decodeStakeCredential(stakeCredential);
    console.log('✓ Stake info:', stakeInfo);
    
    console.log('Step 3: Creating DRep credential...');
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    console.log('  DRep hash bytes length:', drepHashBytes.length);
    
    if (drepHashBytes.length !== 28) {
      throw new Error(`Invalid DRep hash length: expected 28 bytes, got ${drepHashBytes.length}`);
    }
    
    const drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    const drepCredential = CSL.Credential.from_keyhash(drepKeyHash);
    
    // Create DRep - CSL API varies, try multiple methods
    let drep: any;
    const DRepClass = CSL.DRep as any;
    
    if (typeof DRepClass.new === 'function') {
      drep = DRepClass.new(drepCredential);
    } else if (typeof DRepClass.from_credential === 'function') {
      drep = DRepClass.from_credential(drepCredential);
    } else if (typeof DRepClass.from_key_hash === 'function') {
      drep = DRepClass.from_key_hash(drepKeyHash);
    } else {
      // Fallback: use credential directly (some CSL versions accept credential where DRep is expected)
      drep = drepCredential;
      console.warn('Using credential directly as DRep (DRep creation methods not found)');
    }
    console.log('✓ DRep credential created');
    
    console.log('Step 4: Creating stake credential...');
    const stakeHashBytes = Buffer.from(stakeInfo.hash, 'hex');
    console.log('  Stake hash bytes length:', stakeHashBytes.length);
    const stakeKeyHash = CSL.Ed25519KeyHash.from_bytes(stakeHashBytes);
    const stakeCred = CSL.Credential.from_keyhash(stakeKeyHash);
    console.log('✓ Stake credential created');
    
    console.log('Step 5: Creating vote delegation certificate...');
    const voteDelegation = CSL.VoteDelegation.new(stakeCred, drep);
    const cert = CSL.Certificate.new_vote_delegation(voteDelegation);
    console.log('✓ Certificate created successfully');
    console.groupEnd();
    
    return { cert };
  } catch (error) {
    console.error('❌ Error building vote delegation certificate:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      drepId,
      stakeCredential,
    });
    console.groupEnd();
    
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
  console.group('🔨 Building DRep Registration Certificate');
  console.log('Input:', { drepId, anchor });
  
  try {
    console.log('Step 1: Decoding DRep ID...');
    const drepHash = decodeDRepId(drepId);
    console.log('✓ DRep hash:', drepHash);
    
    console.log('Step 2: Creating DRep credential...');
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    console.log('  DRep hash bytes length:', drepHashBytes.length);
    const drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    const drepCredential = CSL.Credential.from_keyhash(drepKeyHash);
    
    // Create DRep - CSL API varies, try multiple methods
    let drep: any;
    const DRepClass = CSL.DRep as any;
    if (typeof DRepClass.new === 'function') {
      drep = DRepClass.new(drepCredential);
    } else if (typeof DRepClass.from_credential === 'function') {
      drep = DRepClass.from_credential(drepCredential);
    } else if (typeof DRepClass.from_key_hash === 'function') {
      drep = DRepClass.from_key_hash(drepKeyHash);
    } else {
      drep = drepCredential;
      console.warn('Using credential directly as DRep');
    }
    console.log('✓ DRep credential created');
    
    console.log('Step 3: Creating anchor...');
    const anchorObj = createAnchor(anchor);
    console.log('✓ Anchor:', anchorObj ? 'created' : 'null');
    
    console.log('Step 4: Creating DRep registration certificate...');
    const drepRegistration = CSL.DRepRegistration.new(drep, anchorObj);
    const cert = CSL.Certificate.new_drep_registration(drepRegistration);
    console.log('✓ Certificate created successfully');
    console.groupEnd();
    
    return { cert };
  } catch (error) {
    console.error('❌ Error building DRep registration certificate:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      drepId,
      anchor,
    });
    console.groupEnd();
    
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
  console.group('🔨 Building DRep Update Certificate');
  console.log('Input:', { drepId, anchor });
  
  try {
    console.log('Step 1: Decoding DRep ID...');
    const drepHash = decodeDRepId(drepId);
    console.log('✓ DRep hash:', drepHash);
    
    console.log('Step 2: Creating DRep credential...');
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    console.log('  DRep hash bytes length:', drepHashBytes.length);
    const drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    const drepCredential = CSL.Credential.from_keyhash(drepKeyHash);
    
    // Create DRep - CSL API varies, try multiple methods
    let drep: any;
    const DRepClass = CSL.DRep as any;
    if (typeof DRepClass.new === 'function') {
      drep = DRepClass.new(drepCredential);
    } else if (typeof DRepClass.from_credential === 'function') {
      drep = DRepClass.from_credential(drepCredential);
    } else if (typeof DRepClass.from_key_hash === 'function') {
      drep = DRepClass.from_key_hash(drepKeyHash);
    } else {
      drep = drepCredential;
      console.warn('Using credential directly as DRep');
    }
    console.log('✓ DRep credential created');
    
    console.log('Step 3: Creating anchor...');
    const anchorObj = createAnchor(anchor);
    console.log('✓ Anchor:', anchorObj ? 'created' : 'null');
    
    console.log('Step 4: Creating DRep update certificate...');
    const drepUpdate = CSL.DRepUpdate.new(drep, anchorObj);
    const cert = CSL.Certificate.new_drep_update(drepUpdate);
    console.log('✓ Certificate created successfully');
    console.groupEnd();
    
    return { cert };
  } catch (error) {
    console.error('❌ Error building DRep update certificate:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      drepId,
      anchor,
    });
    console.groupEnd();
    
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
  console.group('🔨 Building DRep Retirement Certificate');
  console.log('Input:', { drepId });
  
  try {
    console.log('Step 1: Decoding DRep ID...');
    const drepHash = decodeDRepId(drepId);
    console.log('✓ DRep hash:', drepHash);
    
    console.log('Step 2: Creating DRep credential...');
    const drepHashBytes = Buffer.from(drepHash, 'hex');
    console.log('  DRep hash bytes length:', drepHashBytes.length);
    
    if (drepHashBytes.length !== 28) {
      throw new Error(`Invalid DRep hash length: expected 28 bytes, got ${drepHashBytes.length}`);
    }
    
    const drepKeyHash = CSL.Ed25519KeyHash.from_bytes(drepHashBytes);
    const drepCredential = CSL.Credential.from_keyhash(drepKeyHash);
    
    // Create DRep - CSL API varies, try multiple methods
    let drep: any;
    const DRepClass = CSL.DRep as any;
    if (typeof DRepClass.new === 'function') {
      drep = DRepClass.new(drepCredential);
    } else if (typeof DRepClass.from_credential === 'function') {
      drep = DRepClass.from_credential(drepCredential);
    } else if (typeof DRepClass.from_key_hash === 'function') {
      drep = DRepClass.from_key_hash(drepKeyHash);
    } else {
      drep = drepCredential;
      console.warn('Using credential directly as DRep');
    }
    console.log('✓ DRep credential created');
    
    console.log('Step 3: Creating DRep retirement certificate...');
    const drepDeregistration = CSL.DRepDeregistration.new(drep);
    const cert = CSL.Certificate.new_drep_deregistration(drepDeregistration);
    console.log('✓ Certificate created successfully');
    console.groupEnd();
    
    return { cert };
  } catch (error) {
    console.error('❌ Error building DRep retirement certificate:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      drepId,
    });
    console.groupEnd();
    
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
 * This function is currently not supported by CSL's certificate API.
 * Votes would need to be added to txBody.voting_procedures() instead.
 */
export function buildVoteCert(
  proposalId: string,
  vote: 'yes' | 'no' | 'abstain',
  anchor?: Anchor
): { cert: CSL.Certificate; error?: BuildError } {
  // Votes are not certificates in CSL - they need to be added to voting_procedures
  // This is a more complex implementation that requires building VotingProcedure objects
  // For now, return an error indicating this needs to be implemented differently
  return {
    cert: null as any,
    error: {
      message: 'Vote certificates are not supported. Votes must be added to voting_procedures in the transaction body, which requires additional implementation.',
      field: 'proposalId'
    }
  };
}

/**
 * Build certificate from builder certificate data
 */
export function buildCertificateFromData(certData: BuilderCertificate): { cert: CSL.Certificate; error?: BuildError } {
  console.log(`📋 Building certificate from data:`, certData);
  
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
      console.error(`❌ Unknown certificate type: ${certData.type}`);
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
  console.group('🔧 Assembling Transaction');
  console.log('Input params:', {
    certificateCount: params.certificates.length,
    utxoCount: params.utxos.length,
    changeAddress: params.changeAddress,
    network: params.network,
    fee: params.fee?.toString(),
  });
  console.log('Certificates:', params.certificates);
  console.log('UTXOs sample:', params.utxos.slice(0, 2));
  
  try {
    const { certificates, utxos, changeAddress, network, fee } = params;
    
    // Filter out votes - they are not certificates, they need to be added to voting_procedures
    const certificateTypes = certificates.filter(c => c.type !== 'Vote');
    const voteTypes = certificates.filter(c => c.type === 'Vote');
    
    console.log(`Filtered: ${certificateTypes.length} certificates, ${voteTypes.length} votes`);
    
    if (certificateTypes.length === 0 && voteTypes.length === 0) {
      console.error('❌ No certificates to build transaction');
      console.groupEnd();
      return {
        txBody: null as any,
        error: { message: 'No certificates to build transaction' }
      };
    }
    
    // Build certificate list
    console.log('Step 1: Building certificate list...');
    const certList = CSL.Certificates.new();
    const errors: BuildError[] = [];
    
    if (voteTypes.length > 0) {
      const voteError = {
        message: `Votes (${voteTypes.length}) cannot be added as certificates. Votes must be added to voting_procedures in the transaction body. This feature requires additional implementation.`,
        field: 'votes'
      };
      errors.push(voteError);
      console.warn('⚠️ Votes detected (not supported as certificates):', voteTypes);
    }
    
    for (let i = 0; i < certificateTypes.length; i++) {
      const certData = certificateTypes[i];
      console.log(`Building certificate ${i + 1}/${certificateTypes.length}:`, certData.type);
      const { cert, error } = buildCertificateFromData(certData);
      if (error) {
        console.error(`❌ Failed to build certificate ${i + 1}:`, error);
        errors.push(error);
        continue;
      }
      certList.add(cert);
      console.log(`✓ Certificate ${i + 1} added successfully`);
    }
    
    // Only set certificates if we have any
    if (certList.len() === 0 && errors.length > 0) {
      console.error('❌ No certificates built successfully. Errors:', errors);
      console.groupEnd();
      return {
        txBody: null as any,
        error: { message: `Failed to build certificates: ${errors.map(e => e.message).join(', ')}` }
      };
    }
    
    console.log(`✓ Built ${certList.len()} certificate(s)`);
    
    // Create transaction inputs
    console.log('Step 2: Creating transaction inputs...');
    const inputs = CSL.TransactionInputs.new();
    let totalInput = BigInt(0);
    
    for (let i = 0; i < utxos.length; i++) {
      const utxo = utxos[i];
      try {
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
      } catch (utxoError) {
        console.error(`❌ Error processing UTXO ${i + 1}:`, utxoError);
        console.error('UTXO data:', utxo);
        throw utxoError;
      }
    }
    console.log(`✓ Created ${inputs.len()} input(s), total input: ${totalInput.toString()} lovelace`);
    
    // Create transaction outputs
    console.log('Step 3: Creating transaction outputs...');
    const outputs = CSL.TransactionOutputs.new();
    
    // Calculate output value (total input - fee - certificates deposit if any)
    const calculatedFee = fee || BigInt(200000); // Default fee estimate
    const outputValue = totalInput - calculatedFee;
    console.log(`Fee: ${calculatedFee.toString()}, Output value: ${outputValue.toString()}`);
    
    if (outputValue > 0) {
      try {
        const address = CSL.Address.from_bech32(changeAddress);
        const value = CSL.Value.new(CSL.BigNum.from_str(outputValue.toString()));
        const output = CSL.TransactionOutput.new(address, value);
        outputs.add(output);
        console.log('✓ Created change output');
      } catch (outputError) {
        console.error('❌ Error creating change output:', outputError);
        console.error('Change address:', changeAddress);
        throw outputError;
      }
    }
    
    // Create transaction body
    console.log('Step 4: Creating transaction body...');
    const txBody = CSL.TransactionBody.new(inputs, outputs);
    
    // Set fee
    txBody.set_fee(CSL.BigNum.from_str(calculatedFee.toString()));
    console.log('✓ Fee set');
    
    // Set certificates (only if we have any)
    if (certList.len() > 0) {
      txBody.set_certs(certList);
      console.log('✓ Certificates set');
    }
    
    // If there were vote errors, add them to the return
    if (errors.length > 0 && certList.len() > 0) {
      // We have some certificates but also vote errors - return warning but allow building
      console.warn('⚠️ Vote errors (non-blocking):', errors);
    }
    
    // Set TTL (validity interval end) - set to current slot + 3600 (1 hour)
    const currentSlot = Math.floor(Date.now() / 1000) + 3600; // Rough estimate
    txBody.set_ttl_bignum(CSL.BigNum.from_str(currentSlot.toString()));
    console.log(`✓ TTL set to slot ${currentSlot}`);
    
    console.log('✅ Transaction assembled successfully');
    console.groupEnd();
    return { txBody };
  } catch (error) {
    console.error('❌ Error assembling transaction:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      params: {
        certificateCount: params.certificates.length,
        utxoCount: params.utxos.length,
        changeAddress: params.changeAddress,
        network: params.network,
      },
    });
    console.groupEnd();
    
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
