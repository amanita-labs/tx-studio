// src/app/api/blockfrost/transactions/[hash]/utxos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Network } from '@/domain/tx';
import { fetchTransactionUtxos } from '@/lib/blockfrost/utxos';
import { isValidTransactionHash } from '@/lib/blockfrost/config';
import { FetchTxUtxosResponse } from '@/lib/types/blockfrost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  let hash = '';
  let network: Network = 'mainnet';

  try {
    const paramsResolved = await params;
    hash = paramsResolved.hash;
    const searchParams = request.nextUrl.searchParams;
    network = (searchParams.get('network') || 'mainnet') as Network;

    if (!['mainnet', 'preprod', 'preview'].includes(network)) {
      return NextResponse.json<FetchTxUtxosResponse>(
        { success: false, error: 'Invalid network. Must be one of: mainnet, preprod, preview' },
        { status: 400 }
      );
    }

    if (!isValidTransactionHash(hash)) {
      return NextResponse.json<FetchTxUtxosResponse>(
        { success: false, error: 'Invalid transaction hash format. Must be 64 hexadecimal characters.' },
        { status: 400 }
      );
    }

    const utxos = await fetchTransactionUtxos(network, hash);

    return NextResponse.json<FetchTxUtxosResponse>({
      success: true,
      hash: utxos.hash,
      utxos,
    });
  } catch (error) {
    console.error('Error fetching transaction UTXOs from Blockfrost:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      network,
      hash,
    });

    if (error instanceof Error) {
      const statusCode = (error as unknown as { status_code?: number })?.status_code;
      if (statusCode === 404 || error.message.toLowerCase().includes('not found') || error.message.includes('404')) {
        return NextResponse.json<FetchTxUtxosResponse>(
          {
            success: false,
            error: `Transaction not found on ${network} network.`,
            statusCode: 404,
          },
          { status: 404 }
        );
      }
      if (statusCode === 429 || error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json<FetchTxUtxosResponse>(
          { success: false, error: 'Rate limit exceeded. Please try again later.', statusCode: 429 },
          { status: 429 }
        );
      }
      if (error.message.includes('project ID') || error.message.includes('API key')) {
        return NextResponse.json<FetchTxUtxosResponse>(
          { success: false, error: 'Blockfrost API configuration error. Please check server configuration.', statusCode: 500 },
          { status: 500 }
        );
      }
      return NextResponse.json<FetchTxUtxosResponse>(
        { success: false, error: error.message || 'Failed to fetch transaction UTXOs' },
        { status: 500 }
      );
    }

    return NextResponse.json<FetchTxUtxosResponse>(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
