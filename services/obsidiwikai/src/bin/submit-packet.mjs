// Enqueue a context packet (manual / test path; the fusiongptbot lane calls enqueuePacket too).
// Usage: node --env-file=... src/bin/submit-packet.mjs '<json>'   OR   <type> <summary...>
import { assertConfig } from '../config.mjs';
import { enqueuePacket } from '../core/contextOutbox.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
let p;
const a = process.argv[2] || '';
if (a.trim().startsWith('{')) p = JSON.parse(process.argv.slice(2).join(' '));
else p = { type: a || 'preference', summary: process.argv.slice(3).join(' ') };

const id = await enqueuePacket(p);
console.log(id ? 'enqueued packet ' + id : 'duplicate (idempotent) — not re-enqueued');
await close();
