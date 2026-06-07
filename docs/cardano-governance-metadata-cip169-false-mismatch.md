# Bug report: `cip169.verifyAgainstTx` reports false mismatches for `parameter_change_action`

> **RESOLVED in `0.1.2`.** The fixes below were verified: `encodeProtocolParamUpdate` now maps CSL field
> names to CIP‑116 names (`PPU_CSL_TO_CIP116`) and strips `null`/`undefined` fields, and `diff` uses
> `numericEqual` for numeric‑string vs number. This document is retained as a record of the issue.

**Package:** `@amanita-labs/cardano-governance-metadata`
**Version:** `0.1.1` (fixed in `0.1.2`)
**Component:** `cip169` — `verifyAgainstTx` / `compareOnChain` / `decodeConwayTx`
**Severity:** High — produced false-negative bindings (reported "does not match") for essentially every CIP‑169 `parameter_change_action` binding.
**Status of prior issues:** The two `0.1.0` bugs are confirmed **fixed** in `0.1.1` (signature verification now uses `verifyAsync`; `parameter_change_action` now decodes via `protocol_param_updates()`). This report was a **third** issue exposed once the comparison actually ran.

---

## Summary

`verifyAgainstTx` decodes the on‑chain governance action with CSL's `ProtocolParamUpdate.to_json()` and diffs it against the metadata document's `body.onChain`. The two sides used **different field‑naming conventions and different sparsity rules**, so a faithful, correct binding was reported as a mismatch with dozens of spurious differences.

For a real parameter‑change proposal whose metadata binding is correct, `verifyAgainstTx` returned:

```
matched: false
differences.length: 34
```

…of which **0** were genuine.

---

## Reproduction

```js
import * as cip169 from '@amanita-labs/cardano-governance-metadata/cip169';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';

cip169.setCardanoSerializationLib(CSL);

// Metadata document: ipfs://bafkreidbxerdwxxntmmr6qvjvquyla3qbwhk3flfqjbm3d5lj2ubxfk3aq
// (CIP-108 governance-action rationale with a CIP-169 body.onChain extension)
const doc = await (await fetch('https://ipfs.io/ipfs/bafkreidbxerdwxxntmmr6qvjvquyla3qbwhk3flfqjbm3d5lj2ubxfk3aq')).json();

const txCbor = '<see appendix>'; // a real mainnet parameter_change proposal tx

const res = await cip169.verifyAgainstTx(doc, txCbor);
console.log(res.data.matched, res.data.differences.length); // 0.1.1: false 34 — 0.1.2: true 0
```

### The two sides being compared

**Metadata** — `doc.body.onChain.gov_action.protocol_param_update`:

```json
{ "committee_min_size": "5" }
```

**Decoded action** — `cslToJson(action.protocol_param_updates())`:

```json
{
  "minfee_a": null, "minfee_b": null, "max_block_body_size": null, "max_tx_size": null,
  "max_block_header_size": null, "key_deposit": null, "pool_deposit": null, "max_epoch": null,
  "n_opt": null, "pool_pledge_influence": null, "expansion_rate": null, "treasury_growth_rate": null,
  "d": null, "extra_entropy": null, "protocol_version": null, "min_pool_cost": null,
  "ada_per_utxo_byte": null, "cost_models": null, "execution_costs": null, "max_tx_ex_units": null,
  "max_block_ex_units": null, "max_value_size": null, "collateral_percentage": null,
  "max_collateral_inputs": null, "pool_voting_thresholds": null, "drep_voting_thresholds": null,
  "min_committee_size": 5, "committee_term_limit": null, "governance_action_validity_period": null,
  "governance_action_deposit": null, "drep_deposit": null, "drep_inactivity_period": null,
  "ref_script_coins_per_byte": null
}
```

Both describe the **same** change (set the committee minimum size to 5). The binding is correct.

### Difference breakdown (all 34 were artifacts)

| Class | Count | Example |
|------|------:|---------|
| Field absent in metadata vs `null` in action | **32** | `minfee_a`: (absent) vs `null` |
| Canonical name in metadata, absent in action | **1** | `committee_min_size`: `"5"` vs (absent) |
| CSL name in action, absent in metadata | **1** | `min_committee_size`: (absent) vs `5` |
| **Genuine differences** | **0** | — |

---

## Root cause

Three independent normalization gaps in `dist/cip169/index.js`, all in the compare path used by `verifyAgainstTx → compareOnChain → diff`:

### 1. Field‑name divergence (the headline)

`decodeConwayTx` serialized the action via `cslToJson(a.protocol_param_updates())` (`JSON.parse(value.to_json())`). CSL's `ProtocolParamUpdate.to_json()` uses **CSL's** field names (e.g. `min_committee_size`, `committee_term_limit`), while CIP‑100/CDDL metadata documents use the **CDDL/CIP** names (e.g. `committee_min_size`, `committee_max_term_length`). The comparison never mapped between the two vocabularies, so matching parameters landed under different keys and diffed against "absent" on the other side.

### 2. `diff` treated absent (`undefined`) vs `null` as different

CSL's `to_json()` emits the **full** `ProtocolParamUpdate` struct with `null` for every unset field; metadata documents include **only** the fields being changed. `diff(undefined, null)` was flagged, producing the 32 spurious diffs.

### 3. `normalizeNumericFields` whitelist was too narrow

`NUMERIC_FIELD_NAMES = new Set(["gov_action_index"])` — numeric protocol‑param values appear as JSON **strings** in metadata (`"5"`) but as **numbers** after CSL decode (`5`). Only `gov_action_index` was coerced, so even once #1 and #2 were resolved, `"5"` vs `5` would still diff. This was masked by #1.

---

## Fix shipped in 0.1.2

- `PPU_CSL_TO_CIP116` rename map (CSL → CIP‑116 names): `min_committee_size→committee_min_size`, `committee_term_limit→committee_max_term_length`, `governance_action_validity_period→gov_action_lifetime`, `governance_action_deposit→gov_action_deposit`, `drep_inactivity_period→drep_activity`, `ref_script_coins_per_byte→min_fee_ref_script_cost_per_byte`.
- `encodeProtocolParamUpdate` drops `null`/`undefined` fields before comparison.
- `numericEqual(a, b)` in `diff` treats a numeric string and a number as equal when `Number(str) === num`.

A regression test using the appendix transaction + document should expect `matched: true`.

---

## Environment

- `@amanita-labs/cardano-governance-metadata@0.1.1` (repro) / `0.1.2` (fixed)
- `@emurgo/cardano-serialization-lib-nodejs` (repro) / `-browser` (app) — the bug was CSL‑build‑independent; `to_json()` naming is identical across builds.
- Node 21 / Next.js 16 (tx-studio).

## Appendix — transaction CBOR (hex)

Parameter‑change proposal: "Reduce the committeeMinSize parameter from 7 to 5".

```
84a800d901028282582017e43ffe4b2e0df1787d54f21ac66643c74abb131a326272fceecbdbbdd0d3fc008258201a6b426a86dd6701f895c7b3db251d50c004f7f3e29998821c4fd50c959bffa4000dd901028182582017e43ffe4b2e0df1787d54f21ac66643c74abb131a326272fceecbdbbdd0d3fc00018182583901076ad93c90e7dafc2ad468212fb2e2701559d1d32f25ebdc1facdada611943783e94de22f533778841521e97f77588fe05447f464be192c91a002dcb141082583901076ad93c90e7dafc2ad468212fb2e2701559d1d32f25ebdc1facdada611943783e94de22f533778841521e97f77588fe05447f464be192c91a002b3f30111a0007a3ab021a000517c70b582029e4275d87625bd995adbebe6e052fa86f7c02a15ecb901c3d66a6768a6b5c4c14d9010281841b000000174876e800581de1192688a334130db2b51aedea594301010b0d1d2e9a86a460932520ba8400825820c82f3834898e4d70d3605fa0d92ffe31345701075b107a54309c1525f9581f6200a1181b05581cfa24fb305126805cf2164c161d852a0e7330cf988f1fe558cf7d4a64827842697066733a2f2f6261666b7265696462786572647778786e746d6d723671766a767175796c6133716277686b33666c66716a626d3364356c6a32756278666b33617158208c7c510c1c959d5c587de268350ce9275af45a05f5774c15fd424b924e18e749a300d9010281825820b34db9badbd148ffdcc73259bad2bc5981a382e657a2b27c2bc014fc163871195840f47245e0fb635fa12a82e34659ae6a24580fe0738891ed318860d5b440e3ce28d95bb3da47443734690c34997e4224ff6a82b872f46b2d7c9f07dd4e33726f0607d90102815908545908510101003232323232323232323232323232323232323232323232323232323232323232323232323232323232259323255333573466e1d20000011180098111bab357426ae88d55cf00104554ccd5cd19b87480100044600422c6aae74004dd51aba1357446ae88d55cf1baa3255333573466e1d200a35573a002226ae84d5d11aab9e00111637546ae84d5d11aba235573c6ea800642b26006003149a2c8a4c301f801c0052000c00e0070018016006901e4070c00e003000c00d20d00fc000c0003003800a4005801c00e003002c00d20c09a0c80e1801c006001801a4101b5881380018000600700148013003801c006005801a410100078001801c006001801a4101001f8001800060070014801b0038018096007001800600690404002600060001801c0052008c00e006025801c006001801a41209d8001800060070014802b003801c006005801a410112f501c3003800c00300348202b7881300030000c00e00290066007003800c00b003482032ad7b806038403060070014803b00380180960003003800a4005801c00e003002c00d20f40380e1801c006001801a41403f800100a0c00e0029009600f0030078040c00e002900a600f003800c00b003301a483403e01a600700180060066034904801e00060001801c0052016c01e00600f801c006001801980c2402900e30000c00e002901060070030128060c00e00290116007003800c00b003483c0ba03860070018006006906432e00040283003800a40498003003800a404d802c00e00f003800c00b003301a480cb0003003800c003003301a4802b00030001801c01e0070018016006603490605c0160006007001800600660349048276000600030000c00e0029014600b003801c00c04b003800c00300348203a2489b00030001801c00e006025801c006001801a4101b11dc2df80018000c0003003800a4055802c00e007003012c00e003000c00d2080b8b872c000c0006007003801809600700180060069040607e4155016000600030000c00e00290166007003012c00e003000c00d2080c001c000c0003003800a405d801c00e003002c00d20c80180e1801c006001801a412007800100a0c00e00290186007003013c0006007001480cb005801801e006003801800e00600500403003800a4069802c00c00f003001c00c007003803c00e003002c00c05300333023480692028c0004014c00c00b003003c00c00f003003c00e00f003800c00b00301480590052008003003800a406d801c00e003002c00d2000c00d2006c00060070018006006900a600060001801c0052038c00e007001801600690006006901260003003800c003003483281300020141801c005203ac00e006027801c006001801a403d800180006007001480f3003801804e00700180060069040404af3c4e302600060001801c005203ec00e006013801c006001801a4101416f0fd20b80018000600700148103003801c006005801a403501c3003800c0030034812b00030000c00e0029021600f003800c00a01ac00e003000c00ccc08d20d00f4800b00030000c0000000000803c00c016008401e006009801c006001801807e0060298000c000401e006007801c0060018018074020c000400e00f003800c00b003010c000802180020070018006006019801805e0003000400600580180760060138000800c00b00330134805200c400e00300080330004006005801a4001801a410112f58000801c00600901260008019806a40118002007001800600690404a75ee01e00060008018046000801801e000300c4832004c025201430094800a0030028052003002c00d2002c000300648010c0092002300748028c0312000300b48018c0292012300948008c0212066801a40018000c0192008300a2233335573e00250002801994004d55ce800cd55cf0008d5d08014c00cd5d10011263009222532900389800a4d2219002912c80344c01526910c80148964cc04cdd68010034564cc03801400626601800e0071801226601800e01518010096400a3000910c008600444002600244004a664600200244246466004460044460040064600444600200646a660080080066a00600224446600644b20051800484ccc02600244666ae68cdc3801000c00200500a91199ab9a33710004003000801488ccd5cd19b89002001800400a44666ae68cdc4801000c00a00122333573466e20008006005000912a999ab9a3371200400222002220052255333573466e2400800444008440040026eb400a42660080026eb000a4264666015001229002914801c8954ccd5cd19b8700400211333573466e1c00c006001002118011229002914801c88cc044cdc100200099b82002003245200522900391199ab9a3371066e08010004cdc1001001c002004403245200522900391199ab9a3371266e08010004cdc1001001c00a00048a400a45200722333573466e20cdc100200099b820020038014000912c99807001000c40062004912c99807001000c400a2002001199919ab9a357466ae880048cc028dd69aba1003375a6ae84008d5d1000934000dd60010a40064666ae68d5d1800c0020052225933006003357420031330050023574400318010600a444aa666ae68cdc3a400000222c22aa666ae68cdc4000a4000226600666e05200000233702900000088994004cdc2001800ccdc20010008cc010008004c01088954ccd5cd19b87480000044400844cc00c004cdc300100091119803112c800c60012219002911919806912c800c4c02401a442b26600a004019130040018c008002590028c804c8888888800d1900991111111002a244b267201722222222008001000c600518000001112a999ab9a3370e004002230001155333573466e240080044600823002229002914801c88ccd5cd19b893370400800266e0800800e00100208c8c0040048c0088cc00800800505a182050082a0821a0008d2b31a0758a283f5f6
```
