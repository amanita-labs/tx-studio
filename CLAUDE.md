# TX-Studio

Cardano transaction inspector built with Next.js 16, React 19, and Tailwind CSS v4. Parses raw CBOR-encoded transaction hex and renders an interactive multi-tab inspector. Optionally fetches on-chain data via Blockfrost API routes.

The builder page (`/build`) is a stub — not yet implemented.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run type-check   # tsc --noEmit
npm run lint         # ESLint
```

No test suite exists yet (`npm test` is a no-op).

## Architecture

**Data flow:** hex input → CSL web worker → `TxParseResult` → Zustand store → inspector tabs

1. User pastes hex or fetches a tx hash via Blockfrost
2. `use-csl-worker` hook posts hex to `/src/workers/csl-worker.ts` (runs `@emurgo/cardano-serialization-lib-asmjs` off the main thread)
3. Worker returns a `DomainTx` (or error) wrapped in `TxParseResult`
4. Result is stored in `useAppStore` (Zustand, `/src/lib/store.ts`)
5. Inspector tabs read from the store and render

**Server-side:** Next.js API routes under `src/app/api/blockfrost/` proxy Blockfrost calls, keeping API keys server-only. When `STATIC_EXPORT=true`, these routes are unavailable (GitHub Pages deployment).

## Directory Structure

```
src/
├── app/                   Next.js app router — pages + API routes
│   ├── api/blockfrost/    Server-side Blockfrost proxy (transactions, protocol-params, evaluate, detect-network)
│   ├── [txHash]/          Dynamic route for deep-linked tx hashes
│   └── build/             Builder page (stub)
├── components/            Reusable components
│   └── ui/                shadcn/ui primitives (Radix + Tailwind)
├── features/inspector/    Main inspector feature
│   ├── TxInspector.tsx    Root inspector component
│   └── tabs/              OverviewTab, IoValueTab, ScriptsTab, MetadataTab,
│                          ValidationTab, ContentsTab, RawTab, ComparisonTab
├── hooks/                 React hooks (use-csl-worker, use-blockfrost, use-script-eval, etc.)
├── lib/                   Core logic
│   ├── store.ts           Zustand store (useAppStore)
│   ├── types/             TypeScript types (blockfrost, protocol-params, script-eval, block-explorer)
│   ├── blockfrost/        Blockfrost client, config, cache, multi-network search
│   ├── utils/             ada.ts, hex.ts, asset-fingerprint.ts, slot-time.ts, tx-hash.ts
│   ├── cbor-annotator.ts  CBOR structure annotation
│   ├── transaction-validator.ts
│   ├── script-analyzer.ts
│   ├── metadata-parser.ts
│   ├── transaction-diff.ts
│   └── labels.ts          Known address/script label registry
├── domain/
│   └── tx.ts              DomainTx, CertificateVM, GovernanceVM, Network, TxParseResult
├── data/
│   └── known-labels.json  Static label data
└── workers/
    └── csl-worker.ts      Web worker — CSL parsing (~2300 lines)
```

## Key Types (`src/domain/tx.ts`)

- **`DomainTx`** — Normalized transaction model. All monetary values are `bigint` (lovelace). Contains inputs, outputs, mint, certs, withdrawals, governance, metadata, scripts, redeemers, witnesses, signers, collateral, reference inputs, and warnings.
- **`CertificateVM`** — Discriminated union over `type` field. Covers Shelley-era stake operations through Conway-era governance certs (DRep registration, votes, proposals, committee auth).
- **`GovernanceVM`** — Conway governance data: constitution, committee, DRep votes, committee votes, proposals.
- **`TxParseResult`** — Discriminated union: `{ success: true; tx: DomainTx }` | `{ success: false; error: string }`.
- **`Network`** — `"mainnet" | "preprod" | "preview"`.

API response types in `src/lib/types/` follow the same discriminated-union pattern for success/error.

## Conventions

- **Component library:** shadcn/ui (New York style, Radix UI + Tailwind). Primitives live in `src/components/ui/`. Add new ones via `npx shadcn@latest add <component>`.
- **Imports:** `@/` alias maps to `src/`. Always use `@/` for project imports.
- **State:** Single Zustand store (`useAppStore`). Only `theme`, `network`, and `blockExplorer` are persisted to localStorage. Transient state (parsed tx, loading, errors) resets on reload.
- **Client components:** Most feature/UI components use `'use client'`. API routes use `export const dynamic = 'force-dynamic'`.
- **Singleton analyzers:** `TransactionValidator`, `ScriptAnalyzer`, `CBORAnnotator` are instantiated as classes, not hooks.
- **Styling:** Tailwind v4 with CSS variables for theming (`globals.css`). Use `cn()` from `@/lib/utils` for conditional classes.
- **Icons:** `lucide-react`.
- **Toasts:** `sonner`.
- **BigInt:** Monetary values are always `bigint`. Use `formatAda()` / `formatLovelace()` from `@/lib/utils/ada` for display. Use `safeStringify()` from `@/lib/utils` when serializing objects that may contain BigInt.

## Cardano Domain Primer

- **CBOR:** Concise Binary Object Representation — Cardano transactions are CBOR-encoded. The app accepts raw CBOR hex as input.
- **UTXOs:** Unspent Transaction Outputs — Cardano uses the UTXO model. Transactions consume inputs and produce outputs.
- **Lovelace:** 1 ADA = 1,000,000 lovelace. All internal values use lovelace as `bigint`.
- **Policy ID + Asset Name:** Native tokens are identified by a 28-byte policy ID (minting script hash) + an asset name. Together they form an asset fingerprint (CIP-14).
- **Plutus:** Smart contract scripts (V1/V2/V3). Redeemers provide input data; execution is metered in memory + CPU units (ExUnits).
- **Conway governance:** CIP-1694 era. DReps, constitutional committee, proposals, voting. The `GovernanceVM` type models this.
- **Bech32:** Human-readable encoding for addresses and credentials (`addr1...`, `drep1...`, `stake1...`).
- **CIP-10/CIP-25/CIP-68:** Metadata label standards. CIP-25 = NFT metadata (label 721). CIP-68 = rich fungible tokens. CIP-10 = label registry.

## Current Limitations

- No test suite
- Builder page is a non-functional stub
- Static export (`STATIC_EXPORT=true`) disables all API routes — Blockfrost features require a server
- CSL worker is a single large file (~2300 lines) that could benefit from splitting
