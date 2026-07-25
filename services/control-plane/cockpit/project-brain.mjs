// IDEA-016 — BRAIN projector. Reads the authoritative Brain (obsidiwikai.* + cockpit.learning_candidate)
// and idempotently projects ONLY the genuine human-facing items into the two universal contracts:
//   cockpit.attention_item — decisions Warwick must make: pending learning candidates + held canonicalisations
//   cockpit.output_item     — real insights produced for Warwick: the "so what" knowledge cards
// Redline: routine learned/enriched sources are NOT outputs (they stay Brain-detail state); only genuine
// results/decisions land in the contracts. A shared provenance_ref keeps output↔decision one journey.
// Runs as the trusted service role (DATABASE_URL, cross-schema read+write); Directus only reads.
//   node --env-file=C:/.fusion247/fusion-capture-gateway.env services/control-plane/cockpit/project-brain.mjs
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const REPORT = process.env.REPORT_URL || 'http://100.101.240.85:8701';
const GRAPH = process.env.GRAPH_URL || 'http://100.101.240.85:8700';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

async function upsertAttention(r) {
  await c.query(
    `insert into cockpit.attention_item
       (source_module, source_type, source_key, title, reason, priority, kind, notify_policy, status, actions, provenance_ref, related_ref, detail_route)
     values ('brain',$1,$2,$3,$4,$5,$6,$7,'open',$8,$9,$10,$11)
     on conflict (source_module, source_key) do update set
       source_type=excluded.source_type, title=excluded.title, reason=excluded.reason, priority=excluded.priority,
       kind=excluded.kind, notify_policy=excluded.notify_policy, actions=excluded.actions, provenance_ref=excluded.provenance_ref,
       related_ref=excluded.related_ref, detail_route=excluded.detail_route, status='open', updated_at=now()`,
    [r.source_type, r.source_key, r.title, r.reason, r.priority, r.kind || 'suggestion', r.notify_policy || 'none',
      JSON.stringify(r.actions || []), r.provenance_ref, r.related_ref || null, r.detail_route || null],
  );
}
async function upsertOutput(r) {
  await c.query(
    `insert into cockpit.output_item
       (source_module, source_type, source_key, title, value, produced_at, evidence_url, provenance_ref, related_ref, detail_route)
     values ('brain',$1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (source_module, source_key) do update set
       source_type=excluded.source_type, title=excluded.title, value=excluded.value, produced_at=excluded.produced_at,
       evidence_url=excluded.evidence_url, provenance_ref=excluded.provenance_ref, related_ref=excluded.related_ref,
       detail_route=excluded.detail_route, updated_at=now()`,
    [r.source_type, r.source_key, r.title, r.value, r.produced_at, r.evidence_url || null, r.provenance_ref, r.related_ref || null, r.detail_route || null],
  );
}

const attnKeys = [];
let cardsN = 0;

// 1) Pending learning candidates → ATTENTION (accept/decline via the wired learning_command seam).
const cands = (await c.query(
  `select id, candidate_scope, recommendation, why, confidence, source_video_id
   from cockpit.learning_candidate where status='pending' order by created_at`,
)).rows;
for (const k of cands) {
  const sys = k.candidate_scope === 'system_improvement';
  const key = 'candidate:' + k.id;
  attnKeys.push(key);
  await upsertAttention({
    source_type: sys ? 'system_improvement' : 'learning_candidate',
    source_key: key,
    title: (sys ? '🛠 Make the Brain Better — ' : '💡 ') + (k.recommendation || 'suggestion'),
    reason: k.why || null,
    priority: Number(k.confidence) >= 0.8 ? 'high' : 'medium',
    kind: 'suggestion',
    notify_policy: 'none',
    actions: [
      { key: 'accept', label: 'Accept', intent: 'learning_command', args: { candidate_id: k.id, command: 'accept' } },
      { key: 'decline', label: 'Decline', intent: 'learning_command', args: { candidate_id: k.id, command: 'decline' } },
    ],
    provenance_ref: 'cockpit:learning_candidate:' + k.id,
    related_ref: k.source_video_id ? 'cockpit:youtube_source:' + k.source_video_id : null,
    detail_route: '/attention/candidate/' + k.id,
  });
}

// 2) Held canonicalisation decisions → ATTENTION (review; merge/keep via the governed brain_command seam).
const held = (await c.query(
  `select id, source_id, entity_name, matched_name, rationale, evidence
   from obsidiwikai.wp15_canonicalisation where action='held' order by created_at desc`,
)).rows;
for (const h of held) {
  const key = 'held:' + h.id;
  attnKeys.push(key);
  await upsertAttention({
    source_type: 'held_canonicalisation',
    source_key: key,
    title: h.matched_name ? `Is "${h.entity_name}" the same as "${h.matched_name}"?` : `Review concept: "${h.entity_name}"`,
    reason: (h.rationale || 'The Brain held this for your review rather than merging automatically.')
      + (h.evidence ? `\nEvidence: "${String(h.evidence).slice(0, 180)}"` : ''),
    priority: 'medium',
    kind: 'decision',
    notify_policy: 'selective',
    actions: [
      { key: 'merge', label: 'Merge them', intent: 'brain_command', args: { held_id: h.id, command: 'merge' } },
      { key: 'keep', label: 'Keep separate', intent: 'brain_command', args: { held_id: h.id, command: 'keep' } },
    ],
    provenance_ref: 'obsidiwikai:wp15_canonicalisation:' + h.id,
    related_ref: h.source_id ? 'cockpit:youtube_source:' + h.source_id : null,
    detail_route: '/brain/held/' + h.id,
  });
}

// 3) Knowledge cards → OUTPUT (the genuine "so what" insight). Deep link into the report + graph.
const cards = (await c.query(
  `select kc.card_id, kc.source_id, kc.why_it_matters, kc.what_follows, kc.created_at,
          (select title from cockpit.youtube_source where video_id = kc.source_id) as src_title
   from obsidiwikai.knowledge_card kc order by kc.created_at desc`,
)).rows;
for (const kc of cards) {
  cardsN++;
  await upsertOutput({
    source_type: 'so_what',
    source_key: 'card:' + kc.card_id,
    title: 'So what — ' + (kc.src_title || kc.source_id),
    value: kc.why_it_matters || kc.what_follows || null,
    produced_at: kc.created_at,
    evidence_url: `${REPORT}/s/${encodeURIComponent(kc.source_id)}`,
    provenance_ref: 'cockpit:youtube_source:' + kc.source_id,
    detail_route: '/outputs/brain/' + kc.card_id,
  });
}

// Resolve brain attention items whose source is no longer open (accepted/declined/merged/kept).
await c.query(
  `update cockpit.attention_item set status='resolved', updated_at=now()
   where source_module='brain' and status='open' and not (source_key = any($1))`,
  [attnKeys],
);

console.log(JSON.stringify({
  ok: true,
  attention: { candidates: cands.length, held: held.length, total_open: attnKeys.length },
  output: { knowledge_cards: cardsN },
}, null, 2));
await c.end();
