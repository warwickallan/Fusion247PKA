// Merge readiness — the defined, checkable predicate (BUILD-018 T-14, deliverable 2)
//
// "Merge readiness" must be a PREDICATE, not a vibe (T-14 §Scope 2). This module is
// the whole of that predicate and nothing else: five checks, evaluated over signals
// the caller gathers, returning a verdict that says which ones are green, which are
// red, and — the load-bearing third state — which ones could not be established.
//
// PURE, BY CONSTRUCTION (AD-11)
// -----------------------------
// No filesystem, no git, no `gh`, no clock, no environment. Signals in, verdict out.
// That is asserted by a test that inspects this file's IMPORT statements, not by this
// comment: purity by construction beats purity by claim, and a claim in a header is
// exactly the kind of unexamined assertion this build was commissioned over.
//
// FAILS CLOSED (AD-24, and T-10's precedent in assessRotationSafety)
// ------------------------------------------------------------------
// Any check that is UNKNOWN makes the programme not ready. `null` is never `0` and
// never `pass`. The direction is deliberate and is the opposite of the T-11 gate's
// (AD-19): refusing to open a PR costs a delay, whereas presenting Warwick a merge
// decision backed by a check that never ran spends the one gate he actually holds.
//
// THE ZERO-COUNT GREEN
// --------------------
// Three checks here can be handed a shape that reports success over nothing at all,
// and all three refuse it:
//   - `suite-green`   : { executed: true, total: 0, failed: 0 } is not green.
//   - `tickets-...`   : an empty ticket list is not "every ticket resolved".
//   - `independent-review` : a QA object claiming approval while having examined
//                       zero verdicts (`checked: 0`) is not a review.
// The third is closed twice over: `qa-binding.mjs` refuses to PRODUCE a vacuous
// `allCurrentApproved: true` (an empty required-reviewer list means review is not
// configured), and this module refuses to BELIEVE one. The two do not depend on each
// other being correct. This is the single check standing between an unreviewed
// programme and Warwick's merge gate, and two independent refusals is the right cost.

export const CHECK = { PASS: 'pass', FAIL: 'fail', UNKNOWN: 'unknown' };

// The complete set, in render order. `assessMergeReadiness` maps over this array, so
// the returned `checks` cannot silently gain a sixth entry or lose one of these five.
export const CHECK_IDS = [
  'tickets-resolved-with-evidence',
  'suite-green',
  'tree-clean',
  'head-pushed',
  'independent-review',
];

const TITLES = {
  'tickets-resolved-with-evidence': 'Every ticket in scope resolved, with evidence',
  'suite-green': 'Test suite executed and green',
  'tree-clean': 'Working tree clean',
  'head-pushed': 'Local head matches the remote-tracking head',
  'independent-review': 'Independent review current at this head',
};

function pass(detail) {
  return { status: CHECK.PASS, detail };
}
function fail(detail) {
  return { status: CHECK.FAIL, detail };
}
function unknown(detail) {
  return { status: CHECK.UNKNOWN, detail };
}

// ---------------------------------------------------------------------------
// 1. tickets-resolved-with-evidence
// ---------------------------------------------------------------------------
// Scope is every entry in `state.tickets`. An unresolved ticket fails; a resolved
// ticket with empty evidence fails (a resolution nobody can check is a claim, not a
// resolution). The detail NAMES the offending tickets rather than counting them — a
// refusal that does not say which is a second investigation.
//
// The consequence is deliberate and must not be softened: programme readiness is
// all-or-nothing, so a programme cannot use this machinery until every ticket lands.
// A partial merge is a scope decision about the programme, never a relaxation here.

function checkTickets(state, ctx) {
  ctx.checked += 1;

  const declaredUnknown = (state?.unknown || []).some((u) => u?.path === 'tickets');
  if (declaredUnknown) {
    const why = (state.unknown.find((u) => u?.path === 'tickets') || {}).why || 'no reason recorded';
    return unknown(`the banked state declares \`tickets\` in its \`unknown\` list (${why}) — a collection that was not gathered cannot be reported as complete`);
  }

  const tickets = state?.tickets;
  if (!Array.isArray(tickets)) {
    return unknown('no ticket list is present in the programme state — scope could not be established, and unknown scope is never complete scope');
  }
  if (tickets.length === 0) {
    return fail('the ticket list is empty. A readiness verdict over zero tickets is the same zero-count green a suite of zero tests would be — it reports success over ground it never examined');
  }

  const unresolved = [];
  const withoutEvidence = [];
  for (const t of tickets) {
    ctx.checked += 1;
    const id = t?.id || '(unnamed ticket)';
    if (t?.state !== 'resolved') {
      unresolved.push(`${id} [${t?.state ?? 'no state'}]`);
    } else if (!Array.isArray(t.evidence) || t.evidence.length === 0) {
      withoutEvidence.push(id);
    }
  }

  if (unresolved.length === 0 && withoutEvidence.length === 0) {
    return pass(`all ${tickets.length} ticket(s) are resolved and each carries at least one evidence entry`);
  }

  const parts = [];
  if (unresolved.length) parts.push(`${unresolved.length} not resolved: ${unresolved.join(', ')}`);
  if (withoutEvidence.length) {
    parts.push(`${withoutEvidence.length} resolved with NO evidence: ${withoutEvidence.join(', ')} (a resolution nobody can check is a claim, not a resolution)`);
  }
  return fail(parts.join('; '));
}

// ---------------------------------------------------------------------------
// 2. suite-green
// ---------------------------------------------------------------------------
// Green requires an EXECUTED run with a NON-ZERO test count and no failures. "No
// failures found" over zero tests is the classic green-that-never-ran; it is a FAIL,
// not a pass and not an unknown, because the shape asserts a run happened.

function checkSuite(suite, ctx) {
  ctx.checked += 1;

  if (suite === null || suite === undefined) {
    return unknown('no suite result was supplied — an unrun suite is not a green suite');
  }
  if (suite.executed === false) {
    return fail('the suite is recorded as NOT executed. A suite that did not run cannot be green');
  }
  if (suite.executed !== true) {
    return unknown('the suite result does not record whether it actually executed — "did not run" must never be indistinguishable from "ran clean"');
  }
  if (typeof suite.total !== 'number' || !Number.isFinite(suite.total)) {
    return unknown('the suite reports no test count — an unknown count is never a non-zero count');
  }
  if (typeof suite.failed !== 'number' || !Number.isFinite(suite.failed)) {
    return unknown('the suite reports no failure count — unknown is never zero');
  }
  if (suite.total <= 0) {
    return fail(`the suite reports ${suite.total} test(s) executed. Zero failures over zero tests is the classic green-that-never-ran, and it is not green`);
  }
  if (suite.failed > 0) {
    return fail(`${suite.failed} of ${suite.total} test(s) failed`);
  }
  return pass(`${suite.total} test(s) executed, 0 failed`);
}

// ---------------------------------------------------------------------------
// 3. tree-clean
// ---------------------------------------------------------------------------

function checkTreeClean(git, ctx) {
  ctx.checked += 1;

  if (git?.clean === true) return pass('the working tree reported no uncommitted changes');
  if (git?.clean === false) {
    return fail('the working tree has uncommitted changes. Work that is not committed is not in the pull request');
  }
  return unknown('working-tree cleanliness could not be determined. Unknown is not clean');
}

// ---------------------------------------------------------------------------
// 4. head-pushed
// ---------------------------------------------------------------------------
// KNOWN BOUND, stated in the detail rather than hidden behind it: what the caller
// can cheaply supply as `remoteHeadSha` is a remote-TRACKING ref, and per AD-15
// nothing in this estate performs a fetch. A stale tracking ref can therefore make
// this check PASS while the remote genuinely differs. This module is pure and must
// not fix that; the honest fix belongs to the caller and is a read-only
// `git ls-remote` (which answers the question without mutating refs, so it does not
// offend AD-15). The wording below never implies the remote was consulted.

const REMOTE_TRACKING_CAVEAT =
  'compared against the remote-tracking ref, which is only as fresh as the last fetch — this check does not itself contact the remote';

function checkHeadPushed(git, ctx) {
  ctx.checked += 1;

  const head = git?.headSha;
  const remote = git?.remoteHeadSha;
  const known = (v) => typeof v === 'string' && v.length > 0 && v !== 'unknown';

  if (!known(head) && !known(remote)) {
    return unknown(`neither the local head nor the remote-tracking head could be read (${REMOTE_TRACKING_CAVEAT})`);
  }
  if (!known(head)) return unknown(`the local head could not be read (${REMOTE_TRACKING_CAVEAT})`);
  if (!known(remote)) return unknown(`the remote-tracking head could not be read (${REMOTE_TRACKING_CAVEAT})`);

  if (head === remote) {
    return pass(`local head ${head.slice(0, 7)} equals the remote-tracking head (${REMOTE_TRACKING_CAVEAT})`);
  }
  return fail(`local head ${head.slice(0, 7)} differs from the remote-tracking head ${remote.slice(0, 7)} — commits exist that the pull request would not contain (${REMOTE_TRACKING_CAVEAT})`);
}

// ---------------------------------------------------------------------------
// 5. independent-review
// ---------------------------------------------------------------------------
// Consumes the object returned by `verdictStatus()` in qa-binding.mjs. See the header
// note: the vacuous-approval hole is closed on both sides on purpose.

function checkReview(qa, ctx) {
  ctx.checked += 1;

  if (qa === null || qa === undefined) {
    return unknown('no review status was supplied. Required-but-unavailable review is BLOCKED, never waived');
  }
  if (typeof qa.checked !== 'number' || !Number.isFinite(qa.checked)) {
    return unknown('the review status does not report how many verdicts it examined, so its verdict cannot be trusted (INV-5)');
  }
  if (qa.checked <= 0) {
    return fail(
      'the review status examined ZERO verdicts. Whatever it concluded, it concluded over ground it never examined — ' +
      'a clean bill from an empty scan is exactly the defect this estate has already been burned by (INV-5)'
    );
  }
  if (qa.headKnown !== true) {
    return unknown('the reviewed head could not be established. An unknown head is never "the reviewed head" (AD-23)');
  }
  if (qa.allCurrentApproved !== true) {
    const superseded = Array.isArray(qa.superseded) ? qa.superseded.length : 0;
    const detail = [
      'not every required reviewer holds a CURRENT approve at this head',
      superseded ? `${superseded} verdict(s) are superseded — the head moved after review and a verdict does not carry forward` : null,
      ...(Array.isArray(qa.reviewers)
        ? qa.reviewers
            .filter((r) => r && r.binding !== 'current')
            .map((r) => `${r.reviewer}: ${r.binding}`)
        : []),
    ].filter(Boolean);
    return fail(detail.join('; '));
  }
  return pass(`${qa.checked} verdict(s) examined; every required reviewer holds a current approve at the known head`);
}

// ---------------------------------------------------------------------------
// The assessment
// ---------------------------------------------------------------------------
// `checked` counts things ACTUALLY EXAMINED — the five checks plus every individual
// ticket inspected — so it scales with real scope. A constant 5 would prove nothing,
// which is the entire point of the field (INV-5).

const EVALUATORS = {
  'tickets-resolved-with-evidence': ({ state }, ctx) => checkTickets(state, ctx),
  'suite-green': ({ suite }, ctx) => checkSuite(suite, ctx),
  'tree-clean': ({ git }, ctx) => checkTreeClean(git, ctx),
  'head-pushed': ({ git }, ctx) => checkHeadPushed(git, ctx),
  'independent-review': ({ qa }, ctx) => checkReview(qa, ctx),
};

export function assessMergeReadiness({ state = null, git = null, suite = null, qa = null } = {}) {
  const ctx = { checked: 0 };
  const signals = { state, git, suite, qa };

  const checks = CHECK_IDS.map((id) => {
    const { status, detail } = EVALUATORS[id](signals, ctx);
    return { id, title: TITLES[id], status, detail };
  });

  const blocking = checks.filter((c) => c.status !== CHECK.PASS);

  return {
    ready: blocking.length === 0,
    checks,
    checked: ctx.checked,
    blocking,
  };
}

// ---------------------------------------------------------------------------
// Render — for Larry's own log and for the PR body. Never addressed to Warwick as a
// task list: under AD-20 the git lifecycle is Larry's, so nothing here asks anyone to
// run a command.
// ---------------------------------------------------------------------------

const GLYPH = { [CHECK.PASS]: 'PASS', [CHECK.FAIL]: 'FAIL', [CHECK.UNKNOWN]: 'UNKNOWN' };

export function renderReadiness(readiness) {
  if (!readiness || !Array.isArray(readiness.checks)) {
    return 'MERGE READINESS: no assessment was produced. That is not a pass.\n';
  }

  const lines = [
    `MERGE READINESS: ${readiness.ready ? 'READY' : 'NOT READY'} (${readiness.checked} thing(s) examined)`,
    '',
  ];

  for (const c of readiness.checks) {
    lines.push(`  [${GLYPH[c.status] || c.status}] ${c.title}`);
    lines.push(`         ${c.detail}`);
  }

  if (!readiness.ready) {
    lines.push('');
    lines.push(`Blocking (${readiness.blocking.length}): ${readiness.blocking.map((c) => `${c.id} (${c.status})`).join(', ')}`);
    lines.push('An UNKNOWN check blocks exactly as a FAIL does: a check that could not be established has not been passed.');
  }

  lines.push('');
  return lines.join('\n');
}
