// WP3 — interest-lens MANAGEMENT. Warwick sees what the brain thinks he cares about, and can
// confirm / correct / strengthen / weaken / expire / add. Canonical state lives in Supabase
// (obsidiwikai.canonical_interest); every change is ALSO fed to Honcho (via the hardened Context
// Outbox) so future lens builds actually shift — Warwick can watch the brain learn him.
import { q } from '../clients/db.mjs';
import { honcho, PEER_WARWICK } from '../clients/honcho.mjs';
import { enqueuePacket, deliverPacket } from './contextOutbox.mjs';

export const HORIZONS = ['enduring', 'active', 'emerging', 'goal', 'project', 'question', 'negative'];

// What the canonical state says Warwick cares about.
export async function listInterests({ includeExpired = false } = {}) {
  const r = await q(
    `select label,horizon,weight,confidence,status,source,updated_at from obsidiwikai.canonical_interest
     ${includeExpired ? '' : "where status='active'"} order by horizon, weight desc`
  );
  return r.rows;
}

// What Honcho's live model of Warwick currently thinks he cares about (best-effort).
export async function honchoView() {
  try {
    const ans = await honcho.chat(PEER_WARWICK, 'In 4-6 short bullet phrases, what does Warwick currently care about and focus on? Return just the phrases, one per line.');
    return typeof ans === 'string' ? ans : (ans?.content || JSON.stringify(ans));
  } catch (e) { return '(Honcho unavailable: ' + String(e.message).slice(0, 80) + ')'; }
}

// Feed a change to Honcho through the hardened outbox (single delivery, privacy-gated).
let seq = 0;
async function feedHoncho(summary, type = 'interest') {
  const key = `interest:${Date.now()}:${seq++}`;
  const id = await enqueuePacket({ type, summary, source_pointer: 'interest-manager', idempotency_key: key });
  if (!id) return { delivered: false, reason: 'duplicate' };
  const row = (await q('select * from obsidiwikai.context_packet where packet_id=$1', [id])).rows[0];
  const res = await deliverPacket(row).catch((e) => ({ state: 'error', error: e.message }));
  return { delivered: res.state === 'delivered', state: res.state };
}

function assertHorizon(h) { if (!HORIZONS.includes(h)) throw new Error(`horizon must be one of ${HORIZONS.join('|')}`); }

// ADD or update an interest (Warwick-sourced).
export async function addInterest(label, horizon, weight = 0.7) {
  assertHorizon(horizon);
  await q(
    `insert into obsidiwikai.canonical_interest(label,horizon,weight,confidence,source,status)
     values($1,$2,$3,$3,'warwick','active')
     on conflict (label,horizon) do update set weight=$3, confidence=greatest(obsidiwikai.canonical_interest.confidence,$3), source='warwick', status='active', updated_at=now()`,
    [label, horizon, weight]
  );
  const fed = await feedHoncho(`Warwick cares about "${label}" (${horizon}); interest weight ${weight}.`, 'interest');
  return { label, horizon, weight, honcho: fed };
}

// STRENGTHEN / WEAKEN (delta on weight, clamped 0..1).
export async function adjustInterest(label, horizon, delta) {
  assertHorizon(horizon);
  const r = await q(
    `update obsidiwikai.canonical_interest set weight=greatest(0,least(1,weight+$3)), source='warwick', updated_at=now()
     where label=$1 and horizon=$2 and status='active' returning weight`,
    [label, horizon, delta]
  );
  if (!r.rowCount) throw new Error(`no active interest "${label}" (${horizon})`);
  const w = Number(r.rows[0].weight);
  const fed = await feedHoncho(`Warwick ${delta > 0 ? 'cares MORE' : 'cares LESS'} about "${label}" (${horizon}) now — weight ${w.toFixed(2)}.`, 'correction');
  return { label, horizon, weight: w, honcho: fed };
}

// EXPIRE (no longer relevant).
export async function expireInterest(label, horizon) {
  assertHorizon(horizon);
  const r = await q(`update obsidiwikai.canonical_interest set status='expired', updated_at=now() where label=$1 and horizon=$2 returning label`, [label, horizon]);
  if (!r.rowCount) throw new Error(`no interest "${label}" (${horizon})`);
  const fed = await feedHoncho(`Warwick no longer cares about "${label}" (${horizon}); this interest is expired.`, 'correction');
  return { label, horizon, status: 'expired', honcho: fed };
}

// CONFIRM (Warwick affirms it — bump confidence).
export async function confirmInterest(label, horizon) {
  assertHorizon(horizon);
  const r = await q(`update obsidiwikai.canonical_interest set confidence=least(1,confidence+0.1), source='warwick', updated_at=now() where label=$1 and horizon=$2 and status='active' returning confidence`, [label, horizon]);
  if (!r.rowCount) throw new Error(`no active interest "${label}" (${horizon})`);
  const fed = await feedHoncho(`Warwick confirmed he cares about "${label}" (${horizon}).`, 'interest');
  return { label, horizon, confidence: Number(r.rows[0].confidence), honcho: fed };
}
