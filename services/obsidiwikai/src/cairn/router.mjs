// Cairn router — source-adapter based. Each lane has an adapter that hands the capture to its
// downstream processor. Lanes without a built downstream are stubs that prove the routing CONTRACT
// (adding email/article/audio/document later = add an adapter, no Cairn rewrite).
import { LANE, INTENT } from './contracts.mjs';
import { q } from '../clients/db.mjs';
import { enqueuePacket, deliverPacket } from '../core/contextOutbox.mjs';

const PACKET_TYPES = new Set(['preference', 'correction', 'decision', 'interest', 'standing_instruction', 'session_conclusion']);
// A subject that is ONLY the routing instruction ("Honch that", "→ Honcho") is not content —
// the body is. Don't let the marker become the remembered summary.
const MARKER_ONLY = /^\s*(honch(o)?\s*(that|this|it)?|→?\s*honcho|for honcho|remember (this|that)?\s*about me)\s*[:.!-]*\s*$/i;

// Turn a captured object into a Context-Outbox packet. Cairn decided it's FOR Honcho;
// the outbox owns delivery + its own privacy gate (health/employer held, never auto-shipped).
function packetFrom(capture) {
  const body = (capture.text || capture.payload_text || '').trim();
  const rawSubject = (capture.subject || '').trim();
  const subject = MARKER_ONLY.test(rawSubject) ? '' : rawSubject; // drop a marker-only subject
  // Substantive subject → headline (summary) with the body as evidence; otherwise the body IS the content.
  const summary = (subject || body || rawSubject || 'context').slice(0, 600);
  const evidence = subject && body ? body.slice(0, 4000) : null;
  const type = PACKET_TYPES.has(capture.packet_type) ? capture.packet_type : 'session_conclusion';
  const src = capture.source_id ? `${capture.source_type || 'capture'}:${capture.source_id}` : `capture:${capture.capture_id}`;
  return { type, summary, evidence, source_pointer: src, lifespan: 'permanent' };
}

const adapters = {
  [LANE.ENCYCLOPEDIA]: async (capture, d) => {
    if (d.treatment === INTENT.KEEP) {
      return { lane: LANE.ENCYCLOPEDIA, did: 'retained source only (keep)', handoff: 'raw preserved + linked, no extraction' };
    }
    // learn → the knowledge pipeline (the existing working flow); Cairn records the routing + treatment.
    return {
      lane: LANE.ENCYCLOPEDIA, did: 'routed to knowledge pipeline (learn)',
      handoff: 'TubeAIR → LightRAG(clean) → Honcho lens → canonicaliser → searchable encyclopedia',
      source_id: capture.source_id || capture.url || null,
    };
  },
  [LANE.HONCHO]: async (capture) => {
    // Reuse the existing, proven Context-Outbox delivery pipeline as the Honcho lane adapter.
    const packet = packetFrom(capture);
    const packetId = await enqueuePacket(packet); // null = duplicate (idempotent at the outbox layer)
    if (!packetId) return { lane: LANE.HONCHO, did: 'already delivered to Honcho (duplicate packet)', handoff: 'context-outbox (idempotent)' };
    const row = (await q('select * from obsidiwikai.context_packet where packet_id=$1', [packetId])).rows[0];
    const res = await deliverPacket(row); // applies the outbox privacy gate: restricted → held, prohibited → rejected
    return { lane: LANE.HONCHO, did: `context ${res.state} → Honcho`, handoff: 'context-outbox → Honcho lens', packet_id: packetId, state: res.state, honcho_ref: res.honcho_ref || null };
  },
  [LANE.PERSONAL]: async () => ({ lane: LANE.PERSONAL, did: 'routed to personal/Obsidian lane', handoff: 'Obsidian journal/backlink pipeline (lane stub — not built this increment)' }),
  [LANE.TASK]: async () => ({ lane: LANE.TASK, did: 'routed to task lane', handoff: 'task lane (stub — not built this increment)' }),
  [LANE.WORK]: async () => ({ lane: LANE.WORK, did: 'held for walled work lane', handoff: 'work/Bellrock lane — deferred by design (WP7)' }),
  [LANE.UNKNOWN]: async () => ({ lane: LANE.UNKNOWN, did: 'no route — asking Warwick', handoff: null }),
};

export function laneAdapter(lane) { return adapters[lane] || adapters[LANE.UNKNOWN]; }
export function knownLanes() { return Object.keys(adapters); }
