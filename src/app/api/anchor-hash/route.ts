// src/app/api/anchor-hash/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { blake2b } from 'blakejs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT = 15_000; // 15 seconds

function resolveUrl(url: string): string {
  if (url.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${url.slice(7)}`;
  }
  return url;
}

export async function POST(request: NextRequest) {
  let url: string;
  try {
    const body = await request.json();
    url = body.url;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid "url" field' },
      { status: 400 },
    );
  }

  const resolved = resolveUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(resolved, {
      signal: controller.signal,
      headers: { 'Accept': '*/*' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream returned ${res.status}` },
        { status: 502 },
      );
    }

    // Check content-length header first
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Content exceeds 10 MB size limit' },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    if (buffer.length > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Content exceeds 10 MB size limit' },
        { status: 413 },
      );
    }

    const hash = Buffer.from(blake2b(buffer, undefined, 32)).toString('hex');

    return NextResponse.json({ success: true, hash });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(
        { success: false, error: 'Request timed out' },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fetch failed' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
