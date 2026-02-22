// src/lib/ogmios-errors.ts

export type OgmiosErrorCategory = 'context' | 'script' | 'phase1' | 'phase2' | 'governance' | 'unknown';

const OGMIOS_ERROR_MESSAGES: Record<number, string> = {
  // Context errors (3000-3004)
  3000: 'The transaction era is incompatible with the current node era.',
  3001: 'The transaction uses an unsupported era.',
  3002: 'The additional UTXO set overlaps with the on-chain UTXO set.',
  3003: 'The node tip is too old to evaluate transactions. Try again later.',
  3004: 'Cannot create an evaluation context for this transaction.',

  // Script errors (3010-3013)
  3010: 'One or more scripts failed during execution.',
  3011: 'One or more redeemer pointers are invalid or do not match any script.',
  3012: 'Script validation failed.',
  3013: 'An output reference used for a reference script is unsuitable.',

  // Phase-1 errors (3100-3117)
  3100: 'One or more required scripts are missing from the transaction.',
  3101: 'One or more required datums are missing.',
  3102: 'One or more required redeemers are missing.',
  3103: 'The script integrity hash does not match the computed hash.',
  3104: 'One or more scripts in the transaction are malformed.',
  3105: 'One or more output references are unknown (not in the UTXO set).',
  3106: 'The transaction contains extra redeemers not needed by any script.',
  3107: 'Missing required cost models for script languages used.',
  3108: 'A Plutus script was provided where a native script was expected.',
  3109: 'The transaction body is too large.',
  3110: 'The transaction output value is too small (below minimum UTXO).',
  3111: 'The transaction output value exceeds the maximum allowed.',
  3112: 'A required signer is missing from the transaction.',
  3113: 'The transaction has no collateral inputs.',
  3114: 'Collateral inputs contain non-ADA assets.',
  3115: 'The total collateral amount is insufficient.',
  3116: 'The collateral return output is malformed.',
  3117: 'The number of collateral inputs exceeds the protocol maximum.',

  // Phase-2 errors (3118-3135)
  3118: 'The transaction validity interval does not include the current slot.',
  3119: 'The fee specified is too small for this transaction.',
  3120: 'Value not conserved: inputs + minting != outputs + fee + burning.',
  3121: 'The network ID in the transaction does not match the node network.',
  3122: 'There is a mismatch in the transaction output serialization format.',
  3123: 'The transaction contains outputs with negative quantities.',
  3124: 'A script was provided but no corresponding redeemer was found.',
  3125: 'Execution budget exceeded: memory or CPU steps too large.',
  3126: 'A transaction output has an invalid address.',
  3127: 'The transaction mint field is invalid.',
  3128: 'The transaction references an unknown stake pool.',
  3129: 'The total transaction size exceeds the protocol limit.',
  3130: 'Token name length exceeds the maximum (32 bytes).',
  3131: 'A Plutus script failed execution (phase-2 validation error).',
  3132: 'Collateral inputs have insufficient funds.',
  3133: 'Required extra datums are missing.',
  3134: 'A minting policy requires a redeemer but none was provided.',
  3135: 'Withdrawals exceed available rewards.',

  // Governance errors (3136-3168)
  3136: 'Invalid governance action.',
  3137: 'A governance proposal does not meet the minimum deposit.',
  3138: 'Unknown committee member in governance action.',
  3139: 'The DRep is already registered.',
  3140: 'The DRep is not registered.',
  3141: 'An invalid previous governance action ID was referenced.',
  3142: 'Voting is not allowed for this governance action type.',
  3143: 'The proposal procedure is invalid.',
  3144: 'A conflicting committee update was proposed.',
  3145: 'The committee term exceeds the maximum allowed.',
  3146: 'Governance action deposit mismatch.',
  3147: 'Invalid treasury withdrawal amount.',
  3148: 'The committee quorum is invalid.',
  3149: 'An invalid constitutional committee member was referenced.',
  3150: 'A duplicate committee member was proposed.',
  3151: 'The hard-fork version is invalid.',
  3152: 'Missing required constitution script hash.',
  3153: 'Invalid protocol parameter update.',
  3154: 'Unconstitutional protocol parameter change.',
  3155: 'The stake credential is already registered.',
  3156: 'The stake credential is not registered.',
  3157: 'Insufficient stake pool operator delegation.',
  3158: 'Duplicate governance proposal.',
  3159: 'Constitution script integrity error.',
  3160: 'An invalid governance vote was cast.',
  3161: 'Missing required governance voters.',
  3162: 'Treasury value mismatch.',
  3163: 'An expired governance action was referenced.',
  3164: 'A governance anchor data hash mismatch.',
  3165: 'Unknown governance action ID.',
  3166: 'Current treasury value is required but not provided.',
  3167: 'Voting on an expired proposal is not allowed.',
  3168: 'An invalid governance action was referenced in a vote.',
};

export function getOgmiosErrorMessage(code: number): string {
  return OGMIOS_ERROR_MESSAGES[code] || `Unknown Ogmios error (code ${code}).`;
}

export function getOgmiosErrorCategory(code: number): OgmiosErrorCategory {
  if (code >= 3000 && code <= 3004) return 'context';
  if (code >= 3010 && code <= 3013) return 'script';
  if (code >= 3100 && code <= 3117) return 'phase1';
  if (code >= 3118 && code <= 3135) return 'phase2';
  if (code >= 3136 && code <= 3168) return 'governance';
  return 'unknown';
}
