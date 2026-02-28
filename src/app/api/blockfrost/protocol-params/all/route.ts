// src/app/api/blockfrost/protocol-params/all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Network } from '@/domain/tx';
import { createBlockfrostClient } from '@/lib/blockfrost/client';
import type { AllProtocolParams, AllProtocolParamsResponse } from '@/lib/types/protocol-params';
import { allProtocolParamsCache, CACHE_TTL_PROTOCOL_PARAMS } from '@/lib/blockfrost/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  let network: Network = 'mainnet';

  try {
    const searchParams = request.nextUrl.searchParams;
    network = (searchParams.get('network') || 'mainnet') as Network;

    if (!['mainnet', 'preprod', 'preview'].includes(network)) {
      return NextResponse.json<AllProtocolParamsResponse>(
        { success: false, error: 'Invalid network. Must be one of: mainnet, preprod, preview' },
        { status: 400 },
      );
    }

    const cached = allProtocolParamsCache.get(network);
    if (cached) {
      return NextResponse.json<AllProtocolParamsResponse>({
        success: true,
        params: cached,
      });
    }

    const api = createBlockfrostClient(network);
    const raw = await api.epochsLatestParameters();

    const params: AllProtocolParams = {
      epoch: raw.epoch,
      min_fee_a: raw.min_fee_a,
      min_fee_b: raw.min_fee_b,
      max_block_size: raw.max_block_size,
      max_tx_size: raw.max_tx_size,
      max_block_header_size: raw.max_block_header_size,
      key_deposit: raw.key_deposit,
      pool_deposit: raw.pool_deposit,
      e_max: raw.e_max,
      n_opt: raw.n_opt,
      a0: raw.a0,
      rho: raw.rho,
      tau: raw.tau,
      min_pool_cost: raw.min_pool_cost,
      coins_per_utxo_size: raw.coins_per_utxo_size ?? null,
      cost_models: raw.cost_models ?? null,
      price_mem: raw.price_mem ?? null,
      price_step: raw.price_step ?? null,
      max_tx_ex_mem: raw.max_tx_ex_mem ?? null,
      max_tx_ex_steps: raw.max_tx_ex_steps ?? null,
      max_block_ex_mem: raw.max_block_ex_mem ?? null,
      max_block_ex_steps: raw.max_block_ex_steps ?? null,
      max_val_size: raw.max_val_size ?? null,
      collateral_percent: raw.collateral_percent ?? null,
      max_collateral_inputs: raw.max_collateral_inputs ?? null,
      pvt_motion_no_confidence: raw.pvt_motion_no_confidence ?? null,
      pvt_committee_normal: raw.pvt_committee_normal ?? null,
      pvt_committee_no_confidence: raw.pvt_committee_no_confidence ?? null,
      pvt_hard_fork_initiation: raw.pvt_hard_fork_initiation ?? null,
      pvt_p_p_security_group: raw.pvt_p_p_security_group ?? null,
      dvt_motion_no_confidence: raw.dvt_motion_no_confidence ?? null,
      dvt_committee_normal: raw.dvt_committee_normal ?? null,
      dvt_committee_no_confidence: raw.dvt_committee_no_confidence ?? null,
      dvt_update_to_constitution: raw.dvt_update_to_constitution ?? null,
      dvt_hard_fork_initiation: raw.dvt_hard_fork_initiation ?? null,
      dvt_p_p_network_group: raw.dvt_p_p_network_group ?? null,
      dvt_p_p_economic_group: raw.dvt_p_p_economic_group ?? null,
      dvt_p_p_technical_group: raw.dvt_p_p_technical_group ?? null,
      dvt_p_p_gov_group: raw.dvt_p_p_gov_group ?? null,
      dvt_treasury_withdrawal: raw.dvt_treasury_withdrawal ?? null,
      committee_min_size: raw.committee_min_size ?? null,
      committee_max_term_length: raw.committee_max_term_length ?? null,
      gov_action_lifetime: raw.gov_action_lifetime ?? null,
      gov_action_deposit: raw.gov_action_deposit ?? null,
      drep_deposit: raw.drep_deposit ?? null,
      drep_activity: raw.drep_activity ?? null,
      min_fee_ref_script_cost_per_byte: raw.min_fee_ref_script_cost_per_byte ?? null,
    };

    allProtocolParamsCache.set(network, params, CACHE_TTL_PROTOCOL_PARAMS);

    return NextResponse.json<AllProtocolParamsResponse>({
      success: true,
      params,
    });
  } catch (error: any) {
    console.error('Error fetching all protocol parameters:', error);

    const statusCode = error?.status_code;

    if (statusCode === 403) {
      return NextResponse.json<AllProtocolParamsResponse>(
        { success: false, error: 'Blockfrost API key invalid or insufficient permissions' },
        { status: 403 },
      );
    }

    if (statusCode === 429) {
      return NextResponse.json<AllProtocolParamsResponse>(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 },
      );
    }

    return NextResponse.json<AllProtocolParamsResponse>(
      { success: false, error: error?.message || 'Failed to fetch protocol parameters' },
      { status: 500 },
    );
  }
}
