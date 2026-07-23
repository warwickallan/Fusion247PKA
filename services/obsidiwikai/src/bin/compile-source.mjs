// M1 entrypoint — compile one source end-to-end into the encyclopedia + a knowledge card.
// Usage: node --env-file=... src/bin/compile-source.mjs [sourceId] [title] [url]
import { assertConfig } from '../config.mjs';
import { compileSource } from '../core/compiler.mjs';
import { close } from '../clients/db.mjs';

const sourceId = process.argv[2] || 'karpathy-packet-1';
const title = process.argv[3] || 'Andrej Karpathy — Neural Networks & LLM fundamentals';
const url = process.argv[4] || null;

assertConfig();
console.log('=== ObsidiWikAi compile:', sourceId, '===');
compileSource({ sourceId, title, url })
  .then(async (r) => {
    console.log('\n=== M1 RESULT ===');
    console.log('stats:', JSON.stringify(r.stats, null, 2));
    console.log('\nwhy it matters to Warwick:');
    console.log(JSON.stringify(r.card.why_it_matters, null, 2));
    console.log('\nhow the encyclopedia changed:');
    console.log(JSON.stringify(r.card.how_changed, null, 2));
    await close();
  })
  .catch(async (e) => {
    console.error('\nCOMPILE FAILED:', e.message);
    await close();
    process.exit(1);
  });
