// src/app/api/blockfrost/addresses/[address]/utxos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Network } from '@/domain/tx';
import { fetchAddressUtxoRefs } from '@/lib/blockfrost/address-utxos';
import { FetchAddressUtxosResponse } from '@/lib/types/blockfrost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Light sanity check; Blockfrost rejects malformed addresses with a 400.
function looksLikeAddress(address: string): boolean {
  return /^(addr|addr_test|stake|stake_test)1[0-9a-z]+$/.test(address) && address.length <= 200;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  let address = '';
  let network: Network = 'mainnet';

  try {
    const paramsResolved = await params;
    address = decodeURIComponent(paramsResolved.address);
    const searchParams = request.nextUrl.searchParams;
    network = (searchParams.get('network') || 'mainnet') as Network;

    if (!['mainnet', 'preprod', 'preview'].includes(network)) {
      return NextResponse.json<FetchAddressUtxosResponse>(
        { success: false, error: 'Invalid network. Must be one of: mainnet, preprod, preview' },
        { status: 400 }
      );
    }

    if (!looksLikeAddress(address)) {
      return NextResponse.json<FetchAddressUtxosResponse>(
        { success: false, error: 'Invalid address format.' },
        { status: 400 }
      );
    }

    const utxos = await fetchAddressUtxoRefs(network, address);

    return NextResponse.json<FetchAddressUtxosResponse>({
      success: true,
      address,
      utxos,
    });
  } catch (error) {
    console.error('Error fetching address UTXOs from Blockfrost:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      network,
      address,
    });

    if (error instanceof Error) {
      const statusCode = (error as unknown as { status_code?: number })?.status_code;
      if (statusCode === 429 || error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json<FetchAddressUtxosResponse>(
          { success: false, error: 'Rate limit exceeded. Please try again later.', statusCode: 429 },
          { status: 429 }
        );
      }
      if (error.message.includes('project ID') || error.message.includes('API key')) {
        return NextResponse.json<FetchAddressUtxosResponse>(
          { success: false, error: 'Blockfrost API configuration error. Please check server configuration.', statusCode: 500 },
          { status: 500 }
        );
      }
      return NextResponse.json<FetchAddressUtxosResponse>(
        { success: false, error: error.message || 'Failed to fetch address UTXOs' },
        { status: 500 }
      );
    }

    return NextResponse.json<FetchAddressUtxosResponse>(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
