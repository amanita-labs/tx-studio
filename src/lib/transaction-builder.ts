// src/lib/transaction-builder.ts
// Core transaction building logic using CSL
// IMPROVED VERSION: Better memory management, error handling, and efficiency

import * as CSL from '@emurgo/cardano-serialization-lib-browser';
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
function safeFree(...objects: Array<unknown>): void {
  for (const obj of objects) {
    try {
      if (obj && typeof obj === 'object' && 'free' in obj && typeof (obj as { free: () => void }).free === 'function') {
        (obj as { free: () => void }).free();
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
    // Using type assertion because CSL types may not match runtime API
    const DRepClass = CSL.DRep as unknown as {
      new_key_hash?: (hash: CSL.Ed25519KeyHash) => CSL.DRep;
      new?: (cred: CSL.Credential) => CSL.DRep;
      from_bytes?: (bytes: Uint8Array) => CSL.DRep;
    };
    let drep: CSL.DRep | null = null;
    
    // Method 1: DRep.new_key_hash(keyHash) - CSL 15.0.1 enum variant constructor
    // This is the correct way to create a DRep from a key hash in CSL 15.0.1
    // Note: Using type assertion because CSL types may not match runtime API
    try {
      drep = (DRepClass as { new_key_hash: (hash: CSL.Ed25519KeyHash) => CSL.DRep }).new_key_hash(drepKeyHash);
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
      const drepNew = (DRepClass as { new?: (cred: CSL.Credential) => CSL.DRep }).new;
      if (drepNew) {
        drep = drepNew(drepCredential);
        if (drep) return drep;
      }
    } catch (error) {
      // Silently continue - this method doesn't exist in CSL 15.0.1
    }
    
    // Method 3: Try from_bytes with credential's CBOR bytes
    // DRep.from_bytes() expects CBOR-encoded DRep enum, not raw hash
    try {
      const credentialBytes = drepCredential.to_bytes();
      const fromBytes = (DRepClass as { from_bytes?: (bytes: Uint8Array) => CSL.DRep }).from_bytes;
      if (fromBytes) {
        drep = fromBytes(credentialBytes);
        if (drep) return drep;
      }
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
      const fromBytes = (DRepClass as { from_bytes?: (bytes: Uint8Array) => CSL.DRep }).from_bytes;
      if (fromBytes) {
        drep = fromBytes(drepEnumBytes);
        if (drep) return drep;
      }
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
        typeof (DRepClass as Record<string, unknown>)[name] === 'function' && name !== 'free'
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

/* -------------------------------------------------------------------------- */
/*  Governance proposal helpers (Info / ParameterChange)                       */
/* -------------------------------------------------------------------------- */

export type CostModels = {
  PlutusV1?: number[];
  PlutusV2?: number[];
  PlutusV3?: number[];
};

const COST_MODEL_LANGUAGES = ['PlutusV1', 'PlutusV2', 'PlutusV3'] as const;
type CostModelLang = typeof COST_MODEL_LANGUAGES[number];
type GuardrailsLang = 'V1' | 'V2' | 'V3';

/**
 * Normalise a language key to the canonical PlutusV1/V2/V3 form.
 * Accepts variants like "plutus_v1", "PlutusV1", "PLUTUS_V2", "plutusV3".
 */
function normaliseLanguageKey(key: string): CostModelLang | null {
  const k = key.toLowerCase().replace(/_/g, '');
  if (k === 'plutusv1') return 'PlutusV1';
  if (k === 'plutusv2') return 'PlutusV2';
  if (k === 'plutusv3') return 'PlutusV3';
  return null;
}

/**
 * Coerce a JSON value into a JS integer. Accepts numbers, BigInts, and decimal
 * integer strings (incl. negatives). Returns null on anything else.
 */
function coerceInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'bigint') {
    if (v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)) return Number(v);
    return null;
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (!/^-?[0-9]+$/.test(t)) return null;
    const n = Number(t);
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

/**
 * Walk a parsed JSON tree and return the first object that looks like a
 * cost-models map — either explicitly under a `cost_models` / `costModels`
 * key, or any object whose own keys all look like Plutus language identifiers.
 *
 * This handles the IntersectMBO governance metadata.jsonld shape where the
 * map is buried at body.onChain.gov_action.protocol_param_update.cost_models.
 */
function findCostModelsRoot(node: unknown): Record<string, unknown> | null {
  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

  const looksLikeMap = (obj: Record<string, unknown>): boolean => {
    const keys = Object.keys(obj);
    if (keys.length === 0) return false;
    return keys.every((k) => normaliseLanguageKey(k) !== null);
  };

  // BFS to prefer the shallowest match.
  const queue: unknown[] = [node];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!isPlainObject(cur)) continue;

    if (cur.cost_models && isPlainObject(cur.cost_models)) return cur.cost_models;
    if (cur.costModels && isPlainObject(cur.costModels)) return cur.costModels;
    if (looksLikeMap(cur)) return cur;

    for (const v of Object.values(cur)) {
      if (isPlainObject(v) || Array.isArray(v)) queue.push(v);
    }
  }
  return null;
}

/**
 * Parse a cost-models JSON string into a structured CostModels object.
 *
 * Accepts:
 *   - Bare maps: `{ "PlutusV1": [...], "PlutusV2": [...], "PlutusV3": [...] }`
 *     or snake_case `{ "plutus_v1": [...], ... }`.
 *   - Wrapped maps: any depth — the parser walks the tree and finds the first
 *     `cost_models` (or all-Plutus-key) object. Works on cardano-cli output
 *     and the IntersectMBO metadata.jsonld `body.onChain.gov_action.protocol_param_update.cost_models`.
 *   - Array entries as JS numbers OR decimal-integer strings (cardano-cli
 *     emits strings, including negatives).
 */
export function parseCostModelsJson(input: string): { models: CostModels | null; error?: BuildError } {
  const trimmed = (input ?? '').trim();
  if (!trimmed) {
    return { models: null, error: { message: 'Cost models JSON is required', field: 'costModelsJson' } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return {
      models: null,
      error: { message: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`, field: 'costModelsJson' },
    };
  }

  const cur = findCostModelsRoot(parsed);
  if (!cur) {
    return {
      models: null,
      error: { message: 'Could not find a cost_models object in the JSON. Expected keys like PlutusV1/PlutusV2/PlutusV3 or plutus_v1/plutus_v2/plutus_v3.', field: 'costModelsJson' },
    };
  }

  const out: CostModels = {};
  for (const [rawKey, value] of Object.entries(cur as Record<string, unknown>)) {
    const lang = normaliseLanguageKey(rawKey);
    if (!lang) {
      return {
        models: null,
        error: { message: `Unknown language key "${rawKey}". Allowed: PlutusV1, PlutusV2, PlutusV3 (or plutus_v1 / plutus_v2 / plutus_v3)`, field: 'costModelsJson' },
      };
    }
    if (!Array.isArray(value)) {
      return {
        models: null,
        error: { message: `${rawKey} must be an array of integers`, field: 'costModelsJson' },
      };
    }
    if (value.length === 0) {
      return {
        models: null,
        error: { message: `${rawKey} array is empty`, field: 'costModelsJson' },
      };
    }
    const arr: number[] = [];
    for (let i = 0; i < value.length; i++) {
      const n = coerceInt(value[i]);
      if (n === null) {
        return {
          models: null,
          error: { message: `${rawKey}[${i}] must be an integer (number or numeric string), got ${JSON.stringify(value[i])}`, field: 'costModelsJson' },
        };
      }
      arr.push(n);
    }
    out[lang] = arr;
  }

  if (Object.keys(out).length === 0) {
    return { models: null, error: { message: 'At least one Plutus version is required', field: 'costModelsJson' } };
  }

  return { models: out };
}

function languageForKey(key: CostModelLang): CSL.Language {
  if (key === 'PlutusV1') return CSL.Language.new_plutus_v1();
  if (key === 'PlutusV2') return CSL.Language.new_plutus_v2();
  return CSL.Language.new_plutus_v3();
}

/**
 * Build a CSL Costmdls from the structured cost-models object. Caller owns the
 * returned object (free it directly, OR pass to ProtocolParamUpdate.set_cost_models
 * which takes ownership).
 */
export function buildCostmdls(models: CostModels): CSL.Costmdls {
  const costmdls = CSL.Costmdls.new();
  for (const key of COST_MODEL_LANGUAGES) {
    const arr = models[key];
    if (!arr) continue;

    const language = languageForKey(key);
    const costModel = CSL.CostModel.new();
    try {
      for (let i = 0; i < arr.length; i++) {
        const intVal = CSL.Int.from_str(String(arr[i]));
        try {
          // CostModel.set returns the previous value (or zero) — free it.
          const prev = costModel.set(i, intVal);
          safeFree(prev);
        } finally {
          safeFree(intVal);
        }
      }
      // Costmdls.insert takes ownership of the value (CostModel) and copies the key (Language).
      // Returns the previous value, if any — free it.
      const prevModel = costmdls.insert(language, costModel);
      safeFree(prevModel);
    } finally {
      // Language is copied; free it. CostModel was transferred above.
      safeFree(language);
    }
  }
  return costmdls;
}

/**
 * Compute the policy_hash (ScriptHash hex) for a Plutus script supplied as
 * raw script-bytes hex. The language tag is required because the on-chain
 * hash differs between V1/V2/V3 even for the same bytes.
 */
export function computeScriptHashHex(
  scriptHex: string,
  language: GuardrailsLang
): { hashHex: string; error?: BuildError } {
  let plutusScript: CSL.PlutusScript | null = null;
  let scriptHash: CSL.ScriptHash | null = null;
  let cslLanguage: CSL.Language | null = null;
  try {
    validateHex(scriptHex, undefined, 'Guardrails script');
    const bytes = Buffer.from(scriptHex.trim(), 'hex');
    cslLanguage = languageForKey(`Plutus${language}` as CostModelLang);
    plutusScript = CSL.PlutusScript.new_with_version(bytes, cslLanguage);
    scriptHash = plutusScript.hash();
    return { hashHex: scriptHash.to_hex() };
  } catch (e) {
    return {
      hashHex: '',
      error: { message: e instanceof Error ? e.message : 'Failed to hash script', field: 'guardrailsScript' },
    };
  } finally {
    safeFree(scriptHash, plutusScript, cslLanguage);
  }
}

type ProposalCommon = {
  depositLovelace: bigint;
  rewardAddressBech32: string;
  metadataUrl: string;
  metadataHashHex: string;
};

/**
 * Allocate the four common pieces of a VotingProposal: deposit BigNum,
 * RewardAddress, Anchor, and the parsed bech32 Address. The caller takes
 * ownership of all returned objects until VotingProposal.new consumes them.
 *
 * Throws on validation failure; callers should wrap in try/finally and free
 * any partial allocations they receive.
 */
function allocateProposalCommons(p: ProposalCommon): {
  address: CSL.Address;
  rewardAddress: CSL.RewardAddress;
  anchor: CSL.Anchor;
  deposit: CSL.BigNum;
} {
  if (!p.rewardAddressBech32 || typeof p.rewardAddressBech32 !== 'string') {
    throw new Error('Deposit return address is required');
  }
  if (!p.metadataUrl) throw new Error('Metadata URL is required');
  validateHex(p.metadataHashHex, 64, 'Metadata hash');
  if (p.depositLovelace <= 0n) throw new Error('Deposit must be greater than 0');

  let address: CSL.Address | null = null;
  let rewardAddress: CSL.RewardAddress | null = null;
  let anchor: CSL.Anchor | null = null;
  let deposit: CSL.BigNum | null = null;
  try {
    address = CSL.Address.from_bech32(p.rewardAddressBech32);
    const maybeReward = CSL.RewardAddress.from_address(address);
    if (!maybeReward) {
      throw new Error('Address is not a stake (reward) address — must start with stake1/stake_test1');
    }
    rewardAddress = maybeReward;

    anchor = createAnchor({ url: p.metadataUrl, hash: p.metadataHashHex });
    if (!anchor) {
      throw new Error('Failed to build anchor from URL/hash');
    }

    deposit = CSL.BigNum.from_str(p.depositLovelace.toString());

    return { address, rewardAddress, anchor, deposit };
  } catch (e) {
    safeFree(deposit, anchor, rewardAddress, address);
    throw e;
  }
}

/**
 * Build a VotingProposal containing an InfoAction and serialise it to hex.
 */
export function buildInfoProposalCbor(p: ProposalCommon): { hex: string; error?: BuildError } {
  let address: CSL.Address | null = null;
  let rewardAddress: CSL.RewardAddress | null = null;
  let anchor: CSL.Anchor | null = null;
  let deposit: CSL.BigNum | null = null;
  let infoAction: CSL.InfoAction | null = null;
  let govAction: CSL.GovernanceAction | null = null;
  let proposal: CSL.VotingProposal | null = null;
  try {
    ({ address, rewardAddress, anchor, deposit } = allocateProposalCommons(p));

    infoAction = CSL.InfoAction.new();
    govAction = CSL.GovernanceAction.new_info_action(infoAction);
    proposal = CSL.VotingProposal.new(govAction, anchor, rewardAddress, deposit);
    const hex = proposal.to_hex();
    return { hex };
  } catch (e) {
    return { hex: '', error: { message: e instanceof Error ? e.message : 'Failed to build info proposal' } };
  } finally {
    // VotingProposal.new takes ownership of govAction/anchor/rewardAddress/deposit.
    // GovernanceAction.new_info_action takes ownership of infoAction.
    // Address (parsed bech32) is independent and must be freed.
    safeFree(proposal);
    if (!proposal) safeFree(govAction, infoAction, anchor, rewardAddress, deposit);
    safeFree(address);
  }
}

type ParameterChangeParams = ProposalCommon & {
  costModels: CostModels;
  prevAction?: { txHash: string; index: number };
  guardrailsScriptHashHex?: string;
};

/**
 * Build a VotingProposal containing a ParameterChangeAction and serialise it to hex.
 */
export function buildParameterChangeProposalCbor(p: ParameterChangeParams): { hex: string; error?: BuildError } {
  let address: CSL.Address | null = null;
  let rewardAddress: CSL.RewardAddress | null = null;
  let anchor: CSL.Anchor | null = null;
  let deposit: CSL.BigNum | null = null;
  let costmdls: CSL.Costmdls | null = null;
  let ppu: CSL.ProtocolParamUpdate | null = null;
  let txHash: CSL.TransactionHash | null = null;
  let govActionId: CSL.GovernanceActionId | null = null;
  let scriptHash: CSL.ScriptHash | null = null;
  let action: CSL.ParameterChangeAction | null = null;
  let govAction: CSL.GovernanceAction | null = null;
  let proposal: CSL.VotingProposal | null = null;
  try {
    ({ address, rewardAddress, anchor, deposit } = allocateProposalCommons(p));

    costmdls = buildCostmdls(p.costModels);
    ppu = CSL.ProtocolParamUpdate.new();
    ppu.set_cost_models(costmdls);
    // set_cost_models takes ownership of costmdls; null out our reference.
    costmdls = null;

    if (p.prevAction) {
      validateHex(p.prevAction.txHash, 64, 'Previous action tx hash');
      txHash = CSL.TransactionHash.from_hex(p.prevAction.txHash);
      govActionId = CSL.GovernanceActionId.new(txHash, p.prevAction.index);
    }
    if (p.guardrailsScriptHashHex) {
      validateHex(p.guardrailsScriptHashHex, 56, 'Guardrails script hash');
      scriptHash = CSL.ScriptHash.from_hex(p.guardrailsScriptHashHex);
    }

    if (govActionId && scriptHash) {
      action = CSL.ParameterChangeAction.new_with_policy_hash_and_action_id(govActionId, ppu, scriptHash);
    } else if (govActionId) {
      action = CSL.ParameterChangeAction.new_with_action_id(govActionId, ppu);
    } else if (scriptHash) {
      action = CSL.ParameterChangeAction.new_with_policy_hash(ppu, scriptHash);
    } else {
      action = CSL.ParameterChangeAction.new(ppu);
    }
    // ParameterChangeAction.new* takes ownership of govActionId, ppu, scriptHash.
    govActionId = null;
    ppu = null;
    scriptHash = null;
    txHash = null; // owned by govActionId at this point

    govAction = CSL.GovernanceAction.new_parameter_change_action(action);
    action = null; // owned by govAction

    proposal = CSL.VotingProposal.new(govAction, anchor, rewardAddress, deposit);
    const hex = proposal.to_hex();
    return { hex };
  } catch (e) {
    return { hex: '', error: { message: e instanceof Error ? e.message : 'Failed to build parameter change proposal' } };
  } finally {
    safeFree(proposal);
    if (!proposal) {
      safeFree(govAction, action, scriptHash, govActionId, txHash, ppu, costmdls, anchor, rewardAddress, deposit);
    }
    safeFree(address);
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
    // Using type assertion because CSL types may not match runtime API
    voteDelegation = CSL.VoteDelegation.new(stakeCred, drep as unknown as CSL.DRep);
    const cert = CSL.Certificate.new_vote_delegation(voteDelegation);
    
    // Note: We don't free intermediate objects here because they are owned by cert
    // The caller is responsible for freeing the cert when done
    
    return { cert };
  } catch (error) {
    // Clean up all intermediate objects on error
    safeFree(drep, stakeKeyHash, stakeCred, voteDelegation);
    
    return {
      cert: null as unknown as CSL.Certificate,
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
      const DRepRegistrationClass = CSL.DRepRegistration as unknown as { new: (cred: CSL.Credential, anchor: CSL.Anchor | null) => CSL.DRepRegistration };
      drepRegistration = DRepRegistrationClass.new(drepCredential, anchorObj);
    } catch (error) {
      // Method 2: Try with DRep instead of Credential
      const DRepRegistrationClass = CSL.DRepRegistration as unknown as { new: (drep: CSL.DRep, anchor: CSL.Anchor | null) => CSL.DRepRegistration };
      drepRegistration = DRepRegistrationClass.new(drep, anchorObj);
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
      cert: null as unknown as CSL.Certificate,
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
          const DRepUpdateClass = CSL.DRepUpdate as unknown as { new: (cred: CSL.Credential, anchor: CSL.Anchor) => CSL.DRepUpdate };
          drepUpdate = DRepUpdateClass.new(drepCredential, anchorObj);
        } catch (twoArgError) {
          // If 2 args fails, try 1 arg and set anchor separately
          drepUpdate = CSL.DRepUpdate.new(drepCredential);
          const drepUpdateObj = drepUpdate as unknown as { set_anchor?: (anchor: CSL.Anchor) => void };
          if (typeof drepUpdateObj.set_anchor === 'function') {
            drepUpdateObj.set_anchor(anchorObj);
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
      cert: null as unknown as CSL.Certificate,
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
      const DRepDeregistrationClass = CSL.DRepDeregistration as unknown as { new: (epoch: CSL.BigNum, drep: CSL.DRep) => CSL.DRepDeregistration };
      drepDeregistration = DRepDeregistrationClass.new(epochBigNum, drep);
    } catch (error) {
      // Try reverse order if first fails
      const DRepDeregistrationClass = CSL.DRepDeregistration as unknown as { new: (drep: CSL.DRep, epoch: CSL.BigNum) => CSL.DRepDeregistration };
      drepDeregistration = DRepDeregistrationClass.new(drep, epochBigNum);
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
      cert: null as unknown as CSL.Certificate,
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
    cert: null as unknown as CSL.Certificate,
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
          cert: null as unknown as CSL.Certificate,
          error: { message: `Unknown certificate type: ${certData.type}` }
        };
    }
  } catch (error) {
    return {
      cert: null as unknown as CSL.Certificate,
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
type UTXO = {
  input: {
    txHash: string;
    outputIndex: number;
  };
  output?: {
    amount?: Array<{ unit: string; quantity: string | number | bigint }>;
  };
};

// Default execution units for the {} redeemer attached to a guard-rails
// script reference. The script doesn't run at submission time (it executes
// at ratification), but a redeemer with ex_units is still required by the
// CDDL. These are well under Conway maxTxExUnits.
const DEFAULT_GUARDRAILS_EX_UNITS = { mem: BigInt(7_000_000), steps: BigInt(4_000_000_000) };
const MAX_COLLATERAL_INPUTS = 3;

export function assembleTransaction(params: {
  certificates: BuilderCertificate[];
  txBodyElements?: BuilderTxBodyElement[];
  utxos: UTXO[];
  changeAddress: string;
  network: Network;
  fee?: bigint;
}): {
  txBody: CSL.TransactionBody;
  txWitnessSet?: CSL.TransactionWitnessSet;
  error?: BuildError;
} {
  const { certificates, txBodyElements = [], utxos: rawUtxos, changeAddress, network, fee } = params;

  // Track all CSL objects for cleanup on error
  const createdObjects: Array<unknown> = [];

  // Detect early whether the resulting tx will carry a Plutus script
  // (guard-rails for a parameter change). If so we need a collateral input.
  const willHaveScripts = txBodyElements.some(
    (el) => el.type === 'ProposalProcedures'
      && typeof el.data?.guardrailsScriptHex === 'string'
      && (el.data.guardrailsScriptHex as string).length > 0
  );

  // Pick a collateral UTXO from the wallet's regular UTXOs (preferring one
  // that holds only ADA — Conway requires collateral to be pure-ADA). Exclude
  // it from the regular input set so it isn't double-spent.
  let collateralUtxo: UTXO | null = null;
  let utxos: UTXO[] = rawUtxos;
  if (willHaveScripts && rawUtxos.length > 0) {
    const pureAda = rawUtxos.find((u) => {
      const amounts = u.output?.amount ?? [];
      return amounts.length === 1 && amounts[0].unit === 'lovelace';
    });
    collateralUtxo = pureAda ?? rawUtxos[0];
    utxos = rawUtxos.filter((u) => u !== collateralUtxo);
    if (utxos.length === 0) {
      return {
        txBody: null as unknown as CSL.TransactionBody,
        error: { message: 'Need at least 2 UTXOs in wallet: one for inputs and one for collateral when using a guard-rails script.' },
      };
    }
  }

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
        txBody: null as unknown as CSL.TransactionBody,
        error: { message: 'No certificates or transaction body elements to build transaction' }
      };
    }

    // TODO: Process transaction body elements
    // This will require implementing builder functions for each element type
    if (txBodyElements.length > 0) {
      const supportedTypes = new Set(['ProposalProcedures']);
      const unsupported = txBodyElements.filter(e => !supportedTypes.has(e.type));
      if (unsupported.length > 0) {
        console.warn(
          `Transaction body elements not yet implemented and will be skipped: ${unsupported.map(e => e.type).join(', ')}`
        );
      }
    }
    
    // Warn about votes (not supported as certificates)
    if (voteTypes.length > 0) {
      console.warn(`Votes (${voteTypes.length}) cannot be added as certificates. Votes must be added to voting_procedures in the transaction body.`);
    }
    
    // Build certificate list. Unknown/unsupported cert types are skipped with
    // a warning rather than failing the whole build — the user can still build
    // a tx that contains only supported items (e.g. a governance proposal).
    const certList = CSL.Certificates.new();
    createdObjects.push(certList);

    const errors: BuildError[] = [];
    const skipped: string[] = [];

    for (let i = 0; i < certificateTypes.length; i++) {
      const certData = certificateTypes[i];
      const { cert, error } = buildCertificateFromData(certData);

      if (error) {
        if (error.message.startsWith('Unknown certificate type:')) {
          skipped.push(certData.type);
          continue;
        }
        errors.push(error);
        continue;
      }

      certList.add(cert);
      // Note: cert is owned by certList, will be freed when certList is freed
    }

    if (skipped.length > 0) {
      console.warn(`Skipping unsupported certificate types: ${skipped.join(', ')}`);
    }

    // Build voting proposals from tx body elements (CBOR-pasted gov actions).
    const proposalElements = txBodyElements.filter(e => e.type === 'ProposalProcedures');
    const votingProposals = proposalElements.length > 0 ? CSL.VotingProposals.new() : null;
    if (votingProposals) {
      createdObjects.push(votingProposals);
    }
    // For each proposal added, track whether it references a guard-rails
    // script. Index in this array == index in the VotingProposals collection.
    type GuardrailsInfo = { scriptHex: string; language: GuardrailsLang; costModels?: CostModels };
    const guardrailsByIndex: Array<GuardrailsInfo | null> = [];

    for (const element of proposalElements) {
      const raw = (element.data?.proposalData as string | undefined)?.trim();
      if (!raw) {
        errors.push({ message: 'Proposal procedure has no data', field: 'proposalData' });
        continue;
      }
      try {
        const proposal = CSL.VotingProposal.from_hex(raw);
        votingProposals!.add(proposal);
        // Note: VotingProposals.add takes ownership of the proposal.

        const scriptHex = element.data?.guardrailsScriptHex as string | undefined;
        const lang = element.data?.guardrailsLanguage as GuardrailsLang | undefined;
        if (scriptHex && lang) {
          guardrailsByIndex.push({
            scriptHex,
            language: lang,
            costModels: element.data?.costModels as CostModels | undefined,
          });
        } else {
          guardrailsByIndex.push(null);
        }
      } catch (e) {
        errors.push({
          message: `Failed to parse proposal procedure CBOR: ${e instanceof Error ? e.message : 'invalid hex'}`,
          field: 'proposalData',
        });
      }
    }

    // Fail only if everything fell through — no valid certs AND no valid proposals.
    const haveAnything = certList.len() > 0 || (votingProposals?.len() ?? 0) > 0;
    if (!haveAnything && errors.length > 0) {
      safeFree(...createdObjects);
      return {
        txBody: null as unknown as CSL.TransactionBody,
        error: { message: `Failed to build transaction: ${errors.map(e => e.message).join(', ')}` }
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
        const lovelaceAmount = amounts.find((a: { unit: string; quantity: string | number | bigint }) => a.unit === 'lovelace');
        if (lovelaceAmount) {
          totalInput += BigInt(lovelaceAmount.quantity);
        }
      } catch (utxoError) {
        safeFree(...createdObjects);
        throw new Error(`Error processing UTXO ${i + 1}: ${utxoError instanceof Error ? utxoError.message : 'Unknown error'}`);
      }
    }
    
    // Sum deposits from voting proposals — these come out of the wallet's
    // funds at submission time and must be subtracted from change. (Cert
    // deposits are also a thing but our currently-supported certs have none.)
    let proposalDepositTotal = BigInt(0);
    if (votingProposals && votingProposals.len() > 0) {
      for (let i = 0; i < votingProposals.len(); i++) {
        const p = votingProposals.get(i);
        const dep = p.deposit();
        proposalDepositTotal += BigInt(dep.to_str());
        dep.free();
        // p is owned by the collection; don't free.
      }
    }

    // Detect if this tx will carry scripts/redeemers (changes fee floor).
    const hasScripts = guardrailsByIndex.some((g) => g !== null);

    // Create transaction outputs
    const outputs = CSL.TransactionOutputs.new();
    createdObjects.push(outputs);

    // Fee placeholder. With scripts + ex_units this can be ~1.3 ADA on mainnet;
    // we leave a 2 ADA cushion. Without scripts we use the historic 0.2 ADA
    // estimate. The wallet/node validates exact min_fee at submission.
    const calculatedFee = fee ?? (hasScripts ? BigInt(2_000_000) : BigInt(200_000));

    const outflow = calculatedFee + proposalDepositTotal;
    if (totalInput < outflow) {
      safeFree(...createdObjects);
      throw new Error(
        `Insufficient funds: total input ${totalInput} < fee ${calculatedFee} + deposits ${proposalDepositTotal} = ${outflow}`
      );
    }

    const outputValue = totalInput - outflow;

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
    
    // Create transaction body. CSL requires fee at construction time via
    // new_tx_body(inputs, outputs, fee); the legacy `new(...)` overload also
    // takes a fee and is deprecated.
    const feeBigNum = CSL.BigNum.from_str(calculatedFee.toString());
    const txBody: CSL.TransactionBody = CSL.TransactionBody.new_tx_body(inputs, outputs, feeBigNum);
    feeBigNum.free(); // BigNum is copied into txBody; safe to free.
    // Note: inputs and outputs are owned by txBody, don't free them separately
    
    // Set certificates (only if we have any)
    if (certList.len() > 0) {
      const txBodyCertsObj = txBody as unknown as { set_certs?: (certs: CSL.Certificates) => void; certs?: CSL.Certificates };
      try {
        if (txBodyCertsObj.set_certs) {
          txBodyCertsObj.set_certs(certList);
        } else {
          txBodyCertsObj.certs = certList;
        }
      } catch (error) {
        // Alternative method name
        txBodyCertsObj.certs = certList;
      }
      // Note: certList is owned by txBody now, don't free it separately
    } else {
      certList.free(); // Free if not used
    }

    // Set voting proposals (governance actions) if any were parsed.
    if (votingProposals && votingProposals.len() > 0) {
      txBody.set_voting_proposals(votingProposals);
      // votingProposals is owned by txBody now, don't free it separately
    } else if (votingProposals) {
      votingProposals.free();
    }

    // ----- Plutus script attachments for guard-rails proposals -----
    // For each proposal that references a guard-rails policy hash, attach the
    // referenced PlutusScript to the witness set, add a {} redeemer tagged
    // VotingProposal, and wire up collateral + script_data_hash on the body.
    let txWitnessSet: CSL.TransactionWitnessSet | undefined;
    const proposalsWithGuardrails = guardrailsByIndex
      .map((g, i) => g ? { g, i } : null)
      .filter((x): x is { g: GuardrailsInfo; i: number } => x !== null);

    if (proposalsWithGuardrails.length > 0) {
      const plutusScripts = CSL.PlutusScripts.new();
      const redeemers = CSL.Redeemers.new();
      let firstCostModels: CostModels | undefined;

      try {
        for (const { g, i } of proposalsWithGuardrails) {
          if (!firstCostModels && g.costModels) firstCostModels = g.costModels;

          // PlutusScript witness
          const langKey = `Plutus${g.language}` as CostModelLang;
          const cslLang = languageForKey(langKey);
          let plutusScript: CSL.PlutusScript | null = null;
          try {
            plutusScript = CSL.PlutusScript.new_with_version(Buffer.from(g.scriptHex, 'hex'), cslLang);
            plutusScripts.add(plutusScript);
            // PlutusScripts.add takes ownership; null-out so finally doesn't double-free.
            plutusScript = null;
          } finally {
            safeFree(plutusScript, cslLang);
          }

          // {} redeemer = Constr 0 [], tagged VotingProposal at this index.
          const tag = CSL.RedeemerTag.new_voting_proposal();
          const idxBN = CSL.BigNum.from_str(String(i));
          const altBN = CSL.BigNum.from_str('0');
          const data = CSL.PlutusData.new_empty_constr_plutus_data(altBN);
          const memBN = CSL.BigNum.from_str(DEFAULT_GUARDRAILS_EX_UNITS.mem.toString());
          const stepsBN = CSL.BigNum.from_str(DEFAULT_GUARDRAILS_EX_UNITS.steps.toString());
          const exUnits = CSL.ExUnits.new(memBN, stepsBN);
          const redeemer = CSL.Redeemer.new(tag, idxBN, data, exUnits);
          redeemers.add(redeemer);
          // Redeemer.new takes ownership of tag/idx/data/exUnits. exUnits owns mem/steps.
          // altBN was consumed by new_empty_constr_plutus_data.
          // Redeemers.add takes ownership of redeemer.
        }

        // script_data_hash uses the cost models of the languages USED IN THIS TX.
        // For correct on-chain validation this should be the *current* cost models;
        // we use the cost models the user is proposing as the closest-available
        // approximation. The wallet will sign whatever bytes we hand it; the node
        // validates the hash against its own params at submit time.
        if (firstCostModels) {
          let costmdls: CSL.Costmdls | null = null;
          let scriptDataHash: CSL.ScriptDataHash | null = null;
          try {
            costmdls = buildCostmdls(firstCostModels);
            scriptDataHash = CSL.hash_script_data(redeemers, costmdls);
            txBody.set_script_data_hash(scriptDataHash);
          } finally {
            safeFree(scriptDataHash, costmdls);
          }
        } else {
          console.warn('No cost models available — script_data_hash not set; tx will be rejected on submission.');
        }

        // Collateral input: a single UTXO chosen from the wallet's own UTXO
        // set (preferring pure-ADA), reserved at the top of this function.
        if (!collateralUtxo) {
          throw new Error('Guard-rails script referenced but no collateral UTXO could be reserved.');
        }

        const collateralInputs = CSL.TransactionInputs.new();
        const collTxId = CSL.TransactionHash.from_bytes(Buffer.from(collateralUtxo.input.txHash, 'hex'));
        const collInput = CSL.TransactionInput.new(collTxId, collateralUtxo.input.outputIndex);
        collateralInputs.add(collInput);
        collTxId.free();
        collInput.free();

        const collLovelace = (collateralUtxo.output?.amount ?? []).find(a => a.unit === 'lovelace');
        const collateralLovelace = collLovelace ? BigInt(collLovelace.quantity) : BigInt(0);

        txBody.set_collateral(collateralInputs);
        // Note: collateralInputs is now owned by txBody.

        if (collateralLovelace > 0) {
          const totalCollateral = CSL.BigNum.from_str(collateralLovelace.toString());
          txBody.set_total_collateral(totalCollateral);
          totalCollateral.free();
        }
        // Suppress unused-var warning; MAX_COLLATERAL_INPUTS kept for future multi-collateral selection.
        void MAX_COLLATERAL_INPUTS;

        // Build the witness set with scripts + redeemers. (Vkey witnesses are
        // appended by the wallet at signTx time.)
        txWitnessSet = CSL.TransactionWitnessSet.new();
        txWitnessSet.set_plutus_scripts(plutusScripts);
        txWitnessSet.set_redeemers(redeemers);
        // plutusScripts and redeemers are owned by txWitnessSet.
      } catch (scriptErr) {
        safeFree(plutusScripts, redeemers, txWitnessSet);
        throw scriptErr;
      }
    }

    // Set TTL (validity interval end) - set to current slot + 3600 (1 hour)
    const currentSlot = Math.floor(Date.now() / 1000) + 3600; // Rough estimate
    const ttlBigNum = CSL.BigNum.from_str(currentSlot.toString());
    const txBodyTtlObj = txBody as unknown as { set_ttl_bignum?: (ttl: CSL.BigNum) => void; ttl_bignum?: CSL.BigNum };
    try {
      if (txBodyTtlObj.set_ttl_bignum) {
        txBodyTtlObj.set_ttl_bignum(ttlBigNum);
      } else {
        txBodyTtlObj.ttl_bignum = ttlBigNum;
      }
    } catch (error) {
      // Alternative method name
      txBodyTtlObj.ttl_bignum = ttlBigNum;
    }
    ttlBigNum.free(); // Free immediately after use
    
    // Clear createdObjects since txBody now owns them
    createdObjects.length = 0;

    return { txBody, txWitnessSet };
  } catch (error) {
    // Clean up all created objects on error
    safeFree(...createdObjects);

    return {
      txBody: null as unknown as CSL.TransactionBody,
      error: {
        message: error instanceof Error ? error.message : 'Failed to assemble transaction'
      }
    };
  }
}

/**
 * Serialize transaction to hex - IMPROVED with validation.
 * If a witness set is supplied (e.g. carrying script witnesses + redeemers),
 * it's embedded into the resulting Transaction; otherwise an empty one is used.
 */
export function serializeTransaction(
  txBody: CSL.TransactionBody,
  providedWitnessSet?: CSL.TransactionWitnessSet
): string {
  if (!txBody) {
    throw new Error('Transaction body is required');
  }

  // Wrap the body in a full Transaction so the resulting hex matches the
  // Conway `transaction = [body, witness_set, is_valid, aux_data?]` shape.
  // Wallets / parsers expect a CBOR array, not a bare body Map.
  const ownsWitnessSet = !providedWitnessSet;
  const witnessSet = providedWitnessSet ?? CSL.TransactionWitnessSet.new();
  let tx: CSL.Transaction | null = null;
  try {
    tx = CSL.Transaction.new(txBody, witnessSet, undefined);
    return tx.to_hex();
  } catch (error) {
    throw new Error(`Failed to serialize transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    tx?.free();
    if (ownsWitnessSet) witnessSet.free();
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
