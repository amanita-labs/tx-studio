// Standalone probe: parse the failing transaction with CSL directly to find
// which step throws. Run with: node scripts/probe-tx.mjs
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';

const HEX = process.argv[2] || process.env.TX_HEX;
if (!HEX) {
  console.error('Usage: node scripts/probe-tx.mjs <hex>  (or set TX_HEX)');
  process.exit(1);
}

function step(label, fn) {
  try {
    const t0 = Date.now();
    const result = fn();
    console.log(`  OK  ${label} (${Date.now() - t0}ms)`);
    return result;
  } catch (e) {
    console.log(`  FAIL ${label}`);
    console.log('       thrown value:', e);
    console.log('       typeof:', typeof e);
    console.log('       isError:', e instanceof Error);
    if (e && e.stack) console.log('       stack:', e.stack.split('\n').slice(0, 4).join('\n              '));
    throw e;
  }
}

console.log(`hex length: ${HEX.length} chars (${HEX.length / 2} bytes)`);
console.log('---');

const tx = step('Transaction.from_hex', () => CSL.Transaction.from_hex(HEX));
const body = step('tx.body()', () => tx.body());
const witnessSet = step('tx.witness_set()', () => tx.witness_set());
step('tx.auxiliary_data()', () => tx.auxiliary_data());
step('CSL.FixedTransaction.from_hex (for hash)', () => CSL.FixedTransaction.from_hex(HEX));

step('body.fee()', () => body.fee());
step('body.inputs()', () => body.inputs());
const outputs = step('body.outputs()', () => body.outputs());
step('body.ttl()', () => body.ttl());
step('body.certs()', () => body.certs());
step('body.withdrawals()', () => body.withdrawals());
step('body.update()', () => body.update());
step('body.auxiliary_data_hash()', () => body.auxiliary_data_hash());
step('body.validity_start_interval()', () => body.validity_start_interval());
step('body.mint()', () => body.mint());
step('body.script_data_hash()', () => body.script_data_hash());
step('body.collateral()', () => body.collateral());
step('body.required_signers()', () => body.required_signers());
step('body.network_id()', () => body.network_id());
step('body.collateral_return()', () => body.collateral_return());
step('body.total_collateral()', () => body.total_collateral());
step('body.reference_inputs()', () => body.reference_inputs());
step('body.voting_procedures()', () => body.voting_procedures());
step('body.voting_proposals()', () => body.voting_proposals());
step('body.donation()', () => body.donation());
step('body.current_treasury_value()', () => body.current_treasury_value());

console.log('---');
console.log('walking outputs:');
const outLen = outputs.len();
for (let i = 0; i < outLen; i++) {
  console.log(`  output[${i}]:`);
  const out = step(`    outputs.get(${i})`, () => outputs.get(i));
  step(`    out.address()`, () => out.address());
  step(`    out.amount()`, () => out.amount());
  step(`    out.data_hash()`, () => out.data_hash());
  const plutusData = step(`    out.plutus_data()`, () => out.plutus_data());
  const scriptRef = step(`    out.script_ref()`, () => out.script_ref());
  if (plutusData) {
    const kind = step(`    plutusData.kind()`, () => plutusData.kind());
    console.log(`      kind = ${kind}`);
    step(`    plutusData.to_bytes()`, () => plutusData.to_bytes());
    if (kind === 0) {
      const constr = step(`    plutusData.as_constr_plutus_data()`, () => plutusData.as_constr_plutus_data());
      if (constr) {
        step(`    constr.alternative()`, () => constr.alternative());
        const data = step(`    constr.data()`, () => constr.data());
        const dataLen = step(`    constr.data().len()`, () => data.len());
        console.log(`      constr fields: ${dataLen}`);
        for (let j = 0; j < dataLen; j++) {
          const field = step(`      data.get(${j})`, () => data.get(j));
          step(`      field.kind()`, () => field.kind());
        }
      }
    }
  }
  if (scriptRef) {
    step(`    scriptRef.to_bytes()`, () => scriptRef.to_bytes());
    step(`    scriptRef.is_plutus_script()`, () => scriptRef.is_plutus_script());
    step(`    scriptRef.is_native_script()`, () => scriptRef.is_native_script());
    const ps = step(`    scriptRef.plutus_script()`, () => scriptRef.plutus_script());
    if (ps) {
      step(`    plutus_script.language_version()`, () => ps.language_version());
      step(`    plutus_script.bytes()`, () => ps.bytes());
      step(`    plutus_script.hash()`, () => ps.hash());
    }
  }
}

console.log('---');
console.log('witness set inspection:');
step('witnessSet.vkeys()', () => witnessSet.vkeys());
step('witnessSet.native_scripts()', () => witnessSet.native_scripts());
step('witnessSet.bootstraps()', () => witnessSet.bootstraps());
step('witnessSet.plutus_scripts()', () => witnessSet.plutus_scripts());
step('witnessSet.plutus_data()', () => witnessSet.plutus_data());
step('witnessSet.redeemers()', () => witnessSet.redeemers());

console.log('---');
console.log('ALL CSL CALLS SUCCEEDED — failure is in our code, not CSL');
