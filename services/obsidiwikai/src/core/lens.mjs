// The Warwick lens. Canonical, inspectable interest state lives in Supabase (portable);
// Honcho enrichment plugs in at WP3 behind this same interface. The compiler consumes the
// lens and does not care where it came from.
import { q } from '../clients/db.mjs';
import { honcho, PEER_WARWICK } from '../clients/honcho.mjs';
import { extractJson } from './llm.mjs';

const uniq = (a) => [...new Set(a.filter(Boolean).map((s) => String(s).trim()))];

// Seed profile (thin-slice per Pax): a reasonable first lens so the interest pass has signal
// on day one. Warwick can edit any of this in Directus (WP3); feedback + Honcho grow it.
const SEED = [
  ['enduring', 'AI and automation', 0.9],
  ['enduring', 'knowledge systems and second brains', 0.9],
  ['enduring', 'persistent agent memory', 0.85],
  ['enduring', 'implementation consulting', 0.8],
  ['enduring', 'health and self-improvement', 0.6],
  ['active', 'Fusion247 / MyPKA agentic OS', 0.95],
  ['active', 'LightRAG retrieval', 0.8],
  ['active', 'Neo4j knowledge graphs', 0.8],
  ['active', 'Honcho / user-context memory', 0.8],
  ['active', 'Directus cockpit', 0.7],
  ['active', 'Telegram capture', 0.7],
  ['emerging', 'semantic entity resolution', 0.6],
  ['emerging', 'agentic self-improvement', 0.6],
  ['emerging', 'monetising practical AI systems', 0.7],
  ['emerging', 'personalised knowledge discovery', 0.6],
  ['goal', 'turn Fusion247 into useful products/services for small organisations', 0.7],
  ['negative', 'generic AI hype', 0.9],
  ['negative', 'ungrounded autonomous action', 0.9],
];

export async function seedInterestsIfEmpty() {
  const r = await q(`select count(*)::int c from obsidiwikai.canonical_interest`);
  if (r.rows[0].c > 0) return false;
  for (const [horizon, label, weight] of SEED) {
    await q(
      `insert into obsidiwikai.canonical_interest(label,horizon,weight,confidence,source)
       values($1,$2,$3,$3,'seed') on conflict (label,horizon) do nothing`,
      [label, horizon, weight]
    );
  }
  return true;
}

export async function buildLens() {
  await seedInterestsIfEmpty();
  const r = await q(`select label,horizon,weight from obsidiwikai.canonical_interest where status='active'`);
  const by = (h) => r.rows.filter((x) => x.horizon === h).map((x) => x.label);
  const lens = {
    enduring: by('enduring'), active: by('active'), emerging: by('emerging'),
    goals: by('goal'), current_projects: by('project'), open_questions: by('question'),
    negative_signals: by('negative'), adjacent_topics: [],
  };
  // WP3 — enrich the lens from Honcho's live model of Warwick (best-effort; seed stands on failure).
  let origin = 'supabase_seed';
  try {
    const ans = await honcho.chat(
      PEER_WARWICK,
      'Return ONLY JSON describing Warwick: {"active":[],"emerging":[],"goals":[],"negative":[]}. Max 6 short phrases each. active=current interests/projects, emerging=newer curiosities, negative=things he finds low value.'
    );
    const txt = typeof ans === 'string' ? ans : (ans?.content || JSON.stringify(ans));
    const j = extractJson(txt);
    if (j) {
      lens.active = uniq([...lens.active, ...(j.active || [])]);
      lens.emerging = uniq([...lens.emerging, ...(j.emerging || [])]);
      lens.goals = uniq([...lens.goals, ...(j.goals || [])]);
      lens.negative_signals = uniq([...lens.negative_signals, ...(j.negative || [])]);
      origin = 'honcho+supabase';
    }
  } catch { /* seed lens stands */ }

  const version = Date.now();
  const ins = await q(
    `insert into obsidiwikai.interest_lens
       (lens_version,origin,enduring,active,emerging,goals,current_projects,open_questions,negative_signals,adjacent_topics)
     values($1,$10,$2,$3,$4,$5,$6,$7,$8,$9) returning lens_id`,
    [version, j(lens.enduring), j(lens.active), j(lens.emerging), j(lens.goals),
     j(lens.current_projects), j(lens.open_questions), j(lens.negative_signals), j(lens.adjacent_topics), origin]
  );
  return { lensId: ins.rows[0].lens_id, version, origin, ...lens };
}

export function lensSummary(lens) {
  return [
    `Enduring interests: ${lens.enduring.join(', ')}`,
    `Active interests: ${lens.active.join(', ')}`,
    `Emerging interests: ${lens.emerging.join(', ')}`,
    `Goals: ${lens.goals.join(', ')}`,
    `Low-value / negative: ${lens.negative_signals.join(', ')}`,
  ].join('\n');
}

const j = (v) => JSON.stringify(v);
