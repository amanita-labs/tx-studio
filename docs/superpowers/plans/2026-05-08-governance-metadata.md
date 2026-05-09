# Governance Metadata Resolution & Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Governance tab to the tx-studio inspector that fetches, validates, and renders the JSON-LD documents referenced by every governance anchor in a Cardano transaction.

**Architecture:** Three-layer feature: a Next.js API route fetches anchor URLs server-side (avoiding browser CORS); a main-thread validator wraps `@amanita-labs/cardano-governance-metadata` for parsing, schema validation, and ed25519 signature verification; the existing CSL worker gains one new message handler for CIP-169 transaction-binding verification. Resolved metadata lives in a per-session slice of the existing Zustand store. UI is a new tab with `<AnchorCard>` per anchor, sanitized markdown bodies, status pills, and per-author signature badges that cross-reference the existing label registry.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind v4, shadcn/ui, Zustand (already in use), `@amanita-labs/cardano-governance-metadata`, `react-markdown`, `rehype-sanitize`, `blakejs` (already installed for `/api/anchor-hash`), `@emurgo/cardano-serialization-lib-asmjs` (already loaded in worker).

**Verification model:** This codebase has no test runner (`npm test` is a no-op per CLAUDE.md). Each task verifies via `npm run type-check`, `npm run lint`, and final manual end-to-end testing against real anchors. Adding a test framework is out of scope.

---

## File Map

**New files**
- `src/lib/governance-metadata/types.ts` — type definitions
- `src/lib/governance-metadata/collect-anchors.ts` — domain helper: walk a `DomainTx` and yield every anchor with its source
- `src/lib/governance-metadata/author-labels.ts` — match CIP-100 author pubkeys against the existing label registry
- `src/lib/governance-metadata/validator.ts` — wraps the npm library; main-thread parse/validate/verify
- `src/app/api/governance-metadata/route.ts` — server-side fetch + blake2b hash check
- `src/hooks/use-governance-metadata.ts` — orchestrates fetch → validate → CIP-169 worker → store
- `src/features/inspector/components/SafeMarkdown.tsx` — sanitized markdown renderer
- `src/features/inspector/components/AnchorCard.tsx` — per-anchor card UI
- `src/features/inspector/tabs/GovernanceTab.tsx` — tab that aggregates and renders all anchors

**Modified files**
- `src/lib/store.ts` — add `governanceMetadata` slice + actions; clear on `clearTx`
- `src/workers/csl-worker.ts` — add `verify-cip169` message handler
- `src/hooks/use-csl-worker.ts` — expose a `verifyCip169` method (callable from main thread)
- `src/features/inspector/InspectorTabs.tsx` — register the Governance tab; bump `grid-cols-7` → `grid-cols-8` when present
- `package.json` — three new deps

**Out of scope for v1** (deferred per design): persistent cross-session caching, the `MetadataValidator` integration with the (currently hidden) `ValidationTab`, support for non-CIP-100-family documents.

---

## Task 0: Install dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install @amanita-labs/cardano-governance-metadata react-markdown rehype-sanitize
```

Expected: lockfile updated, no peer-dep errors. The library has CSL peer-deps; tx-studio already has `@emurgo/cardano-serialization-lib-asmjs` so this should resolve cleanly.

- [ ] **Step 2: Verify build still works**

```bash
npm run type-check && npm run lint
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add governance metadata library and markdown deps"
```

---

## Task 1: `collectAllAnchors` domain helper

**Files:**
- Create: `src/lib/governance-metadata/collect-anchors.ts`

This walks a `DomainTx` and produces a flat, ordered list of every anchor with enough context to label it in the UI. Five anchor sources, all from `src/domain/tx.ts`:

1. `tx.governance.drepVotes[].anchor`
2. `tx.governance.committeeVotes[].anchor`
3. `tx.governance.proposals[].details.anchor` (proposals store anchor under `details`, see `csl-worker.ts:1259`)
4. `tx.certs[]` of type `DRepRegistration` → `details.anchor`
5. `tx.certs[]` of type `DRepUpdate` → `details.anchor`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/governance-metadata/collect-anchors.ts
import type { DomainTx } from '@/domain/tx';

export type AnchorSource =
  | { kind: 'drep-vote'; index: number; voter: string; proposalId: string }
  | { kind: 'committee-vote'; index: number; voter: string; proposalId: string }
  | { kind: 'proposal'; index: number; proposalId: string; proposalType: string }
  | { kind: 'drep-registration'; certIndex: number; drepId?: string }
  | { kind: 'drep-update'; certIndex: number; drepId?: string };

export type CollectedAnchor = {
  source: AnchorSource;
  url: string;
  hash: string;
  /** Stable key for store + deduplication. */
  key: string;
};

function readAnchorFromDetails(details: Record<string, unknown>): { url: string; hash: string } | null {
  const a = details.anchor as { url?: string; hash?: string } | null | undefined;
  if (!a || !a.url || !a.hash) return null;
  return { url: a.url, hash: a.hash };
}

export function collectAllAnchors(tx: DomainTx): CollectedAnchor[] {
  const out: CollectedAnchor[] = [];

  tx.governance?.drepVotes?.forEach((vote, i) => {
    if (!vote.anchor?.url || !vote.anchor.hash) return;
    out.push({
      source: { kind: 'drep-vote', index: i, voter: vote.drepId, proposalId: vote.proposalId },
      url: vote.anchor.url,
      hash: vote.anchor.hash,
      key: `${vote.anchor.url}#${vote.anchor.hash}`,
    });
  });

  tx.governance?.committeeVotes?.forEach((vote, i) => {
    if (!vote.anchor?.url || !vote.anchor.hash) return;
    out.push({
      source: { kind: 'committee-vote', index: i, voter: vote.memberId, proposalId: vote.proposalId },
      url: vote.anchor.url,
      hash: vote.anchor.hash,
      key: `${vote.anchor.url}#${vote.anchor.hash}`,
    });
  });

  tx.governance?.proposals?.forEach((prop, i) => {
    const a = readAnchorFromDetails(prop.details);
    if (!a) return;
    out.push({
      source: { kind: 'proposal', index: i, proposalId: prop.id, proposalType: prop.type },
      url: a.url,
      hash: a.hash,
      key: `${a.url}#${a.hash}`,
    });
  });

  tx.certs?.forEach((cert, i) => {
    if (cert.type !== 'DRepRegistration' && cert.type !== 'DRepUpdate') return;
    const a = readAnchorFromDetails(cert.details);
    if (!a) return;
    const drepId = (cert.details.drepId as string | undefined) ?? undefined;
    out.push({
      source: cert.type === 'DRepRegistration'
        ? { kind: 'drep-registration', certIndex: i, drepId }
        : { kind: 'drep-update', certIndex: i, drepId },
      url: a.url,
      hash: a.hash,
      key: `${a.url}#${a.hash}`,
    });
  });

  return out;
}

export function txHasGovernanceAnchors(tx: DomainTx): boolean {
  return collectAllAnchors(tx).length > 0;
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/governance-metadata/collect-anchors.ts
git commit -m "feat(governance): add collectAllAnchors domain helper"
```

---

## Task 2: Governance metadata types

**Files:**
- Create: `src/lib/governance-metadata/types.ts`

These types describe the result of resolving one anchor — used by the validator, the orchestration hook, the store, and the UI.

- [ ] **Step 1: Write types**

```ts
// src/lib/governance-metadata/types.ts

/** "{url}#{hash}" — stable id for the store and dedup. */
export type AnchorKey = string;

export type DetectedCip = 'cip-100' | 'cip-108' | 'cip-119' | 'cip-136' | 'cip-169' | 'unknown';

export type AuthorWitness = {
  name?: string;
  pubkeyHex: string;
  /** ed25519 signature verification status. 'unverifiable' = malformed witness or missing sig. */
  signature: 'valid' | 'invalid' | 'unverifiable';
  /** Resolved label from the existing known-labels registry, if matched. */
  label?: { name: string; description?: string };
};

export type Cip169Binding =
  | { status: 'idle' }
  | { status: 'verifying' }
  | { status: 'ok'; referencedTxHash: string }
  | { status: 'mismatch'; referencedTxHash: string }
  | { status: 'error'; error: string };

export type ResolvedGovernanceMetadata = {
  /** Raw fetched bytes as hex (kept for debugging / signature verify input). */
  rawHex: string;
  /** Parsed JSON document. */
  document: Record<string, unknown>;
  detectedCip: DetectedCip;
  hashOk: boolean;
  computedHash: string;
  /** Schema validation issues from the library; empty if document is valid. */
  schemaIssues: Array<{ path: string; message: string }>;
  authors: AuthorWitness[];
  cip169?: Cip169Binding;
};

export type GovernanceMetadataState =
  | { status: 'idle' }
  | { status: 'fetching' }
  | { status: 'resolved'; result: ResolvedGovernanceMetadata }
  | { status: 'error'; error: string };
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add src/lib/governance-metadata/types.ts
git commit -m "feat(governance): add metadata result types"
```

---

## Task 3: Server route `/api/governance-metadata`

**Files:**
- Create: `src/app/api/governance-metadata/route.ts`

Mirrors the structure of `src/app/api/anchor-hash/route.ts` (which already does the same fetch + blake2b dance) but additionally returns the body bytes (hex) and parsed JSON document. The library's fetch helpers run server-side here.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/governance-metadata/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { blake2b } from 'blakejs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT = 15_000;

function resolveUrl(url: string): string {
  if (url.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${url.slice(7)}`;
  if (url.startsWith('ar://')) return `https://arweave.net/${url.slice(5)}`;
  return url;
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
    const res = await fetch(resolved, { signal: controller.signal, headers: { Accept: '*/*' } });
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
      return NextResponse.json(
        {
          success: false,
          error: `Invalid JSON: ${err instanceof Error ? err.message : 'parse failed'}`,
          rawHex: buffer.toString('hex'),
          computedHash,
          hashOk,
        },
        { status: 200 }, // 200 so the client can still render the diagnostic
      );
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
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fetch failed' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
npm run lint
git add src/app/api/governance-metadata/route.ts
git commit -m "feat(governance): add /api/governance-metadata server route"
```

---

## Task 4: Validator wrapper

**Files:**
- Create: `src/lib/governance-metadata/author-labels.ts`
- Create: `src/lib/governance-metadata/validator.ts`

The validator runs on the main thread. It receives the parsed `document` from the server route and the on-chain `dataHash`, then uses the npm library to detect the CIP, validate the schema, and verify each author's ed25519 signature. Author lookup uses the existing `getKnownCredLabel` helper from `src/lib/labels.ts`.

> **Note on library API:** Library version 0.1.0 exposes per-CIP subpath imports (`/cip100`, `/cip108`, `/cip119`, `/cip136`, `/cip169`). The exact function names — `parse`, `validate`, `verify`, `detectCipStandard` — were captured from the README during planning but should be confirmed against the actual `dist/index.d.ts` at execution time. If the names differ, adjust the wrapper but keep the public `validate()` contract below.

- [ ] **Step 1: Author label lookup**

```ts
// src/lib/governance-metadata/author-labels.ts
import { getKnownCredLabel } from '@/lib/labels';
import type { Network } from '@/domain/tx';

/**
 * CIP-100 witnesses identify themselves by ed25519 public key. The hash of that
 * key (blake2b-224) is what Cardano credentials use, so to match against our
 * label registry we hash the pubkey first. Returns the matched label or undefined.
 */
export function lookupAuthorLabel(
  pubkeyHashHex: string | undefined,
  network: Network,
): { name: string; description?: string } | undefined {
  if (!pubkeyHashHex) return undefined;
  // DReps and CC members both register metadata; try both purposes.
  const drep = getKnownCredLabel(pubkeyHashHex, 'drep', network);
  if (drep) return { name: drep.name, description: drep.description };
  const cc = getKnownCredLabel(pubkeyHashHex, 'cc', network);
  if (cc) return { name: cc.name, description: cc.description };
  return undefined;
}
```

- [ ] **Step 2: Validator wrapper**

```ts
// src/lib/governance-metadata/validator.ts
import { blake2b } from 'blakejs';
import { hexToBytes } from '@/lib/utils/hex';
import type { Network } from '@/domain/tx';
import type {
  AuthorWitness,
  DetectedCip,
  ResolvedGovernanceMetadata,
} from './types';
import { lookupAuthorLabel } from './author-labels';

// Library imports — verify these names against dist/index.d.ts during execution.
// If the public surface differs, keep the function shape below stable.
import * as gov from '@amanita-labs/cardano-governance-metadata';

export type ValidatorInput = {
  rawHex: string;
  document: Record<string, unknown>;
  computedHash: string;
  dataHash: string;
  hashOk: boolean;
  network: Network;
};

function blake2b224Hex(pubkeyHex: string): string {
  // ed25519 pubkey -> blake2b-224 (28 bytes) — matches Cardano credential hashing.
  return Buffer.from(blake2b(hexToBytes(pubkeyHex), undefined, 28)).toString('hex');
}

function detectCip(document: Record<string, unknown>): DetectedCip {
  // Library-provided detection where available; fall back to heuristics on @context.
  const detect = (gov as unknown as { detectCipStandard?: (d: unknown) => string | undefined })
    .detectCipStandard;
  const detected = detect ? detect(document) : undefined;
  if (typeof detected === 'string') {
    const lc = detected.toLowerCase();
    if (lc.includes('169')) return 'cip-169';
    if (lc.includes('136')) return 'cip-136';
    if (lc.includes('119')) return 'cip-119';
    if (lc.includes('108')) return 'cip-108';
    if (lc.includes('100')) return 'cip-100';
  }
  // Heuristic fallback: inspect @context URLs.
  const ctx = JSON.stringify(document['@context'] ?? '');
  if (ctx.includes('CIP169') || ctx.includes('cip-169')) return 'cip-169';
  if (ctx.includes('CIP136') || ctx.includes('cip-136')) return 'cip-136';
  if (ctx.includes('CIP119') || ctx.includes('cip-119')) return 'cip-119';
  if (ctx.includes('CIP108') || ctx.includes('cip-108')) return 'cip-108';
  if (ctx.includes('CIP100') || ctx.includes('cip-100')) return 'cip-100';
  return 'unknown';
}

function extractSchemaIssues(verifyResult: unknown): Array<{ path: string; message: string }> {
  // The library returns Zod-style `.issues`; normalize defensively.
  if (!verifyResult || typeof verifyResult !== 'object') return [];
  const r = verifyResult as { issues?: Array<{ path?: unknown; message?: unknown }> };
  if (!Array.isArray(r.issues)) return [];
  return r.issues.map((iss) => ({
    path: Array.isArray(iss.path) ? iss.path.join('.') : String(iss.path ?? ''),
    message: String(iss.message ?? 'Schema validation error'),
  }));
}

function extractAuthors(
  verifyResult: unknown,
  network: Network,
): AuthorWitness[] {
  if (!verifyResult || typeof verifyResult !== 'object') return [];
  const r = verifyResult as {
    authors?: Array<{
      name?: string;
      witness?: { publicKey?: string; signatureValid?: boolean };
    }>;
  };
  if (!Array.isArray(r.authors)) return [];
  return r.authors.map((a) => {
    const pubkeyHex = a.witness?.publicKey ?? '';
    const credHashHex = pubkeyHex ? blake2b224Hex(pubkeyHex) : '';
    const sig: AuthorWitness['signature'] =
      a.witness?.signatureValid === true
        ? 'valid'
        : a.witness?.signatureValid === false
          ? 'invalid'
          : 'unverifiable';
    return {
      name: a.name,
      pubkeyHex,
      signature: sig,
      label: lookupAuthorLabel(credHashHex, network),
    };
  });
}

export function validateGovernanceMetadata(
  input: ValidatorInput,
): Omit<ResolvedGovernanceMetadata, 'cip169'> {
  const detected = detectCip(input.document);

  // Run the library's verify pipeline. The exact function may live on the root
  // module or under a per-CIP subpath; we adapt to whatever resolves first.
  const verifyFn = (gov as unknown as {
    verify?: (doc: unknown, opts?: unknown) => unknown;
  }).verify;
  let verifyResult: unknown = undefined;
  try {
    if (typeof verifyFn === 'function') {
      verifyResult = verifyFn(input.document, {
        rawBytes: hexToBytes(input.rawHex),
        anchorHash: input.dataHash,
      });
    }
  } catch (err) {
    // Library throws on hard failures (malformed JSON-LD, etc.). Surface as a single issue.
    return {
      rawHex: input.rawHex,
      document: input.document,
      detectedCip: detected,
      hashOk: input.hashOk,
      computedHash: input.computedHash,
      schemaIssues: [{ path: '', message: err instanceof Error ? err.message : 'Verification threw' }],
      authors: [],
    };
  }

  return {
    rawHex: input.rawHex,
    document: input.document,
    detectedCip: detected,
    hashOk: input.hashOk,
    computedHash: input.computedHash,
    schemaIssues: extractSchemaIssues(verifyResult),
    authors: extractAuthors(verifyResult, input.network),
  };
}
```

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check
npm run lint
git add src/lib/governance-metadata/author-labels.ts src/lib/governance-metadata/validator.ts
git commit -m "feat(governance): add metadata validator wrapper"
```

---

## Task 5: CIP-169 worker handler

**Files:**
- Modify: `src/workers/csl-worker.ts`
- Modify: `src/hooks/use-csl-worker.ts`

The worker already loads CSL. We add one new message type. Library version 0.1.0 has `peerDependencies` on all three CSL builds, so the asmjs build is acceptable.

- [ ] **Step 1: Add the worker handler**

Add near the top of `src/workers/csl-worker.ts`, alongside other imports:

```ts
import * as cip169 from '@amanita-labs/cardano-governance-metadata/cip169';
```

Wire CSL once at worker init (in the same place CSL is currently initialized — the worker already imports `@emurgo/cardano-serialization-lib-asmjs` as `CSL`):

```ts
// One-time setup so cip169.verify can hash the referenced tx with CSL.
const cip169SetCsl = (cip169 as unknown as {
  setCardanoSerializationLib?: (csl: unknown) => void;
}).setCardanoSerializationLib;
if (typeof cip169SetCsl === 'function') {
  cip169SetCsl(CSL);
}
```

In the worker's message handler `switch`, add a new case:

```ts
case 'verify-cip169': {
  try {
    const { metadata, txCbor } = event.data as { metadata: unknown; txCbor: string };
    const verifier = (cip169 as unknown as {
      verifyAgainstTransaction?: (m: unknown, tx: unknown) => unknown;
    }).verifyAgainstTransaction;
    if (typeof verifier !== 'function') {
      self.postMessage({
        type: 'verify-cip169-result',
        id: event.data.id,
        binding: 'error',
        error: 'cip169.verifyAgainstTransaction not available',
      });
      break;
    }
    const tx = CSL.Transaction.from_bytes(Buffer.from(txCbor, 'hex'));
    const result = verifier(metadata, tx) as { ok?: boolean; referencedTxHash?: string };
    self.postMessage({
      type: 'verify-cip169-result',
      id: event.data.id,
      binding: result.ok ? 'ok' : 'mismatch',
      referencedTxHash: result.referencedTxHash,
    });
  } catch (err) {
    self.postMessage({
      type: 'verify-cip169-result',
      id: event.data.id,
      binding: 'error',
      error: err instanceof Error ? err.message : 'CIP-169 verify threw',
    });
  }
  break;
}
```

> **Adjust during execution:** the exact library function name (`verifyAgainstTransaction` vs `verify` vs something else) must be confirmed against `node_modules/@amanita-labs/cardano-governance-metadata/dist/cip169/index.d.ts`. The shape above (post a `verify-cip169-result` with `binding`) is the contract the rest of the code depends on — keep that stable.

- [ ] **Step 2: Expose from `use-csl-worker.ts`**

Add a `verifyCip169(metadata, txHex)` method to the hook, mirroring how `parseTransaction` is exposed. It should:
1. Generate a request id
2. Post `{ type: 'verify-cip169', id, metadata, txCbor: txHex }`
3. Return a `Promise<Cip169Binding>` that resolves on the matching `verify-cip169-result` message
4. Time out after 10s with `{ status: 'error', error: 'verify timed out' }`

Read the existing `parseTransaction` implementation in `src/hooks/use-csl-worker.ts` first and follow the same id-correlation pattern.

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check
npm run lint
git add src/workers/csl-worker.ts src/hooks/use-csl-worker.ts
git commit -m "feat(governance): add CIP-169 transaction binding verification in worker"
```

---

## Task 6: Store slice

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Add slice to `AppState`**

Add the import:

```ts
import type { AnchorKey, GovernanceMetadataState } from '@/lib/governance-metadata/types';
```

Add to the `AppState` interface (alongside `evalCache`):

```ts
governanceMetadata: Record<AnchorKey, GovernanceMetadataState>;

setGovernanceMetadata: (key: AnchorKey, state: GovernanceMetadataState) => void;
clearGovernanceMetadata: () => void;
```

Add to initial state:

```ts
governanceMetadata: {},
```

Add the action implementations near `setEvalCache`:

```ts
setGovernanceMetadata: (key, state) => set((s) => ({
  governanceMetadata: { ...s.governanceMetadata, [key]: state },
})),
clearGovernanceMetadata: () => set({ governanceMetadata: {} }),
```

Update `clearTx` to also reset the slice:

```ts
clearTx: () => set({
  txHex: '',
  parsedTx: null,
  error: null,
  isDetectingNetwork: false,
  networkDetected: false,
  isOnChain: false,
  onChainMeta: null,
  activeTab: 'overview',
  governanceMetadata: {},
}),
```

The `partialize` whitelist (theme/network/blockExplorer) is unchanged, so the slice is correctly **not** persisted.

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add src/lib/store.ts
git commit -m "feat(governance): add per-session metadata cache to store"
```

---

## Task 7: Orchestration hook

**Files:**
- Create: `src/hooks/use-governance-metadata.ts`

Wires fetch → validate → CIP-169 worker call → store update. One hook used by `GovernanceTab` and `AnchorCard`.

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/use-governance-metadata.ts
'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { CollectedAnchor } from '@/lib/governance-metadata/collect-anchors';
import type { ResolvedGovernanceMetadata } from '@/lib/governance-metadata/types';
import { validateGovernanceMetadata } from '@/lib/governance-metadata/validator';
import { useCSLWorker } from '@/hooks/use-csl-worker';

type FetchResponse =
  | {
      success: true;
      rawHex: string;
      document: Record<string, unknown>;
      computedHash: string;
      hashOk: boolean;
    }
  | { success: false; error: string };

export function useGovernanceMetadata() {
  const setGovernanceMetadata = useAppStore((s) => s.setGovernanceMetadata);
  const network = useAppStore((s) => s.network);
  const { verifyCip169 } = useCSLWorker();

  const resolveOne = useCallback(
    async (anchor: CollectedAnchor, txHex: string): Promise<void> => {
      setGovernanceMetadata(anchor.key, { status: 'fetching' });

      let fetched: FetchResponse;
      try {
        const res = await fetch('/api/governance-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: anchor.url, dataHash: anchor.hash }),
        });
        fetched = await res.json();
      } catch (err) {
        setGovernanceMetadata(anchor.key, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Fetch failed',
        });
        return;
      }

      if (!fetched.success) {
        setGovernanceMetadata(anchor.key, { status: 'error', error: fetched.error });
        return;
      }

      const validated = validateGovernanceMetadata({
        rawHex: fetched.rawHex,
        document: fetched.document,
        computedHash: fetched.computedHash,
        dataHash: anchor.hash,
        hashOk: fetched.hashOk,
        network,
      });

      const result: ResolvedGovernanceMetadata = { ...validated };

      // CIP-169: kick off async binding verification.
      if (validated.detectedCip === 'cip-169') {
        result.cip169 = { status: 'verifying' };
        setGovernanceMetadata(anchor.key, { status: 'resolved', result });
        try {
          const binding = await verifyCip169(fetched.document, txHex);
          setGovernanceMetadata(anchor.key, {
            status: 'resolved',
            result: { ...result, cip169: binding },
          });
        } catch (err) {
          setGovernanceMetadata(anchor.key, {
            status: 'resolved',
            result: {
              ...result,
              cip169: {
                status: 'error',
                error: err instanceof Error ? err.message : 'CIP-169 verify failed',
              },
            },
          });
        }
        return;
      }

      setGovernanceMetadata(anchor.key, { status: 'resolved', result });
    },
    [network, setGovernanceMetadata, verifyCip169],
  );

  const resolveAll = useCallback(
    async (anchors: CollectedAnchor[], txHex: string): Promise<void> => {
      // Concurrent-but-bounded: fire all at once. The /api endpoint serializes per request.
      await Promise.all(anchors.map((a) => resolveOne(a, txHex)));
    },
    [resolveOne],
  );

  return { resolveOne, resolveAll };
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
npm run lint
git add src/hooks/use-governance-metadata.ts
git commit -m "feat(governance): add use-governance-metadata orchestration hook"
```

---

## Task 8: SafeMarkdown component

**Files:**
- Create: `src/features/inspector/components/SafeMarkdown.tsx`

Sanitized markdown for governance bodies (rationale, abstract, motivation, DRep bio).

- [ ] **Step 1: Write the component**

```tsx
// src/features/inspector/components/SafeMarkdown.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { cn } from '@/lib/utils';

const schema = {
  ...defaultSchema,
  // Drop raw HTML, inline styles, and event handlers; keep semantic markup.
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
  },
  tagNames: (defaultSchema.tagNames ?? []).filter((t) => t !== 'img'),
};

export function SafeMarkdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ children, href, ...rest }) => (
            <a
              {...rest}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
```

> **Note:** `prose` classes come from `@tailwindcss/typography`, which may not be installed. If `npm run type-check` (or the dev server's CSS pass) complains, fall back to plain text styling:
> ```tsx
> <div className={cn('text-sm whitespace-pre-wrap leading-relaxed', className)}>...
> ```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
npm run lint
git add src/features/inspector/components/SafeMarkdown.tsx
git commit -m "feat(governance): add SafeMarkdown component for sanitized rendering"
```

---

## Task 9: AnchorCard component

**Files:**
- Create: `src/features/inspector/components/AnchorCard.tsx`

Renders one anchor's full state: header (URL/hash + status pill + CIP badge), optional hash-mismatch banner, CIP-specific body, authors list. Uses shadcn primitives that already exist in `src/components/ui/`.

- [ ] **Step 1: Write the component**

```tsx
// src/features/inspector/components/AnchorCard.tsx
'use client';

import { useAppStore } from '@/lib/store';
import { useGovernanceMetadata } from '@/hooks/use-governance-metadata';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SafeMarkdown } from './SafeMarkdown';
import type { CollectedAnchor } from '@/lib/governance-metadata/collect-anchors';
import type {
  AuthorWitness,
  DetectedCip,
  ResolvedGovernanceMetadata,
} from '@/lib/governance-metadata/types';

const cipLabel: Record<DetectedCip, string> = {
  'cip-100': 'CIP-100',
  'cip-108': 'CIP-108',
  'cip-119': 'CIP-119',
  'cip-136': 'CIP-136',
  'cip-169': 'CIP-169',
  unknown: 'Unrecognized schema',
};

function readString(doc: Record<string, unknown>, ...path: string[]): string | undefined {
  let cur: unknown = doc;
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function readBody(doc: Record<string, unknown>): Record<string, unknown> {
  const body = doc.body;
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : doc;
}

function CipBody({ result }: { result: ResolvedGovernanceMetadata }) {
  const body = readBody(result.document);
  switch (result.detectedCip) {
    case 'cip-119': {
      const name = readString(body, 'givenName') ?? readString(body, 'name');
      const bio = readString(body, 'bio') ?? readString(body, 'motivation');
      const objectives = readString(body, 'objectives');
      const qualifications = readString(body, 'qualifications');
      return (
        <div className="space-y-3">
          {name && <h3 className="text-lg font-semibold">{name}</h3>}
          {bio && <SafeMarkdown source={bio} />}
          {objectives && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Objectives</h4>
              <SafeMarkdown source={objectives} />
            </div>
          )}
          {qualifications && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Qualifications</h4>
              <SafeMarkdown source={qualifications} />
            </div>
          )}
        </div>
      );
    }
    case 'cip-108': {
      const title = readString(body, 'title');
      const abstract = readString(body, 'abstract');
      const motivation = readString(body, 'motivation');
      const rationale = readString(body, 'rationale');
      return (
        <div className="space-y-3">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {abstract && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Abstract</h4>
              <SafeMarkdown source={abstract} />
            </div>
          )}
          {motivation && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Motivation</h4>
              <SafeMarkdown source={motivation} />
            </div>
          )}
          {rationale && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Rationale</h4>
              <SafeMarkdown source={rationale} />
            </div>
          )}
        </div>
      );
    }
    case 'cip-136': {
      const rationale = readString(body, 'rationale') ?? readString(body, 'comment');
      return (
        <div className="space-y-3">
          {rationale && <SafeMarkdown source={rationale} />}
        </div>
      );
    }
    default:
      return (
        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
          {JSON.stringify(result.document, null, 2)}
        </pre>
      );
  }
}

function Cip169Section({ result }: { result: ResolvedGovernanceMetadata }) {
  if (result.detectedCip !== 'cip-169') return null;
  const b = result.cip169;
  let body: React.ReactNode;
  if (!b || b.status === 'idle' || b.status === 'verifying') {
    body = <span className="text-muted-foreground">Verifying transaction binding…</span>;
  } else if (b.status === 'ok') {
    body = (
      <span className="text-green-600 dark:text-green-400">
        ✓ Binds to this transaction
      </span>
    );
  } else if (b.status === 'mismatch') {
    body = (
      <span className="text-yellow-600 dark:text-yellow-400">
        ⚠ Binds to a different transaction ({b.referencedTxHash.slice(0, 16)}…)
      </span>
    );
  } else {
    body = <span className="text-red-600 dark:text-red-400">Verify failed: {b.error}</span>;
  }
  return (
    <div className="border-t pt-3 mt-3">
      <h4 className="text-sm font-medium mb-1">Transaction binding</h4>
      <div className="text-sm">{body}</div>
    </div>
  );
}

function AuthorsList({ authors }: { authors: AuthorWitness[] }) {
  if (authors.length === 0) return null;
  const validCount = authors.filter((a) => a.signature === 'valid').length;
  return (
    <div className="border-t pt-3 mt-3">
      <h4 className="text-sm font-medium mb-2">
        Authors — {validCount} of {authors.length} signatures valid
      </h4>
      <ul className="space-y-1">
        {authors.map((a, i) => (
          <li key={`${a.pubkeyHex}-${i}`} className="text-sm flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">
              {a.pubkeyHex.slice(0, 16)}…
            </span>
            {a.signature === 'valid' && (
              <Badge variant="secondary" className="text-green-700 dark:text-green-400">
                ✓ valid
              </Badge>
            )}
            {a.signature === 'invalid' && (
              <Badge variant="destructive">✗ invalid</Badge>
            )}
            {a.signature === 'unverifiable' && (
              <Badge variant="outline">not verifiable</Badge>
            )}
            {a.label && (
              <Badge variant="outline" title={a.label.description}>
                {a.label.name}
              </Badge>
            )}
            {a.name && <span className="text-muted-foreground">— {a.name}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnchorCard({ anchor, txHex }: { anchor: CollectedAnchor; txHex: string }) {
  const state = useAppStore((s) => s.governanceMetadata[anchor.key]) ?? { status: 'idle' as const };
  const { resolveOne } = useGovernanceMetadata();

  const renderHeader = () => (
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-medium break-all">
            {anchor.url}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
            hash: {anchor.hash}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {state.status === 'idle' && (
            <>
              <Badge variant="outline">Not resolved</Badge>
              <Button size="sm" onClick={() => resolveOne(anchor, txHex)}>
                Resolve
              </Button>
            </>
          )}
          {state.status === 'fetching' && <Badge variant="outline">Fetching…</Badge>}
          {state.status === 'error' && (
            <>
              <Badge variant="destructive">Failed</Badge>
              <Button size="sm" variant="outline" onClick={() => resolveOne(anchor, txHex)}>
                Retry
              </Button>
            </>
          )}
          {state.status === 'resolved' && (
            <>
              <Badge
                variant={state.result.hashOk ? 'secondary' : 'outline'}
                className={
                  state.result.hashOk
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-yellow-700 dark:text-yellow-400'
                }
              >
                {state.result.hashOk ? '✓ Hash match' : '⚠ Hash mismatch'}
              </Badge>
              <Badge variant="outline">{cipLabel[state.result.detectedCip]}</Badge>
            </>
          )}
        </div>
      </div>
    </CardHeader>
  );

  return (
    <Card>
      {renderHeader()}
      <CardContent>
        {state.status === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        {state.status === 'resolved' && (
          <>
            {!state.result.hashOk && (
              <Alert variant="default" className="mb-3 border-yellow-500/50">
                <AlertTitle>Hash mismatch</AlertTitle>
                <AlertDescription>
                  This content does not match the hash anchored on-chain. The host may have
                  changed it after submission.
                </AlertDescription>
              </Alert>
            )}
            {state.result.schemaIssues.length > 0 && (
              <Alert variant="default" className="mb-3 border-yellow-500/50">
                <AlertTitle>Schema issues ({state.result.schemaIssues.length})</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-xs">
                    {state.result.schemaIssues.slice(0, 5).map((iss, i) => (
                      <li key={i}>
                        {iss.path && <code>{iss.path}: </code>}
                        {iss.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <CipBody result={state.result} />
            <Cip169Section result={state.result} />
            <AuthorsList authors={state.result.authors} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
npm run lint
git add src/features/inspector/components/AnchorCard.tsx
git commit -m "feat(governance): add AnchorCard component"
```

---

## Task 10: GovernanceTab

**Files:**
- Create: `src/features/inspector/tabs/GovernanceTab.tsx`

Aggregates all anchors in the tx, groups them by source, renders an `AnchorCard` for each, and shows a "Resolve all" button + a static-export banner when applicable.

- [ ] **Step 1: Write the tab**

```tsx
// src/features/inspector/tabs/GovernanceTab.tsx
'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnchorCard } from '../components/AnchorCard';
import { collectAllAnchors, type AnchorSource, type CollectedAnchor } from '@/lib/governance-metadata/collect-anchors';
import { useGovernanceMetadata } from '@/hooks/use-governance-metadata';
import type { DomainTx } from '@/domain/tx';

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

const GROUP_LABELS: Record<AnchorSource['kind'], string> = {
  'proposal': 'Governance actions',
  'drep-vote': 'DRep votes',
  'committee-vote': 'Committee votes',
  'drep-registration': 'DRep registrations',
  'drep-update': 'DRep updates',
};

const GROUP_ORDER: AnchorSource['kind'][] = [
  'proposal',
  'drep-vote',
  'committee-vote',
  'drep-registration',
  'drep-update',
];

function groupAnchors(anchors: CollectedAnchor[]): Array<[AnchorSource['kind'], CollectedAnchor[]]> {
  const groups = new Map<AnchorSource['kind'], CollectedAnchor[]>();
  for (const a of anchors) {
    const list = groups.get(a.source.kind) ?? [];
    list.push(a);
    groups.set(a.source.kind, list);
  }
  return GROUP_ORDER.filter((k) => groups.has(k)).map((k) => [k, groups.get(k)!]);
}

export function GovernanceTab({ tx, txHex }: { tx: DomainTx; txHex: string }) {
  const anchors = useMemo(() => collectAllAnchors(tx), [tx]);
  const grouped = useMemo(() => groupAnchors(anchors), [anchors]);
  const { resolveAll } = useGovernanceMetadata();

  if (anchors.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        This transaction does not contain any governance anchors.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {isStaticExport && (
        <Alert variant="default" className="border-yellow-500/50">
          <AlertTitle>Metadata resolution unavailable</AlertTitle>
          <AlertDescription>
            Anchors are listed below, but fetching their JSON-LD bodies requires the
            dynamic build. Run <code>npm run dev</code> or deploy to a server to enable
            resolution.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {anchors.length} anchor{anchors.length === 1 ? '' : 's'} in this transaction
        </p>
        <Button
          size="sm"
          onClick={() => resolveAll(anchors, txHex)}
          disabled={isStaticExport}
        >
          Resolve all
        </Button>
      </div>
      {grouped.map(([kind, list]) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {GROUP_LABELS[kind]} ({list.length})
          </h2>
          <div className="space-y-2">
            {list.map((a) => (
              <AnchorCard key={a.key + a.source.kind} anchor={a} txHex={txHex} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

> **`isStaticExport` note:** `STATIC_EXPORT=true` is currently a build-time flag in `next.config.ts`. To make it visible to client code we need `NEXT_PUBLIC_STATIC_EXPORT=true` set alongside it in the same build. If the project doesn't already do that, add a one-liner: in the relevant build script set `NEXT_PUBLIC_STATIC_EXPORT=$STATIC_EXPORT`. Don't ship without checking; if the static-export build matters today, verify the flag plumbs through during execution.

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
npm run lint
git add src/features/inspector/tabs/GovernanceTab.tsx
git commit -m "feat(governance): add Governance tab"
```

---

## Task 11: Register the tab in `InspectorTabs`

**Files:**
- Modify: `src/features/inspector/InspectorTabs.tsx`

The current `TabsList` uses `grid-cols-7`. We add an 8th tab when the tx has anchors.

- [ ] **Step 1: Wire it in**

Replace the existing `InspectorTabs` body. Key changes:
1. Import `GovernanceTab` and `txHasGovernanceAnchors`
2. Compute `showGovernance = txHasGovernanceAnchors(tx)`
3. Use `grid-cols-8` when `showGovernance` is true; keep `grid-cols-7` otherwise
4. Conditionally render the trigger and content

```tsx
// src/features/inspector/InspectorTabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DomainTx } from '@/domain/tx';
import { OverviewTab } from './tabs/OverviewTab';
import { IoValueTab } from './tabs/IoValueTab';
import { MetadataTab } from './tabs/MetadataTab';
import { RawTab } from './tabs/RawTab';
import { ScriptsTab } from './tabs/ScriptsTab';
import { SearchTab } from './tabs/SearchTab';
import { ContentsTab } from './tabs/ContentsTab';
import { GovernanceTab } from './tabs/GovernanceTab';
import { useAppStore } from '@/lib/store';
import { txHasGovernanceAnchors } from '@/lib/governance-metadata/collect-anchors';
import { cn } from '@/lib/utils';

interface InspectorTabsProps {
  tx: DomainTx;
  txHex: string;
}

export function InspectorTabs({ tx, txHex }: InspectorTabsProps) {
  const isOnChain = useAppStore((s) => s.isOnChain);
  const showGovernance = txHasGovernanceAnchors(tx);

  return (
    <div className="h-full">
      <Tabs defaultValue="overview" className="h-full flex flex-col">
        <TabsList className={cn('grid w-full', showGovernance ? 'grid-cols-8' : 'grid-cols-7')}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="io-value">I/O & Value</TabsTrigger>
          <TabsTrigger value="contents">Contents</TabsTrigger>
          {showGovernance && <TabsTrigger value="governance">Governance</TabsTrigger>}
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="cbor">Raw</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full">
            <OverviewTab tx={tx} />
          </TabsContent>
          <TabsContent value="io-value" className="h-full">
            <IoValueTab tx={tx} />
          </TabsContent>
          <TabsContent value="contents" className="h-full">
            <ContentsTab tx={tx} />
          </TabsContent>
          {showGovernance && (
            <TabsContent value="governance" className="h-full">
              <GovernanceTab tx={tx} txHex={txHex} />
            </TabsContent>
          )}
          <TabsContent value="metadata" className="h-full">
            <MetadataTab tx={tx} />
          </TabsContent>
          <TabsContent value="scripts" className="h-full">
            <ScriptsTab tx={tx} txHex={txHex} isOnChain={isOnChain} />
          </TabsContent>
          <TabsContent value="cbor" className="h-full">
            <RawTab tx={tx} txHex={txHex} />
          </TabsContent>
          <TabsContent value="search" className="h-full">
            <SearchTab tx={tx} txHex={txHex} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
npm run lint
git add src/features/inspector/InspectorTabs.tsx
git commit -m "feat(governance): register Governance tab in inspector"
```

---

## Task 12: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run static checks**

```bash
npm run type-check && npm run lint && npm run build
```

Expected: all pass. The `build` is included because Next.js does its own type-pass per page; this catches API-route or RSC issues type-check alone might miss.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Smoke test against real transactions**

Walk the cases from the design's Verification section. For each, paste the tx hex (or use a known mainnet/Sanchonet hash) into the input panel; the Governance tab should appear if and only if the tx has at least one anchor.

1. **DRep registration with CIP-119 anchor** — Open Governance tab, click "Resolve all". The DRep card resolves with name, bio, references; hash badge green; author signature `valid ✓`; if the DRep is in `known-labels.json`, label appears.
2. **Governance action proposal with CIP-108 anchor** — title, abstract, motivation, rationale render as markdown.
3. **DRep vote with CIP-136 anchor** — rationale renders.
4. **Hash mismatch** — yellow warning banner appears above the body; body still renders.
5. **CIP-169 binding match** — after the document resolves, a binding badge `binds to this transaction ✓` appears.
6. **CIP-169 binding mismatch** — `binds to a different tx ⚠`.
7. **IPFS anchor** — `ipfs://` URLs resolve through the route.
8. **Unreachable URL** — red `Failed` pill with helpful error; "Retry" button works.
9. **Tx with no anchors** — Governance tab is not rendered; `grid-cols-7` is used.
10. **Static export** — `STATIC_EXPORT=true npm run build && npx serve out`. Tab still lists anchors with the unavailable banner; "Resolve all" is disabled.

- [ ] **Step 4: Final commit (if any cleanup needed)**

```bash
git status
# if any small fixes from manual testing:
# git add ... && git commit -m "fix(governance): <issue>"
```

---

## Library API caveats

The plan was written against the library's README + `npm view` metadata. The exact function names and result shapes (`detectCipStandard`, `verify`, `verifyAgainstTransaction`, the `.issues` and `.authors` shape) need confirmation against the actual `dist/index.d.ts` files at execution time. The task code uses defensive `(gov as unknown as { ... }).fn?.()` patterns so naming drift surfaces as runtime issues rather than type errors.

If a function name differs:

1. Check `node_modules/@amanita-labs/cardano-governance-metadata/dist/index.d.ts` and the per-CIP `dist/cip*/index.d.ts` files.
2. Update the wrapper to the real names.
3. Keep the **public contract** of `validateGovernanceMetadata` (input/output) and the worker `verify-cip169` message stable — those are what the rest of the code depends on.

---

## Self-review

**Spec coverage** — all approved decisions covered:
- All five CIPs ✓ (Tasks 4, 5, 9)
- New Governance tab ✓ (Tasks 10, 11)
- Server-side fetch ✓ (Task 3)
- Hash mismatch warn + render ✓ (Task 9)
- Per-author signature display + label match ✓ (Tasks 4, 9)
- CIP-169 full binding verification ✓ (Tasks 5, 7, 9)
- Per-session Zustand cache ✓ (Task 6)
- Sanitized markdown ✓ (Task 8)
- Library defaults for IPFS/Arweave ✓ (Task 3)
- Static export banner ✓ (Task 10)

**Placeholder scan** — none. Every step has concrete code or a concrete command.

**Type consistency** — `AnchorKey`, `CollectedAnchor.key`, `GovernanceMetadataState`, `ResolvedGovernanceMetadata`, `Cip169Binding` shapes are consistent across Tasks 1, 2, 6, 7, 9.

**Scope check** — this is one feature, one plan. The deferred items (`MetadataValidator`, persistent caching) are noted in the file map, not slipped into tasks.
