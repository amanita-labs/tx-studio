// src/lib/protocol-param-mapping.ts

import type { AllProtocolParams } from '@/lib/types/protocol-params';

/**
 * Result of looking up a current protocol parameter value.
 */
export interface CurrentValueResult {
  formatted: string;
  raw: number;
}

export interface CurrentExecUnitsResult {
  mem: CurrentValueResult | null;
  steps: CurrentValueResult | null;
}

// Parameter categories for formatting
const COIN_PARAMS = new Set([
  'minFeeA',
  'minFeeB',
  'keyDeposit',
  'poolDeposit',
  'minPoolCost',
  'adaPerUtxoByte',
  'governanceActionDeposit',
  'drepDeposit',
]);

const RATIO_PARAMS = new Set([
  'poolPledgeInfluence',
  'expansionRate',
  'treasuryGrowthRate',
]);

const EXEC_UNIT_PARAMS = new Set([
  'maxTxExecutionUnits',
  'maxBlockExecutionUnits',
]);

const SKIP_PARAMS = new Set([
  'costModels',
  'poolVotingThresholds',
  'drepVotingThresholds',
  'executionUnitPrices',
]);

/**
 * Map from camelCase governance parameter names to Blockfrost field name(s).
 */
const PARAM_TO_BLOCKFROST: Record<string, string | string[]> = {
  minFeeA: 'min_fee_a',
  minFeeB: 'min_fee_b',
  maxBlockBodySize: 'max_block_size',
  maxTransactionSize: 'max_tx_size',
  maxBlockHeaderSize: 'max_block_header_size',
  keyDeposit: 'key_deposit',
  poolDeposit: 'pool_deposit',
  maximumEpoch: 'e_max',
  nOpt: 'n_opt',
  poolPledgeInfluence: 'a0',
  expansionRate: 'rho',
  treasuryGrowthRate: 'tau',
  minPoolCost: 'min_pool_cost',
  adaPerUtxoByte: 'coins_per_utxo_size',
  maxValueSize: 'max_val_size',
  collateralPercentage: 'collateral_percent',
  maxCollateralInputs: 'max_collateral_inputs',
  minCommitteeSize: 'committee_min_size',
  committeeTermLimit: 'committee_max_term_length',
  governanceActionValidityPeriod: 'gov_action_lifetime',
  governanceActionDeposit: 'gov_action_deposit',
  drepDeposit: 'drep_deposit',
  drepInactivityPeriod: 'drep_activity',
  minFeeRefScriptCoinsPerByte: 'min_fee_ref_script_cost_per_byte',
  // Compound exec-unit params
  maxTxExecutionUnits: ['max_tx_ex_mem', 'max_tx_ex_steps'],
  maxBlockExecutionUnits: ['max_block_ex_mem', 'max_block_ex_steps'],
};

function formatAdaFromLovelace(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  return ada.toFixed(6);
}

function getRawValue(params: AllProtocolParams, field: string): number | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const val = (params as any)[field];
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Look up the current value of a protocol parameter from Blockfrost data.
 * Returns null for unmapped/skipped params (costModels, voting thresholds, etc.).
 */
export function lookupCurrentValue(
  camelKey: string,
  params: AllProtocolParams,
): CurrentValueResult | CurrentExecUnitsResult | null {
  if (SKIP_PARAMS.has(camelKey)) return null;

  const mapping = PARAM_TO_BLOCKFROST[camelKey];
  if (!mapping) return null;

  // Execution unit compound params
  if (EXEC_UNIT_PARAMS.has(camelKey)) {
    const [memField, stepsField] = mapping as string[];
    const memRaw = getRawValue(params, memField);
    const stepsRaw = getRawValue(params, stepsField);
    return {
      mem: memRaw !== null ? { formatted: Number(memRaw).toLocaleString(), raw: memRaw } : null,
      steps: stepsRaw !== null ? { formatted: Number(stepsRaw).toLocaleString(), raw: stepsRaw } : null,
    };
  }

  const field = mapping as string;
  const raw = getRawValue(params, field);
  if (raw === null) return null;

  // Format based on parameter type
  if (COIN_PARAMS.has(camelKey)) {
    return { formatted: formatAdaFromLovelace(raw), raw };
  }

  if (RATIO_PARAMS.has(camelKey)) {
    return { formatted: `${(raw * 100).toFixed(2)}%`, raw };
  }

  // Plain numeric values
  return { formatted: String(raw), raw };
}

/**
 * Extract a raw numeric value from the already-formatted proposed value string.
 * Used for computing percentage deltas.
 */
export function parseProposedRaw(camelKey: string, proposedValue: unknown): number | null {
  if (proposedValue === null || proposedValue === undefined) return null;

  const str = String(proposedValue);

  if (COIN_PARAMS.has(camelKey)) {
    // Proposed is formatted as ADA string like "0.000044" — convert back to lovelace
    const ada = parseFloat(str);
    if (isNaN(ada)) return null;
    return Math.round(ada * 1_000_000);
  }

  if (RATIO_PARAMS.has(camelKey)) {
    // Proposed is formatted as "30.00%" — convert back to decimal
    const pct = parseFloat(str.replace('%', ''));
    if (isNaN(pct)) return null;
    return pct / 100;
  }

  // Plain number
  const n = parseFloat(str.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Compute percentage change.
 */
export function computeDeltaPct(current: number, proposed: number): number | null {
  if (current === 0) return proposed === 0 ? 0 : null;
  return ((proposed - current) / Math.abs(current)) * 100;
}

/**
 * Check whether a parameter is an exec-unit compound parameter.
 */
export function isExecUnitParam(camelKey: string): boolean {
  return EXEC_UNIT_PARAMS.has(camelKey);
}

/**
 * Check whether a parameter should be skipped for current value display.
 */
export function isSkippedParam(camelKey: string): boolean {
  return SKIP_PARAMS.has(camelKey) || !PARAM_TO_BLOCKFROST[camelKey];
}
