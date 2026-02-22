// src/app/api/blockfrost/detect-network/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isValidTransactionHash } from '@/lib/blockfrost/config';
import { detectNetworkFromInputs, NetworkDetectionResponse } from '@/lib/blockfrost/multi-network-search';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputTxIds } = body as { inputTxIds: string[] };

    if (!Array.isArray(inputTxIds) || inputTxIds.length === 0) {
      return NextResponse.json<NetworkDetectionResponse>(
        { success: false, error: 'Missing or empty inputTxIds array', searchedNetworks: [] },
        { status: 400 }
      );
    }

    // Validate the first txId format
    if (!isValidTransactionHash(inputTxIds[0])) {
      return NextResponse.json<NetworkDetectionResponse>(
        { success: false, error: 'Invalid transaction hash format. Must be 64 hexadecimal characters.', searchedNetworks: [] },
        { status: 400 }
      );
    }

    const result = await detectNetworkFromInputs(inputTxIds);

    if (result.success) {
      return NextResponse.json<NetworkDetectionResponse>(result);
    } else {
      return NextResponse.json<NetworkDetectionResponse>(result, { status: 404 });
    }
  } catch (error) {
    console.error('Error detecting network from inputs:', error);

    return NextResponse.json<NetworkDetectionResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        searchedNetworks: [],
      },
      { status: 500 }
    );
  }
}
