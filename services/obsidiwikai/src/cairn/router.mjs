// Cairn router — source-adapter based. Each lane has an adapter that hands the capture to its
// downstream processor. Lanes without a built downstream are stubs that prove the routing CONTRACT
// (adding email/article/audio/document later = add an adapter, no Cairn rewrite).
import { LANE, INTENT } from './contracts.mjs';
import { q } from '../clients/db.mjs';
import { enqueuePacket, deliverPacket } from '../core/contextOutbox.mjs';
import { enqueueCompileJob } from '../core/compileQueue.mjs';

const PACKET_TYPES = new Set(['preference', 'correction', 'decision', 'interest', 'standing_instruction', 'session_conclusion']);
// A subject that is ONLY the routing instruction ("Honch that", "→ Honcho") is not content —
// the body is. Don't let the marker become the remembered summary.
const MARKER_ONLY = /^\s*(honch(o)?\s*(that|this|it)?|→?\s*honcho|for honcho|remember (this|that)?\s*about me)\s*[:.!-]*\s*$/i;

// Turn a captured object into a Context-Outbox packet. Cairn decided it's FOR Honcho;
// the outbox owns delivery + its own privacy gate (health/employer held, never auto-shipped).
//
// TWO distinct contracts:
//  - REMEMBER ("Honch that"): preserve the WHOLE coherent exchange VERBATIM. The routing marker is
//    an instruction only; the body is kept in full (no 600/4000 truncation). Privacy scans the full
//    payload (evidence carries it); idempotency is keyed on the message identity, not a summary fragment.
//  - otherwise: a compact context packet (preference/correction updates) — summarised is fine.
export function packetFrom(capture, d) {
  const body = (capture.text || capture.payload_text || '').trim();
  const rawSubject = (capture.subject || '').trim();
  const subject = MARKER_ONLY.test(rawSubject) ? '' : rawSubject; // a marker-only subject is instruction, not content
  const type = PACKET_TYPES.has(capture.packet_type) ? capture.packet_type : 'session_conclusion';
  const identity = capture.source_id || capture.capture_id || null;
  const source_pointer = identity ? `${capture.source_type || 'capture'}:${identity}` : null;
  const idempotency_key = identity ? `honcho:${identity}` : undefined; // distinct exchanges never collide; replays dedupe

  if (d?.intent === INTENT.REMEMBER) {
    let header = (subject || body.split('\n').find((l) => l.trim()) || 'GPT exchange').trim().slice(0, 200);
    if (header.length < 3) header = 'GPT exchange';
    return { type, summary: header, evidence: body || null, source_pointer, idempotency_key, lifespan: 'permanent', verbatim: true };
  }
  const summary = (subject || body || rawSubject || 'context').slice(0, 600);
  const evidence = subject && body ? body.slice(0, 4000) : null;
  return { type, summary, evidence, source_pointer, idempotency_key, lifespan: 'permanent' };
}

const adapters = {
  [LANE.ENCYCLOPEDIA]: async (capture, d) => {
    if (d.treatment === INTENT.KEEP) {
      return { lane: LANE.ENCYCLOPEDIA, did: 'retained source only (keep)', handoff: 'raw preserved + linked, no extraction' };
    }
    // learn → enqueue a DURABLE compile job; the compile-worker grows the encyclopedia async
    // (routing never blocks on a slow/costly compile; a crash can't lose the capture).
    const jobId = await enqueueCompileJob(capture, 'learn');
    return {
      lane: LANE.ENCYCLOPEDIA,
      did: jobId ? 'queued compile job (learn)' : 'compile already queued (idempotent)',
      handoff: 'compile-worker → TubeAIR → LightRAG(clean) → canonicaliser → searchable encyclopedia',
      job_id: jobId, source_id: capture.source_id || capture.url || null,
    };
  },
  [LANE.HONCHO]: async (capture, d) => {
    // Reuse the existing, proven Context-Outbox delivery pipeline as the Honcho lane adapter.
    const packet = packetFrom(capture, d);
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
