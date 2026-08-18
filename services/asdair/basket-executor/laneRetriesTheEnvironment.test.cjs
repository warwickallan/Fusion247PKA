// =====================================================================
// BUILD-015 AsdAIr WO-2026-08-18-07 - laneRetriesTheEnvironment.test.cjs
//
// Runs under: node --test
//
// A CONFIGURATION FAILURE IS NOT A PERMANENT FAILURE.
//
// -- THE INCIDENT ------------------------------------------------------------
// On 2026-08-18, between 21:22:48Z and 21:26:03Z, browser build requests 1, 2,
// 5 and 7 were terminated with `last_error='launcher-config'` - AFTER the
// three-week-old manifest join defect had been fixed and the join had provably
// worked (50 lines built for shop 6, 38 for shop 26). Three environment
// variables were absent, `ensureChrome` threw `LauncherConfigError`, the run
// returned `basket_not_ready`, and `consume-request.cjs` called
// `lease.finish(status:'failed')` ON THE FIRST ATTEMPT - no retry, no backoff,
// no re-queue - and overwrote `progress` with `{"executor": null}`, discarding
// the executor progress the Gap 7 recovery design exists to preserve.
//
// Shop 26 was left at `WAITING_FOR_BROWSER` -> `AWAIT_RUNNER` with its only
// request terminal and no route back.
//
// Veritas, defect 6: "No test covers the `basket_not_ready` -> terminal
// `failed` path. The only 'failed' assertions in that suite are on the
// attempt-ceiling path, so the behaviour that fired four times in production
// has no proof and no guard." This file is that guard.
//
// -- WHAT IS PROVEN, AND WHAT IS NOT ----------------------------------------
// PROVES, by execution: an environment-class blocker is RELEASED with a counted
// attempt and a recorded failure class rather than finished terminally; a
// run-class failure still finishes terminally; carried executor progress is no
// longer discarded; and the re-queue rule reads the CLASS and never the error
// message.
//
// DOES NOT PROVE: that a real Chrome ever launches. No browser runs under
// `network: none`, and the first real execution of this lane belongs to the
// joined live run.
//
// PURE ASCII. No database, no network, no browser.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { consumeOneBrowserBuildRequest, ENVIRONMENT_BLOCKERS, environmentBlockers } = require('./consume-request.cjs');
const lease = require('../browser-runner/lease.cjs');

// ---------------------------------------------------------------------
// A fake write pool that ROUTES on the statement shape and RECORDS every
// statement it was given. The lease's own SQL is what runs - this file does not
// re-implement it - so a change to which lease call the consumer makes is
// visible here as a different statement, not as a different mock.
// ---------------------------------------------------------------------
function fakePool({ claimed, releaseStatus = 'queued', attempts = 1 }) {
  const statements = [];
  const query = async (text, params) => {
    statements.push({ text, params });
    if (/update asdair\.browser_build_request b/.test(text) && /set status\s*=\s*'running'/.test(text)) {
      return { rows: claimed ? [claimed] : [] };
    }
    if (/_released_reason/.test(text)) {
      return { rows: [{ id: claimed.id, status: releaseStatus, attempts, retry_after: '2026-08-18T21:30:00Z', failure_class: params[5] }] };
    }
    if (/finished_at = now\(\)/.test(text)) {
      return { rows: [{ id: claimed.id, status: params[2], progress: params[3], finished_at: 'now' }] };
    }
    return { rows: [] };
  };
  query.statements = statements;
  query.released = () => statements.filter((s) => /_released_reason/.test(s.text));
  query.finished = () => statements.filter((s) => /finished_at = now\(\)/.test(s.text) && !/_released_reason/.test(s.text));
  return query;
}

const SHOP = { id: 26, shop_ref: 'SHOP-2026-08-18', household_id: 1, status: 'WAITING_FOR_BROWSER' };

function io(query, { result, carried = null }) {
  const announced = [];
  const deps = {
    query,
    loadShop: async () => ({ shop: SHOP, lines: [] }),
    loadCatalogue: async () => ({ rows: [] }),
    loadRules: async () => ({ rows: [] }),
    runBasket: async () => result,
    announce: async (payload) => { announced.push(payload); },
  };
  deps.announced = announced;
  deps.carried = carried;
  return deps;
}

const claimedRow = (progress) => ({
  id: 7, shop_id: 26, status: 'running', claimed_by: 'r1', progress, requested_at: 'x', claimed_at: 'y',
  finished_at: null, last_error: null,
});

const LAUNCHER_CONFIG_RESULT = {
  exitCode: 2,
  basketReady: false,
  reconciliation: null,
  blockers: [{ kind: 'launcher-config', detail: 'launcher configuration missing: chromePath, profileDir, port.' }],
};

const RUN_CLASS_RESULT = {
  exitCode: 1,
  basketReady: false,
  reconciliation: null,
  blockers: [{ kind: 'unexplained-absence', line: 4, detail: 'Ben and Jerrys: not in the trolley' }],
};

// =====================================================================
// AC4 - THE LANE DOES NOT DIE ON THE FIRST ATTEMPT
// =====================================================================

test('AC4: a launcher-config failure is RELEASED with a counted attempt, not finished terminally', async () => {
  const query = fakePool({ claimed: claimedRow({ executor: { completed_steps: [1, 2, 3] } }) });
  const deps = io(query, { result: LAUNCHER_CONFIG_RESULT });

  const out = await consumeOneBrowserBuildRequest(deps, { log: () => {} });

  assert.equal(query.finished().length, 0,
    'the request was finished terminally on its first attempt - this is the 2026-08-18 defect, restored');
  const released = query.released();
  assert.equal(released.length, 1, 'the request was not released back for another attempt');
  assert.equal(released[0].params[3], true, 'the release did not COUNT the attempt - it would retry forever');
  assert.equal(released[0].params[5], lease.FAILURE_CLASS.ENVIRONMENT,
    'the release recorded no failure class - nothing can tell an environment gap from a bad shop');
  assert.equal(out.ready, false);
  assert.equal(out.requeued, true);
});

test('AC4 MUTATION: change ONLY the blocker kind, and the request finishes terminally again', async () => {
  // The classification is what decides, and nothing else. Same consumer, same
  // fake pool, same absent reconciliation - one field differs.
  const query = fakePool({ claimed: claimedRow({}) });
  const deps = io(query, { result: RUN_CLASS_RESULT });

  await consumeOneBrowserBuildRequest(deps, { log: () => {} });

  assert.equal(query.released().length, 0,
    'a run-class failure was retried - an untruthful basket needs a human, not another attempt');
  assert.equal(query.finished().length, 1);
  assert.equal(query.finished()[0].params[2], 'failed');
});

test('AC4: carried executor progress survives a terminal failure', async () => {
  // `{"executor": null}` is what requests 1, 2, 5 and 7 carry in live data. The
  // Gap 7 design exists precisely so a resumed run does not re-add everything.
  const carried = { completed_steps: [1, 2, 3, 4], runner_state: 'adding' };
  const query = fakePool({ claimed: claimedRow({ executor: carried }) });
  const deps = io(query, { result: RUN_CLASS_RESULT });

  await consumeOneBrowserBuildRequest(deps, { log: () => {} });

  const progress = JSON.parse(query.finished()[0].params[3]);
  assert.deepEqual(progress.executor, carried,
    'the executor progress was discarded on failure - which is exactly what happened to four live requests');
});

test('AC4: a SUCCESSFUL run still writes the reconciliation, unchanged', async () => {
  const query = fakePool({ claimed: claimedRow({ executor: { completed_steps: [1] } }) });
  const recon = { ready: { ready: true }, lines: 38 };
  const deps = io(query, { result: { basketReady: true, reconciliation: recon, blockers: [] } });

  const out = await consumeOneBrowserBuildRequest(deps, { log: () => {} });

  assert.equal(out.ready, true);
  assert.equal(query.released().length, 0);
  const progress = JSON.parse(query.finished()[0].params[3]);
  assert.deepEqual(progress.executor, recon,
    'the carried-progress fix swallowed the reconciliation - the success path must be untouched');
});

test('AC4: the environment class is a short, explicit allow-list - an unknown kind is NOT retried', () => {
  assert.deepEqual(ENVIRONMENT_BLOCKERS, ['launcher-config']);
  assert.equal(environmentBlockers({ blockers: [{ kind: 'launcher-config' }] }).length, 1);
  assert.equal(environmentBlockers({ blockers: [{ kind: 'something-nobody-classified' }] }).length, 0,
    'an unclassified kind fell to the retry side - it must fall to the side a human looks at');
  assert.equal(environmentBlockers(null).length, 0);
});

// =====================================================================
// AC5 - AND IT IS NOT SILENT
// =====================================================================

test('AC5: the FIRST environment failure announces, and says it is still trying', async () => {
  const query = fakePool({ claimed: claimedRow({}), releaseStatus: 'queued', attempts: 1 });
  const deps = io(query, { result: LAUNCHER_CONFIG_RESULT });

  await consumeOneBrowserBuildRequest(deps, { log: () => {} });

  assert.equal(deps.announced.length, 1, 'nothing was announced - four requests died in silence on 2026-08-18');
  const a = deps.announced[0];
  assert.equal(a.kind, 'basket_blocked_on_environment');
  assert.equal(a.shop_id, 26, 'the announcement carries no shop - it cannot become an outbox row');
  assert.equal(a.household_id, 1, 'the announcement carries no household - the outbox is keyed per household');
  assert.equal(a.shop_ref, 'SHOP-2026-08-18');
  assert.equal(a.terminal, false);
  assert.equal(a.attempts, 1);
  assert.equal(a.max_attempts, lease.MAX_ATTEMPTS);
  assert.deepEqual(a.blockers.map((b) => b.kind), ['launcher-config']);
});

test('AC5: the CEILING announces too, and says it has stopped', async () => {
  const query = fakePool({ claimed: claimedRow({}), releaseStatus: 'failed', attempts: lease.MAX_ATTEMPTS });
  const deps = io(query, { result: LAUNCHER_CONFIG_RESULT });

  const out = await consumeOneBrowserBuildRequest(deps, { log: () => {} });

  assert.equal(deps.announced[0].terminal, true,
    'the ceiling was reached and the card still says AsdAIr is trying - he would wait for nothing');
  assert.equal(out.requeued, false);
});

// =====================================================================
// AC4 - THE RECOVERY RULE READS THE CLASS, NEVER THE MESSAGE
// =====================================================================

test('AC4 RECOVERY: the re-queue selects on the failure CLASS and never on last_error', async () => {
  const seen = [];
  const query = async (text, params) => { seen.push({ text, params }); return { rows: [{ id: 7, shop_id: 26, status: 'queued' }] }; };

  const out = await lease.requeueEnvironmentFailures(query, {
    shopStatuses: ['READY_TO_SHOP', 'WAITING_FOR_BROWSER', 'SHOPPING'],
    reason: 'configured again',
  });

  assert.equal(out.length, 1);
  const { text, params } = seen[0];
  assert.match(text, /progress->>'_failure_class'\s*=\s*\$2::text/,
    'the recovery rule no longer selects on the recorded class');
  // The SELECTION is what must never read prose. `last_error` is legitimately
  // WRITTEN in the SET clause, so the assertion is scoped to the subquery that
  // chooses the rows - asserting over the whole statement would have been a
  // control that fires on the wrong half.
  const chooses = text.slice(text.indexOf("where r2.status = 'failed'"));
  assert.ok(chooses.length > 0, 'the row-choosing subquery is no longer recognisable - re-read this test');
  assert.doesNotMatch(chooses, /last_error/i,
    'the recovery rule chooses rows by last_error - improving an error sentence would silently switch it off');
  assert.equal(params[1], lease.FAILURE_CLASS.ENVIRONMENT);
  assert.deepEqual(params[2], ['READY_TO_SHOP', 'WAITING_FOR_BROWSER', 'SHOPPING']);
  // The shop join is an ALLOW-LIST, so a cancelled or reconciled shop cannot
  // qualify by failing to appear on a deny-list.
  assert.match(text, /s2\.status = any\(\$3::text\[\]\)/);
  // The counter is reset; the executor's own work is not touched.
  assert.match(text, /- '_lease' - '_retry_after' - '_attempts'/);
});

test('AC4 RECOVERY: an empty allow-list resurrects NOTHING and issues no statement at all', async () => {
  let called = 0;
  const query = async () => { called += 1; return { rows: [] }; };
  assert.deepEqual(await lease.requeueEnvironmentFailures(query, { shopStatuses: [] }), []);
  assert.deepEqual(await lease.requeueEnvironmentFailures(query, {}), []);
  assert.equal(called, 0,
    'an absent allow-list issued an UPDATE - a missing argument must never widen what is resurrected');
});

test('AC4 RECOVERY: a release that names no class does not erase the class an earlier one recorded', async () => {
  const seen = [];
  const query = async (text, params) => { seen.push({ text, params }); return { rows: [{ id: 7, status: 'queued', attempts: 2 }] }; };
  await lease.release(query, { requestId: 7, runnerId: 'r1', reason: 'human took the browser' });
  assert.match(seen[0].text, /coalesce\(\$6::text, progress->>'_failure_class'\)/,
    'a plain release overwrites the failure class with null - the recovery rule would then never find it');
  assert.equal(seen[0].params[5], null);
});
