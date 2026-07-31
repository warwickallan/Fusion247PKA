// Programme pull request — created and maintained by Larry, decided by Warwick
// (BUILD-018 T-14, deliverables 2 and 4)
//
// Under AD-20 the complete git lifecycle is Larry's: branches, worktrees, commits,
// pushes and the pull request itself. Warwick's standing gate is merge-to-main. This
// module is the machinery that makes that division real rather than aspirational —
// it prepares and presents, and the only thing it ever puts in front of Warwick is
// one decision: merge this, or not.
//
// THE SAFETY PROPERTY: THIS CODE CANNOT MERGE (AD-25)
// ----------------------------------------------------
// Creating a pull request and merging it are different authorities. That is enforced
// here by construction and proven by an ARGV-SHAPE control:
//
//   * `GH_ACTIONS` is the complete, exported set of subcommands `buildGhArgs` will
//     build. Any other action THROWS. It is exported so the test can enumerate it
//     exhaustively rather than hardcoding a list that could drift from this file.
//   * Every argv is structurally constrained: `argv[0] === 'pr'`, `argv[1]` is in
//     `GH_ACTIONS`, and no flag-position element is a merging flag.
//   * Every `execFile` invocation `upsertProgrammePr` makes is captured by the
//     injected `execFile` in tests and asserted against the same shape.
//
// It is deliberately NOT enforced by banning a substring in this source. T-10 shipped
// exactly that control and it failed on contact, because the module legitimately
// printed the banned word in the sentence proving the invariant held. A control
// scoped to source text cannot distinguish a subcommand from a noun in a paragraph.
// This one is scoped to the argument vector, where the authority actually lives — so
// a PR body containing the word "merge" is a value element and never a subcommand,
// and there is a test that passes exactly such content through to prove it.
//
// THE BODY IS A PROJECTION, NOT A COMPOSITION
// -------------------------------------------
// Per the document-mirroring rule: one canonical source, mirrored — never the same
// document independently composed twice. The body is assembled from artefacts that
// already exist (resolved-ticket evidence, the programme's locked decisions, the
// readiness verdict, the QA ledger's own status). Where a source was not supplied,
// the body says so rather than describing the build from memory.

import { execFileSync } from 'node:child_process';

import { renderReadiness, CHECK } from './merge-readiness.mjs';

// The marker identifies a governor-managed body so a human reading the PR knows the
// body is generated and will be overwritten on the next update.
export const PR_MARKER = (buildId) => `<!-- governor:programme-pr ${buildId} -->`;

// THE COMPLETE SET. Exported so the never-merges control can enumerate it.
export const GH_ACTIONS = ['list', 'create', 'edit'];

export const PR_ACTION = {
  CREATED: 'created',
  UPDATED: 'updated',
  REFUSED: 'refused',   // readiness said no. This value means exactly that and nothing else.
  BLIND: 'blind',       // `gh` missing, failing, or unusable — never a silent no-op reading as success.
  DRY_RUN: 'dry-run',   // evaluated, nothing sent. Its own value so a consumer switching on
                        // `action` cannot read a dry run as a failed gate.
};

// Flag-position tokens that would hand this module the merge authority. Nothing in
// `buildGhArgs` emits any of them; the test asserts that over every action.
export const MERGING_FLAGS = [
  '--merge', '--squash', '--rebase', '--auto', '--admin',
  '--delete-branch', '--merge-when-ready',
];

// ---------------------------------------------------------------------------
// The argv builder — pure, and the control surface
// ---------------------------------------------------------------------------

export function buildGhArgs(action, opts = {}) {
  if (!GH_ACTIONS.includes(action)) {
    throw new Error(
      `programme-pr: refusing to build a "${action}" invocation. This module builds only ${GH_ACTIONS.join('/')} — ` +
      `preparing a pull request and deciding its fate are different authorities (AD-25).`
    );
  }

  const { repo, branch, base, title, body, number } = opts;

  if (action === 'list') {
    if (!repo) throw new Error('programme-pr: a repo (owner/name) is required to list pull requests');
    if (!branch) throw new Error('programme-pr: a head branch is required to list pull requests');
    return [
      'pr', 'list',
      '--repo', repo,
      '--head', branch,
      '--state', 'all',
      '--json', 'number,url,title,state,headRefName,isDraft',
    ];
  }

  if (action === 'create') {
    if (!repo) throw new Error('programme-pr: a repo (owner/name) is required to open a pull request');
    if (!branch) throw new Error('programme-pr: a head branch is required to open a pull request');
    if (!base) throw new Error('programme-pr: a base branch is required to open a pull request');
    if (!title) throw new Error('programme-pr: a title is required to open a pull request');
    if (typeof body !== 'string') throw new Error('programme-pr: a body is required to open a pull request');
    return [
      'pr', 'create',
      '--repo', repo,
      '--base', base,
      '--head', branch,
      '--title', title,
      '--body', body,
    ];
  }

  // edit
  if (!repo) throw new Error('programme-pr: a repo (owner/name) is required to edit a pull request');
  if (!Number.isInteger(number)) throw new Error('programme-pr: an integer pull-request number is required to edit');
  if (!title) throw new Error('programme-pr: a title is required to edit a pull request');
  if (typeof body !== 'string') throw new Error('programme-pr: a body is required to edit a pull request');
  return [
    'pr', 'edit', String(number),
    '--repo', repo,
    '--title', title,
    '--body', body,
  ];
}

// ---------------------------------------------------------------------------
// The body — a projection
// ---------------------------------------------------------------------------

function bullets(lines, empty = '_(none recorded)_') {
  return lines.length ? lines.map((l) => `- ${l}`).join('\n') : empty;
}

const STATUS_LABEL = { [CHECK.PASS]: 'PASS', [CHECK.FAIL]: 'FAIL', [CHECK.UNKNOWN]: 'UNKNOWN' };

export function renderPrBody({ state, readiness, qa, goalContractText = null }) {
  const p = state?.programme || {};
  const tickets = Array.isArray(state?.tickets) ? state.tickets : [];
  const resolved = tickets.filter((t) => t?.state === 'resolved');
  const outstanding = tickets.filter((t) => t?.state !== 'resolved');

  const goalSection = goalContractText
    ? `The goal contract is reproduced from \`${p.home || 'the programme home'}/01-GOAL-CONTRACT.md\`:\n\n${goalContractText.trim()}`
    : '_The goal contract text was not supplied to this render, so it is not reproduced here. It is not described from memory: this body mirrors sources, it does not compose new prose about the build._';

  const checksTable = Array.isArray(readiness?.checks) && readiness.checks.length
    ? [
        '| Check | Verdict | Detail |',
        '|---|---|---|',
        ...readiness.checks.map(
          (c) => `| \`${c.id}\` | **${STATUS_LABEL[c.status] || c.status}** | ${String(c.detail || '').replace(/\|/g, '\\|')} |`
        ),
        '',
        `${readiness.checked} thing(s) examined. An UNKNOWN check blocks exactly as a FAIL does.`,
      ].join('\n')
    : '_No readiness assessment was supplied. That is not a pass._';

  const qaSection = qa
    ? [
        `Head known: **${qa.headKnown === true ? 'yes' : 'NO'}**${qa.head ? ` (\`${qa.head}\`)` : ''}. ` +
          `Verdicts examined: **${typeof qa.checked === 'number' ? qa.checked : 'not reported'}**. ` +
          `All required reviewers current-approved: **${qa.allCurrentApproved === true ? 'yes' : 'NO'}**.`,
        '',
        bullets(
          (Array.isArray(qa.reviewers) ? qa.reviewers : []).map(
            (r) => `**${r.reviewer}** — ${r.binding}${r.verdict ? ` (${r.verdict})` : ''}${r.sha ? ` at \`${String(r.sha).slice(0, 12)}\`` : ''}${r.at ? ` on ${r.at}` : ''}${r.detail ? ` — ${r.detail}` : ''}`
          ),
          '_(no reviewer records)_'
        ),
      ].join('\n')
    : '_No review status was supplied. Required-but-unavailable review is BLOCKED, never waived._';

  return `${PR_MARKER(p.id || 'unknown-build')}

# ${p.id || 'Programme'} — ${p.title || 'untitled programme'}

> This body is **generated** by the Governor from artefacts that already exist in this
> branch. It is a projection, not a fresh description of the build, and it is
> overwritten on every update. Its sources are named in each section below.

## Outcome

${goalSection}

## Merge readiness

${checksTable}

## Independent review (exact-head binding)

${qaSection}

## Resolved work and its evidence

Projected from \`${p.home || 'the programme home'}/programme-state.json\` (\`tickets[]\`); evidence paths are reproduced verbatim, not summarised.

${bullets(
  resolved.map(
    (t) =>
      `**${t.id}** — ${t.title}${t.resolved ? ` _(resolved ${t.resolved})_` : ''}\n` +
      (Array.isArray(t.evidence) && t.evidence.length
        ? t.evidence.map((e) => `  - \`${e}\``).join('\n')
        : '  - _no evidence recorded_')
  ),
  '_(no resolved tickets)_'
)}

${outstanding.length ? `**Outstanding (${outstanding.length}):**\n${bullets(outstanding.map((t) => `**${t.id}** — ${t.title} _(${t.state})_`))}\n` : ''}
## Decisions locked during this build

Projected from \`locked_decisions\` in the banked programme state.

${bullets((state?.locked_decisions || []).map((d) => `**${d.id}** — ${d.decision}${d.why ? ` _(${d.why})_` : ''}`))}

## Declared unknowns

Fields the banked state could not establish. An empty collection elsewhere in that document is a positive assertion of "there are none"; anything listed here was **not** gathered.

${bullets((state?.unknown || []).map((u) => `\`${u.path}\` — ${u.why}`), '_(none — every collection in the banked state was gathered)_')}

---

Branch \`${state?.repository?.branch || 'unknown'}\` @ \`${state?.repository?.head_sha || 'unknown'}\`, base \`${state?.repository?.base_sha || 'unknown'}\`.
Prepared by the BUILD-018 Governor. This tooling prepares and presents pull requests; it has no authority to merge one.
`;
}

// ---------------------------------------------------------------------------
// The one impure entrypoint
// ---------------------------------------------------------------------------
// Idempotent: it finds the open pull request for the branch and EDITS it, and only
// creates when there is none. A MERGED or CLOSED pull request on the branch is not an
// edit target and is not a licence to open a second one — that returns `refused`
// naming it, because a branch that has already been merged is a state Larry should
// not paper over.

function openPrFor(list) {
  return list.find((pr) => {
    const s = String(pr?.state || '').toUpperCase();
    return s === 'OPEN' || s === 'DRAFT';
  }) || null;
}

function settledPrFor(list) {
  return list.find((pr) => {
    const s = String(pr?.state || '').toUpperCase();
    return s === 'MERGED' || s === 'CLOSED';
  }) || null;
}

function prNumberFromUrl(out) {
  const m = String(out || '').match(/\/pull\/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export function upsertProgrammePr({
  state,
  readiness,
  qa = null,
  ghRepo,
  execFile = execFileSync,
  dryRun = false,
  goalContractText = null,
} = {}) {
  let checked = 0;

  // 1. The gate. No readiness, no pull request — and not a single `gh` invocation is
  //    made, so a refusal cannot have side effects on the repository.
  const checks = Array.isArray(readiness?.checks) ? readiness.checks : [];
  checked += checks.length;
  if (readiness?.ready !== true) {
    const blocking = Array.isArray(readiness?.blocking) ? readiness.blocking : [];
    const named = blocking.length
      ? blocking.map((c) => `${c.id} (${c.status}): ${c.detail}`).join(' | ')
      : 'no readiness assessment was supplied, which is not a pass';
    return {
      action: PR_ACTION.REFUSED,
      number: null,
      url: null,
      reason: `merge readiness is not met, so no pull request was created or updated. Blocking: ${named}`,
      checked,
    };
  }

  // 2. Addressing. Without a repo or a branch there is nothing to be idempotent about.
  const branch = state?.repository?.branch;
  if (!ghRepo) {
    return {
      action: PR_ACTION.BLIND,
      number: null,
      url: null,
      reason: 'no GitHub repo (owner/name) was configured, so the pull request could not be looked up. Blind is not success',
      checked,
    };
  }
  if (!branch) {
    return {
      action: PR_ACTION.BLIND,
      number: null,
      url: null,
      reason: 'the banked programme state names no branch, so the pull request could not be looked up. Blind is not success',
      checked,
    };
  }

  const base =
    (state?.branches || []).find((b) => b?.role === 'main')?.name || 'main';
  const title = `${state?.programme?.id || 'programme'} — ${state?.programme?.title || 'untitled'}`;
  const body = renderPrBody({ state, readiness, qa, goalContractText });

  // 3. Look for an existing pull request on this branch.
  let raw;
  try {
    raw = execFile('gh', buildGhArgs('list', { repo: ghRepo, branch }), { encoding: 'utf8' });
    checked += 1;
  } catch (err) {
    return {
      action: PR_ACTION.BLIND,
      number: null,
      url: null,
      reason: `\`gh pr list\` failed (${String((err && err.message) || err).slice(0, 300)}). The pull-request state could not be read, so nothing was created or updated — blind is never a silent success`,
      checked,
    };
  }

  let list;
  try {
    list = JSON.parse(raw);
  } catch (err) {
    return {
      action: PR_ACTION.BLIND,
      number: null,
      url: null,
      reason: `\`gh\` returned output that could not be parsed (${String((err && err.message) || err).slice(0, 200)}). Nothing was created or updated`,
      checked,
    };
  }
  if (!Array.isArray(list)) {
    return {
      action: PR_ACTION.BLIND,
      number: null,
      url: null,
      reason: '`gh` returned a shape that is not a list of pull requests. Nothing was created or updated',
      checked,
    };
  }
  checked += list.length;

  const open = openPrFor(list);

  if (!open) {
    const settled = settledPrFor(list);
    if (settled) {
      return {
        action: PR_ACTION.REFUSED,
        number: typeof settled.number === 'number' ? settled.number : null,
        url: settled.url || null,
        reason: `pull request #${settled.number} for \`${branch}\` is already ${String(settled.state).toLowerCase()}. A settled pull request is not an edit target, and opening a second one on the same branch is not something this tooling will do unprompted`,
        checked,
      };
    }
  }

  // 4. A dry run has now done the entire judgement and the entire lookup, and sends
  //    nothing. It gets its own action value rather than borrowing `refused`, which
  //    means exactly one thing: readiness said no.
  if (dryRun) {
    return {
      action: PR_ACTION.DRY_RUN,
      would: open ? PR_ACTION.UPDATED : PR_ACTION.CREATED,
      number: open && typeof open.number === 'number' ? open.number : null,
      url: (open && open.url) || null,
      reason: open
        ? `dry run: pull request #${open.number} on \`${branch}\` would have been updated. Nothing was sent`
        : `dry run: a pull request would have been opened for \`${branch}\` against \`${base}\`. Nothing was sent`,
      checked,
    };
  }

  // 5. Update, or open. Never both, and never a second one.
  if (open) {
    try {
      execFile(
        'gh',
        buildGhArgs('edit', { repo: ghRepo, number: open.number, title, body }),
        { encoding: 'utf8' }
      );
      checked += 1;
    } catch (err) {
      return {
        action: PR_ACTION.BLIND,
        number: typeof open.number === 'number' ? open.number : null,
        url: open.url || null,
        reason: `\`gh pr edit\` failed (${String((err && err.message) || err).slice(0, 300)}). The existing pull request may still carry a stale body`,
        checked,
      };
    }
    return {
      action: PR_ACTION.UPDATED,
      number: open.number,
      url: open.url || null,
      reason: `pull request #${open.number} for \`${branch}\` already existed and was updated in place. No second pull request was opened`,
      checked,
    };
  }

  let out;
  try {
    out = execFile(
      'gh',
      buildGhArgs('create', { repo: ghRepo, branch, base, title, body }),
      { encoding: 'utf8' }
    );
    checked += 1;
  } catch (err) {
    return {
      action: PR_ACTION.BLIND,
      number: null,
      url: null,
      reason: `\`gh pr create\` failed (${String((err && err.message) || err).slice(0, 300)}). No pull request was opened`,
      checked,
    };
  }

  const url = String(out || '').trim().split(/\s+/).filter(Boolean).pop() || null;
  return {
    action: PR_ACTION.CREATED,
    number: prNumberFromUrl(out),
    url,
    reason: `no pull request existed for \`${branch}\`, so one was opened against \`${base}\``,
    checked,
  };
}

// ---------------------------------------------------------------------------
// Deliverable 4 — the ONLY thing Warwick sees
// ---------------------------------------------------------------------------
// One decision, the evidence behind it, the risks named. Everything else already
// happened and is stated as done, not requested (AD-20).

function collectRisks({ state, readiness, qa }) {
  const risks = [];

  for (const b of state?.blockers || []) {
    risks.push(`[${b.kind}] ${b.summary}${b.owner ? ` — owner: ${b.owner}` : ''}${b.recommendation ? ` _(recommendation: ${b.recommendation})_` : ''}`);
  }

  const superseded = Array.isArray(qa?.superseded) ? qa.superseded : [];
  for (const s of superseded) {
    risks.push(`[review] a verdict from ${s?.reviewer || 'a reviewer'} is SUPERSEDED — it was recorded at a different head and does not carry forward`);
  }

  for (const u of state?.unknown || []) {
    risks.push(`[not established] \`${u.path}\` — ${u.why}. This was not gathered; it is not a zero`);
  }

  for (const c of readiness?.blocking || []) {
    risks.push(`[readiness] ${c.id} is ${c.status}: ${c.detail}`);
  }

  return risks;
}

export function renderMergeDecision({ state, readiness, qa, pr }) {
  const p = state?.programme || {};
  const bar = '='.repeat(72);
  const risks = collectRisks({ state, readiness, qa });
  const prLine = pr?.url
    ? `${pr.number ? `#${pr.number}` : 'the pull request'} — ${pr.url}`
    : pr?.number
      ? `#${pr.number}`
      : '(not yet opened)';

  if (readiness?.ready !== true) {
    return [
      '',
      bar,
      `${p.id || 'This programme'} — NOT READY. No decision is being asked of you.`,
      bar,
      '',
      renderReadiness(readiness).trimEnd(),
      '',
      'Nothing is required from you here. The outstanding items above are Larry\'s to close;',
      'you will see this again only when there is a decision to make.',
      bar,
      '',
    ].join('\n');
  }

  const resolved = (state?.tickets || []).filter((t) => t?.state === 'resolved');

  return [
    '',
    bar,
    `${p.id || 'PROGRAMME'} — ${p.title || ''}`,
    'ONE DECISION: merge this, or not.',
    bar,
    '',
    `Pull request : ${prLine}`,
    `Branch       : ${state?.repository?.branch || 'unknown'} @ ${String(state?.repository?.head_sha || 'unknown').slice(0, 12)}`,
    `Into         : ${(state?.branches || []).find((b) => b?.role === 'main')?.name || 'main'}`,
    '',
    'THE EVIDENCE',
    '',
    ...readiness.checks.map((c) => `  [${STATUS_LABEL[c.status] || c.status}] ${c.title} — ${c.detail}`),
    '',
    `  ${resolved.length} ticket(s) resolved, each with evidence recorded in the pull request body.`,
    qa
      ? `  Independent review: ${qa.checked} verdict(s) examined at a known head; every required reviewer holds a current approve.`
      : '  Independent review: not supplied.',
    '',
    'THE RISKS',
    '',
    ...(risks.length ? risks.map((r, i) => `  ${i + 1}. ${r}`) : ['  None recorded in the banked state. That is an assertion by the programme, not a proof.']),
    '',
    'ALREADY DONE — nothing here is waiting on you',
    '',
    '  The branch, the worktree, every commit, the push and this pull request were',
    '  Larry\'s and are complete. Independent review has run and is bound to the exact',
    '  head above; if that head moves, the review is marked superseded and re-run —',
    '  it is never carried forward (AD-20, AD-23).',
    '',
    'YOUR DECISION',
    '',
    '  Merge to main — or say no, and name what would change your mind.',
    '  Merge-to-main is the single standing gate, and it is yours.',
    bar,
    '',
  ].join('\n');
}
