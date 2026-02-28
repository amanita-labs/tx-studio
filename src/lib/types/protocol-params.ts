// src/lib/types/protocol-params.ts

/**
 * All governance-relevant protocol parameters returned by Blockfrost's
 * epochsLatestParameters() endpoint. Field names match the Blockfrost API.
 */
export interface AllProtocolParams {
  epoch: number;
  min_fee_a: number;
  min_fee_b: number;
  max_block_size: number;
  max_tx_size: number;
  max_block_header_size: number;
  key_deposit: string;
  pool_deposit: string;
  e_max: number;
  n_opt: number;
  a0: number;
  rho: number;
  tau: number;
  min_pool_cost: string;
  coins_per_utxo_size: string | null;
  cost_models: Record<string, unknown> | null;
  price_mem: number | null;
  price_step: number | null;
  max_tx_ex_mem: string | null;
  max_tx_ex_steps: string | null;
  max_block_ex_mem: string | null;
  max_block_ex_steps: string | null;
  max_val_size: string | null;
  collateral_percent: number | null;
  max_collateral_inputs: number | null;
  pvt_motion_no_confidence: number | null;
  pvt_committee_normal: number | null;
  pvt_committee_no_confidence: number | null;
  pvt_hard_fork_initiation: number | null;
  pvt_p_p_security_group: number | null;
  dvt_motion_no_confidence: number | null;
  dvt_committee_normal: number | null;
  dvt_committee_no_confidence: number | null;
  dvt_update_to_constitution: number | null;
  dvt_hard_fork_initiation: number | null;
  dvt_p_p_network_group: number | null;
  dvt_p_p_economic_group: number | null;
  dvt_p_p_technical_group: number | null;
  dvt_p_p_gov_group: number | null;
  dvt_treasury_withdrawal: number | null;
  committee_min_size: string | null;
  committee_max_term_length: string | null;
  gov_action_lifetime: string | null;
  gov_action_deposit: string | null;
  drep_deposit: string | null;
  drep_activity: string | null;
  min_fee_ref_script_cost_per_byte: number | null;
}

export interface AllProtocolParamsSuccess {
  success: true;
  params: AllProtocolParams;
}

export interface AllProtocolParamsFailure {
  success: false;
  error: string;
}

export type AllProtocolParamsResponse =
  | AllProtocolParamsSuccess
  | AllProtocolParamsFailure;
