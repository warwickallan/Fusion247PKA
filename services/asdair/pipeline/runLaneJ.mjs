// =====================================================================
// BUILD-015 AsdAIr - pipeline/runLaneJ.mjs
//
// WO-2026-08-13-15 (WP-B15-47). THE WHOLE INGESTION JOURNEY, IN ONE RUN,
// OVER THE REAL COMMITTED PHOTOGRAPH, AGAINST A REAL (DISPOSABLE) POSTGRES.
//
// ── THE ONE SENTENCE THAT DESCRIBES WHAT THIS IS ─────────────────────────
// The chain is continuous and crosses ONE process boundary, at the credential
// line, because no other crossing is lawful.
//
// ⛔ NOT "end-to-end" without that qualifier. ⛔ NOT a fixture run: every model
// answer replayed here is the real model's real answer to the real photograph,
// captured by captureVisionRun.mjs through the real orchestrator's own prompts.
//
// ── WHAT IS REAL IN THIS PROCESS ─────────────────────────────────────────
// The REAL `createDeps()` container - the same one production builds - with
// exactly TWO substitutions, both named and both justified below. Everything
// else is production: the real catalogue loader, the real region planner and
// renderer, the real sanity checks, the real follow-up decision, the real
// region and PHOTO provenance writers, resolveByCatalogue, shopperRoute, the
// real intent execution, the real planner and rulebook directives, the real
// planWithDecisions provenance seam, and the real browser handoff builder.
//
// SUBSTITUTION 1 - `vision`, and ONLY vision. Replayed from the committed
//   capture. The replay THROWS on any divergence rather than substituting;
//   see visionRunArtefact.mjs for why that refusal is what makes this a chain.
//
// SUBSTITUTION 2 - `consult`, DECLINED LOUDLY. The prose-rulebook consumer is
//   a SECOND gateway call about a different question. This order's `network`
//   is `none`, and anything an authority does not name remains none - so it is
//   not made. Declining is a supported state the module handles: it changes no
//   line and flags every line an inert rule would have spoken about. The
//   deterministic map/exclude/rotate directives DO run - the planner applies
//   those itself - so the household's hard rules are genuinely applied here.
//   Silence was the one option not taken.
//
// ⛔ NO LIVE DATABASE. ⛔ NO TELEGRAM. ⛔ NO PRODUCTION TRIGGER (runtime.js
// sends whatever is queued - firing it would message Mum unprompted).
// ⛔ NO CHECKOUT, PAYMENT, SLOT, OR LIVE ASDA SESSION. This run stops at the
// payload a browser runner would pick up.
//
// ── RUN IT ───────────────────────────────────────────────────────────────
//   ASDAIR_DB_URL=<owner>  ASDAIR_WRITE_DB_URL=<writer>  node runLaneJ.mjs
// =====================================================================

'use strict';

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KNOWN_PHOTO_PATH, KNOWN_PHOTO_SHA256, EXPECTED_INTERPRETER_MODEL,
  assertPhotoIdentity, computeRegionPlan, regionPlanSha256,
  latestArtefactPath, loadArtefact, makeReplayVision,
} from './visionRunArtefact.mjs';

import * as commands from './commands.js';
import { runPipeline, buildBrowserHandoff } from './runPipeline.js';
import { createDeps, closeDeps, realInterpretPhoto } from './deps.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'finalise', 'out');

const argOf = (name, fb = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
};

const requireEnv = (name) => {
  if (!process.env[name]) throw new Error(`runLaneJ: ${name} is not set - this run needs a DISPOSABLE Postgres and will not guess one`);
  return process.env[name];
};

/** Refuse anything that is not obviously a throwaway target. Defence in depth. */
function assertDisposableTarget(url, varName) {
  const u = new URL(url);
  const host = (u.hostname || '').toLowerCase();
  const db = (u.pathname || '').replace(/^\//, '').toLowerCase();
  if (host.includes('supabase') || host.includes('pooler')) {
    throw new Error(`runLaneJ: REFUSING - ${varName} host "${host}" looks live. This run writes, and it only ever writes to a throwaway.`);
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && !db.endsWith('_test')) {
    throw new Error(`runLaneJ: REFUSING - ${varName} must be localhost or a *_test database. Got host "${host}", db "${db}".`);
  }
}

const q = async (deps, sql, params) => (await deps.readQuery(sql, params));

async function main() {
  const householdId = Number(argOf('household', '1'));
  // The production shop_ref shape, enforced by shopState.buildShopCreate:
  // SHOP-YYYY-MM-DD with an optional -M<message id> suffix. The suffix makes
  // repeated runs of this journey distinct without inventing a new format -
  // the constraint is production's and this run lives inside it.
  const listDate = argOf('list-date', '2026-08-13');
  const shopRef = argOf('shop-ref', `SHOP-${listDate}-M${Math.floor(Date.now() / 1000)}`);
  const actor = 'lane-j:runner';

  // ── 0. IDENTITY BEFORE ANYTHING ELSE ───────────────────────────────────
  const photoSha = assertPhotoIdentity(KNOWN_PHOTO_PATH, KNOWN_PHOTO_SHA256);

  const artefactPath = latestArtefactPath();
  const artefact = loadArtefact(artefactPath); // refuses a non-Terra capture
  if (artefact.photo_sha256 !== photoSha) {
    throw new Error(`runLaneJ: artefact was captured from a different photograph (${artefact.photo_sha256}) than this run reads (${photoSha})`);
  }

  // THE CHAIN ASSERTION - recompute the plan the model was actually shown.
  const plan = await computeRegionPlan(readFileSync(KNOWN_PHOTO_PATH));
  const planSha = regionPlanSha256(plan);
  if (planSha !== artefact.region_plan_sha256) {
    throw new Error(
      `runLaneJ: REGION PLAN MISMATCH - this run computes ${planSha}, the capture was taken over ${artefact.region_plan_sha256}. `
      + 'The replayed answers would describe pixels this run never rendered.',
    );
  }

  const dbUrl = requireEnv('ASDAIR_DB_URL');
  const writeUrl = requireEnv('ASDAIR_WRITE_DB_URL');
  assertDisposableTarget(dbUrl, 'ASDAIR_DB_URL');
  assertDisposableTarget(writeUrl, 'ASDAIR_WRITE_DB_URL');

  console.log('─'.repeat(78));
  console.log('LANE J - the whole ingestion journey, one run, real photograph, real Postgres');
  console.log('─'.repeat(78));
  console.log(`photograph        : ${photoSha}`);
  console.log(`artefact          : ${artefactPath.split(/[\\/]/).pop()}`);
  console.log(`interpreter_model : ${artefact.interpreter_model}  (expected ${EXPECTED_INTERPRETER_MODEL})`);
  console.log(`prompt_version    : ${artefact.prompt_version}`);
  console.log(`region_plan_sha256: ${planSha}  MATCHES capture`);
  console.log(`captured calls    : ${artefact.calls.map((c) => `${c.seq}:${c.kind}[${c.regions.join(',')}]`).join('  ')}`);
  console.log(`shop_ref          : ${shopRef}`);
  console.log('');

  // ── 1. THE REAL DEPS CONTAINER, TWO NAMED SUBSTITUTIONS ────────────────
  const replay = makeReplayVision(artefact);
  let rulebookDeclined = 0;

  const deps = createDeps({
    interpretPhoto: (args) => realInterpretPhoto(args, {
      collaboratorOverrides: { vision: replay },
      argOverrides: {
        interpreterModel: artefact.interpreter_model,
        promptVersion: artefact.prompt_version,
      },
    }),
    consult: async () => {
      rulebookDeclined += 1;
      throw new Error('rulebook consultation declined: WO-2026-08-13-15 network is `none`; a prose-rulebook consult is a second gateway call this order does not name');
    },
  });

  // ── 2. RECEIVE THE PHOTOGRAPH AND BUILD THE SHOP ───────────────────────
  await commands.receiveList({
    householdId,
    shopRef,
    listDate,
    sourceKind: 'photo',
    rawMediaPath: KNOWN_PHOTO_PATH,
    needsReview: true,
    actor,
  }, deps);
  await commands.buildShop({ shopRef, actor }, deps);

  // ── 3. DRIVE THE REAL PIPELINE ─────────────────────────────────────────
  const steps = [];
  for (let i = 0; i < 14; i += 1) {
    const r = await runPipeline({ shopRef }, deps);
    steps.push(`${r.step}${r.stepped === false ? '(halt)' : ''}`);
    if (!r.stepped) break;
  }
  console.log(`pipeline steps    : ${steps.join(' -> ')}`);

  // Every captured question must have been asked. A short replay means this
  // run and the capture were not the same journey.
  replay.assertFullyConsumed();
  console.log(`replay            : ${replay.served.length}/${artefact.vision_calls} captured calls consumed, in order`);

  const shopRows = await q(deps, 'select * from asdair.shop where shop_ref = $1', [shopRef]);
  const shop = shopRows.rows[0];
  if (!shop) throw new Error('runLaneJ: this run created no shop row');

  // ── 4. AC2 - PROVENANCE READ BACK, SCOPED TO THIS RUN'S SHOP ───────────
  const prov = await q(deps,
    `select provenance, count(*)::int as n from asdair.shop_line_provenance
      where shop_id = $1 group by provenance order by provenance`, [shop.id]);
  const regions = await q(deps,
    'select count(*)::int as n from asdair.shop_image_region where shop_id = $1', [shop.id]);
  const photoCitingOwnRegion = await q(deps,
    `select count(*)::int as n from asdair.shop_line_provenance p
       join asdair.shop_image_region r on r.id = p.source_region_id
      where p.shop_id = $1 and p.provenance = 'PHOTO' and r.shop_id = $1`, [shop.id]);
  const models = await q(deps,
    `select distinct interpreter_model, prompt_version from asdair.shop_line_provenance
      where shop_id = $1 and provenance = 'PHOTO'`, [shop.id]);

  // ── 5. AC4 - THE BROWSER HANDOFF, THROUGH THE PRODUCTION FUNCTION ──────
  const { handoff, unusableRefs } = await buildBrowserHandoff(deps, shop);

  const lines = await q(deps, 'select * from asdair.shop_line where shop_id = $1 order by line_no', [shop.id]);
  const openQuestions = await q(deps,
    "select count(*)::int as n from asdair.shop_question where shop_id = $1 and status = 'open'", [shop.id]);

  mkdirSync(OUT, { recursive: true });
  const result = {
    lane: 'J',
    work_order: 'WO-2026-08-13-15',
    qualifier: 'The chain is continuous and crosses ONE process boundary, at the credential line, because no other crossing is lawful.',
    reading_count: 1,
    corroboration: 'UNAVAILABLE - one reading cannot corroborate itself. Every observation is support_class "single-reading"; nothing here is corroborated, unanimous or verified.',
    photo_sha256: photoSha,
    artefact: artefactPath.split(/[\\/]/).pop(),
    interpreter_model: artefact.interpreter_model,
    prompt_version: artefact.prompt_version,
    region_plan_sha256: planSha,
    vision_calls_replayed: replay.served.length,
    vision_cost_usd_of_capture: artefact.total_cost_usd,
    shop_id: shop.id,
    shop_ref: shopRef,
    shop_status: shop.status,
    regions_persisted: regions.rows[0].n,
    provenance_by_kind: Object.fromEntries(prov.rows.map((r) => [r.provenance, r.n])),
    photo_rows_citing_this_runs_regions: photoCitingOwnRegion.rows[0].n,
    photo_row_model: models.rows,
    shop_lines: lines.rows.length,
    rulebook_consultations_declined: rulebookDeclined,
    open_questions: openQuestions.rows[0].n,
    // AC2, stated honestly rather than implied by the counts above. Two of the
    // four kinds are gated behind things this run legitimately does not have:
    // RULE needs a prose-rulebook consult (a SECOND gateway call this order's
    // `network: none` forbids) or a deterministic directive that fires on these
    // lines; WARWICK is definitionally downstream of a human answering an open
    // question, and this run must never invent one.
    provenance_kinds_gated: {
      RULE: 'not emitted - the prose rulebook consult was declined (network: none) and no deterministic directive applied to these lines',
      WARWICK: 'not emitted - requires a recorded human decision; this run halted with open questions and inventing an answer would fabricate the step',
    },
    handoff,
    unusable_refs: unusableRefs || [],
  };
  writeFileSync(join(OUT, 'lane-j-run.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  // ── 6. REPORT ──────────────────────────────────────────────────────────
  console.log('');
  console.log(`shop              : id=${shop.id} status=${shop.status}`);
  console.log(`regions persisted : ${result.regions_persisted}`);
  console.log(`provenance by kind: ${JSON.stringify(result.provenance_by_kind)}`);
  console.log(`PHOTO citing own  : ${result.photo_rows_citing_this_runs_regions}`);
  console.log(`PHOTO row model   : ${JSON.stringify(result.photo_row_model)}`);
  console.log(`shop_line rows    : ${result.shop_lines}`);
  console.log(`rulebook declined : ${rulebookDeclined}`);
  console.log(`handoff lines     : ${(handoff.lines || []).length}  held: ${(handoff.held || []).length}`);
  console.log(`handoff counts    : ${JSON.stringify(handoff.counts)}`);
  console.log(`handoff expected  : ${JSON.stringify(handoff.expected)}`);
  console.log(`brand sort        : contract=${handoff.sort_contract} declared=${handoff.sort_contract_declared} verified=${handoff.sort_contract_verified}`);
  console.log(`open questions    : ${openQuestions.rows[0].n}  <- the journey HALTS here by design, for a human`);
  console.log('');
  console.log(`wrote ${join(OUT, 'lane-j-run.json')}`);

  await closeDeps();
}

main().catch(async (err) => {
  console.error(`\nrunLaneJ: STOPPED - ${err.message}`);
  console.error('A run that stops with an accurate account of where it stopped is a better result');
  console.error('than one that completes by bridging a gap.');
  try { await closeDeps(); } catch { /* no-op */ }
  process.exitCode = 1;
});
