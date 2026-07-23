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

export async function deliverPacket(row) {
  const v = validatePacket(row);
  if (!v.ok) {
    await q(`update obsidiwikai.context_packet set state='rejected', error=$2 where packet_id=$1`, [row.packet_id, v.errs.join('; ')]);
    return { packet_id: row.packet_id, state: 'rejected', errs: v.errs };
  }
  const sens = effectiveSensitivity(row);
  if (sens === 'prohibited') {
    await q(`update obsidiwikai.context_packet set state='rejected', error='prohibited content' where packet_id=$1`, [row.packet_id]);
    return { packet_id: row.packet_id, state: 'rejected' };
  }
  if (sens === 'restricted') {
    await q(`update obsidiwikai.context_packet set state='held', error='restricted — needs explicit review' where packet_id=$1`, [row.packet_id]);
    return { packet_id: row.packet_id, state: 'held' };
  }
  // deliver exactly one Honcho message (idempotency already guaranteed by the queued->delivered transition)
  await honcho.ensureWorkspace();
  await honcho.ensurePeer(PEER_WARWICK);
  await honcho.ensureSession(SESSION_CONTEXT, [PEER_WARWICK]);
  const content = `[${row.type}] ${row.summary}${row.evidence ? `\nEvidence: ${row.evidence}` : ''}`;
  const res = await honcho.addMessage(SESSION_CONTEXT, PEER_WARWICK, content, {
    packet_id: row.packet_id, type: row.type, source: 'context-outbox', lifespan: row.lifespan,
  });
  const ref = Array.isArray(res) && res[0]?.id ? res[0].id : (res?.id || null);
  await q(`update obsidiwikai.context_packet set state='delivered', honcho_ref=$2, delivered_at=now() where packet_id=$1`, [row.packet_id, ref]);
  return { packet_id: row.packet_id, state: 'delivered', honcho_ref: ref };
}

export async function processQueue({ limit = 20 } = {}) {
  const rows = (await q(
    `select * from obsidiwikai.context_packet where state='queued' order by created_at limit $1`, [limit]
  )).rows;
  const out = [];
  for (const row of rows) {
    try { out.push(await deliverPacket(row)); }
    catch (e) {
      await q(`update obsidiwikai.context_packet set error=$2 where packet_id=$1`, [row.packet_id, String(e.message).slice(0, 300)]);
      out.push({ packet_id: row.packet_id, state: 'error', error: e.message });
    }
  }
  return out;
}
