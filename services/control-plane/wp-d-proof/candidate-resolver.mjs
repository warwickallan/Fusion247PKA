// Resolves Warwick's human fallback phrase (for example, "Action A from the Cerebras report")
// to one durable system-improvement candidate. Ambiguity fails closed.
export function parseActionPhrase(phrase) {
  const match = String(phrase || '').trim().match(/^action\s+([a-z])\s+from\s+(?:the\s+)?(.+?)(?:\s+report)?[.!?]?$/i);
  if (!match) return null;
  return { action: match[1].toUpperCase(), sourceHint: match[2].trim() };
}

export async function resolveActionCandidate(db, phrase) {
  const parsed = parseActionPhrase(phrase);
  if (!parsed) throw new Error('use: Action <A-Z> from <source title> report');
  const hint = parsed.sourceHint.replace(/[\\%_]/g, (m) => `\\${m}`);
  const rows = (await db.query(
    `select lc.*, ys.title as source_title
       from cockpit.learning_candidate lc
       join cockpit.youtube_source ys on ys.video_id=lc.source_video_id
      where lc.candidate_scope='system_improvement'
        and lc.candidate_ref like $1
        and ys.title ilike ('%' || $2 || '%') escape '\\'
      order by lc.created_at desc`,
    [`%:${parsed.action}`, hint],
  )).rows;
  if (rows.length !== 1) {
    throw new Error(`candidate phrase resolved to ${rows.length} rows; use the durable candidate ref instead`);
  }
  return rows[0];
}
