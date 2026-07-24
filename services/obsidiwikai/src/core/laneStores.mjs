// Personal + Task lane adapters — durably record a routed capture in the PRIVATE Supabase.
// These replace the earlier stubs: a capture Cairn sends here is now preserved + queryable, not
// just described. Downstream materialisation (Obsidian vault / ClickUp / Todoist) is deferred; the
// durable record is what makes each lane non-lossy today. Idempotent by capture_id.
import { q } from '../clients/db.mjs';

// Personal — journals/reflections/health. PRIVATE by rule: recorded in the private Supabase only,
// NEVER git, NEVER the encyclopedia. Obsidian-vault materialisation is the deferred cloud→local sync.
export async function recordPersonalEntry(capture, d) {
  const captureId = String(capture.capture_id || capture.source_id || '').trim();
  if (!captureId) throw new Error('personal lane: capture_id required');
  const body = capture.text || capture.payload_text || '';
  const r = await q(
    `insert into obsidiwikai.personal_entry(capture_id,privacy_domain,subject,body,source_type,source_id)
     values($1,$2,$3,$4,$5,$6) on conflict (capture_id) do nothing returning entry_id`,
    [captureId, d?.privacy || 'personal', capture.subject || null, body, capture.source_type || null, capture.source_id || null]
  );
  const entryId = r.rows[0]?.entry_id || null;
  return {
    lane: 'personal',
    did: entryId ? 'recorded personal entry (private Supabase)' : 'already recorded (idempotent)',
    handoff: 'private store → Obsidian vault sync (deferred)',
    entry_id: entryId, privacy: d?.privacy || 'personal',
  };
}

// Task — reminders/todos. Durable task record; external sync (ClickUp/Todoist) deferred.
export async function recordTaskItem(capture) {
  const captureId = String(capture.capture_id || capture.source_id || '').trim();
  if (!captureId) throw new Error('task lane: capture_id required');
  const body = capture.text || capture.payload_text || '';
  const title = (capture.subject || body.split('\n')[0] || 'task').trim().slice(0, 200) || 'task';
  const r = await q(
    `insert into obsidiwikai.task_item(capture_id,title,detail,source_type,source_id)
     values($1,$2,$3,$4,$5) on conflict (capture_id) do nothing returning task_id`,
    [captureId, title, body, capture.source_type || null, capture.source_id || null]
  );
  const taskId = r.rows[0]?.task_id || null;
  return {
    lane: 'task',
    did: taskId ? 'recorded task' : 'already recorded (idempotent)',
    handoff: 'task store → ClickUp/Todoist sync (deferred)',
    task_id: taskId,
  };
}
