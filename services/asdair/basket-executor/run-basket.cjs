#!/usr/bin/env node
// =====================================================================
// WO-2026-08-17-B15-BASKET - THE AI-CAPABLE BASKET EXECUTOR.
//
// A ONE-SHOT, MANUALLY INVOKED executor. It is explicitly NOT automation and
// makes no automation claim: a human runs it, watches it, and can take the
// browser over at any moment. Weekly automation is separate later work.
//
//   HANDS      browser-runner/{cdp,browser,guards,commands,lease,progress}
//              - reused, not rewritten, and guards.cjs is not touched.
//   JUDGEMENT  judge.cjs -> FUSION_GATEWAY_URL, for the 16 lines with no
//              stored ASDA id. No Claude Code session is in this path.
//
// WHAT IT WILL NOT DO. Not "disabled" - absent, and refused a second time by
// guards.cjs on every navigation and every click:
//   checkout · payment · booking or changing a delivery slot · entering any
//   password or card detail · enabling substitutions · accepting a substitute.
//
// The substitutions control is READ and REPORTED here, never clicked. It is not
// this executor's to change in either direction.
//
// NO DATABASE. Progress is a local JSON file, so a resumed run re-reads what it
// already did rather than re-adding it. Harvested ASDA references are WRITTEN
// OUT as an operations file for a human to apply; this process makes no
// live-data write of any kind.
//
// RUN
//   node --env-file=C:/.fusion247/asdair.env services/asdair/basket-executor/run-basket.cjs \
//        --manifest Deliverables/2026-08-17-asdair-frozen-manifest-SHOP-2026-08-19.json \
//        --chrome "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
//        --profile "C:/.fusion247/asdair/chrome-profile" --port 9222
//
//   Add --lines 1-8 to run a slice, --reconcile-only to just read the trolley
//   back, --dry-run to plan and judge nothing and touch nothing.
// =====================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const P = require('../browser-runner/progress.cjs');
const lease = require('../browser-runner/lease.cjs');
const { Session, ReauthRequiredError, RateLimitedError, sleep } = require('../browser-runner/browser.cjs');
const { ensureChrome, LauncherConfigError } = require('./launcher.cjs');
const { buildPlan, planSummary } = require('./plan.cjs');
const { judgeLine } = require('./judge.cjs');
const { writeReconciliation, writeHarvest, reconcile } = require('./reconcile.cjs');
const { methodPolicy, methodReport, rulesForRun } = require('./method.cjs');
const { resolveLine, UNRESOLVED } = require('./resolve.cjs');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..', '..', '..');

// ---------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const a = {
    manifest: null, cataloguePath: null, rulesPath: null, outDir: null,
    chrome: null, profile: null, port: null,
    state: null, log: null, reconciliation: null, harvest: null,
    lines: null, dryRun: false, reconcileOnly: false, leaseMs: 45_000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const next = () => argv[i += 1];
    if (k === '--manifest') a.manifest = next();
    else if (k === '--catalogue') a.cataloguePath = next();
    else if (k === '--rules') a.rulesPath = next();
    else if (k === '--out') a.outDir = next();
    else if (k === '--chrome') a.chrome = next();
    else if (k === '--profile') a.profile = next();
    else if (k === '--port') a.port = next();
    else if (k === '--state') a.state = next();
    else if (k === '--log') a.log = next();
    else if (k === '--reconciliation') a.reconciliation = next();
    else if (k === '--harvest') a.harvest = next();
    else if (k === '--lines') a.lines = next();
    else if (k === '--lease-ms') a.leaseMs = Number(next());
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--reconcile-only') a.reconcileOnly = true;
  }
  return a;
}

/** "1-8" / "3,9,14" / "1-8,20" -> a Set of line numbers, or null for all. */
function parseLineFilter(spec) {
  if (!spec) return null;
  const out = new Set();
  for (const part of String(spec).split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`unreadable --lines segment: ${JSON.stringify(part)}`);
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    for (let n = from; n <= to; n += 1) out.add(n);
  }
  return out;
}

// ---------------------------------------------------------------------
// durable local state
// ---------------------------------------------------------------------

function loadState(file) {
  try { return P.normalise(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return P.normalise({}); }
}

function saveState(file, progress) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------
// single writer, without a database
// ---------------------------------------------------------------------

/**
 * ONE executor drives the trolley at a time.
 *
 * A stale lock is adopted rather than obeyed forever: a crashed run must not
 * lock the shop out until someone deletes a file by hand. `ttlMs` is what makes
 * "held" a claim about the present rather than about history.
 */
function acquireLocalLock(file, runnerId, ttlMs, log) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const held = JSON.parse(fs.readFileSync(file, 'utf8'));
    const age = Date.now() - Number(held.at || 0);
    if (age < ttlMs) {
      throw new Error(
        `another executor holds the trolley lock (runner ${held.runner_id}, ${Math.round(age / 1000)}s ago). `
        + 'Refusing to become a second writer. Wait, or remove ' + file + ' if that run is definitely dead.',
      );
    }
    log(`adopting a stale trolley lock from runner ${held.runner_id} (${Math.round(age / 1000)}s old)`);
  } catch (e) {
    if (/another executor holds/.test(e.message)) throw e;
    // no lock file, or an unreadable one - ours to take
  }
  fs.writeFileSync(file, JSON.stringify({ runner_id: runnerId, at: Date.now(), pid: process.pid }));
  return { release: () => { try { fs.unlinkSync(file); } catch { /* already gone */ } } };
}

// ---------------------------------------------------------------------
// the substitutions control - READ ONLY. NEVER CLICKED.
// ---------------------------------------------------------------------

/**
 * Report the state of ASDA's "Allow substitutions for all" control.
 *
 * READ ONLY, and deliberately so. guards.cjs refuses to click that control in
 * EITHER direction - its deny vocabulary matches the word itself - and this
 * executor does not weaken that. If the control needs changing, a human changes
 * it. This function's whole output is an observation for the report.
 */
async function readSubstitutionState(session) {
  const text = await session.evaluate('(document.body && document.body.innerText || "").slice(0, 20000)');
  const body = String(text || '');
  const phrase = /allow\s+substitut\w*\s+for\s+all/i;
  const present = phrase.test(body);
  const window = present ? body.slice(Math.max(0, body.search(phrase) - 120), body.search(phrase) + 240) : null;
  return {
    control_present_on_page: present,
    // Reported verbatim for a human to read. No inference is made about the
    // checkbox from surrounding prose: innerText does not carry checked state.
    surrounding_text: window,
    note: present
      ? 'control found on the trolley page - its ticked/unticked state is NOT readable from page text and was NOT clicked'
      : 'control not present in the trolley page text (an empty or near-empty trolley often does not render it)',
  };
}

// ---------------------------------------------------------------------
// per-line execution
// ---------------------------------------------------------------------

function groupByLine(plan) {
  const map = new Map();
  for (const step of plan) {
    if (!map.has(step.line)) map.set(step.line, []);
    map.get(step.line).push(step);
  }
  return map;
}

async function withRateLimitRetry(fn, log, attempts = 2) {
  for (let i = 1; ; i += 1) {
    try { return await fn(); } catch (e) {
      if (e instanceof RateLimitedError && i < attempts) {
        log(`rate limited - backing off 30s (attempt ${i}/${attempts})`);
        await sleep(30_000);
        continue;
      }
      throw e;
    }
  }
}

/**
 * One manifest line: IDENTIFY it, then ADD it.
 *
 * The identification half now lives entirely in resolve.cjs, which walks
 * Warwick's settled ladder - stored id, then the Favourites/Regulars grid by
 * canonical ASDA description, then live search, then the model over real
 * candidates. What used to be here was rung 1 followed immediately by rung 3,
 * which is the defect of 2026-08-17: a free search per line for products that
 * were on the Favourites page all along.
 *
 * The ADD half is unchanged in every respect that matters for safety. A
 * reference that came from search is still added through
 * `select_search_result`, which re-runs the search and refuses any reference
 * not in the live result set - the invention guard stays in the path.
 */
async function runLine(session, steps, ctx) {
  const { log, progress, harvest, outcomes, policy, favourites, catalogue } = ctx;
  const first = steps[0];
  const lineNo = first.line;
  const done = new Set(P.completedStepIds(progress));

  const record = (status, detail) => {
    outcomes.push({ line: lineNo, product: first.product, qty: first.qty, status, ...detail });
  };

  const findStep = steps.find((s) => s.command === 'search') || first;

  // ---- IDENTIFY -------------------------------------------------------
  const id = await withRateLimitRetry(() => resolveLine(first, {
    session, policy, favourites, catalogue, log,
    judge: (line, candidates) => judgeLine(line, candidates, { log }),
  }), log);

  if (!id.resolved) {
    // GAP 6. The two states are kept apart all the way out to the report,
    // because they need opposite handling: an absence is recorded and dropped,
    // an ambiguity stops the line and asks.
    if (id.kind === UNRESOLVED.UNAVAILABLE) {
      P.markUnavailable(progress, findStep, id.reason);
      record('out_of_stock', { reason: id.reason, why: id.why, search_term: id.search_term || null });
      return;
    }
    P.markHeld(progress, findStep, `${id.reason}: ${id.why || ''}`);
    record('ambiguous', {
      reason: id.reason,
      why: id.why,
      search_term: id.search_term || null,
      answerable_by_warwick: id.answerable_by_warwick !== false,
      candidates: id.candidates || [],
    });
    return;
  }

  const ref = id.product_ref;
  let matchedName = id.name;
  const via = id.via;
  log(`line ${lineNo}: identity via ${via} -> ${ref}${matchedName ? ` (${matchedName})` : ''}`);

  // ---- ADD ------------------------------------------------------------
  const addStep = steps.find((s) => s.command === 'add_known_product') || findStep;
  if (!done.has(addStep.step_id)) {
    const add = id.search_term
      ? await withRateLimitRetry(() => session.select_search_result(id.search_term, ref), log)
      : await withRateLimitRetry(() => session.add_known_product(ref), log);
    matchedName = add.name || matchedName;

    if (add.added !== true) {
      if (add.reason === 'unavailable' || add.reason === 'product-not-found') {
        P.markUnavailable(progress, addStep, add.reason);
        record('out_of_stock', { product_ref: ref, name: matchedName, via, reason: add.reason });
        return;
      }
      if (add.reason !== 'already-in-trolley') {
        P.markFailed(progress, addStep, add.reason || 'add-failed');
        record('failed', { product_ref: ref, name: matchedName, via, reason: add.reason || 'add-failed' });
        return;
      }
    }
    P.markCompleted(progress, addStep, add);

    // Harvest is an OPTIMISATION and is recorded as one. The line was bought
    // on its description; storing the reference only makes next week faster.
    if (id.harvest) {
      harvest.push({
        line: lineNo, manifest_product: first.product, asda_product_id: ref,
        name_on_site: add.name || matchedName, qty: first.qty, search_term: id.search_term || null,
      });
    }
  }

  // ---- the quantity. ALWAYS, including qty 1 (SOP-021 fact 10) --------
  const qtyStep = steps.find((s) => s.command === 'set_quantity');
  let qtyResult = null;
  if (qtyStep && !done.has(qtyStep.step_id)) {
    qtyResult = await withRateLimitRetry(() => session.set_quantity(ref, first.qty), log);
    if (qtyResult.ok) P.markCompleted(progress, qtyStep, qtyResult);
    else P.markFailed(progress, qtyStep, qtyResult.reason || 'quantity-not-set');
  }

  record(qtyResult && qtyResult.ok === false ? 'added_wrong_qty' : 'added', {
    product_ref: ref,
    name: matchedName,
    via,
    qty_target: first.qty,
    qty_actual: qtyResult ? qtyResult.qty : null,
    qty_reason: qtyResult && !qtyResult.ok ? qtyResult.reason : null,
  });
}

// ---------------------------------------------------------------------
// main
// ---------------------------------------------------------------------

/**
 * THE ENTRY POINT, AND IT IS NOT ARGV-SHAPED.
 *
 * Tonight a human starts this from a shell, because credentials and runtime
 * wiring are not autonomous yet. Next week the waking event is Mum's own input
 * through ShopperBot or the Cockpit, and that caller must not have to
 * synthesise a command line or re-implement anything here.
 *
 * So the executable work takes an OPTIONS OBJECT and `main(argv)` is a thin
 * shell adapter over it. An event caller supplies the same fields directly and
 * gets the same run - no rewrite, no second code path, and nothing about the
 * shopping decisions changes with who invoked it.
 */
async function runBasket(args = {}) {
  args = { leaseMs: 45_000, ...args };
  const started = new Date().toISOString();
  const lines = [];
  const log = (m) => { const s = `[${new Date().toISOString()}] ${m}`; lines.push(s); console.log(s); };

  // ── THE JOIN. THE LINE THAT HAD NEVER ONCE WORKED. ────────────────────────
  //
  // `args.manifest` arrives as one of two things, and this function assumed
  // only one of them:
  //
  //   * a PATH, from `main(argv)` - the CLI shape, which worked;
  //   * an OBJECT, from pipeline/runtime.js -> basket-executor/consume-request.cjs,
  //     which builds the manifest in memory from durable rows and passes it
  //     straight in as `runBasket({ manifest, ... })`.
  //
  // Handing the object to `fs.readFileSync` throws, verbatim:
  //   TypeError: The "path" argument must be of type string or an instance of
  //   Buffer or URL. Received an instance of Object
  //
  // which is exactly what `runtime.log` recorded 291 times between 2026-07-28
  // and the Veritas Gate 2 review - on every pass, unbounded, with the request
  // released back to `queued` each time so the next pass retried it forever.
  //
  // ⛔ THE SIZE OF IT: the browser lane has therefore NEVER EXECUTED A SINGLE
  // REQUEST since the day it was wired. Every claim died on this line before a
  // browser was ever launched. The 291 failures were not a flaky browser, a
  // stale ASDA session or a changed page - they were one unconverted argument,
  // repeating in a loop with no ceiling to make anyone look at it.
  const manifest = (args.manifest !== null && typeof args.manifest === 'object')
    ? args.manifest
    : JSON.parse(fs.readFileSync(
      args.manifest || path.join(REPO, 'Deliverables', '2026-08-17-asdair-frozen-manifest-SHOP-2026-08-19.json'),
      'utf8',
    ));
  if (!manifest || !Array.isArray(manifest.lines)) {
    throw new Error('runBasket: the manifest carries no `lines` array. Refusing to shop from an '
      + 'unreadable manifest rather than reporting an empty basket as a successful one.');
  }
  const shopRef = manifest.shop_ref || 'SHOP-UNKNOWN';
  // WHERE THE MANIFEST CAME FROM, for the run artefact. An in-memory manifest
  // is now the ORDINARY production case (the runtime builds it from durable
  // rows), so the log says so rather than recording an object as a filename.
  const manifestSource = (args.manifest !== null && typeof args.manifest === 'object')
    ? 'in-memory, built from asdair.shop_line by consume-request.cjs'
    : String(args.manifest || 'the default frozen manifest');

  // ── PER-RUN ARTEFACT PATHS. THE OVERWRITE BUG, CLOSED. ────────────────────
  //
  // These three files used to default to fixed per-date paths in Deliverables/,
  // so EVERY invocation silently replaced the previous one's record. On
  // 2026-08-17 that destroyed the record of the real full run: what survived on
  // disk is a later 2-line invocation reporting "Added 2 - not attempted 35",
  // and three different totals for one shop were reported from it in good
  // faith. An artefact that can be overwritten by the next run is not evidence.
  //
  // The run id is time-ordered and unique, so runs sort and none collides.
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const outDir = args.outDir || path.join(HERE, 'state', 'runs', shopRef, runId);
  const stateFile = args.state || path.join(HERE, 'state', `run-${shopRef}.json`);
  const logFile = args.log || path.join(outDir, 'basket-run-log.json');
  const reconFile = args.reconciliation || path.join(outDir, 'trolley-reconciliation.md');
  const harvestFile = args.harvest || path.join(outDir, 'regulars-harvest.json');

  // ── THE HOUSEHOLD CONTEXT ────────────────────────────────────────────────
  // Supplied by the caller (the runtime reads it from the durable rows) or by
  // path for a hand-run. ABSENT IS LOGGED LOUDLY: with no catalogue there is no
  // bridge from Mum's wording to the canonical ASDA description, so the
  // Favourites rung degrades to the manifest text alone - which is exactly the
  // silent degradation that must never look like a normal run.
  const catalogue = args.catalogue
    || (args.cataloguePath ? JSON.parse(fs.readFileSync(args.cataloguePath, 'utf8')) : null);
  const rules = args.rules
    || (args.rulesPath ? JSON.parse(fs.readFileSync(args.rulesPath, 'utf8')) : null);

  // ── GAP 10. WHICH METHOD IS THIS RUN OBEYING? ────────────────────────────
  const policy = methodPolicy(args.browserMethod);
  const method = methodReport(args.browserMethod);
  const ruleSet = rulesForRun(rules);

  const plan = buildPlan(manifest);
  const summary = planSummary(manifest);
  log(`manifest ${shopRef}: ${summary.line_count} lines - ${summary.with_stored_id} with a stored id, ${summary.needing_search} to be identified`);
  log(`browser method v${method.instructions_version}: ${method.delivered} instructions delivered, ${method.implemented_here} implemented by this executor`);
  log(`  Favourites-first: ${policy.favouritesFirst ? 'ON' : 'OFF'} · trolley reconciliation from the quantity field: ${policy.reconcileFromQuantityField ? 'ON' : 'OFF'}`);
  if (method.delivered_but_not_implemented_here.length) {
    log(`  delivered but NOT performed here: ${method.delivered_but_not_implemented_here.join(', ')}`);
  }
  log(`household rules active: ${ruleSet.count}${ruleSet.count ? ` (${ruleSet.ids.join(', ')})` : ' - NONE SUPPLIED, so no household rule reached this run'}`);
  const catalogueRows = catalogue ? ((catalogue.rows || catalogue).length || 0) : 0;
  log(catalogue
    ? `household catalogue: ${catalogueRows} rows - canonical ASDA descriptions available for identity`
    : 'household catalogue: NONE SUPPLIED - identity falls back to the manifest wording alone');
  log(`plan: ${plan.length} steps`);
  log(`run artefacts: ${outDir}`);

  // ── GAP 7. DURABLE PROGRESS COMES FROM THE CALLER WHEN THERE IS ONE ──────
  //
  // A local JSON file beside the source is fine for a hand-run and is NOT a
  // durable dependency: a resumed run on a fresh checkout, another working
  // directory or another machine would find nothing and re-add the lot. When
  // the runtime invokes this it passes the progress it read out of the durable
  // request row, and that wins - the file is then only a local convenience.
  const progress = args.resumeFrom ? P.normalise(args.resumeFrom) : loadState(stateFile);
  progress.plan = plan;
  const alreadyDone = P.completedStepIds(progress).length;
  if (alreadyDone) {
    log(`resuming: ${alreadyDone} step(s) already completed${args.resumeFrom ? ' (carried in the durable request row)' : ` in ${stateFile}`}`);
  }

  // Flush after every line. `saveState` keeps the local file; this is what
  // makes the progress survive the process, and a failure to flush is LOUD
  // rather than silent - an unflushed step is a step that will be re-added.
  const flush = async () => {
    saveState(stateFile, progress);
    if (typeof args.onProgress === 'function') {
      try { await args.onProgress(progress); } catch (e) { log(`DURABLE PROGRESS FLUSH FAILED: ${e.message} - a restart will re-do work from here`); }
    }
  };

  const outcomes = [];
  const harvest = [];
  let basket = null;
  let favourites = [];
  let favouritesRead = null;
  let substitutions = null;
  let fatal = null;

  const writeLog = (status) => {
    // ONE reconciliation, from the page, and the run log carries the SAME
    // object the report renders. Two derivations of "what is in the basket"
    // is how three totals were reported for one shop.
    const truth = basket ? reconcile({ manifest, outcomes, basket, catalogue }) : null;
    const payload = {
      work_order: 'WO-2026-08-18-B15-RUNTIME',
      shop_ref: shopRef,
      run_id: runId,
      started, finished: new Date().toISOString(),
      status,
      manifest: manifestSource,
      browser_method: method,
      method_policy: policy,
      household_rules: { count: ruleSet.count, ids: ruleSet.ids },
      household_catalogue_rows: catalogueRows,
      favourites_read: favouritesRead,
      plan_summary: summary,
      progress_summary: P.summary(progress),
      // The single count. Derived from the trolley, or absent - never guessed.
      reconciliation: truth ? { summary: truth.summary, ready: truth.ready } : null,
      basket_ready: truth ? truth.ready.ready : false,
      outcomes,
      harvested_ids: harvest,
      basket,
      substitutions,
      fatal,
      console: lines,
    };
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, JSON.stringify(payload, null, 2));
    return payload;
  };

  if (args.dryRun) {
    log('DRY RUN - no browser, no gateway, no trolley. Plan built and validated only.');
    P.setRunnerState(progress, 'dry_run');
    saveState(stateFile, progress);
    const dry = writeLog('dry-run');
    return { exitCode: 0, runId, outDir, shopRef, basketReady: false, blockers: [{ kind: 'dry-run', detail: 'no browser, no gateway, no trolley' }], reconciliation: dry.reconciliation, artefacts: { log: logFile } };
  }

  // ---- the browser ----------------------------------------------------
  //
  // ── THE SEAM, AND WHY IT EXISTS (WO-2026-08-18-06 REV 2) ─────────────────
  // `ensureChrome` and `Session` were reached by direct construction, so this
  // function could not be executed at all without a real Chrome and a real
  // signed-in ASDA session. That is why a one-line argument defect survived 291
  // failures and three weeks: NOTHING could run the lane end to end to see it.
  //
  // These two overrides default to the real implementations, so production is
  // byte-identical, and they let the suite drive the REAL plan / ladder / judge
  // / reconcile code over a fake session. A lane nobody can exercise offline is
  // a lane whose failures are only ever discovered in production, which is
  // precisely what happened here.
  const acquireChrome = args.ensureChrome || ensureChrome;
  const makeSession = args.makeSession || ((opts) => new Session(opts));

  let chrome;
  try {
    chrome = await acquireChrome({ chromePath: args.chrome, profileDir: args.profile, port: args.port }, { log });
  } catch (e) {
    if (e instanceof LauncherConfigError) {
      log(`LAUNCHER CONFIG ERROR: ${e.message}`);
      fatal = { kind: 'launcher-config', message: e.message };
      writeLog('failed');
      return { exitCode: 2, runId, outDir, shopRef, basketReady: false, blockers: [{ kind: 'launcher-config', detail: e.message }], reconciliation: null, artefacts: { log: logFile } };
    }
    throw e;
  }
  process.env.ASDAIR_CDP_ENDPOINT = chrome.endpoint;
  log(`chrome: ${chrome.reused ? 'REUSED existing' : 'launched'} ${chrome.version.Browser} on ${chrome.endpoint}`);

  // ---- single writer ---------------------------------------------------
  // lease.cjs's claim/heartbeat/release are SQL against asdair.browser_build_request
  // and are unreachable without a database this executor deliberately does not
  // use. What IS reusable from it is `newRunnerId()`, which is pure - so the run
  // identity stays the estate's, and the mutual exclusion becomes a local lock
  // over the one thing that actually needs protecting here: the trolley.
  const runnerId = lease.newRunnerId();
  const lock = acquireLocalLock(path.join(HERE, 'state', `${shopRef}.lock`), runnerId, args.leaseMs, log);
  log(`runner ${runnerId} holds the local trolley lock`);

  const session = makeSession({ log });
  let exitCode = 0;

  try {
    await session.open();
    P.setRunnerState(progress, 'running');

    if (!args.reconcileOnly) {
      // ── THE FAVOURITES GRID, READ ONCE, BEFORE ANY LINE IS TOUCHED ───────
      //
      // One navigation for the whole shop. `one_session_one_page_context` says
      // "the whole speed of this method is many items from one page" and rule
      // 40 says the DEFAULT is a full pass over Regulars, not a hunt per line.
      // Reading it up front is what turns those from instructions into
      // behaviour: every line below is then matched against a list already in
      // memory, at no further page cost.
      if (policy.favouritesFirst) {
        try {
          const grid = await withRateLimitRetry(() => session.read_regulars(), log);
          favourites = grid.items || [];
          favouritesRead = {
            count: favourites.length,
            with_reference: favourites.filter((f) => f.product_ref).length,
            bulk_control_present: grid.bulk_control_present,
            checkbox_count: grid.checkbox_count,
          };
          log(`Favourites/Regulars: ${favourites.length} product(s) read from one page (${favouritesRead.with_reference} carrying an ASDA reference)`);
        } catch (e) {
          if (e instanceof ReauthRequiredError) throw e;
          // A grid that will not load is a DEGRADED run, not a failed one: the
          // ladder still has search and the model beneath it. It is recorded
          // so nobody reads the resulting search count as normal.
          favouritesRead = { count: 0, error: e.message.slice(0, 200) };
          log(`Favourites/Regulars could NOT be read (${e.message}) - every line now falls through to search. This run is DEGRADED.`);
        }
      } else {
        favouritesRead = { count: 0, skipped: 'the pinned browser method does not carry regulars_favourites_first' };
        log('Favourites-first is OFF for this run because the pinned browser method does not carry regulars_favourites_first');
      }

      const filter = parseLineFilter(args.lines);
      const groups = groupByLine(plan);
      for (const [lineNo, steps] of groups) {
        if (filter && !filter.has(lineNo)) continue;
        log(`--- line ${lineNo}: ${steps[0].product} (qty ${steps[0].qty}) ---`);
        try {
          await runLine(session, steps, { log, progress, harvest, outcomes, policy, favourites, catalogue });
        } catch (e) {
          if (e instanceof ReauthRequiredError) throw e;
          log(`line ${lineNo} ERRORED: ${e.message}`);
          P.markFailed(progress, steps[0], e.message.slice(0, 200));
          outcomes.push({ line: lineNo, product: steps[0].product, qty: steps[0].qty, status: 'failed', reason: e.message.slice(0, 200) });
        }
        await flush();
      }
    }

    // ---- read the trolley back. Verified, never assumed ---------------
    log('reading the trolley back');
    basket = await session.read_basket();
    P.applyBasketRead(progress, basket);
    substitutions = await readSubstitutionState(session);
    P.setRunnerState(progress, 'basket_ready');
  } catch (e) {
    exitCode = 1;
    if (e instanceof ReauthRequiredError) {
      log(`STOPPING: ${e.message}`);
      P.setReauthRequired(progress, true, e.reauth_reason);
      fatal = { kind: 'reauth-required', message: e.message };
    } else {
      log(`FAILED: ${e.stack || e.message}`);
      P.setRunnerState(progress, 'failed');
      fatal = { kind: 'error', message: e.message };
    }
  } finally {
    session.close();
    lock.release();
    saveState(stateFile, progress);
  }

  const payload = writeLog(fatal ? 'failed' : 'completed');
  writeReconciliation(reconFile, { manifest, outcomes, basket, substitutions, progress, plan, payload, catalogue });
  writeHarvest(harvestFile, { manifest, harvest });
  log(`wrote ${logFile}`);
  log(`wrote ${reconFile}`);
  log(`wrote ${harvestFile}`);

  // ── THE ANNOUNCEMENT GATE ────────────────────────────────────────────────
  //
  // Warwick: "'Mum's basket is ready' may not be issued until that
  // reconciliation is truthful. A total and item count are insufficient."
  //
  // So the phrase is returned as a FIELD the caller may only pass on when the
  // gate is open. It is deliberately not a log line the caller could scrape,
  // and it is deliberately not computed twice.
  const ready = payload.reconciliation ? payload.reconciliation.ready : { ready: false, blockers: [{ kind: 'trolley-not-read', detail: 'no reconciliation was produced' }] };
  if (ready.ready) log('RECONCILED and truthful: Mum\'s basket is ready.');
  else log(`NOT announceable: ${ready.blockers.length} blocker(s) - ${ready.blockers.map((b) => b.kind).join(', ')}`);

  return {
    exitCode,
    runId,
    outDir,
    shopRef,
    basketReady: ready.ready,
    blockers: ready.blockers,
    reconciliation: payload.reconciliation,
    artefacts: { log: logFile, reconciliation: reconFile, harvest: harvestFile },
  };
}

/** The shell adapter. Parses argv and hands off to the real entry point. */
async function main(argv) { return runBasket(parseArgs(argv)); }

if (require.main === module) {
  main(process.argv.slice(2))
    .then((r) => { process.exitCode = r && typeof r === 'object' ? r.exitCode : r; })
    .catch((e) => { console.error('FATAL', e.stack || e.message); process.exitCode = 1; });
}

module.exports = { runBasket, main, parseArgs, parseLineFilter, groupByLine, runLine, readSubstitutionState, acquireLocalLock };
