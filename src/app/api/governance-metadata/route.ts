import { NextRequest, NextResponse } from 'next/server';
import { blake2b } from 'blakejs';
import dns from 'node:dns/promises';
import net from 'node:net';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT = 15_000;
const MAX_REDIRECTS = 5;
const HASH_RE = /^[0-9a-fA-F]{64}$/; // blake2b-256 = 32 bytes = 64 hex chars

/** Thrown for disallowed schemes / hosts — surfaced to the caller as a 400. */
class BlockedUrlError extends Error {}

function resolveUrl(url: string): string {
  if (url.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${url.slice(7)}`;
  if (url.startsWith('ar://')) return `https://arweave.net/${url.slice(5)}`;
  return url;
}

function ipv4ToInt(ip: string): number {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const inRange = (base: string, bits: number) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  };
  return (
    inRange('0.0.0.0', 8) || // "this" network
    inRange('10.0.0.0', 8) || // RFC1918
    inRange('100.64.0.0', 10) || // CGNAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local / cloud metadata
    inRange('172.16.0.0', 12) || // RFC1918
    inRange('192.0.0.0', 24) ||
    inRange('192.168.0.0', 16) || // RFC1918
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('240.0.0.0', 4) // reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4 address.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (lower === '::' || lower === '::1') return true; // unspecified / loopback
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique-local
  return false;
}

function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return true; // not a parseable IP — treat as blocked
}

/**
 * Reject loopback / link-local / private destinations before fetching.
 * Note: there is an inherent TOCTOU gap (DNS could re-resolve to a different
 * address at fetch time / DNS rebinding); for this read-only inspector proxy
 * that residual risk is acceptable.
 */
async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, ''); // strip IPv6 literal brackets
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new BlockedUrlError('URL resolves to a private address');
    return;
  }
  const records = await dns.lookup(host, { all: true });
  if (records.length === 0) throw new BlockedUrlError('Host did not resolve');
  for (const { address } of records) {
    if (isPrivateIp(address)) throw new BlockedUrlError('URL resolves to a private address');
  }
}

/** Fetch with scheme + host validation on every hop, following redirects manually. */
async function safeFetch(initialUrl: string, signal: AbortSignal): Promise<Response> {
  let current = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new BlockedUrlError('Invalid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BlockedUrlError('Only http(s) URLs are allowed');
    }
    await assertPublicHost(parsed.hostname);

    const res = await fetch(current, {
      signal,
      headers: { Accept: '*/*' },
      redirect: 'manual',
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new BlockedUrlError('Too many redirects');
}

export async function POST(request: NextRequest) {
  let url: string;
  let dataHash: string;
  try {
    const body = await request.json();
    url = body.url;
    dataHash = body.dataHash;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing "url"' }, { status: 400 });
  }
  if (!dataHash || typeof dataHash !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing "dataHash"' }, { status: 400 });
  }
  if (!HASH_RE.test(dataHash)) {
    return NextResponse.json(
      { success: false, error: 'Invalid "dataHash" — expected 64 hex chars' },
      { status: 400 },
    );
  }

  const resolved = resolveUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await safeFetch(resolved, controller.signal);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream returned ${res.status}` },
        { status: 502 },
      );
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'Content > 10 MB' }, { status: 413 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'Content > 10 MB' }, { status: 413 });
    }

    const computedHash = Buffer.from(blake2b(buffer, undefined, 32)).toString('hex');
    const hashOk = computedHash.toLowerCase() === dataHash.toLowerCase();

    let document: unknown;
    try {
      document = JSON.parse(buffer.toString('utf-8'));
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: `Invalid JSON: ${err instanceof Error ? err.message : 'parse failed'}`,
        rawHex: buffer.toString('hex'),
        computedHash,
        hashOk,
      });
    }

    return NextResponse.json({
      success: true,
      rawHex: buffer.toString('hex'),
      document,
      computedHash,
      hashOk,
    });
  } catch (err: unknown) {
    if (err instanceof BlockedUrlError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'Request timed out' }, { status: 504 });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fetch failed' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
