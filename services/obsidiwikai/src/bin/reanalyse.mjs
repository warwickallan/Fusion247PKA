// WP4 — re-analysis trigger + compounding delta.
//   node $ENVS src/bin/reanalyse.mjs snapshot <sourceId>   # store the baseline interpretation (time A)
//   node $ENVS src/bin/reanalyse.mjs <sourceId>            # re-analyse under the current lens → DELTA
//   node $ENVS src/bin/reanalyse.mjs stale                 # sources worth reconsidering (lens changed since)
import { assertConfig } from '../config.mjs';
import { snapshot, reanalyse, detectStale } from '../core/reanalyse.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'snapshot') console.log('baseline:', JSON.stringify(await snapshot(arg)));
  else if (cmd === 'stale') { const s = await detectStale(); console.log('worth reconsidering:', s.join(', ') || '(none)'); }
  else if (cmd) console.log(JSON.stringify(await reanalyse(cmd), null, 1));
  else console.log('usage: snapshot <id> | <id> (reanalyse) | stale');
} catch (e) { console.error('❌', e.message); process.exitCode = 1; }
finally { await close(); }
