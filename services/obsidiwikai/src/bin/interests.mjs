// WP3 — interest management CLI. See what the brain thinks Warwick cares about, and shape it.
// Every change persists to canonical state AND is fed to Honcho so future runs shift.
//   node $ENVS src/bin/interests.mjs                              # show current lens + Honcho's live view
//   node $ENVS src/bin/interests.mjs add "topic" active [0.8]     # add/update an interest
//   node $ENVS src/bin/interests.mjs strengthen "topic" active    # care more
//   node $ENVS src/bin/interests.mjs weaken "topic" active        # care less
//   node $ENVS src/bin/interests.mjs confirm "topic" active       # affirm it
//   node $ENVS src/bin/interests.mjs expire "topic" active        # no longer relevant
import { assertConfig } from '../config.mjs';
import { listInterests, honchoView, addInterest, adjustInterest, expireInterest, confirmInterest } from '../core/interests.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const [cmd, label, horizon, weight] = process.argv.slice(2);

function bar(w) { const n = Math.round(Number(w) * 10); return '█'.repeat(n) + '·'.repeat(10 - n); }

async function show() {
  const rows = await listInterests();
  console.log('\n🧠 What the brain (canonical state) thinks Warwick cares about:\n');
  let lastH = '';
  for (const r of rows) {
    if (r.horizon !== lastH) { console.log(`  ${r.horizon.toUpperCase()}`); lastH = r.horizon; }
    console.log(`    ${bar(r.weight)} ${Number(r.weight).toFixed(2)}  ${r.label}   ${r.source === 'warwick' ? '✓warwick' : r.source}`);
  }
  console.log('\n💬 What Honcho (live lens) currently reads:\n');
  console.log('    ' + (await honchoView()).split('\n').filter(Boolean).join('\n    '));
  console.log('\n(edit: add|strengthen|weaken|confirm|expire "label" <horizon> [weight])\n');
}

try {
  if (!cmd || cmd === 'list' || cmd === 'show') {
    await show();
  } else if (cmd === 'add') {
    console.log('→', JSON.stringify(await addInterest(label, horizon, weight ? Number(weight) : 0.7)));
  } else if (cmd === 'strengthen') {
    console.log('→', JSON.stringify(await adjustInterest(label, horizon, +0.15)));
  } else if (cmd === 'weaken') {
    console.log('→', JSON.stringify(await adjustInterest(label, horizon, -0.15)));
  } else if (cmd === 'confirm') {
    console.log('→', JSON.stringify(await confirmInterest(label, horizon)));
  } else if (cmd === 'expire') {
    console.log('→', JSON.stringify(await expireInterest(label, horizon)));
  } else {
    console.log('unknown command:', cmd);
  }
} catch (e) {
  console.error('❌', e.message);
  process.exitCode = 1;
} finally {
  await close();
}
