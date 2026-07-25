// WP5 entrypoint — generate grounded suggestions from the encyclopedia.
import { assertConfig } from '../config.mjs';
import { generateSuggestions } from '../core/suggestions.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const s = await generateSuggestions({ limit: 6 });
console.log(`generated ${s.length} grounded suggestions:\n`);
for (const x of s) {
  console.log(`[${x.kind}] (conf ${x.confidence}) ${x.summary}`);
  console.log(`   cites: ${(x.cites || []).join(', ')}`);
  console.log(`   next: ${x.next_step}`);
  console.log(`   invalidated if: ${x.what_invalidates}\n`);
}
await close();
