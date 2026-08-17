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
const { writeReconciliation, writeHarvest } = require('./reconcile.cjs');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..', '..', '..');

// ---------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const a = {
    manifest: null, chrome: null, profile: null, port: null,
    state: null, log: null, reconciliation: null, harvest: null,
    lines: null, dryRun: false, reconcileOnly: false, leaseMs: 45_000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const next = () => argv[i += 1];
    if (k === '--manifest') a.manifest = next();
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

async function runLine(session, steps, ctx) {
  const { log, progress, harvest, outcomes } = ctx;
  const first = steps[0];
  const lineNo = first.line;
  const done = new Set(P.completedStepIds(progress));

  const record = (status, detail) => {
    outcomes.push({ line: lineNo, product: first.product, qty: first.qty, status, ...detail });
  };

  // ---- an unresolvable line: no id, and no legal search term ----------
  if (first.unresolvable) {
    P.markHeld(progress, first, 'no ASDA id and no usable search term could be derived from the manifest text');
    record('ambiguous', { reason: 'no-usable-search-term', candidates: [] });
    return;
  }

  let ref = first.product_ref || null;
  let matchedName = null;
  let via = ref ? 'stored-id' : null;

  // ---- resolve the reference -----------------------------------------
  if (!ref) {
    const findStep = steps.find((s) => s.command === 'search');
    let candidates = [];
    let usedTerm = null;

    for (const term of findStep.terms) {
      const found = await withRateLimitRetry(() => session.search(term), log);
      usedTerm = term;
      candidates = found.results || [];
      log(`line ${lineNo}: search "${term}" -> ${candidates.length} candidate(s)`);
      if (candidates.length > 0) break;
    }

    const verdict = await judgeLine(first, candidates, { log });
    if (!verdict.resolved) {
      P.markHeld(progress, findStep, `${verdict.reason}: ${verdict.why}`);
      record('ambiguous', {
        reason: verdict.reason,
        why: verdict.why,
        search_term: usedTerm,
        candidates: (verdict.candidates || []).map((c) => ({ product_ref: c.product_ref, name: c.name })),
      });
      return;
    }

    ref = verdict.product_ref;
    matchedName = verdict.name;
    via = 'searched';
    log(`line ${lineNo}: resolved to ${ref} (${matchedName}) - ${verdict.why}`);

    // The add MUST go through select_search_result: it re-runs the search and
    // refuses any reference not in the live result set. That is the invention
    // guard, and it stays in the path even though the reference came from the
    // candidate list a moment ago.
    if (!done.has(findStep.step_id)) {
      const add = await withRateLimitRetry(() => session.select_search_result(usedTerm, ref), log);
      if (add.added !== true) {
        if (add.reason === 'unavailable' || add.reason === 'product-not-found') {
          P.markUnavailable(progress, findStep, add.reason);
          record('out_of_stock', { product_ref: ref, name: matchedName, reason: add.reason });
          return;
        }
        if (add.reason !== 'already-in-trolley') {
          P.markFailed(progress, findStep, add.reason || 'add-failed');
          record('failed', { product_ref: ref, name: matchedName, reason: add.reason || 'add-failed' });
          return;
        }
      }
      P.markCompleted(progress, findStep, add);
      harvest.push({ line: lineNo, manifest_product: first.product, asda_product_id: ref, name_on_site: add.name || matchedName, qty: first.qty, search_term: usedTerm });
    }
  } else {
    // ---- stored id: add it directly ----------------------------------
    const addStep = steps.find((s) => s.command === 'add_known_product');
    if (addStep && !done.has(addStep.step_id)) {
      const add = await withRateLimitRetry(() => session.add_known_product(ref), log);
      matchedName = add.name || null;
      if (add.added !== true) {
        if (add.reason === 'unavailable' || add.reason === 'product-not-found') {
          P.markUnavailable(progress, addStep, add.reason);
          record('out_of_stock', { product_ref: ref, name: matchedName, reason: add.reason });
          return;
        }
        if (add.reason !== 'already-in-trolley') {
          P.markFailed(progress, addStep, add.reason || 'add-failed');
          record('failed', { product_ref: ref, name: matchedName, reason: add.reason || 'add-failed' });
          return;
        }
      }
      P.markCompleted(progress, addStep, add);
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

  const manifestPath = args.manifest || path.join(REPO, 'Deliverables', '2026-08-17-asdair-frozen-manifest-SHOP-2026-08-19.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const shopRef = manifest.shop_ref || 'SHOP-UNKNOWN';

  const stateFile = args.state || path.join(HERE, 'state', `run-${shopRef}.json`);
  const logFile = args.log || path.join(REPO, 'Deliverables', '2026-08-17-asdair-basket-run-log.json');
  const reconFile = args.reconciliation || path.join(REPO, 'Deliverables', '2026-08-17-asdair-trolley-reconciliation.md');
  const harvestFile = args.harvest || path.join(REPO, 'Deliverables', '2026-08-17-asdair-regulars-harvest.json');

  const plan = buildPlan(manifest);
  const summary = planSummary(manifest);
  log(`manifest ${shopRef}: ${summary.line_count} lines - ${summary.with_stored_id} with a stored id, ${summary.needing_search} needing search`);
  log(`plan: ${plan.length} steps`);

  const progress = loadState(stateFile);
  progress.plan = plan;
  const alreadyDone = P.completedStepIds(progress).length;
  if (alreadyDone) log(`resuming: ${alreadyDone} step(s) already completed in ${stateFile}`);

  const outcomes = [];
  const harvest = [];
  let basket = null;
  let substitutions = null;
  let fatal = null;

  const writeLog = (status) => {
    const payload = {
      work_order: 'WO-2026-08-17-B15-BASKET',
      shop_ref: shopRef,
      started, finished: new Date().toISOString(),
      status,
      manifest: manifestPath,
      plan_summary: summary,
      progress_summary: P.summary(progress),
      shortfall: P.basketShortfall(plan, progress),
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
    writeLog('dry-run');
    return 0;
  }

  // ---- the browser ----------------------------------------------------
  let chrome;
  try {
    chrome = await ensureChrome({ chromePath: args.chrome, profileDir: args.profile, port: args.port }, { log });
  } catch (e) {
    if (e instanceof LauncherConfigError) { log(`LAUNCHER CONFIG ERROR: ${e.message}`); fatal = { kind: 'launcher-config', message: e.message }; writeLog('failed'); return 2; }
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

  const session = new Session({ log });
  let exitCode = 0;

  try {
    await session.open();
    P.setRunnerState(progress, 'running');

    if (!args.reconcileOnly) {
      const filter = parseLineFilter(args.lines);
      const groups = groupByLine(plan);
      for (const [lineNo, steps] of groups) {
        if (filter && !filter.has(lineNo)) continue;
        log(`--- line ${lineNo}: ${steps[0].product} (qty ${steps[0].qty}) ---`);
        try {
          await runLine(session, steps, { log, progress, harvest, outcomes });
        } catch (e) {
          if (e instanceof ReauthRequiredError) throw e;
          log(`line ${lineNo} ERRORED: ${e.message}`);
          P.markFailed(progress, steps[0], e.message.slice(0, 200));
          outcomes.push({ line: lineNo, product: steps[0].product, qty: steps[0].qty, status: 'failed', reason: e.message.slice(0, 200) });
        }
        saveState(stateFile, progress);
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
  writeReconciliation(reconFile, { manifest, outcomes, basket, substitutions, progress, plan, payload });
  writeHarvest(harvestFile, { manifest, harvest });
  log(`wrote ${logFile}`);
  log(`wrote ${reconFile}`);
  log(`wrote ${harvestFile}`);
  return exitCode;
}

/** The shell adapter. Parses argv and hands off to the real entry point. */
async function main(argv) { return runBasket(parseArgs(argv)); }

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch((e) => { console.error('FATAL', e.stack || e.message); process.exitCode = 1; });
}

module.exports = { runBasket, main, parseArgs, parseLineFilter, groupByLine, runLine, readSubstitutionState, acquireLocalLock };
