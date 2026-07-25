// Establish the Inbox delta baseline ONCE, right after authorising. Walks the initial delta to
// its end and persists the cursor WITHOUT ingesting — pre-existing Microsoft welcome/security mail
// never enters capture. Only mail arriving after this point is captured by email-poll.
//   node --env-file=C:/.fusion247/msgraph.env --env-file=C:/.fusion247/obsidiwikai.env \
//     services/obsidiwikai/src/bin/email-baseline.mjs
import { graph } from '../clients/msgraph.mjs';
import { emailStore } from '../sources/emailStore.mjs';
import { createEmailSource } from '../sources/email.mjs';
import { routeCapture } from '../cairn/cairn.mjs';
import { close } from '../clients/db.mjs';

const src = createEmailSource({ graph, store: emailStore, route: routeCapture, log: (m) => console.log('·', m) });
try {
  const r = await src.establishBaseline();
  console.log('✅ baseline:', JSON.stringify(r));
} catch (e) {
  console.error('❌ baseline failed:', e.message);
  process.exitCode = 1;
} finally {
  await close();
}
