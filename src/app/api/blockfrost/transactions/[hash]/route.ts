// src/app/api/blockfrost/transactions/[hash]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Network } from '@/domain/tx';
import { fetchTransactionByHash } from '@/lib/blockfrost/client';
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
  let network: Network = 'mainnet';
  
  try {
    const paramsResolved = await params;
    hash = paramsResolved.hash;
    const searchParams = request.nextUrl.searchParams;
    network = (searchParams.get('network') || 'mainnet') as Network;

    // Validate network
    if (!['mainnet', 'preprod', 'preview'].includes(network)) {
      return NextResponse.json<FetchTransactionResponse>(
        {
          success: false,
          error: 'Invalid network. Must be one of: mainnet, preprod, preview',
        },
        { status: 400 }
      );
    }

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

    // Fetch transaction from Blockfrost
    const { transaction, hex } = await fetchTransactionByHash(network, hash);

    return NextResponse.json<FetchTransactionResponse>({
      success: true,
      hash: transaction.hash,
      hex,
      metadata: transaction,
    });
  } catch (error) {
    console.error('Error fetching transaction from Blockfrost:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      network,
      hash,
    });

    // Handle specific error types
    if (error instanceof Error) {
      // Check for rate limiting
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json<FetchTransactionResponse>(
          {
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
            statusCode: 429,
          },
          { status: 429 }
        );
      }

      // Check for not found
      if (error.message.includes('not found') || error.message.includes('404')) {
        return NextResponse.json<FetchTransactionResponse>(
          {
            success: false,
            error: 'Transaction not found',
            statusCode: 404,
          },
          { status: 404 }
        );
      }

      // Check for API key errors
      if (error.message.includes('project ID') || error.message.includes('API key')) {
        return NextResponse.json<FetchTransactionResponse>(
          {
            success: false,
            error: 'Blockfrost API configuration error. Please check server configuration.',
            statusCode: 500,
          },
          { status: 500 }
        );
      }

      // Generic error
      return NextResponse.json<FetchTransactionResponse>(
        {
          success: false,
          error: error.message || 'Failed to fetch transaction',
        },
        { status: 500 }
      );
    }

    // Unknown error
    return NextResponse.json<FetchTransactionResponse>(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
