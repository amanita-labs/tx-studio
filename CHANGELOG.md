# Changelog

All notable changes to TX-Studio are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-10

First tagged release. Cardano transaction inspector that parses raw CBOR hex and
renders an interactive multi-tab view, with optional on-chain enrichment via
Blockfrost.

### Added

- **Transaction inspector** — paste raw CBOR hex (or deep-link a tx hash) and
  parse it off the main thread via a CSL web worker into a normalized domain
  model.
- **Inspector tabs** — overview/summary, inputs & outputs with value breakdowns,
  scripts, metadata, validation, raw CBOR, and transaction comparison.
- **Conway governance** — render and validate governance actions, including
  anchor metadata resolution/validation and guardrails script hash display.
- **Plutus support** — datum and redeemer decoding, UPLC links, and script
  analysis.
- **Blockfrost integration** — server-side proxy routes fetch transactions and
  protocol params, with caching and multi-network search.
- **Known-label registry** — annotate recognized addresses and script hashes.
- Shareable links and Cquisitor inspection hand-off.
- Builder page scaffolding (work in progress).

### Notes

- Production deploys continuously to Render on pushes to `main`.
- Static export (`STATIC_EXPORT=true`) disables API routes, so Blockfrost
  features are unavailable in that mode.

[0.2.0]: https://github.com/amanita-labs/tx-studio/releases/tag/v0.2.0
