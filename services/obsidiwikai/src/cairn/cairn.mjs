// Cairn orchestrator — for a DURABLE capture: classify → decide act/confirm/ask → route → receipt.
// Idempotent by capture_id. Cairn's failure cannot lose the object (capture is already durable
// upstream in BUILD-002); a rerun just re-decides. Decisions are correctable/replayable.
import { q } from '../clients/db.mjs';
import { classify } from './classify.mjs';
import { laneAdapter } from './router.mjs';
import { ACTION } from './contracts.mjs';

async function loadFeedback() {
  try {
    return (await q('select pattern_key, correct_lane, correct_intent, correct_treatment, weight from cairn.routing_feedback')).rows;
  } catch { return []; }
}

export async function routeCapture(capture) {
  const captureId = String(capture.capture_id || capture.source_id || capture.url || '').trim();
  if (!captureId) throw new Error('cairn: capture_id required');

  // idempotent — a prior decision wins (correctable/replayable, but not silently re-run)
  const prior = (await q('select * from cairn.decision where capture_id=$1', [captureId])).rows[0];
  if (prior) return { captureId, decision: prior, idempotent: true, receipt: receiptLine(prior) };

  const d = classify(capture, { feedback: await loadFeedback() });

  let status = d.action === ACTION.ACT ? 'acted' : (d.action === ACTION.CONFIRM ? 'pending_confirm' : 'pending_ask');
  let routed = null, error = null;
  if (d.action === ACTION.ACT) {
    try { routed = await laneAdapter(d.lane)(capture, d); }
    catch (e) { status = 'failed'; error = String(e.message).slice(0, 300); }
  }

  const actedAt = d.action === ACTION.ACT ? new Date().toISOString() : null;
  const ins = await q(
    `insert into cairn.decision(capture_id,source_type,what,intent,privacy_domain,lane,treatment,confidence,rationale,action,status,decided_by,routed_ref,error,acted_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     on conflict (capture_id) do nothing
     returning *`,
    [captureId, d.source_type, d.what, d.intent, d.privacy, d.lane, d.treatment, d.confidence, d.rationale, d.action, status, d.decided_by, routed ? JSON.stringify(routed) : null, error, actedAt]
  );
  const rec = ins.rows[0] || (await q('select * from cairn.decision where capture_id=$1', [captureId])).rows[0];
  return { captureId, decision: rec, routed, receipt: receiptLine(rec) };
}

// Warwick confirms/corrects → persist as governed routing feedback so repeated patterns gain confidence.
// Explicit correction never silently upgrades privacy scope (privacy_domain carried, not raised).
export async function recordCorrection(captureId, { lane, intent, treatment, patternKey } = {}) {
  const dec = (await q('select * from cairn.decision where capture_id=$1', [captureId])).rows[0];
  if (!dec) throw new Error('cairn: no decision for ' + captureId);
  await q(
    `update cairn.decision set status='corrected', lane=coalesce($2,lane), intent=coalesce($3,intent), treatment=coalesce($4,treatment), decided_by='warwick' where capture_id=$1`,
    [captureId, lane || null, intent || null, treatment || null]
  );
  const key = patternKey || dec.source_type;
  await q(
    `insert into cairn.routing_feedback(pattern_key,correct_lane,correct_intent,correct_treatment,privacy_domain,weight,source)
     values($1,$2,$3,$4,$5,1,'warwick')
     on conflict (pattern_key,correct_lane) do update set weight=cairn.routing_feedback.weight+1, updated_at=now()`,
    [key, lane || dec.lane, intent || dec.intent, treatment || dec.treatment, dec.privacy_domain]
  );
  return { captureId, corrected: true, learned: key };
}

function receiptLine(rec) {
  const verb = rec.action === 'act' ? '✅ routed' : (rec.action === 'confirm' ? '🤔 proposing' : '❓ asking');
  return `${verb}: ${rec.what} → ${rec.lane}${rec.treatment ? '/' + rec.treatment : ''} · ${rec.privacy_domain} · conf ${Math.round(rec.confidence * 100)}% — ${rec.rationale}`;
}
