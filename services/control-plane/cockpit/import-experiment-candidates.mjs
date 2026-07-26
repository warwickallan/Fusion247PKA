// One-off: import the surviving frozen-fixture EXPERIMENT candidates (blind Sonnet subagent runs) from
// scratchpad into the durable idea_candidate store — honestly provenanced as experiment, NOT production.
// No new Sonnet call; no rewriting; map only what's deterministically available; mark missing fields.
import fs from 'node:fs';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const SP = 'C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/48608720-4bee-47a6-8dbd-57adc25ad5f4/scratchpad';
const FIXTURES = { m6IXL_YGqBQ: 'ADHD', MO3vBmrYyHI: 'Business-4-tasks', eW_vxrjvERk: 'Context-Graphs', n5G26mmJ7I0: 'Audi-1988' };

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("alter table cockpit.idea_mine add column if not exists origin text not null default 'production'");

const report = {}; let skipped = [];
for (const [vid, label] of Object.entries(FIXTURES)) {
  const path = `${SP}/transfer-output-${vid}.json`;
  if (!fs.existsSync(path)) { skipped.push(`${label} (no scratchpad file)`); continue; }
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const cands = data.candidates || [];
  if (!cands.length) { skipped.push(`${label} (0 candidates)`); continue; }
  const mine = (await c.query(
    `insert into cockpit.idea_mine (source_ref, model, origin, brief_hash, brief_snapshot, discarded_obvious, status)
     values ($1, 'sonnet (subagent frozen-fixture experiment)', 'experiment', 'experiment', $2, $3, 'imported') returning mine_id`,
    [vid, `FROZEN-FIXTURE EXPERIMENT (blind Sonnet subagent run — ${label}). NOT the production runner. Original wording preserved; some structured fields (verbatim quote/timestamp, 4-part SPIN) were condensed/absent at capture and are marked, not manufactured.`,
      JSON.stringify(data.discarded_obvious || [])],
  )).rows[0].mine_id;
  report[label] = 0;
  for (const k of cands) {
    const nvfi = { novelty: k.nvfi?.n ?? null, viability: k.nvfi?.v ?? null, fit: k.nvfi?.f ?? null, impact: k.nvfi?.i ?? null };
    const evidence = { named_mechanism: k.ev || k.evidence || null, quote: null, timestamp: null, _note: 'condensed at experiment capture — verbatim quote/timestamp not preserved' };
    const spin = { situation: k.spin || k.title || null, problem: null, implication: null, need_payoff: null, _note: 'pre-SPIN experiment — original 1-line summary only; 4-part SPIN NOT generated (no rewrite)' };
    const cat = (k.cat || k.category) === 'cash' ? 'cash' : 'brain';
    const cid = (await c.query(
      `insert into cockpit.idea_candidate (mine_id, brief_hash, source_evidence, transfer_reasoning, fusion_target, spin, category, lens, nvfi, traps, lifecycle_state)
       values ($1,'experiment',$2,$3,$4,$5,$6,$7,$8,$9,'proposed') returning candidate_id`,
      [mine, JSON.stringify(evidence), k.transfer || k.transfer_reasoning || '(condensed at capture — see source_evidence)',
        k.target || k.fusion_target || '(see transfer_reasoning)', JSON.stringify(spin), cat, k.lens || '', JSON.stringify(nvfi), JSON.stringify(k.traps || [])],
    )).rows[0].candidate_id;
    await c.query("insert into cockpit.idea_event (candidate_id, mine_id, actor, event, note) values ($1,$2,'system','imported','frozen-fixture experiment')", [cid, mine]);
    report[label]++;
  }
}
const tot = (await c.query("select category, count(*) c from cockpit.idea_candidate group by 1")).rows;
const byOrigin = (await c.query("select im.origin, count(*) c from cockpit.idea_candidate ic join cockpit.idea_mine im on im.mine_id=ic.mine_id group by 1")).rows;
await c.end();
console.log(JSON.stringify({ imported_by_source: report, skipped, totals_by_category: tot, by_origin: byOrigin }, null, 2));
