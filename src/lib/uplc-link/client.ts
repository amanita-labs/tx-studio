// src/lib/uplc-link/client.ts
import type { UplcLookup, UplcScriptListResponse } from './types';

const API_BASE = 'https://api.uplc.link';
const SITE_BASE = 'https://uplc.link';

const HASH_RE = /^[0-9a-f]{56}$/;

export function normalizeHash(hash: string): string | null {
  const trimmed = hash.trim().toLowerCase().replace(/^0x/, '');
  return HASH_RE.test(trimmed) ? trimmed : null;
}

export function registryUrl(hash: string): string {
  return `${SITE_BASE}/registry?hash=${encodeURIComponent(hash)}`;
}

export function verifyUrl(txHash?: string): string {
  return txHash
    ? `${SITE_BASE}/verify?txHash=${encodeURIComponent(txHash)}`
    : `${SITE_BASE}/verify`;
}

export function commitUrl(sourceUrl: string, commitHash: string): string | null {
  // Best-effort GitHub/GitLab/Bitbucket commit URL.
  const cleaned = sourceUrl.replace(/\.git$/, '').replace(/\/+$/, '');
  if (/github\.com|gitlab\.com|bitbucket\.org/i.test(cleaned)) {
    return `${cleaned}/commit/${commitHash}`;
  }
  return null;
}

export async function fetchScriptByHash(
  hash: string,
  signal?: AbortSignal,
): Promise<UplcLookup> {
  const normalized = normalizeHash(hash);
  if (!normalized) {
    return { state: 'error', message: `Invalid script hash: "${hash}"` };
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/api/v1/scripts/by-hash/${normalized}`,
      { signal, headers: { Accept: 'application/json' } },
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network error';
    return { state: 'error', message };
  }

  if (response.status === 404) {
    return { state: 'not-verified' };
  }

  if (!response.ok) {
    return {
      state: 'error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  let data: UplcScriptListResponse;
  try {
    data = (await response.json()) as UplcScriptListResponse;
  } catch {
    return { state: 'error', message: 'Malformed response from uplc.link' };
  }

  // Prefer finalHash match (post-parameterization), fallback to rawHash.
  const finalMatch = data.scripts?.find(s => s.finalHash?.toLowerCase() === normalized);
  if (finalMatch) {
    return { state: 'verified', data, matchedScript: finalMatch, matchKind: 'finalHash' };
  }
  const rawMatch = data.scripts?.find(s => s.rawHash?.toLowerCase() === normalized);
  if (rawMatch) {
    return { state: 'verified', data, matchedScript: rawMatch, matchKind: 'rawHash' };
  }

  // Server returned 200 but no script in the list matched — treat as not-verified.
  return { state: 'not-verified' };
}
