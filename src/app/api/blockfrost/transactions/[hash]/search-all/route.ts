// src/app/api/blockfrost/transactions/[hash]/search-all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchTransactionAcrossNetworks } from '@/lib/blockfrost/multi-network-search';
import { isValidTransactionHash } from '@/lib/blockfrost/config';
import { FetchTransactionResponse } from '@/lib/types/blockfrost';

// Force dynamic rendering - API routes cannot be statically exported
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  let hash: string = '';
  
  try {
    const paramsResolved = await params;
    hash = paramsResolved.hash;

    // Validate transaction hash format
    if (!isValidTransactionHash(hash)) {
      return NextResponse.json<FetchTransactionResponse>(
        {
          success: false,
          error: 'Invalid transaction hash format. Must be 64 hexadecimal characters.',
        },
        { status: 400 }
      );
    }

    // Search across all networks
    const result = await searchTransactionAcrossNetworks(hash);

    if (result.success) {
      return NextResponse.json<FetchTransactionResponse>({
        success: true,
        hash: result.metadata.hash,
        hex: result.hex,
        metadata: result.metadata,
        network: result.network,
      });
    } else {
      return NextResponse.json<FetchTransactionResponse>(
        {
          success: false,
          error: result.error,
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error searching transaction across networks:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      hash,
    });

    return NextResponse.json<FetchTransactionResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
