// src/lib/types/blockfrost.ts

/**
 * Blockfrost API response types
 */

export interface BlockfrostTransaction {
  hash: string;
  block: string;
  block_height: number;
  block_time: number;
  slot: number;
  index: number;
  output_amount: Array<{
    unit: string;
    quantity: string;
  }>;
  fees: string;
  deposit: string;
  size: number;
  invalid_before: string | null;
  invalid_hereafter: string | null;
  utxo_count: number;
  withdrawal_count: number;
  mir_cert_count: number;
  delegation_count: number;
  stake_cert_count: number;
  pool_update_count: number;
  pool_retire_count: number;
  asset_mint_or_burn_count: number;
  redeemer_count: number;
  valid_contract: boolean;
}

export interface BlockfrostTransactionContent {
  tx_hash: string;
  cbor_hex: string;
}

export interface BlockfrostError {
  status_code: number;
  error: string;
  message: string;
}

export interface BlockfrostTransactionResponse {
  transaction: BlockfrostTransaction;
  content: BlockfrostTransactionContent;
}

export interface FetchTransactionResult {
  success: true;
  hash: string;
  hex: string;
  metadata: BlockfrostTransaction;
}

export interface FetchTransactionError {
  success: false;
  error: string;
  statusCode?: number;
}

export type FetchTransactionResponse = FetchTransactionResult | FetchTransactionError;
