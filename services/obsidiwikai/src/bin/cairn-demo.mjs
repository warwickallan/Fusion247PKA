// Cairn demo — route a spread of captures live, showing receipts, idempotency, and learning.
import { assertConfig } from '../config.mjs';
import { routeCapture, recordCorrection } from '../cairn/cairn.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const stamp = 'demo-' + Date.now().toString(36);
const fixtures = [
  { capture_id: `${stamp}-yt`, url: 'https://youtu.be/EUG65dIY-2k', text: 'https://youtu.be/EUG65dIY-2k' },
  { capture_id: `${stamp}-journal`, text: 'Journal: knackered today but the brain build is flying' },
  { capture_id: `${stamp}-task`, text: 'remind me to review the gateway budget on Friday' },
  { capture_id: `${stamp}-ambig`, text: 'hmm, something loose about graphs maybe' },
  { capture_id: `${stamp}-explicit`, url: 'https://youtu.be/x', text: '#journal a note while watching' },
  { capture_id: `${stamp}-personal`, text: 'blood pressure medication review, tell my wife' },
  { capture_id: `${stamp}-work`, text: 'Bellrock Concerto SLA change for the client' },
];

console.log('=== Cairn routing (durable captures → decisions) ===');
for (const f of fixtures) {
  const r = await routeCapture(f);
  console.log(`  ${r.receipt}`);
}

console.log('\n=== idempotency: re-route the YouTube capture ===');
const again = await routeCapture(fixtures[0]);
console.log('  idempotent:', again.idempotent === true, '·', again.receipt);

console.log('\n=== learning: a medium.com article, then reinforce, then a new one ===');
const a1 = await routeCapture({ capture_id: `${stamp}-med1`, url: 'https://medium.com/@x/graph-rag-explained' });
console.log('  first :', a1.receipt);
await recordCorrection(`${stamp}-med1`, { lane: 'encyclopedia', intent: 'learn', patternKey: 'url_host:medium.com' });
const a2 = await routeCapture({ capture_id: `${stamp}-med2`, url: 'https://medium.com/@y/vector-stores' });
console.log('  after learning:', a2.receipt, '(decided_by', a2.decision.decided_by + ')');

await close();
