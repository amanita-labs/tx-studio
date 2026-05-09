import { NextRequest, NextResponse } from 'next/server';
import { blake2b } from 'blakejs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT = 15_000;
const MAX_REDIRECTS = 5;

function resolveUrl(url: string): string {
  if (url.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${url.slice(7)}`;
  if (url.startsWith('ar://')) return `https://arweave.net/${url.slice(5)}`;
  return url;
}

/**
 * Returns true if an IP literal falls in a range that must never be reachable
 * from a server-side fetch: loopback, link-local (incl. cloud metadata
 * 169.254.169.254), private, unspecified, and multicast ranges. Used to block
 * SSRF against internal services.
 */
function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map((n) => parseInt(n, 10));
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 0) return true;                       // 0.0.0.0/8 (incl. unspecified)
    if (a === 10) return true;                      // 10.0.0.0/8
    if (a === 127) return true;                     // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;        // 169.254.0.0/16 link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;        // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true;                      // 224.0.0.0/4 multicast + 240/4 reserved
    return false;
  }
  if (v === 6) {
    const h = ip.toLowerCase();
    // Unwrap IPv4-mapped addresses (::ffff:a.b.c.d) and re-check as IPv4.
    const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    if (h === '::' || h === '::1') return true;     // unspecified + loopback
    if (h.startsWith('fe80') || h.startsWith('fec0')) return true; // link/site-local
    if (h.startsWith('ff')) return true;            // multicast
    // fc00::/7 unique-local (fc.. / fd..)
    const first = parseInt(h.split(':')[0].padStart(4, '0').slice(0, 2), 16);
    if ((first & 0xfe) === 0xfc) return true;
    return false;
  }
  return true; // not a valid IP literal — refuse
}

/**
 * Validates a resolved URL against SSRF: must be https, and every address its
 * host resolves to must be public. Returns the validated URL or throws.
 */
async function assertSafeUrl(target: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only https URLs are allowed');
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  // If the host is an IP literal, validate it directly; otherwise resolve DNS.
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new Error('Blocked address');
    return parsed;
  }
  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0) throw new Error('Host did not resolve');
  for (const { address } of addrs) {
    if (isBlockedAddress(address)) throw new Error('Blocked address');
  }
  return parsed;
}

/**
 * Fetches a URL with SSRF protection, following redirects manually and
 * re-validating each hop's destination so a public host can't redirect into
 * the internal network.
 */
async function safeFetch(initial: string, signal: AbortSignal): Promise<Response> {
  let current = initial;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertSafeUrl(current);
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
  throw new Error('Too many redirects');
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
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'Request timed out' }, { status: 504 });
    }
    const message = err instanceof Error ? err.message : 'Fetch failed';
    // URL-validation failures are client errors, not upstream failures.
    const isBadUrl =
      message === 'Invalid URL' ||
      message === 'Only https URLs are allowed' ||
      message === 'Blocked address' ||
      message === 'Host did not resolve' ||
      message === 'Too many redirects';
    return NextResponse.json(
      { success: false, error: message },
      { status: isBadUrl ? 400 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
