// arc.mjs — corrected Transfer-Intelligence entrypoint (IDEA-016 "Arc quality correction", Warwick 2026-07-27).
// Closes the Arc defect in the YouTube  Source-Intelligence -> Arc -> Mason  chain. Fixes:
//  (1) SOURCE-CORE not interpretation — Arc reads the SI note's FACTUAL sections (claims/mechanisms/examples/
//      people/evidence/caveats/themes) with the pre-written "What this means for Fusion247" + "Actions" conclusions
//      STRIPPED, so legitimate transfers are no longer recognised-then-killed as "already said". Human note untouched.
//  (2) BROADENED DOMAINS — strategic/career/commercial/reputation are IN Arc's remit (see TRANSFER_DOMAINS + T2 F1-F6).
//  (3) OBVIOUS != DISCARD — obvious+high-value validation/sharpening of an existing direction is KEPT (admission rule).
//  (4) DETERMINISTIC TIER — a rich/substantive source gets the T2 divergent multi-frame+convergence treatment (favour
//      RECALL: the register stores it, Mason controls attention); thin/near-empty stays cheap / refuses.
//  Persists converged atoms to cockpit.idea_atom (Mason consumes them) + idea_candidate (Cockpit shows them),
//  transactionally, with provenance + admission + verified evidence.
//    node --env-file=C:/.fusion247/fusion-capture-gateway.env --env-file-if-exists=C:/.fusion247/neo4j.env \
//         services/control-plane/cockpit/arc.mjs <video_id> [--force-tier=t1|t2|thin] [--dry]
//  neo4j.env is OPTIONAL — only the non-model graph enrichment uses it, and enrich() degrades gracefully; a missing
//  file must NEVER stop Arc launching, hence --env-file-if-exists at the call site (server.mjs /api/mine).
import crypto from 'node:crypto';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { assembleBrief, buildPrompt } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/mine-ideas.mjs';
import { callClaude, parseJSON, reportedTotal, runT2Pipeline } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/t2-calibrate.mjs';
import { upsertAtom, verifyEvidence } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/atom-register.mjs';

const COCKPIT = process.env.COCKPIT_URL || 'http://127.0.0.1:8090';

// Deterministic substance tiers, keyed on the raw transcript length (the real source size, NOT the note — a thin
// source yields a padded note, so the note length is a poor richness signal). RICH → T2 divergent; THIN → cheap/refuse.
const RICH_CHARS = 12000;   // ~2000+ words of real source → deserves the deep divergent pass
const THIN_CHARS = 1500;    // near-empty → a single cheap pass, ZERO is the expected answer
export function tierOf(transcriptLen) {
  if (transcriptLen >= RICH_CHARS) return 'rich';
  if (transcriptLen < THIN_CHARS) return 'thin';
  return 'medium';
}

// The SI note's own interpretation sections — Arc must NOT consume these (they are pre-written transfer conclusions).
const INTERPRETATION_HEADINGS = [/what this means for fusion/i, /actions?\s*&?\s*open questions/i];

// Strip YAML frontmatter + the interpretation sections from an SI note, leaving the FACTUAL source-core.
export function stripInterpretation(noteMd) {
  let md = String(noteMd || '').replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n+/, ''); // frontmatter
  const lines = md.split(/\r?\n/);
  const out = [];
  let skipping = false;
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/); // top-level note sections are "## "
    if (h) skipping = INTERPRETATION_HEADINGS.some((re) => re.test(h[1]));
    if (!skipping) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function fetchJson(url) { const r = await fetch(url); return r.json(); }

// The factual source-core Arc reasons over: the SI note minus interpretation (preferred), else the raw transcript.
export async function getSourceCore(video) {
  const brief = await fetchJson(`${COCKPIT}/api/source-brief?video=${encodeURIComponent(video)}`);
  if (brief.ok && brief.noted && brief.text) {
    const core = stripInterpretation(brief.text);
    if (core.length > 200) return { core, basis: 'source-core', hasNote: true };
  }
  const tr = await fetchJson(`${COCKPIT}/api/transcript?video=${encodeURIComponent(video)}`);
  if (!tr.ok) throw new Error('no source-core and no transcript: ' + (tr.error || brief.error || 'unknown'));
  return { core: tr.text, basis: 'transcript-fallback', hasNote: false };
}
async function getTranscript(video) {
  const tr = await fetchJson(`${COCKPIT}/api/transcript?video=${encodeURIComponent(video)}`);
  return tr.ok ? tr.text : '';
}

// Normalise a T1 candidate OR a T2 converged "kept" item to ONE atom shape for the register.
export function normalize(k, engine) {
  const t2 = engine === 'T2';
  return {
    spin: k.spin || {},
    source_evidence: k.source_evidence || {},
    transfer_reasoning: k.transfer_reasoning || '',
    fusion_target: k.fusion_target || '',
    category: k.category === 'cash' ? 'cash' : 'brain',
    lens: k.lens || '',
    domain: k.domain || '',
    admission: k.admission || { obvious: null, value: null, kind: 'new' },
    nvfi: k.nvfi || {},
    traps: k.traps || [],
    engine,
    frames: t2 ? (k.contributing_frames || []) : [],
    convergence: t2 ? (k.convergence_type || 'single_frame') : 'single',
    forced_analogy: !!k.forced_analogy,
    graph_note: k.graph_note || '',
  };
}

async function persist({ video, brief, hash, tier, basis, engine, atoms, discarded, zeroReason, tokens, dry }) {
  if (dry) return { mine_id: '(dry)', persisted: 0 };
  const mineId = crypto.randomUUID();
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('begin');
  try {
    const total = (tokens.output || 0) + (tokens.cache_creation || 0) + (tokens.cache_read || 0) + 4;
    await c.query(
      `insert into cockpit.idea_mine (mine_id, source_ref, brief_hash, brief_snapshot, discarded_obvious, zero_reason,
          payload_input_tokens, output_tokens, wrapper_cache_creation_tokens, wrapper_cache_read_tokens, total_reported_tokens, cost_usd, duration_ms)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [mineId, video, hash, brief, JSON.stringify(discarded || []), zeroReason || null,
        tokens.payload_input || null, tokens.output || null, tokens.cache_creation || null, tokens.cache_read || null,
        total, tokens.cost_usd || null, tokens.duration_ms || null]);
    await c.query(`insert into cockpit.idea_event (mine_id, actor, event, note) values ($1,'specialist','mined',$2)`,
      [mineId, `${engine} · ${tier} · ${atoms.length} atoms · basis=${basis}`]);
    let n = 0;
    for (const a of atoms) {
      const ev = verifyEvidence(a.source_evidence, a.__core); // quote must be verbatim in what Arc actually read
      const cid = (await c.query(
        `insert into cockpit.idea_candidate (mine_id, brief_hash, source_evidence, transfer_reasoning, fusion_target, spin, category, lens, nvfi, traps, lifecycle_state)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed') returning candidate_id`,
        [mineId, hash, JSON.stringify(ev), a.transfer_reasoning, a.fusion_target, JSON.stringify(a.spin),
          a.category, a.lens, JSON.stringify(a.nvfi), JSON.stringify(a.traps)])).rows[0].candidate_id;
      await c.query(`insert into cockpit.idea_event (candidate_id, mine_id, actor, event, note) values ($1,$2,'specialist','emitted',$3)`,
        [cid, mineId, `${a.category}·${a.domain || a.lens || ''}`]);
      await upsertAtom(c, {
        source_ref: video, engine: a.engine, frames: a.frames, convergence: a.convergence, category: a.category,
        fusion_target: a.fusion_target, spin: a.spin, transfer_reasoning: a.transfer_reasoning, source_evidence: ev,
        nvfi: a.nvfi, origin: 'production',
        meta: { traps: a.traps, forced_analogy: a.forced_analogy, admission: a.admission, domain: a.domain, graph_note: a.graph_note, lens: a.lens },
      });
      n++;
    }
    await c.query('commit');
    return { mine_id: mineId, persisted: n };
  } catch (e) { try { await c.query('rollback'); } catch { /* */ } throw e; }
  finally { await c.end().catch(() => {}); }
}

export async function runArc(video, opts = {}) {
  const { text: brief, hash } = assembleBrief();
  assembleBrief.__hash = hash;
  const [{ core, basis, hasNote }, transcript] = await Promise.all([getSourceCore(video), getTranscript(video)]);
  const substanceLen = Math.max(transcript.length, hasNote ? 0 : core.length);
  let tier = tierOf(substanceLen);
  const forced = (opts.forceTier || '').toLowerCase();
  if (forced === 't1') tier = 'medium'; else if (forced === 't2') tier = 'rich'; else if (forced === 'thin') tier = 'thin';
  const log = (m) => console.error(`[arc] ${m}`);
  log(`${video} · basis=${basis} (core ${core.length} chars, transcript ${transcript.length}) · tier=${tier}`);

  let atoms = []; let discarded = []; let zeroReason = null; let engine;
  const tokens = { payload_input: 0, output: 0, cache_creation: 0, cache_read: 0, cost_usd: 0, duration_ms: 0 };

  if (tier === 'rich') {
    engine = 'T2';
    const r = await runT2Pipeline(video, core, log);
    const kept = (r.conv.kept || []);
    atoms = kept.map((k) => ({ ...normalize(k, 'T2'), __core: core }));
    discarded = [
      ...r.branchOutputs.flatMap((b) => (b.discarded_obvious || []).map((d) => ({ frame: b.frame, item: d }))),
      ...(r.conv.killed || []).map((k) => ({ killed: k.fusion_target, reason: k.reason })),
    ];
    if (!atoms.length && r.conv.parsed) zeroReason = r.conv.convergence_summary || 'no transfers survived convergence';
    for (const cc of [...r.branchCalls, r.convCall]) {
      if (!cc || !cc.ok) continue;
      tokens.output += cc.output || 0; tokens.cache_creation += cc.cache_creation || 0;
      tokens.cache_read += cc.cache_read || 0; tokens.cost_usd += cc.cost_usd || 0;
      tokens.payload_input += cc.payload_input_est || 0; tokens.duration_ms += cc.duration_ms || 0;
    }
    log(`T2: ${atoms.length} converged atoms · ${discarded.length} discarded/killed · ${(tokens.output + tokens.cache_creation + tokens.cache_read).toLocaleString()} tok`);
  } else {
    // medium/thin: one strong pass with the corrected admission+domains prompt (thin ⇒ ZERO is the expected result).
    engine = 'T1';
    const mineId = crypto.randomUUID();
    const prompt = buildPrompt(brief, core, mineId);
    const call = await callClaude(prompt, `arc-t1-${video}`);
    if (!call.ok) throw new Error('T1 call failed: ' + call.error);
    const out = parseJSON(call.resultText);
    atoms = (out.candidates || []).map((k) => ({ ...normalize(k, 'T1'), __core: core }));
    discarded = out.discarded_obvious || [];
    zeroReason = atoms.length ? null : (out.zero_reason || 'nothing survived');
    tokens.output = call.output || 0; tokens.cache_creation = call.cache_creation || 0;
    tokens.cache_read = call.cache_read || 0; tokens.cost_usd = call.cost_usd || 0;
    tokens.payload_input = call.payload_input_est || Math.ceil(prompt.length / 4); tokens.duration_ms = call.duration_ms || 0;
    log(`T1: ${atoms.length} atoms · tier=${tier}`);
  }

  const res = await persist({ video, brief, hash, tier, basis, engine, atoms, discarded, zeroReason, tokens, dry: opts.dry });
  return {
    ok: true, video, tier, basis, hasNote, engine, atoms: atoms.length, discarded: discarded.length, zero_reason: zeroReason,
    mine_id: res.mine_id, persisted: res.persisted, source_core_chars: core.length, transcript_chars: transcript.length,
    reported_total: (tokens.output || 0) + (tokens.cache_creation || 0) + (tokens.cache_read || 0),
    cost_usd: +tokens.cost_usd.toFixed(4), duration_s: +(tokens.duration_ms / 1000).toFixed(1),
    verified_evidence: atoms.filter((a) => verifyEvidence(a.source_evidence, core).verified).length,
  };
}

async function main() {
  const video = process.argv.find((a) => /^[A-Za-z0-9_-]{6,24}$/.test(a) && a !== process.argv[1]);
  if (!video) { console.error('usage: arc.mjs <video_id> [--force-tier=t1|t2|thin] [--dry]'); process.exit(2); }
  const forceTier = (process.argv.find((a) => a.startsWith('--force-tier=')) || '').split('=')[1];
  const dry = process.argv.includes('--dry');
  const r = await runArc(video, { forceTier, dry });
  console.log(JSON.stringify(r, null, 2));
}
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('arc.mjs')) {
  main().catch((e) => { console.error('[arc] FAILED:', e.stack || e.message); process.exit(1); });
}
