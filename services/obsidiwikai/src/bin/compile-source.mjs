// Compile entrypoint — one source into the encyclopedia + a knowledge card, per the chosen intent.
// Usage: node --env-file=... src/bin/compile-source.mjs [sourceId] [title] [url] [intent]
//   intent = keep_raw | extract (default) | deep_index
import { existsSync } from 'node:fs';
import { assertConfig } from '../config.mjs';
import { compileSource } from '../core/compiler.mjs';
import { close } from '../clients/db.mjs';

const sourceId = process.argv[2] || 'karpathy-packet-1';
const title = process.argv[3] || 'Andrej Karpathy — Neural Networks & LLM fundamentals';
const url = process.argv[4] || null;
const intent = process.argv[5] || process.env.OWAI_INTENT || 'extract';
const rawGuess = `Team Knowledge/Sources/_raw/${sourceId}`;
const rawRef = existsSync(`C:/Fusion247PKA/${rawGuess}`) ? rawGuess : null;

assertConfig();
console.log(`=== ObsidiWikAi compile: ${sourceId} (intent=${intent}) ===`);
compileSource({ sourceId, title, url, intent, rawRef })
  .then(async (r) => {
    console.log('\n=== RESULT ===');
    console.log('stats:', JSON.stringify(r.stats, null, 2));
    if (r.card) {
      console.log('\nwhy it matters to Warwick:');
      console.log(JSON.stringify(r.card.why_it_matters, null, 2));
      console.log('\nhow the encyclopedia changed:');
      console.log(JSON.stringify(r.card.how_changed, null, 2));
    } else {
      console.log('(no knowledge card — intent was keep_raw; raw source preserved and linked)');
    }
    await close();
  })
  .catch(async (e) => {
    console.error('\nCOMPILE FAILED:', e.message);
    await close();
    process.exit(1);
  });
