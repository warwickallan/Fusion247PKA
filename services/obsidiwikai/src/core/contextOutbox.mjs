// ChatGPT -> Honcho Context Outbox (CONTEXT-OUTBOX.md). A governed, replay-safe bridge:
// a compact packet is enqueued, validated, delivered to Honcho exactly once, and receipted.
// Privacy is enforced here: personal/health/employer material is held, never auto-delivered.
import { q } from '../clients/db.mjs';
import { honcho, PEER_WARWICK, SESSION_CONTEXT } from '../clients/honcho.mjs';

const TYPES = new Set(['preference', 'correction', 'decision', 'interest', 'standing_instruction', 'session_conclusion']);
const SENS = new Set(['ordinary', 'restricted', 'prohibited']);
const RISKY = /\b(health|medical|diagnos|salary|bellrock|client\b|family|password|secret|api[_-]?key|token)\b/i;

export function validatePacket(p) {
  const errs = [];
  if (!p.summary || String(p.summary).trim().length < 3) errs.push('summary required');
  if (!p.type || !TYPES.has(p.type)) errs.push('type must be one of ' + [...TYPES].join('|'));
  if (p.sensitivity && !SENS.has(p.sensitivity)) errs.push('sensitivity must be ordinary|restricted|prohibited');
  return { ok: errs.length === 0, errs };
}

// Effective sensitivity after a privacy scan (auto-escalate risky content to restricted).
export function effectiveSensitivity(p) {
  if (p.sensitivity === 'prohibited') return 'prohibited';
  const blob = `${p.summary} ${p.evidence || ''}`;
  if (RISKY.test(blob) && p.sensitivity !== 'restricted') return 'restricted';
  return p.sensitivity || 'ordinary';
}

export async function enqueuePacket(p) {
  const v = validatePacket(p);
  if (!v.ok) throw new Error('invalid packet: ' + v.errs.join('; '));
  const idem = p.idempotency_key
    || 'pkt:' + Buffer.from(`${p.type}|${String(p.summary).trim().toLowerCase()}`).toString('base64').slice(0, 60);
  const r = await q(
    `insert into obsidiwikai.context_packet(idempotency_key,type,summary,evidence,confidence,sensitivity,lifespan,source_pointer,state)
     values($1,$2,$3,$4,$5,$6,$7,$8,'queued')
     on conflict (idempotency_key) do nothing returning packet_id`,
    [idem, p.type, p.summary, p.evidence || null, p.confidence || null, effectiveSensitivity(p), p.lifespan || 'permanent', p.source_pointer || null]
  );
  return r.rows[0]?.packet_id || null; // null = duplicate → replay-safe (FR: no duplicate memory)
}

// Delivery is NOT "exactly once" — no external system can promise that without an idempotency key
// on its own write. What we DO guarantee: (a) unique enqueue → no duplicate rows; (b) an atomic
// single-worker CLAIM (queued→delivering) so two workers can never both call Honcho for one packet;
// (c) a crash after the claim never blindly re-sends — the row is surfaced for reconcile. The
// packet_id rides in the Honcho message metadata as a stable dedup handle for that reconcile.
export async function deliverPacket(row, { honchoClient = honcho } = {}) {
  const v = validatePacket(row);
  if (!v.ok) {
    await q(`update obsidiwikai.context_packet set state='rejected', error=$2 where packet_id=$1 and state='queued'`, [row.packet_id, v.errs.join('; ')]);
    return { packet_id: row.packet_id, state: 'rejected', errs: v.errs };
  }
  const sens = effectiveSensitivity(row);
  if (sens === 'prohibited') {
    await q(`update obsidiwikai.context_packet set state='rejected', error='prohibited content' where packet_id=$1 and state='queued'`, [row.packet_id]);
    return { packet_id: row.packet_id, state: 'rejected' };
  }
  if (sens === 'restricted') {
    await q(`update obsidiwikai.context_packet set state='held', error='restricted — needs explicit review' where packet_id=$1 and state='queued'`, [row.packet_id]);
    return { packet_id: row.packet_id, state: 'held' };
  }
  // ATOMIC CLAIM — only the worker that flips queued→delivering proceeds. A losing/duplicate worker
  // gets rowCount 0 and must NOT deliver.
  const claim = await q(
    `update obsidiwikai.context_packet set state='delivering', claimed_at=now() where packet_id=$1 and state='queued' returning packet_id`,
    [row.packet_id]
  );
  if (claim.rowCount === 0) {
    const cur = (await q(`select state, honcho_ref from obsidiwikai.context_packet where packet_id=$1`, [row.packet_id])).rows[0];
    return { packet_id: row.packet_id, state: cur?.state || 'unknown', skipped: true, honcho_ref: cur?.honcho_ref || null };
  }
  try {
    await honchoClient.ensureWorkspace();
    await honchoClient.ensurePeer(PEER_WARWICK);
    await honchoClient.ensureSession(SESSION_CONTEXT, [PEER_WARWICK]);
    const content = `[${row.type}] ${row.summary}${row.evidence ? `\nEvidence: ${row.evidence}` : ''}`;
    const res = await honchoClient.addMessage(SESSION_CONTEXT, PEER_WARWICK, content, {
      packet_id: row.packet_id, type: row.type, source: 'context-outbox', lifespan: row.lifespan,
    });
    const ref = Array.isArray(res) && res[0]?.id ? res[0].id : (res?.id || null);
    await q(`update obsidiwikai.context_packet set state='delivered', honcho_ref=$2, delivered_at=now() where packet_id=$1`, [row.packet_id, ref]);
    return { packet_id: row.packet_id, state: 'delivered', honcho_ref: ref };
  } catch (e) {
    // Delivery FAILED (Honcho not confirmed) → release back to queued for a clean retry.
    await q(`update obsidiwikai.context_packet set state='queued', claimed_at=null, error=$2 where packet_id=$1 and state='delivering'`, [row.packet_id, String(e.message).slice(0, 300)]);
    throw e;
  }
}

// Rows stuck in 'delivering' past the lease = a worker crashed mid-delivery. We CANNOT tell whether
// Honcho received the message, so we fail SAFE: move to needs_reconcile (never blind-resend) and
// surface it. Reconcile via the packet_id carried in Honcho's message metadata.
export async function reclaimStale({ leaseSeconds = 120 } = {}) {
  const r = await q(
    `update obsidiwikai.context_packet set state='needs_reconcile',
       error='delivery interrupted after claim — verify Honcho receipt (metadata.packet_id) before resend'
     where state='delivering' and claimed_at < now() - make_interval(secs => $1) returning packet_id`,
    [leaseSeconds]
  );
  return r.rows.map((x) => x.packet_id);
}

export async function processQueue({ limit = 20, leaseSeconds = 120 } = {}) {
  const reconciled = await reclaimStale({ leaseSeconds }); // surface interrupted deliveries first (fail-safe)
  const rows = (await q(
    `select * from obsidiwikai.context_packet where state='queued' order by created_at limit $1`, [limit]
  )).rows;
  const out = [];
  for (const row of rows) {
    try { out.push(await deliverPacket(row)); }
    catch (e) { out.push({ packet_id: row.packet_id, state: 'error', error: e.message }); }
  }
  if (reconciled.length) out.push({ needs_reconcile: reconciled });
  return out;
}
