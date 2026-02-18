// src/app/api/blockfrost/evaluate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Network } from '@/domain/tx';
import { createBlockfrostClient } from '@/lib/blockfrost/client';
import { EvalResponse, EvalResult } from '@/lib/types/script-eval';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let network: Network = 'mainnet';

  try {
    const body = await request.json();
    const { cbor, network: reqNetwork } = body as { cbor: string; network: Network };

    if (!cbor || typeof cbor !== 'string') {
      return NextResponse.json<EvalResponse>(
        { success: false, error: 'Missing or invalid cbor parameter' },
        { status: 400 }
      );
    }

    network = reqNetwork || 'mainnet';

    if (!['mainnet', 'preprod', 'preview'].includes(network)) {
      return NextResponse.json<EvalResponse>(
        { success: false, error: 'Invalid network. Must be one of: mainnet, preprod, preview' },
        { status: 400 }
      );
    }

    const api = createBlockfrostClient(network);
    const response = await api.utilsTxsEvaluate(cbor);

    // Blockfrost returns the Ogmios evaluateTransaction response
    // On success: { type: "jsonwsp/response", result: { EvaluationResult: { "spend:0": { memory, steps }, ... } } }
    // The SDK may normalize this differently
    const rawResult = response as any;

    // Handle Ogmios-style error response
    if (rawResult?.type === 'jsonwsp/fault' || rawResult?.fault) {
      const fault = rawResult.fault || rawResult;
      return NextResponse.json<EvalResponse>({
        success: false,
        error: fault?.string || fault?.message || 'Evaluation failed',
        ogmiosError: {
          code: fault?.code || 0,
          message: fault?.string || fault?.message || 'Unknown error',
          data: fault?.data,
        },
      });
    }

    // Parse the successful evaluation result
    // Blockfrost SDK returns the result directly or wrapped
    const evalResult = rawResult?.result?.EvaluationResult
      || rawResult?.result
      || rawResult?.EvaluationResult
      || rawResult;

    if (evalResult && typeof evalResult === 'object' && !Array.isArray(evalResult)) {
      // Check if there's an EvaluationFailure
      if (evalResult.EvaluationFailure) {
        const failure = evalResult.EvaluationFailure;
        return NextResponse.json<EvalResponse>({
          success: false,
          error: typeof failure === 'string' ? failure : 'Script evaluation failed',
          ogmiosError: {
            code: failure?.code || 3010,
            message: typeof failure === 'string' ? failure : failure?.message || 'Script evaluation failed',
            data: failure,
          },
        });
      }

      const results: EvalResult[] = [];

      for (const [validator, budget] of Object.entries(evalResult)) {
        const b = budget as any;
        if (b && typeof b.memory === 'number' && typeof b.steps === 'number') {
          results.push({
            validator,
            budget: { memory: b.memory, cpu: b.steps },
          });
        }
      }

      if (results.length > 0) {
        return NextResponse.json<EvalResponse>({
          success: true,
          results,
        });
      }
    }

    // If we couldn't parse a success or a recognized error, return the raw response
    return NextResponse.json<EvalResponse>({
      success: false,
      error: 'Unexpected evaluation response format',
      ogmiosError: {
        code: 0,
        message: 'Unexpected response format',
        data: rawResult,
      },
    });
  } catch (error: any) {
    console.error('Error evaluating transaction:', error);

    const statusCode = error?.status_code;

    // Blockfrost SDK may throw with the Ogmios error embedded
    if (statusCode === 400) {
      // Try to extract the Ogmios error from the Blockfrost error
      let ogmiosError = undefined;
      let humanMessage = 'Transaction evaluation failed';

      try {
        const errorData = typeof error.message === 'string' ? JSON.parse(error.message) : error;
        if (errorData?.message) {
          humanMessage = errorData.message;
        }
        ogmiosError = {
          code: errorData?.code || 0,
          message: errorData?.message || humanMessage,
          data: errorData,
        };
      } catch {
        ogmiosError = {
          code: 0,
          message: error?.message || humanMessage,
          data: error?.message,
        };
      }

      return NextResponse.json<EvalResponse>(
        { success: false, error: humanMessage, ogmiosError },
        { status: 400 }
      );
    }

    if (statusCode === 403) {
      return NextResponse.json<EvalResponse>(
        { success: false, error: 'Blockfrost API key invalid or insufficient permissions', statusCode: 403 },
        { status: 403 }
      );
    }

    if (statusCode === 429) {
      return NextResponse.json<EvalResponse>(
        { success: false, error: 'Rate limit exceeded. Please try again later.', statusCode: 429 },
        { status: 429 }
      );
    }

    return NextResponse.json<EvalResponse>(
      {
        success: false,
        error: error?.message || 'An unexpected error occurred during evaluation',
      },
      { status: 500 }
    );
  }
}
