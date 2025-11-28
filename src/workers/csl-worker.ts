// src/workers/csl-worker.ts
// Real CSL-based transaction parser

import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import * as bech32Buffer from 'bech32-buffer';

let isInitialized = false;

// Initialize CSL parser
async function initializeParser() {
  if (isInitialized) return;
  
  try {
    // CSL is already initialized when imported
    isInitialized = true;
    console.log('CSL transaction parser initialized successfully');
  } catch (error) {
    console.error('Failed to initialize CSL parser:', error);
    throw error;
  }
}

// Enhanced metadata parsing helper functions
function parseMetadatum(metadatum: any): any {
  const kind = metadatum.kind();
  
  switch (kind) {
    case 0: // Text
      return metadatum.as_text();
    case 1: // Int
      return metadatum.as_int().to_str();
    case 2: // Bytes
      return Array.from(metadatum.as_bytes()).map((b: unknown) => (b as number).toString(16).padStart(2, '0')).join('');
    case 3: // List
      return parseMetadataList(metadatum.as_list());
    case 4: // Map
      return parseMetadataMap(metadatum.as_map());
    default:
      return null;
  }
}

function parseMetadataList(list: any): any[] {
  const result = [];
  for (let i = 0; i < list.len(); i++) {
    result.push(parseMetadatum(list.get(i)));
  }
  return result;
}

function parseMetadataMap(map: any): Record<string, any> {
  const result: Record<string, any> = {};
  const keys = map.keys();
  for (let i = 0; i < keys.len(); i++) {
    const key = parseMetadatum(keys.get(i));
    const value = parseMetadatum(map.get(keys.get(i)));
    result[String(key)] = value;
  }
  return result;
}

function normalizeAmount(value: any, defaultValue = '0'): string {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'object') {
    try {
      if (typeof value.to_str === 'function') {
        return value.to_str();
      }
      if (typeof value.toString === 'function') {
        const stringified = value.toString();
        if (stringified !== '[object Object]') {
          return stringified;
        }
      }
    } catch {
      // fall through
    }
  }
  return String(value ?? defaultValue);
}

type CredentialInfo = {
  type: string;
  hash: string;
  bech32?: string;
  raw: any;
};

type AnchorInfo = {
  url?: string;
  hash?: string;
  bytes?: string;
  raw: any;
} | null;

function createBech32Credential(hash: string, type: string, context?: 'stake' | 'drep' | 'committee' | 'committeeHot' | 'committeeCold' | 'unknown', networkId?: number): string | null {
  if (!hash || hash.length === 0) return null;

  try {
    const isKeyType = type === 'Key' || type === 'KeyHash';
    const isScriptType = type === 'Script' || type === 'ScriptHash';
    
    if (!isKeyType && !isScriptType) return null;
    
    try {
      // Convert hex hash to bytes
      const hexBytes = new Uint8Array(Buffer.from(hash, 'hex'));
      
      if (hexBytes.length !== 28) return null;
      
      // For stake context, use RewardAddress which creates proper stake1 addresses
      if (context === 'stake') {
        const effectiveNetworkId = networkId ?? 1; // Default to mainnet if not provided
        if (isKeyType) {
          const keyHash = CSL.Ed25519KeyHash.from_bytes(hexBytes);
          const stakeCredential = CSL.Credential.from_keyhash(keyHash);
          const rewardAddress = CSL.RewardAddress.new(effectiveNetworkId, stakeCredential);
          return rewardAddress.to_address().to_bech32();
        } else {
          const scriptHash = CSL.ScriptHash.from_bytes(hexBytes);
          const stakeCredential = CSL.Credential.from_scripthash(scriptHash);
          const rewardAddress = CSL.RewardAddress.new(effectiveNetworkId, stakeCredential);
          return rewardAddress.to_address().to_bech32();
        }
      } else {
        // For drep and committee contexts, use CIP-0129 HRP prefixes with bech32-buffer
        // CIP-0129: drep uses 'drep1', committee hot uses 'cc_hot1', committee cold uses 'cc_cold1'
        let prefix = '';
        if (context === 'drep') {
          prefix = 'drep';
        } else if (context === 'committeeHot') {
          prefix = 'cc_hot';
        } else if (context === 'committeeCold') {
          prefix = 'cc_cold';
        } else {
          prefix = ''; // empty for unknown context
        }
        
        if (!prefix) return null;
        
        // Use bech32-buffer for proper CIP-0129 encoding
        // For committee credentials, CIP-0129 requires a header byte:
        // - Key type: Hot = 0x00, Cold = 0x01
        // - Credential type: Key Hash = 0x02, Script Hash = 0x03
        // Header byte = (keyType << 4) | credentialType
        try {
          const hashBuffer = Buffer.from(hash, 'hex');
          
          // For committee credentials, prepend header byte according to CIP-0129
          if (context === 'committeeHot' || context === 'committeeCold') {
            const keyType = context === 'committeeHot' ? 0x00 : 0x01; // Hot = 0, Cold = 1
            const credentialType = isKeyType ? 0x02 : 0x03; // Key Hash = 2, Script Hash = 3
            const headerByte = (keyType << 4) | credentialType;
            
            // Prepend header byte to hash
            const dataWithHeader = Buffer.concat([Buffer.from([headerByte]), hashBuffer]);
            return bech32Buffer.encode(prefix, dataWithHeader).toString();
          } else {
            // For DRep, no header byte needed
            return bech32Buffer.encode(prefix, hashBuffer).toString();
          }
        } catch (error) {
          console.warn('Failed to create Bech32 credential with bech32-buffer:', error);
          // Fallback to CSL method if bech32-buffer fails
          try {
            if (isKeyType) {
              const keyHash = CSL.Ed25519KeyHash.from_bytes(hexBytes);
              return keyHash.to_bech32(prefix);
            } else {
              const scriptHash = CSL.ScriptHash.from_bytes(hexBytes);
              return scriptHash.to_bech32(prefix);
            }
          } catch (fallbackError) {
            console.warn('Fallback Bech32 creation also failed:', fallbackError);
            return null;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to create Bech32 from hash:', error);
      return null;
    }
  } catch (error) {
    console.warn('Error creating Bech32 credential:', error);
    return null;
  }
}

  // Helper function to create bech32 governance action ID according to CIP-0129
  // Governance action IDs use HRP prefix "gov_action1"
  // CIP-0129: Governance action IDs are bech32-encoded with HRP "gov_action"
  // Format: gov_action1 + bech32_encoded(txId_bytes(32) + index_bytes(1))
  // According to CIP-0129, the index is a uint8 (1 byte)
function createGovernanceActionId(txId: string, index: number): string | null {
  if (!txId || txId.length === 0) return null;
  
  try {
    // Validate transaction ID is 32 bytes (64 hex characters)
    if (txId.length !== 64) {
      console.warn(`Invalid transaction ID length: ${txId.length}, expected 64 hex characters`);
      return `${txId}#${index}`;
    }
    
    // Ensure index is a valid number (handle string inputs)
    const indexNum = typeof index === 'string' ? parseInt(index, 10) : Number(index);

    // Convert index to hex string and pad to 2 characters (1 byte)
    const indexHex = indexNum.toString(16).padStart(2, '0');
    
    // Combine transaction ID and index as hex strings, then convert to Buffer
    // This creates: txId (32 bytes) + index (1 byte) = 33 bytes total
    const combinedHex = txId + indexHex;
    
    // Encode using bech32-buffer with HRP "gov_action" according to CIP-0129
    const encoded = bech32Buffer.encode("gov_action", Buffer.from(combinedHex, 'hex')).toString();

    return encoded;
  } catch (error) {
    console.warn('Error creating governance action ID:', error);
    // Fallback to simple format if encoding fails
    return `${txId}#${index}`;
  }
}

function normalizeCredential(
  credential: any,
  context: 'stake' | 'drep' | 'committee' | 'committeeHot' | 'committeeCold' | 'unknown' = 'unknown',
  networkId?: number
): CredentialInfo {
  const info: CredentialInfo = {
    type: 'Unknown',
    hash: '',
    bech32: undefined,
    raw: credential
  };

  if (!credential) {
    return info;
  }

  if (typeof credential === 'string') {
    info.hash = credential;
    info.type = 'KeyHash';
  } else if (typeof credential === 'object') {
    const keyValue =
      credential.Key ??
      credential.key ??
      credential.KeyHash ??
      credential.keyHash ??
      credential.key_hash;
    const scriptValue =
      credential.Script ??
      credential.script ??
      credential.ScriptHash ??
      credential.scriptHash ??
      credential.script_hash;
    const hashValue = credential.Hash ?? credential.hash ?? credential.value;

    if (keyValue) {
      info.hash = String(keyValue);
      info.type = credential.Key || credential.key ? 'Key' : 'KeyHash';
    } else if (scriptValue) {
      info.hash = String(scriptValue);
      info.type = credential.Script || credential.script ? 'Script' : 'ScriptHash';
    } else if (hashValue) {
      info.hash = String(hashValue);
      info.type = 'Hash';
    }
  }

  if (!info.hash && credential && typeof credential === 'object') {
    const firstEntry = Object.values(credential)[0];
    if (typeof firstEntry === 'string') {
      info.hash = firstEntry;
      info.type = 'KeyHash';
    }
  }

  if (!info.hash) {
    info.hash = '';
  }

  // Try to generate Bech32 representation if we have a valid hash
  if (info.hash && info.hash.length > 0) {
    const bech32String = createBech32Credential(info.hash, info.type, context, networkId);
    if (bech32String) {
      info.bech32 = bech32String;
    } else {
      info.bech32 = info.hash || undefined;
    }
  } else {
    info.bech32 = info.hash || undefined;
  }

  return info;
}

function parseAnchorDetails(anchor: any): AnchorInfo {
  if (!anchor) return null;

  const url = anchor.url ?? anchor.anchor_url ?? anchor.reference ?? undefined;
  const hash = anchor.data_hash ?? anchor.hash ?? anchor.anchor_data_hash ?? undefined;
  const bytes = anchor.bytes ?? anchor.cbor ?? undefined;

  return {
    url,
    hash,
    bytes,
    raw: anchor
  };
}

function getMetadatumType(metadatum: any): string {
  const kind = metadatum.kind();
  const types = ['text', 'int', 'bytes', 'list', 'map'];
  return types[kind] || 'unknown';
}

// Enhanced datum parsing helper functions
function getDatumType(plutusData: any): string {
  try {
    const kind = plutusData.kind();
    const types = ['constr', 'map', 'list', 'int', 'bytes'];
    return types[kind] || 'unknown';
  } catch {
    return 'unknown';
  }
}

function parseDatumContent(plutusData: any): any {
  try {
    const kind = plutusData.kind();
    
    switch (kind) {
      case 0: // Constr
        return {
          constructor: plutusData.as_constr()?.constr_index() || 0,
          fields: plutusData.as_constr()?.fields() ? 
            Array.from({ length: plutusData.as_constr().fields().len() }, (_, i) => 
              parseDatumContent(plutusData.as_constr().fields().get(i))
            ) : []
        };
      case 1: // Map
        return parseDatumMap(plutusData.as_map());
      case 2: // List
        return parseDatumList(plutusData.as_list());
      case 3: // Int
        return plutusData.as_int().to_str();
      case 4: // Bytes
        return Array.from(plutusData.as_bytes()).map((b: unknown) => (b as number).toString(16).padStart(2, '0')).join('');
      default:
        return null;
    }
  } catch (error) {
    console.warn('Error parsing datum content:', error);
    return null;
  }
}

function parseDatumList(list: any): any[] {
  const result = [];
  for (let i = 0; i < list.len(); i++) {
    result.push(parseDatumContent(list.get(i)));
  }
  return result;
}

function parseDatumMap(map: any): Record<string, any> {
  const result: Record<string, any> = {};
  const keys = map.keys();
  for (let i = 0; i < keys.len(); i++) {
    const key = parseDatumContent(keys.get(i));
    const value = parseDatumContent(map.get(keys.get(i)));
    result[String(key)] = value;
  }
  return result;
}

// Real CSL-based transaction parsing
async function parseTransaction(hex: string, network: 'mainnet' | 'preprod' | 'preview' = 'mainnet') {
  let transaction: any = null;
  let body: any = null;
  let witnessSet: any = null;
  let auxiliaryData: any = null;
  
  try {
    await initializeParser();
    
    // Map network to network ID for CSL
    // CSL.NetworkId: 0 = Testnet, 1 = Mainnet
    // For our network enum: mainnet=1, preprod=0, preview=0
    const networkId = network === 'mainnet' ? 1 : 0;
    
    // Enhanced validation
    if (!hex || typeof hex !== 'string') {
      throw new Error('Transaction hex is required and must be a string');
    }
    
    if (hex.length < 100) {
      throw new Error('Transaction hex too short to be valid (minimum 100 characters)');
    }
    
    if (hex.length > 1000000) {
      throw new Error('Transaction hex too long (maximum 1MB)');
    }
    
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error('Invalid hex format - only hexadecimal characters allowed');
    }
    
    if (hex.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    
    // Check for common prefixes and clean if needed
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (cleanHex !== hex) {
      console.warn('Removed 0x prefix from transaction hex');
    }
    
    // Parse transaction using CSL
    transaction = CSL.Transaction.from_hex(cleanHex);
    body = transaction.body();
    witnessSet = transaction.witness_set();
    auxiliaryData = transaction.auxiliary_data();
    
    // Validate transaction structure
    if (!body) {
      throw new Error('Failed to parse transaction body');
    }
    
    if (!witnessSet) {
      throw new Error('Failed to parse witness set');
    }
    
    // Get transaction size
    const size = hex.length / 2;
    
    // Calculate transaction ID (hash of the body)
    const fixedTransaction = CSL.FixedTransaction.from_hex(hex);
    const id = fixedTransaction.transaction_hash().to_hex();
    
    // Determine era based on transaction structure
    let era = "Unknown";
    try {
      // Check for Conway era features first
      if (body.voting_procedures() !== undefined || body.voting_proposals() !== undefined) {
        era = "Conway";
      } else if (body.script_data_hash() !== undefined) {
      era = "Babbage";
      } else if (body.mint() !== undefined) {
      era = "Alonzo";
      } else {
        era = "Alonzo"; // Default to Alonzo for now
      }
    } catch {
      era = "Unknown";
    }
    
    // Parse fee
    const fee = BigInt(body.fee().to_str());
    
    // Parse TTL
    const ttlBignum = body.ttl_bignum();
    const ttl = ttlBignum ? Number(ttlBignum.to_str()) : null;
    
    // Parse validity interval
    const validityStartBignum = body.validity_start_interval_bignum();
    const validityStart = validityStartBignum ? Number(validityStartBignum.to_str()) : null;
    
    // Parse inputs
    const inputs = [];
    const bodyInputs = body.inputs();
    for (let i = 0; i < bodyInputs.len(); i++) {
      const input = bodyInputs.get(i);
      const txId = input.transaction_id().to_hex();
      const index = input.index();
      
      inputs.push({
        txId,
        index,
        isCollateral: false, // Regular inputs are not collateral
        resolved: undefined // Will be resolved later if needed
      });
    }
    
    // Parse collateral inputs
    const collateralInputs = body.collateral();
    if (collateralInputs) {
      for (let i = 0; i < collateralInputs.len(); i++) {
        const input = collateralInputs.get(i);
        const txId = input.transaction_id().to_hex();
        const index = input.index();
        
        inputs.push({
          txId,
          index,
          isCollateral: true,
          resolved: undefined
        });
      }
    }
    
    // Parse outputs
    const outputs = [];
    const bodyOutputs = body.outputs();
    for (let i = 0; i < bodyOutputs.len(); i++) {
      const output = bodyOutputs.get(i);
      const address = output.address().to_bech32();
      const amount = output.amount();
      
      // Parse ADA amount
      const ada = BigInt(amount.coin().to_str());
      
      // Parse assets
      const assets = [];
      const multiAsset = amount.multiasset();
      if (multiAsset) {
        const keys = multiAsset.keys();
        for (let j = 0; j < keys.len(); j++) {
          const policyId = keys.get(j).to_hex();
          const assetsMap = multiAsset.get(keys.get(j));
          if (assetsMap) {
            const assetNames = assetsMap.keys();
            
            for (let k = 0; k < assetNames.len(); k++) {
              const assetName = assetNames.get(k).to_hex();
              const quantity = BigInt(assetsMap.get(assetNames.get(k))?.to_str() || '0');
              
              assets.push({
                policyId,
                assetName,
                quantity
              });
            }
          }
        }
      }
      
      // Parse datum with enhanced detection
      let datum = undefined;
      const dataHash = output.data_hash();
      const plutusData = output.plutus_data();
      
      if (plutusData) {
        // Inline datum - try to parse the content
        try {
          const datumType = getDatumType(plutusData);
          const datumContent = parseDatumContent(plutusData);
          
          datum = {
            inline: true,
            hash: dataHash?.to_hex() || undefined,
            type: datumType,
            content: datumContent,
            size: plutusData.to_bytes().length
          };
        } catch (error) {
          console.warn('Error parsing inline datum:', error);
          datum = {
            inline: true,
            hash: dataHash?.to_hex() || undefined,
            type: 'unknown',
            content: null,
            error: error instanceof Error ? error.message : 'Parse error'
          };
        }
      } else if (dataHash) {
        // Datum hash
        datum = {
          inline: false,
          hash: dataHash.to_hex(),
          type: 'hash',
          content: null
        };
      }
      
      // Parse script reference
      let scriptRef = undefined;
      const scriptRefOption = output.script_ref();
      if (scriptRefOption) {
        if (scriptRefOption.is_native_script()) {
          const nativeScript = scriptRefOption.native_script();
          if (nativeScript) {
            scriptRef = {
              type: "Native",
              bytes: nativeScript.to_hex()
            };
          }
        } else if (scriptRefOption.is_plutus_script()) {
          const plutusScript = scriptRefOption.plutus_script();
          if (plutusScript) {
            const version = plutusScript.language_version();
            const type = version.kind() === 0 ? "PlutusV1" : 
                        version.kind() === 1 ? "PlutusV2" : 
                        version.kind() === 2 ? "PlutusV3" : "PlutusV1";
            scriptRef = {
              type,
              bytes: plutusScript.to_hex()
            };
          }
        }
      }
      
      outputs.push({
        address,
        ada,
        assets,
        datum,
        scriptRef
      });
    }
    
    // Parse mint
    let mint = undefined;
    const mintData = body.mint();
    if (mintData) {
      mint = [];
      const keys = mintData.keys();
      for (let i = 0; i < keys.len(); i++) {
        const policyId = keys.get(i).to_hex();
        const mintsAssets = mintData.get(keys.get(i));
        if (mintsAssets) {
          // MintsAssets is a collection of MintAssets
          for (let j = 0; j < mintsAssets.len(); j++) {
            const mintAssets = mintsAssets.get(j);
            if (mintAssets) {
              const assetNames = mintAssets.keys();
              
              for (let k = 0; k < assetNames.len(); k++) {
                const assetName = assetNames.get(k).to_hex();
                const quantity = BigInt(mintAssets.get(assetNames.get(k))?.to_str() || '0');
                
                mint.push({
                  policyId,
                  assetName,
                  quantity
                });
              }
            }
          }
        }
      }
    }
    
    // Parse certificates
    let certs = undefined;
    const bodyCerts = body.certs();
    if (bodyCerts) {
      certs = [];
      for (let i = 0; i < bodyCerts.len(); i++) {
        const cert = bodyCerts.get(i);
        // Parse certificate type and details
        const certType = cert.kind();
        let type = "Unknown";
        let details: Record<string, unknown> = {};
        
        try {
          // Try to parse certificate as JSON first to get the actual structure
          const certJson = cert.to_js_value();
          
          if (certJson.StakeRegistration) {
            type = "StakeRegistration";
            const stakeReg = certJson.StakeRegistration;
            const stakeCredentialSource = stakeReg.stake_credential ?? null;
            const stakeCredential = normalizeCredential(stakeCredentialSource, 'stake', networkId);
            const credentialDetails = { ...stakeCredential };
            details = {
              stakeCredential: credentialDetails,
              coin: stakeReg.coin || "0",
              deposit: stakeReg.coin || "0"
            };
          } else if (certJson.StakeDeregistration) {
            type = "StakeDeregistration";
            const stakeDereg = certJson.StakeDeregistration;
            const stakeCredentialSource = stakeDereg.stake_credential ?? null;
            const stakeCredential = normalizeCredential(stakeCredentialSource, 'stake', networkId);
            const credentialDetails = { ...stakeCredential };
            details = {
              stakeCredential: credentialDetails,
              coin: stakeDereg.coin || "0",
              refund: stakeDereg.coin || "0"
            };
          } else if (certJson.StakeDelegation) {
            type = "StakeDelegation";
            const stakeDeleg = certJson.StakeDelegation;
            const stakeCredentialSource = stakeDeleg.stake_credential ?? null;
            const stakeCredential = normalizeCredential(stakeCredentialSource, 'stake', networkId);
            const credentialDetails = { ...stakeCredential };
            details = {
              stakeCredential: credentialDetails,
              poolKeyHash: stakeDeleg.pool_keyhash || "",
              poolId: stakeDeleg.pool_keyhash || ""
            };
          } else if (certJson.PoolRegistration) {
            type = "PoolRegistration";
            const poolReg = certJson.PoolRegistration;
            details = {
              operator: {
                type: "KeyHash",
                hash: poolReg.operator || "",
                bech32: poolReg.operator || ""
              },
              vrfKeyHash: {
                type: "VRFKeyHash",
                hash: poolReg.vrf_keyhash || ""
              },
              pledge: poolReg.pledge || "0",
              cost: poolReg.cost || "0",
              margin: poolReg.margin || {},
              rewardAccount: {
                address: poolReg.reward_account || "",
                credential: {
                  type: "KeyHash",
                  hash: poolReg.reward_account || ""
                }
              },
              poolOwners: poolReg.pool_owners || [],
              relays: poolReg.relays || [],
              poolId: poolReg.operator || ""
            };
          } else if (certJson.PoolRetirement) {
            type = "PoolRetirement";
            const poolRet = certJson.PoolRetirement;
            details = {
              poolOperator: {
                type: "KeyHash",
                hash: poolRet.pool_keyhash || "",
                bech32: poolRet.pool_keyhash || ""
              },
              epoch: poolRet.epoch || 0,
              poolId: poolRet.pool_keyhash || ""
            };
          } else if (certJson.GenesisKeyDelegation) {
            type = "GenesisKeyDelegation";
            const genesisDeleg = certJson.GenesisKeyDelegation;
            details = {
              genesisHash: {
                type: "GenesisKeyHash",
                hash: genesisDeleg.genesishash || ""
              },
              genesisDelegateHash: {
                type: "GenesisDelegateHash",
                hash: genesisDeleg.genesis_delegate_hash || ""
              },
              vrfKeyHash: {
                type: "VRFKeyHash",
                hash: genesisDeleg.vrf_keyhash || ""
              }
            };
          } else if (certJson.VoteDelegation) {
            type = "VoteDelegation";
            const voteDeleg = certJson.VoteDelegation;
            
            // Normalize stake credential with proper context
            const stakeCredentialSource = voteDeleg.stake_credential ?? null;
            const stakeCredential = normalizeCredential(stakeCredentialSource, 'stake', networkId);
            const stakeDetails = { ...stakeCredential };
            
            // Normalize DRep credential with proper context
            const drepCredentialSource = voteDeleg.drep ?? null;
            const drepCredential = normalizeCredential(drepCredentialSource, 'drep', networkId);
            const drepDetails = { ...drepCredential };
            
            details = {
              stakeCredential: stakeDetails,
              drepCredential: drepDetails,
              drepId: drepDetails.bech32 || drepDetails.hash
            };
          } else if (certJson.DRepRegistration) {
            type = "DRepRegistration";
            const drepReg = certJson.DRepRegistration;
            const credentialSource =
              drepReg.drep_credential ??
              drepReg.voting_credential ??
              drepReg.votingCredential ??
              drepReg.drepCredential ??
              drepReg.credential ??
              null;
            const drepCredential = normalizeCredential(credentialSource, 'drep', networkId);
            const credentialDetails = { ...drepCredential };
            const anchor = parseAnchorDetails(drepReg.anchor);
            const coinValue = normalizeAmount(drepReg.coin, '0');
            const depositValue = normalizeAmount(drepReg.deposit, coinValue);

            details = {
              drepCredential: credentialDetails,
              votingCredential: { ...credentialDetails },
              coin: coinValue,
              deposit: depositValue,
              drepId: credentialDetails.bech32 || credentialDetails.hash,
              anchor,
              anchorMissing: !anchor
            };
          } else if (certJson.DRepDeregistration) {
            type = "DRepDeregistration";
            const drepDereg = certJson.DRepDeregistration;
            const credentialSource =
              drepDereg.drep_credential ??
              drepDereg.voting_credential ??
              drepDereg.votingCredential ??
              drepDereg.drepCredential ??
              drepDereg.credential ??
              null;
            const drepCredential = normalizeCredential(credentialSource, 'drep', networkId);
            const credentialDetails = { ...drepCredential };

            details = {
              drepCredential: credentialDetails,
              votingCredential: { ...credentialDetails },
              epoch: drepDereg.epoch ?? 0,
              refund: normalizeAmount(drepDereg.refund ?? drepDereg.coin, '0'),
              drepId: credentialDetails.bech32 || credentialDetails.hash
            };
          } else if (certJson.DRepUpdate) {
            type = "DRepUpdate";
            const drepUpdate = certJson.DRepUpdate;
            const credentialSource =
              drepUpdate.drep_credential ??
              drepUpdate.voting_credential ??
              drepUpdate.votingCredential ??
              drepUpdate.drepCredential ??
              drepUpdate.credential ??
              null;
            const drepCredential = normalizeCredential(credentialSource, 'drep', networkId);
            const credentialDetails = { ...drepCredential };
            const anchor = parseAnchorDetails(drepUpdate.anchor);

            details = {
              drepCredential: credentialDetails,
              votingCredential: { ...credentialDetails },
              drepId: credentialDetails.bech32 || credentialDetails.hash,
              anchor,
              anchorMissing: !anchor
            };
          } else if (certJson.CommitteeHotAuth) {
            type = "CommitteeHotAuth";
            const committeeHot = certJson.CommitteeHotAuth;
            // Normalize hot credential with proper context (CIP-0129: cc_hot1)
            const hotCredentialSource = committeeHot.hot_credential ?? null;
            const hotCredential = normalizeCredential(hotCredentialSource, 'committeeHot', networkId);
            details = {
              hotCredential: {
                type: hotCredential.type,
                hash: hotCredential.hash,
                bech32: hotCredential.bech32 || hotCredential.hash
              },
              epoch: committeeHot.epoch || 0,
              committeeMember: hotCredential.bech32 || hotCredential.hash || ""
            };
          } else if (certJson.CommitteeColdResign) {
            type = "CommitteeColdResign";
            const committeeCold = certJson.CommitteeColdResign;
            // Normalize cold credential with proper context (CIP-0129: cc_cold1)
            const coldCredentialSource = committeeCold.cold_credential ?? null;
            const coldCredential = normalizeCredential(coldCredentialSource, 'committeeCold', networkId);
            details = {
              coldCredential: {
                type: coldCredential.type,
                hash: coldCredential.hash,
                bech32: coldCredential.bech32 || coldCredential.hash
              },
              epoch: committeeCold.epoch || 0,
              committeeMember: coldCredential.bech32 || coldCredential.hash || ""
            };
          } else {
            // Fallback to original parsing method for unknown certificate types
            type = "Unknown";
            details = { raw: cert.to_hex() };
          }
        } catch (error) {
          console.warn('Error parsing certificate:', error);
          type = "Unknown";
          details = { raw: cert.to_hex() };
        }
        
        certs.push({
          type,
          details
        });
      }
    }
    
    // Parse withdrawals
    let withdrawals = undefined;
    const bodyWithdrawals = body.withdrawals();
    if (bodyWithdrawals) {
      withdrawals = [];
      const keys = bodyWithdrawals.keys();
      for (let i = 0; i < keys.len(); i++) {
        const stakeAddr = keys.get(i).to_address().to_bech32();
        const amount = BigInt(bodyWithdrawals.get(keys.get(i))?.to_str() || '0');
        withdrawals.push({
          stakeAddr,
          amount
        });
      }
    }
    
    // Parse governance data (Conway era)
    let governance: {
      constitution: { hash: string; url?: string } | null;
      committee: { members: Array<{ keyHash: string; epoch: number }>; threshold: number } | null;
      drepVotes: Array<{ 
        drepId: string; 
        drepHash?: string;
        drepCredential?: { type: string; hash: string; bech32?: string };
        action: string; 
        proposalId: string;
        anchor?: AnchorInfo;
        anchorMissing?: boolean;
      }>;
      committeeVotes: Array<{ 
        memberId: string; 
        memberCredential?: { type: string; hash: string; bech32?: string };
        action: string; 
        proposalId: string;
        anchor?: AnchorInfo;
        anchorMissing?: boolean;
      }>;
      proposals: Array<{ id: string; type: string; details: Record<string, unknown> }>;
    } | null = null;
    try {
      const votingProcedures = body.voting_procedures();
      const votingProposals = body.voting_proposals();
      
      if (votingProcedures || votingProposals) {
        governance = {
          constitution: null as { hash: string; url?: string } | null,
          committee: null as { members: Array<{ keyHash: string; epoch: number }>; threshold: number } | null,
          drepVotes: [] as Array<{ 
            drepId: string; 
            drepHash?: string;
            drepCredential?: { type: string; hash: string; bech32?: string };
            action: string; 
            proposalId: string;
            anchor?: AnchorInfo;
            anchorMissing?: boolean;
          }>,
          committeeVotes: [] as Array<{ 
            memberId: string;
            memberCredential?: { type: string; hash: string; bech32?: string };
            action: string; 
            proposalId: string;
            anchor?: AnchorInfo;
            anchorMissing?: boolean;
          }>,
          proposals: [] as Array<{ id: string; type: string; details: Record<string, unknown> }>
        };
        
        // Parse voting procedures if available
        if (votingProcedures) {
          try {
            // Try to parse voting procedures
            const procedures = votingProcedures.to_js_value();
            if (Array.isArray(procedures)) {
              procedures.forEach((procedure: any) => {
                if (procedure.voter && procedure.votes && Array.isArray(procedure.votes)) {
                  // Determine voter type
                  const voterType = procedure.voter.ConstitutionalCommitteeHotCred ? 'committee' : 
                                  procedure.voter.DRep ? 'drep' : 
                                  procedure.voter.StakingPool ? 'pool' : 'unknown';
                  
                      // Process each vote
                  procedure.votes.forEach((vote: any) => {
                    if (vote.action_id && vote.voting_procedure) {
                      // Extract proposal ID properly (transaction_id is hex, index is a number)
                      const txId = vote.action_id.transaction_id || '';
                      const actionIndex = vote.action_id.index || 0;
                      // Create governance action ID according to CIP-0129 (bech32 with gov_action1 prefix)
                      const proposalId = createGovernanceActionId(txId, actionIndex) || `${txId}#${actionIndex}`;
                      
                      const voteAction = vote.voting_procedure.vote;
                      
                      // Map vote action to our format
                      let action = 'Unknown';
                      if (voteAction === 'Yes') action = 'VoteYes';
                      else if (voteAction === 'No') action = 'VoteNo';
                      else if (voteAction === 'Abstain') action = 'Abstain';
                      
                      // Extract anchor from voting_procedure
                      const anchor = parseAnchorDetails(vote.voting_procedure.anchor);
                      const anchorMissing = !anchor || (!anchor.url && !anchor.hash && !anchor.bytes);
                      
                      if (voterType === 'drep' && governance) {
                        // Normalize DRep credential
                        const drepCredentialSource = procedure.voter.DRep ?? null;
                        const drepCredential = normalizeCredential(drepCredentialSource, 'drep', networkId);
                        
                        governance.drepVotes.push({
                          drepId: drepCredential.bech32 || drepCredential.hash || '',
                          drepHash: drepCredential.hash || '',
                          drepCredential: {
                            type: drepCredential.type,
                            hash: drepCredential.hash,
                            bech32: drepCredential.bech32
                          },
                          action: action,
                          proposalId: proposalId,
                          anchor: anchor,
                          anchorMissing: anchorMissing
                        });
                      } else if (voterType === 'committee' && governance) {
                        // Normalize Committee member credential (use 'committeeHot' context for CIP-0129 encoding)
                        const committeeCredentialSource = procedure.voter.ConstitutionalCommitteeHotCred ?? null;
                        const committeeCredential = normalizeCredential(committeeCredentialSource, 'committeeHot', networkId);
                        
                        governance.committeeVotes.push({
                          memberId: committeeCredential.bech32 || committeeCredential.hash || '',
                          memberCredential: {
                            type: committeeCredential.type,
                            hash: committeeCredential.hash,
                            bech32: committeeCredential.bech32
                          },
                          action: action,
                          proposalId: proposalId,
                          anchor: anchor,
                          anchorMissing: anchorMissing
                        });
                      }
                    }
                  });
                }
              });
            }
          } catch (error) {
            console.warn('Error parsing voting procedures:', error);
          }
        }
        
        // Parse voting proposals if available
        if (votingProposals) {
          try {
            // Try to parse voting proposals
            const proposals = votingProposals.to_js_value();
            if (Array.isArray(proposals)) {
              proposals.forEach((proposal: any) => {
                let proposalType = 'Unknown';
                let details: Record<string, unknown> = {};
                
                // Extract proposal ID from action_id if available
                let proposalId = '';
                if (proposal.action_id) {
                  const txId = proposal.action_id.transaction_id || '';
                  const actionIndex = proposal.action_id.index || 0;
                  // Create governance action ID according to CIP-0129 (bech32 with gov_action1 prefix)
                  proposalId = createGovernanceActionId(txId, actionIndex) || `${txId}#${actionIndex}`;
                } else if (proposal.governance_action_id) {
                  proposalId = proposal.governance_action_id;
                }
                
                // Extract proposal_procedure fields: deposit, reward_account, anchor
                if (proposal.deposit !== undefined) {
                  details.deposit = proposal.deposit;
                }
                if (proposal.reward_account) {
                  details.rewardAccount = proposal.reward_account;
                }
                const anchor = parseAnchorDetails(proposal.anchor);
                if (anchor) {
                  details.anchor = anchor;
                } else if (proposal.anchor === null || proposal.anchor === undefined) {
                  details.anchorMissing = true;
                }
                
                // Helper function to extract parent governance action ID
                const extractParentActionId = (parentActionId: any): string | null => {
                  if (!parentActionId) return null;
                  if (typeof parentActionId === 'string') return parentActionId;
                  if (parentActionId.transaction_id && parentActionId.index !== undefined) {
                    const txId = parentActionId.transaction_id || '';
                    const actionIndex = parentActionId.index || 0;
                    return createGovernanceActionId(txId, actionIndex) || `${txId}#${actionIndex}`;
                  }
                  return null;
                };
                
                // Determine proposal type based on governance action
                if (proposal.governance_action) {
                  const action = proposal.governance_action;
                  
                  // Handle both ParameterChange and ParameterChangeAction formats
                  if (action.ParameterChange || action.ParameterChangeAction) {
                    proposalType = 'ParameterChange';
                    const paramChange = action.ParameterChange || action.ParameterChangeAction;
                    // Handle both parameter_changes and protocol_param_updates field names
                    const paramUpdates = paramChange.parameter_changes || paramChange.protocol_param_updates || {};
                    // Map parameter names from snake_case to camelCase/standard names
                    const mappedParams: Record<string, any> = {};
                    Object.entries(paramUpdates).forEach(([key, value]) => {
                      if (value !== null && value !== undefined) {
                        // Map snake_case keys to standard parameter keys
                        const paramKeyMap: Record<string, number> = {
                          'minfee_a': 0,
                          'minfee_b': 1,
                          'max_block_body_size': 2,
                          'max_tx_size': 3,
                          'max_block_header_size': 4,
                          'key_deposit': 5,
                          'pool_deposit': 6,
                          'max_epoch': 7,
                          'n_opt': 8,
                          'pool_pledge_influence': 9,
                          'expansion_rate': 10,
                          'treasury_growth_rate': 11,
                          'min_pool_cost': 16,
                          'ada_per_utxo_byte': 17,
                          'cost_models': 18,
                          'execution_costs': 19,
                          'max_tx_ex_units': 20,
                          'max_block_ex_units': 21,
                          'max_value_size': 22,
                          'collateral_percentage': 23,
                          'max_collateral_inputs': 24,
                          'pool_voting_thresholds': 25,
                          'drep_voting_thresholds': 26,
                          'min_committee_size': 27,
                          'committee_term_limit': 28,
                          'governance_action_validity_period': 29,
                          'governance_action_deposit': 30,
                          'drep_deposit': 31,
                          'drep_inactivity_period': 32,
                          'ref_script_coins_per_byte': 33
                        };
                        const paramKey = paramKeyMap[key] !== undefined ? paramKeyMap[key] : key;
                        mappedParams[paramKey] = value;
                      }
                    });
                    details = {
                      parameterChanges: mappedParams,
                      epoch: paramChange.epoch || null,
                      parentActionId: extractParentActionId(paramChange.prev_gov_action_id || paramChange.parent_action_id || paramChange.gov_action_id)
                    };
                  } else if (action.HardForkInitiation || action.HardForkInitiationAction) {
                    proposalType = 'HardForkInitiation';
                    const hardFork = action.HardForkInitiation || action.HardForkInitiationAction;
                    details = {
                      epoch: hardFork.epoch || null,
                      protocolVersion: hardFork.protocol_version || null,
                      parentActionId: extractParentActionId(hardFork.prev_gov_action_id || hardFork.parent_action_id || hardFork.gov_action_id)
                    };
                  } else if (action.TreasuryWithdrawals || action.TreasuryWithdrawalsAction) {
                    proposalType = 'TreasuryWithdrawals';
                    const treasury = action.TreasuryWithdrawals || action.TreasuryWithdrawalsAction;
                    details = {
                      withdrawals: treasury.withdrawals || [],
                      epoch: treasury.epoch || null,
                      parentActionId: extractParentActionId(treasury.prev_gov_action_id || treasury.parent_action_id || treasury.gov_action_id)
                    };
                  } else if (action.NoConfidence || action.NoConfidenceAction) {
                    proposalType = 'NoConfidence';
                    const noConf = action.NoConfidence || action.NoConfidenceAction;
                    details = {
                      epoch: noConf.epoch || null,
                      parentActionId: extractParentActionId(noConf.prev_gov_action_id || noConf.parent_action_id || noConf.gov_action_id)
                    };
                  } else if (action.NewConstitution || action.NewConstitutionAction) {
                    proposalType = 'NewConstitution';
                    const newConst = action.NewConstitution || action.NewConstitutionAction;
                    const constitution = newConst.constitution || {};
                    details = {
                      constitution: constitution,
                      constitutionHash: constitution.anchor?.hash || constitution.hash || null,
                      scriptHash: constitution.script_hash || null,
                      epoch: newConst.epoch || null,
                      parentActionId: extractParentActionId(newConst.prev_gov_action_id || newConst.parent_action_id || newConst.gov_action_id)
                    };
                  } else if (action.UpdateCommittee || action.UpdateCommitteeAction) {
                    proposalType = 'UpdateCommittee';
                    const updateComm = action.UpdateCommittee || action.UpdateCommitteeAction;
                    details = {
                      membersToRemove: updateComm.members_to_remove || [],
                      membersToAdd: updateComm.members_to_add || [],
                      threshold: updateComm.threshold || null,
                      epoch: updateComm.epoch || null,
                      parentActionId: extractParentActionId(updateComm.prev_gov_action_id || updateComm.parent_action_id || updateComm.gov_action_id)
                    };
                  } else if (action.InfoAction) {
                    proposalType = 'InfoAction';
                    details = {
                      info: action.InfoAction.info || null
                    };
                  }
                }
                
                if (governance) {
                  governance.proposals.push({
                    id: proposalId,
                    type: proposalType,
                    details: {
                      ...details,
                      raw: proposal
                    }
                  });
                }
              });
            }
          } catch (error) {
            console.warn('Error parsing voting proposals:', error);
          }
        }
        
        // Try to extract constitution from metadata if available
        if (auxiliaryData) {
          try {
            const metadataMap = auxiliaryData.metadata();
            if (metadataMap) {
              const keys = metadataMap.keys();
              for (let i = 0; i < keys.len(); i++) {
                const label = keys.get(i).to_str();
                if (label === '61284') { // Constitution metadata label
                  const metadatum = metadataMap.get(keys.get(i));
                  if (metadatum) {
                    try {
                      // Try to parse as text first
                      const constitutionText = metadatum.as_text();
                      if (constitutionText) {
                        governance.constitution = {
                          hash: constitutionText,
                          url: ''
                        };
                      }
                    } catch {
                      // If not text, try to parse as bytes
                      try {
                        const constitutionBytes = metadatum.as_bytes();
                        if (constitutionBytes) {
                          governance.constitution = {
                            hash: Array.from(constitutionBytes).map((b: unknown) => (b as number).toString(16).padStart(2, '0')).join(''),
                            url: ''
                          };
                        }
                      } catch {
                        // Fallback to hex representation
                        governance.constitution = {
                          hash: metadatum.to_hex(),
                          url: ''
                        };
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.warn('Error parsing constitution from metadata:', error);
          }
        }
        
        // Try to extract committee information from certificates
        if (certs) {
          const committeeCerts = certs.filter(cert => 
            cert.type === 'CommitteeHotAuth' || 
            cert.type === 'CommitteeColdResign'
          );
          
          if (committeeCerts.length > 0) {
            governance.committee = {
              members: committeeCerts.map(cert => ({
                keyHash: (cert.details as any).keyHash || '',
                epoch: (cert.details as any).epoch || 0
              })),
              threshold: 0 // Would need to be extracted from protocol parameters
            };
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing governance data:', error);
      // Governance parsing is optional, so we don't throw
    }
    
    // Parse metadata with enhanced handling
    const metadata = [];
    if (auxiliaryData) {
      const metadataMap = auxiliaryData.metadata();
      if (metadataMap) {
        const keys = metadataMap.keys();
        for (let i = 0; i < keys.len(); i++) {
          const label = keys.get(i).to_str();
          const metadatum = metadataMap.get(keys.get(i));
          
          if (metadatum) {
            try {
              const parsedData = parseMetadatum(metadatum);
              metadata.push({
                label,
                json: parsedData,
                cbor: metadatum.to_hex(),
                type: getMetadatumType(metadatum)
              });
            } catch (error) {
              console.warn(`Error parsing metadata label ${label}:`, error);
      metadata.push({
                label,
                json: null,
                cbor: metadatum.to_hex(),
                type: 'unknown',
                error: error instanceof Error ? error.message : 'Parse error'
              });
            }
          }
        }
      }
    }
    
    // Parse script data hash and total collateral
    const scriptDataHash = body.script_data_hash()?.to_hex();
    const totalCollateral = body.total_collateral()?.to_str();
    
    // Parse collateral return
    let collateralReturn = undefined;
    const collateralReturnOutput = body.collateral_return();
    if (collateralReturnOutput) {
      const address = collateralReturnOutput.address().to_bech32();
      const amount = collateralReturnOutput.amount();
      const ada = amount.coin();
      const assets = [];
      
      const multiasset = amount.multiasset();
      if (multiasset) {
        const policies = multiasset.keys();
        for (let i = 0; i < policies.len(); i++) {
          const policy = policies.get(i);
          const policyId = policy.to_hex();
          const assetsMap = multiasset.get(policy);
          const assetNames = assetsMap.keys();
          
          for (let j = 0; j < assetNames.len(); j++) {
            const assetName = assetNames.get(j);
            const quantity = assetsMap.get(assetName);
            assets.push({
              policyId,
              assetName: assetName.to_hex(),
              quantity: BigInt(quantity.to_str())
            });
          }
        }
      }
      
      collateralReturn = {
        address,
        ada: BigInt(ada.to_str()),
        assets
      };
    }
    
    // Parse reference inputs
    const referenceInputs = [];
    const refInputs = body.reference_inputs();
    if (refInputs) {
      for (let i = 0; i < refInputs.len(); i++) {
        const refInput = refInputs.get(i);
        referenceInputs.push({
          txId: refInput.transaction_id().to_hex(),
          index: refInput.index()
        });
      }
    }
    
    // Parse scripts and redeemers
    const scripts = [];
    const redeemers = [];
    
    // Native scripts
    const nativeScripts = witnessSet.native_scripts();
    if (nativeScripts) {
      for (let i = 0; i < nativeScripts.len(); i++) {
        const script = nativeScripts.get(i);
        scripts.push({
          type: "Native",
          hash: script.hash().to_hex(),
          bytesLen: script.to_bytes().length
        });
      }
    }
    
    // Plutus scripts
    const plutusScripts = witnessSet.plutus_scripts();
    if (plutusScripts) {
      for (let i = 0; i < plutusScripts.len(); i++) {
        const script = plutusScripts.get(i);
        const version = script.language_version();
        const type = version.kind() === 0 ? "PlutusV1" : 
                    version.kind() === 1 ? "PlutusV2" : 
                    version.kind() === 2 ? "PlutusV3" : "PlutusV1";
        
        scripts.push({
          type,
          hash: script.hash().to_hex(),
          bytesLen: script.to_bytes().length
        });
      }
    }
    
    // Redeemers
    const witnessRedeemers = witnessSet.redeemers();
    if (witnessRedeemers) {
      for (let i = 0; i < witnessRedeemers.len(); i++) {
        const redeemer = witnessRedeemers.get(i);
        const purpose = redeemer.tag().kind() === 0 ? "spend" :
                       redeemer.tag().kind() === 1 ? "mint" :
                       redeemer.tag().kind() === 2 ? "cert" :
                       redeemer.tag().kind() === 3 ? "reward" : "unknown";
        
        // Parse redeemer data from PlutusData to JSON format
        let parsedData = undefined;
        const redeemerData = redeemer.data();
        if (redeemerData) {
          try {
            // Check if it's a valid PlutusData object
            if (typeof redeemerData.kind === 'function') {
              const datumContent = parseDatumContent(redeemerData);
              // Only stringify if we got valid content, otherwise fall back to hex
              if (datumContent !== null && datumContent !== undefined) {
                try {
                  parsedData = JSON.stringify(datumContent);
                } catch (stringifyError) {
                  console.warn('Error stringifying redeemer datum content:', stringifyError);
                  // Fall back to hex if stringification fails
                  parsedData = redeemerData.to_hex();
                }
              } else {
                // If parsing returned null but we have data, fall back to hex
                console.warn('parseDatumContent returned null for redeemer, falling back to hex');
                try {
                  parsedData = redeemerData.to_hex();
                } catch (hexError) {
                  console.warn('Error converting redeemer data to hex:', hexError);
                }
              }
            } else {
              // If it's not a PlutusData object, try to convert to hex
              try {
                parsedData = redeemerData.to_hex();
              } catch (hexError) {
                console.warn('Redeemer data is not PlutusData and cannot convert to hex:', hexError);
              }
            }
          } catch (error) {
            console.warn('Error parsing redeemer data:', error);
            // Fallback to hex if parsing fails
            try {
              parsedData = redeemerData.to_hex();
            } catch (hexError) {
              console.warn('Error converting redeemer data to hex:', hexError);
              parsedData = undefined;
            }
          }
        }
        
        // Extract execution units with proper type conversion
        const exUnitsObj = redeemer.ex_units();
        let mem = 0;
        let steps = 0;
        if (exUnitsObj) {
          try {
            // CSL ex_units return BigNum objects that need to_str()
            const memValue = exUnitsObj.mem();
            const stepsValue = exUnitsObj.steps();
            
            // Convert BigNum to string then to number
            if (typeof memValue === 'object' && typeof memValue.to_str === 'function') {
              mem = Number(memValue.to_str()) || 0;
            } else {
              mem = typeof memValue === 'bigint' ? Number(memValue) : 
                    typeof memValue === 'string' ? parseInt(memValue, 10) : 
                    Number(memValue) || 0;
            }
            
            if (typeof stepsValue === 'object' && typeof stepsValue.to_str === 'function') {
              steps = Number(stepsValue.to_str()) || 0;
            } else {
              steps = typeof stepsValue === 'bigint' ? Number(stepsValue) : 
                      typeof stepsValue === 'string' ? parseInt(stepsValue, 10) : 
                      Number(stepsValue) || 0;
            }
          } catch (error) {
            console.warn('Error extracting execution units:', error);
          }
        }
        
        redeemers.push({
          purpose,
          index: redeemer.index(),
          exUnits: {
            mem,
            steps
          },
          data: parsedData,
          scriptHash: undefined // This would need to be associated with the corresponding script
        });
      }
    }
    
    // Count witnesses and extract signer details
    const vkeyCount = witnessSet.vkeys()?.len() || 0;
    const nativeCount = witnessSet.native_scripts()?.len() || 0;
    const plutusCount = witnessSet.plutus_scripts()?.len() || 0;
    
    // Extract detailed signer information
    const signers = [];
    
    // Get required signers from transaction body
    const requiredSigners = body.required_signers();
    if (requiredSigners) {
      for (let i = 0; i < requiredSigners.len(); i++) {
        const keyHash = requiredSigners.get(i);
        try {
          const hash = keyHash.to_hex();
          signers.push({
            type: 'vkey' as const,
            hash,
            address: undefined,
            isWitness: false,
            isRequired: true
          });
        } catch (error) {
          console.warn('Error extracting required signer:', error);
        }
      }
    }
    
    // Get actual VKey witnesses (signatures provided)
    const vkeys = witnessSet.vkeys();
    if (vkeys) {
      for (let i = 0; i < vkeys.len(); i++) {
        const vkey = vkeys.get(i);
        try {
          const hash = vkey.hash().to_hex();
          // Check if this witness corresponds to a required signer
          const isRequired = requiredSigners ? 
            Array.from({ length: requiredSigners.len() }, (_, j) => requiredSigners.get(j).to_hex()).includes(hash) : 
            false;
          
          signers.push({
            type: 'vkey' as const,
            hash,
            address: undefined,
            isWitness: true,
            isRequired
          });
        } catch (error) {
          console.warn('Error extracting vkey witness:', error);
        }
      }
    }
    
    // Native script witnesses
    if (nativeScripts) {
      for (let i = 0; i < nativeScripts.len(); i++) {
        const script = nativeScripts.get(i);
        try {
          const hash = script.hash().to_hex();
          signers.push({
            type: 'native' as const,
            hash,
            address: undefined,
            isWitness: true,
            isRequired: false
          });
        } catch (error) {
          console.warn('Error extracting native script witness:', error);
        }
      }
    }
    
    // Plutus script witnesses
    if (plutusScripts) {
      for (let i = 0; i < plutusScripts.len(); i++) {
        const script = plutusScripts.get(i);
        try {
          const hash = script.hash().to_hex();
          signers.push({
            type: 'plutus' as const,
            hash,
            address: undefined,
            isWitness: true,
            isRequired: false
          });
        } catch (error) {
          console.warn('Error extracting plutus script witness:', error);
        }
      }
    }
    
    // Enhanced validation and warnings
    const warnings: string[] = [];
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };
    
    // Size validation
    if (size > 16384) {
      warnings.push("Transaction size exceeds recommended limit");
      validation.warnings.push("Large transaction size may impact network performance");
    }
    
    // Basic structure validation
    if (inputs.length === 0) {
      warnings.push("No inputs found in transaction");
      validation.errors.push("Transaction must have at least one input");
      validation.isValid = false;
    }
    
    if (outputs.length === 0) {
      warnings.push("No outputs found in transaction");
      validation.errors.push("Transaction must have at least one output");
      validation.isValid = false;
    }
    
    // Fee validation
    if (fee < 0n) {
      validation.errors.push("Transaction fee cannot be negative");
      validation.isValid = false;
    }
    
    // TTL validation
    if (ttl && ttl < 0) {
      validation.errors.push("TTL cannot be negative");
      validation.isValid = false;
    }
    
    // Validity interval validation
    if (validityStart && ttl && validityStart >= ttl) {
      validation.errors.push("Validity start must be before TTL");
      validation.isValid = false;
    }
    
    // Input/Output consistency
    const totalInputValue = inputs.reduce((sum, input) => {
      // This would need actual UTXO resolution to be accurate
      return sum;
    }, 0n);
    
    const totalOutputValue = outputs.reduce((sum, output) => {
      return sum + output.ada;
    }, 0n);
    
    // Check for potential dust outputs
    outputs.forEach((output, index) => {
      if (output.ada < 1000000n) { // Less than 1 ADA
        validation.warnings.push(`Output ${index} may be dust (${output.ada} lovelace)`);
      }
    });
    
    // Script validation
    if (scripts.length > 0 && redeemers.length === 0) {
      validation.warnings.push("Scripts present but no redeemers found");
    }
    
    // Governance validation
    if (governance) {
      if (governance.drepVotes.length > 0 && governance.proposals.length === 0) {
        validation.warnings.push("DRep votes present but no governance proposals found");
      }
    }
    
    // Clean up CSL objects
    if (transaction) transaction.free();
    if (body) body.free();
    if (witnessSet) witnessSet.free();
    if (auxiliaryData) auxiliaryData.free();
    
    return {
      success: true,
      tx: {
        era,
        id,
        sizeBytes: size,
        feeLovelace: fee,
        ttl,
        slot: ttl ? ttl - 1000 : null, // Estimate slot
        validity: { start: validityStart, end: ttl },
        inputs,
        outputs,
        mint,
        certs,
        withdrawals,
        governance,
        metadata,
        scripts,
        redeemers,
        witnesses: { vkeyCount, nativeCount, plutusCount },
        signers,
        scriptDataHash,
        totalCollateral: totalCollateral ? BigInt(totalCollateral) : undefined,
        collateralReturn,
        referenceInputs,
        warnings,
        validation,
        stats: {
          inputCount: inputs.length,
          outputCount: outputs.length,
          assetCount: outputs.reduce((sum, output) => sum + output.assets.length, 0),
          scriptCount: scripts.length,
          redeemerCount: redeemers.length,
          metadataCount: metadata.length,
          governanceActionCount: governance ? 
            (governance.drepVotes.length + governance.committeeVotes.length + governance.proposals.length) : 0
        }
      },
    };
  } catch (error) {
    console.error('Transaction parsing error:', error);
    
    // Clean up CSL objects on error
    try {
      if (transaction) transaction.free();
      if (body) body.free();
      if (witnessSet) witnessSet.free();
      if (auxiliaryData) auxiliaryData.free();
    } catch (cleanupError) {
      console.warn('Error during cleanup:', cleanupError);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
      details: error instanceof Error ? error.stack : undefined,
    };
  }
}

// Handle messages from main thread
self.onmessage = async (event) => {
  const { type, data } = event.data;
  
  try {
    switch (type) {
      case 'PARSE_TRANSACTION':
        const result = await parseTransaction(data.hex, data.network || 'mainnet');
        self.postMessage({ type: 'PARSE_RESULT', data: result });
        break;
      default:
        self.postMessage({ type: 'ERROR', data: { error: 'Unknown message type' } });
    }
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      } 
    });
  }
};
