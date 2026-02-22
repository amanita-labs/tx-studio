// src/app/api/blockfrost/protocol-params/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Network } from '@/domain/tx';
import { createBlockfrostClient } from '@/lib/blockfrost/client';
import { ProtocolParamsResponse } from '@/lib/types/script-eval';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  let network: Network = 'mainnet';

  try {
    const searchParams = request.nextUrl.searchParams;
    network = (searchParams.get('network') || 'mainnet') as Network;

    if (!['mainnet', 'preprod', 'preview'].includes(network)) {
      return NextResponse.json<ProtocolParamsResponse>(
        { success: false, error: 'Invalid network. Must be one of: mainnet, preprod, preview' },
        { status: 400 }
      );
    }

    const api = createBlockfrostClient(network);
    const params = await api.epochsLatestParameters();

    const priceMem = typeof params.price_mem === 'number' ? params.price_mem : 0;
    const priceStep = typeof params.price_step === 'number' ? params.price_step : 0;
    const maxTxExMem = params.max_tx_ex_mem ? parseInt(params.max_tx_ex_mem, 10) : 0;
    const maxTxExSteps = params.max_tx_ex_steps ? parseInt(params.max_tx_ex_steps, 10) : 0;

    return NextResponse.json<ProtocolParamsResponse>({
      success: true,
      params: {
        priceMem,
        priceStep,
        maxTxExMem,
        maxTxExSteps,
      },
    });
  } catch (error: any) {
    console.error('Error fetching protocol parameters:', error);

    const statusCode = error?.status_code;

    if (statusCode === 403) {
      return NextResponse.json<ProtocolParamsResponse>(
        { success: false, error: 'Blockfrost API key invalid or insufficient permissions' },
        { status: 403 }
      );
    }

    if (statusCode === 429) {
      return NextResponse.json<ProtocolParamsResponse>(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json<ProtocolParamsResponse>(
      { success: false, error: error?.message || 'Failed to fetch protocol parameters' },
      { status: 500 }
    );
  }
}
