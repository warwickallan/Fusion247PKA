// IDEA-016 — Brain held-decision WORKER (trusted executor). The cockpit (cp_directus) can only INSERT
// an intent into cockpit.brain_command; this worker (service role, cross-schema) atomically claims it,
// applies the decision to the authoritative Brain — merge → mergeEntities on the one LightRAG graph +
// wp15_canonicalisation.action='merged'; keep → action='kept' — and writes a receipt. Directus never
// mutates the graph. Idempotent per intent row.
//   node --env-file=C:/.fusion247/fusion-capture-gateway.env --env-file=C:/.fusion247/lightrag.env \
//        services/control-plane/cockpit/brain-command-worker.mjs
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const LIGHTRAG = process.env.LIGHTRAG_URL || `http://${process.env.FUSION_CORE_TAILNET || '100.101.240.85'}:9621`;
const KEY = process.env.LIGHTRAG_API_KEY;

async function mergeEntities(sources, target) {
  const r = await fetch(LIGHTRAG + '/graph/entities/merge', {
    method: 'POST', headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ entities_to_change: sources, entity_to_change_into: target }),
  });
  if (!r.ok) throw new Error('lightrag merge failed ' + r.status);
  return r.json().catch(() => ({}));
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const out = [];
const rows = (await c.query("select * from cockpit.brain_command where status='requested' order by requested_at limit 25")).rows;
for (const cmd of rows) {
  const claimed = await c.query("update cockpit.brain_command set status='claimed', claimed_at=now() where id=$1 and status='requested' returning id", [cmd.id]);
  if (!claimed.rowCount) continue; // lost the race
  try {
    const held = (await c.query('select id, entity_name, matched_name, action from obsidiwikai.wp15_canonicalisation where id=$1', [cmd.held_id])).rows[0];
    let receipt;
    if (!held) {
      receipt = { note: 'held item no longer present (already decided)' };
    } else if (cmd.command === 'merge') {
      if (held.matched_name) await mergeEntities([held.entity_name], held.matched_name);
      await c.query("update obsidiwikai.wp15_canonicalisation set action='merged' where id=$1", [cmd.held_id]);
      receipt = { applied: 'merged', entity: held.entity_name, into: held.matched_name };
    } else {
      await c.query("update obsidiwikai.wp15_canonicalisation set action='kept' where id=$1", [cmd.held_id]);
      receipt = { applied: 'kept', entity: held.entity_name };
    }
    await c.query("update cockpit.brain_command set status='done', completed_at=now(), receipt=$2 where id=$1", [cmd.id, JSON.stringify(receipt)]);
    out.push({ id: cmd.id, command: cmd.command, ...receipt });
  } catch (e) {
    await c.query("update cockpit.brain_command set status='failed', completed_at=now(), receipt=$2 where id=$1", [cmd.id, JSON.stringify({ error: String(e.message).slice(0, 200) })]);
    out.push({ id: cmd.id, command: cmd.command, error: e.message });
  }
}
console.log(JSON.stringify({ processed: out.length, results: out }, null, 2));
await c.end();
