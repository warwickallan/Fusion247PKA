// FR-029 entrypoint — source-specific candidates for improving the Brain itself.
import { assertConfig } from '../config.mjs';
import { close } from '../clients/db.mjs';
import { generateSystemImprovements } from '../core/systemImprovements.mjs';

const sourceArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const sourceVideoId = (process.argv.find((arg) => arg.startsWith('--source=')) || '').split('=')[1] || sourceArg;
const limit = Number((process.argv.find((arg) => arg.startsWith('--limit=')) || '').split('=')[1] || 4);
if (!sourceVideoId) {
  console.error('usage: node src/bin/suggest-system.mjs --source=<video-id> [--limit=4]');
  process.exit(2);
}

assertConfig();
try {
  const rows = await generateSystemImprovements({ sourceVideoId, limit });
  console.log(`generated ${rows.length} governed system-improvement candidate(s) for ${sourceVideoId}:\n`);
  for (const row of rows) {
    console.log(`${row.candidateRef} [${row.target}/${row.kind}] conf ${row.confidence.toFixed(2)} — ${row.proposedChange}`);
    console.log(`  evidence: ${row.cites.join(', ')}`);
    console.log(`  next: ${row.nextStep}\n`);
  }
} finally {
  await close();
}
