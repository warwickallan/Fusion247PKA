// Build-session registry and launcher (BUILD-018 T-14, deliverable 1)
//
// THE QUESTION THIS ANSWERS
// -------------------------
// Warwick says "carry on with the governor build" — a name, and nothing else. No
// path, no branch, no worktree. This module turns that name into the canonical
// worktree, branch, state file and next ticket, or into a precise refusal.
//
// THE SAFETY PROPERTY (AD-22) — READ THIS BEFORE CHANGING ANYTHING HERE
// ---------------------------------------------------------------------
// The registry is a machine-local, generated INDEX. It is NEVER a source.
//
// It answers exactly one question: "which file should I open to find out where
// this build lives?" It does NOT answer "where does this build live". Every
// `resolveBuild` re-reads the actual `programme-state.json` from disk and derives
// the returned location from THAT document. The indexed `worktree` and `branch`
// fields exist for display and for narrowing a contest scan — never as the
// answer.
//
// The consequence is the whole point: a stale or corrupt index can only ever FAIL
// TO FIND. It is structurally incapable of sending a session to the wrong place.
// T-11 exists because work landing on the wrong branch looks exactly like work
// landing on the right one; it would be absurd to reintroduce that failure one
// layer up, in the very component whose job is to put sessions somewhere.
//
// If a change here makes the index authoritative for a location, that change is
// wrong however convenient it is.
//
// WHAT THIS CLOSES OF THE T-11 BOUND — AND WHAT IT DOES NOT
// ----------------------------------------------------------
// T-11 recorded that a session sitting in a wholly unrelated repository cannot
// discover the estate, because discovery runs `git worktree list` from cwd.
//
//   CLOSED:     RESOLVING a build by name. The index holds absolute paths, so a
//               session anywhere on this machine can resolve `governor` and be
//               told where to go.
//   NOT CLOSED: BUILDING the index. `buildRegistry` still discovers roots by
//               probing git, so it must be run from inside the estate or given
//               explicit `--estate` roots. The index has to come from somewhere.
//   NOT CLOSED: the PreToolUse gate. `worktree-guard.mjs` still discovers the
//               canonical location by cwd probing and does not consult this
//               registry. A foreign-repo session therefore remains undiscoverable
//               *to the gate*; that is out of T-14's scope and remains open.
//
// A verdict's scope belongs beside the verdict, so it is written here rather than
// left to be inferred from the ticket's more confident sentence.
//
// ONE PROGRAMME, MANY COPIES
// --------------------------
// `programme-state.json` is a tracked file on a branch, so every checkout holding
// that branch's content has a copy, and `main` gains one after the build merges.
// A naive scan therefore reports one build three times and every resolve becomes
// AMBIGUOUS on the real estate — the same trap that disarmed the guard during
// T-11. Copies are collapsed by programme id, preferring the copy sitting inside
// the worktree it names as canonical (an off-branch copy may be an older banking
// of the same programme). Copies that genuinely disagree are BOTH kept, so the
// resolver refuses and says why rather than silently picking one.
//
// MACHINE-LOCAL, and why it is not in git
// ---------------------------------------
// It holds absolute machine paths, which are meaningless in git and wrong on
// every other machine. Default `~/.mypka/governor/registry.json`, following the
// health store's convention, overridden by `MYPKA_GOVERNOR_REGISTRY`.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  normalisePath,
  samePath,
  isInside,
  canonicalFromState,
  discoverWorktreeRoots,
} from './worktree-guard.mjs';
import { validateProgrammeState, SCHEMA_VERSION as STATE_SCHEMA_VERSION } from './programme-state.mjs';

export const REGISTRY_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Where the index lives
// ---------------------------------------------------------------------------

export function registryPath({ env = process.env, home = os.homedir() } = {}) {
  const override = env?.MYPKA_GOVERNOR_REGISTRY;
  if (override) return override;
  return join(home, '.mypka', 'governor', 'registry.json');
}

// ---------------------------------------------------------------------------
// Aliases — the only fuzzy step, and deliberately not fuzzy
// ---------------------------------------------------------------------------
// A matcher that changes its mind between runs is worse than no matcher: it makes
// a launcher that worked yesterday refuse today for reasons nobody can reproduce.
// So the alias set is a fixed, documented derivation, in a fixed order:
//
//   1. the programme id, lower-cased                      "build-018"
//   2. the id's trailing digits                           "018"
//   3. the home directory's basename minus the id prefix  "session-governor"
//   4. each hyphen-separated word of (3) that is >= 4 chars, in order
//                                                          "session", "governor"
//
// Nothing else. Short words are excluded because they collide across builds, and
// every extra alias buys convenience at the price of AMBIGUOUS refusals — which
// cost far more than re-typing a name. `18` is deliberately NOT derived from
// `BUILD-018`; the documented form is the zero-padded one.

export function aliasesFor(state) {
  const out = [];
  const add = (value) => {
    if (typeof value !== 'string') return;
    const s = value.trim().toLowerCase();
    if (s && !out.includes(s)) out.push(s);
  };

  const rawId = typeof state?.programme?.id === 'string' ? state.programme.id.trim() : '';
  add(rawId);

  const tail = rawId.match(/(\d+)\s*$/);
  if (tail) add(tail[1]);

  const home = typeof state?.programme?.home === 'string' ? state.programme.home : '';
  const dir = home ? basename(normalisePath(home) || '') : '';
  let slug = dir.toLowerCase();
  const idLower = rawId.toLowerCase();
  if (idLower && slug.startsWith(`${idLower}-`)) slug = slug.slice(idLower.length + 1);
  else if (idLower && slug === idLower) slug = '';

  if (slug) {
    add(slug);
    for (const word of slug.split('-')) {
      if (word.length >= 4) add(word);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Building the index
// ---------------------------------------------------------------------------

function entryFrom(doc, canonical, statePath) {
  return {
    id: doc.programme.id,
    title: doc.programme?.title ?? null,
    status: doc.programme?.status ?? null,
    aliases: aliasesFor(doc),
    worktree: canonical.worktree,
    branch: canonical.branch,
    state_path: statePath,
    home: doc.programme?.home ?? null,
    banked_at: doc.banked?.at ?? null,
    ticket: canonical.ticket,
    primary_checkout: normalisePath(doc.repository?.primary_checkout) || null,
  };
}

// Collapse the copies of one programme. Deterministic: each group is ordered by
// state_path before any choice is made, so two runs over the same estate cannot
// produce two different indexes.
export function collapseCopies(copies) {
  const byId = new Map();
  for (const c of copies) {
    const key = String(c.id).toLowerCase();
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(c);
  }

  const entries = [];
  for (const group of byId.values()) {
    group.sort((a, b) => a.state_path.localeCompare(b.state_path));
    if (group.length === 1) {
      entries.push(group[0]);
      continue;
    }
    const selfConsistent = group.filter((c) => isInside(c.state_path, c.worktree));
    if (selfConsistent.length === 1) {
      entries.push(selfConsistent[0]);
      continue;
    }
    const agreed = group.every(
      (c) => samePath(c.worktree, group[0].worktree) && c.branch === group[0].branch
    );
    if (agreed) {
      entries.push(selfConsistent.length > 1 ? selfConsistent[0] : group[0]);
      continue;
    }
    // Genuinely contradictory copies of one programme. Keep them all: the
    // resolver must refuse and name the disagreement, not pick a winner.
    for (const c of group) entries.push(c);
  }

  entries.sort(
    (a, b) => String(a.id).localeCompare(String(b.id)) || a.state_path.localeCompare(b.state_path)
  );
  return entries;
}

export function buildRegistry({
  estateRoots = [],
  execFile = execFileSync,
  readdir = readdirSync,
  read = readFileSync,
  exists = existsSync,
  now = () => new Date().toISOString(),
} = {}) {
  // ONE implementation of "what is the estate" — the one findCanonical uses.
  const roots = discoverWorktreeRoots({ probes: estateRoots, execFile });

  const unknown = [];
  const copies = [];

  for (const root of roots) {
    const deliverables = join(root, 'Deliverables');
    let dirents;
    try {
      dirents = readdir(deliverables, { withFileTypes: true });
    } catch {
      continue; // this root carries no Deliverables/ — not an error
    }
    for (const d of dirents) {
      if (!d.isDirectory()) continue;
      const candidate = join(deliverables, d.name, 'programme-state.json');
      if (!exists(candidate)) continue;
      const statePath = normalisePath(candidate);

      let doc;
      try {
        doc = JSON.parse(read(candidate, 'utf8'));
      } catch (err) {
        unknown.push({ path: statePath, why: `not parseable as JSON (${err.message})` });
        continue;
      }
      const canonical = canonicalFromState(doc, candidate);
      if (!doc?.programme?.id || !canonical) {
        unknown.push({
          path: statePath,
          why: 'does not name a programme id together with a worktree and a branch, so it can be neither indexed by name nor resolved to a location',
        });
        continue;
      }
      copies.push(entryFrom(doc, canonical, statePath));
    }
  }

  return {
    schema_version: REGISTRY_SCHEMA_VERSION,
    generated_at: now(),
    estate_roots: roots,
    entries: collapseCopies(copies),
    unknown,
  };
}

// ---------------------------------------------------------------------------
// Persistence — atomic, per the health-store convention
// ---------------------------------------------------------------------------

export function writeRegistry(registry, filePath) {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    writeFileSync(tmpPath, `${JSON.stringify(registry, null, 2)}\n`);
    renameSync(tmpPath, filePath);
    return { ok: true, error: null, path: filePath };
  } catch (err) {
    return { ok: false, error: err.message, path: filePath };
  }
}

// A MISSING registry is `ok: false`, never an empty one. "Nothing matched, and I
// examined nothing" must never be able to impersonate "nothing matched, and I
// examined every build on this machine" — that is INV-5 applied to the read path.
export function readRegistry(filePath) {
  if (!existsSync(filePath)) {
    return {
      ok: false,
      registry: null,
      error: `no build registry at ${filePath} — it has never been generated on this machine. Generate it with: node tools/governor/build-registry.mjs --refresh`,
    };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { ok: false, registry: null, error: `the registry at ${filePath} is not parseable JSON (${err.message}) — regenerate it with --refresh` };
  }
  if (data?.schema_version !== REGISTRY_SCHEMA_VERSION) {
    return {
      ok: false,
      registry: null,
      error: `the registry at ${filePath} declares schema_version ${JSON.stringify(data?.schema_version)}; this governor writes and reads ${REGISTRY_SCHEMA_VERSION}. Regenerate it with --refresh.`,
    };
  }
  if (!Array.isArray(data.entries)) {
    return { ok: false, registry: null, error: `the registry at ${filePath} has no entries array — regenerate it with --refresh` };
  }
  return { ok: true, registry: data, error: null };
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

export const RESOLVE = {
  OK: 'ok',
  NOT_FOUND: 'not-found',
  AMBIGUOUS: 'ambiguous',
  WORKTREE_MISSING: 'worktree-missing',
  STATE_UNREADABLE: 'state-unreadable',
  CONTESTED_WORKTREE: 'contested-worktree',
  BRANCH_GONE: 'branch-gone',
};

// The re-read. This — not the index — is where a location comes from.
function readStateFrom(statePath, { exists, read }) {
  if (!statePath) {
    return { ok: false, error: 'the index entry carries no state-file path, so nothing can be re-read' };
  }
  if (!exists(statePath)) {
    return {
      ok: false,
      error: `the programme state file the index points at is gone: ${statePath}. The index is only an index — it cannot supply a location by itself, so this fails rather than reporting a remembered one.`,
    };
  }
  let raw;
  try {
    raw = read(statePath, 'utf8');
  } catch (err) {
    return { ok: false, error: `${statePath} could not be read (${err.message})` };
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: `${statePath} is not parseable JSON (${err.message})` };
  }
  if (doc?.schema_version !== STATE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `${statePath} declares schema_version ${JSON.stringify(doc?.schema_version)}; this governor understands ${STATE_SCHEMA_VERSION}`,
    };
  }
  let validation;
  try {
    validation = validateProgrammeState(doc);
  } catch (err) {
    return { ok: false, error: `${statePath} could not be validated (${err.message})` };
  }
  if (!validation.ok) {
    return {
      ok: false,
      error: `${statePath} is not a valid programme state (${validation.errors.length} error(s)); first: ${validation.errors[0]}`,
    };
  }
  return { ok: true, doc, examined: validation.examined };
}

// Same status, honest reason. "The branch was deleted" and "git would not answer"
// lead to completely different repairs, and the refusal is the only thing on
// screen at the moment it matters.
function verifyBranch({ worktree, branch, execFile }) {
  try {
    execFile('git', ['-C', worktree, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}^{commit}`], {
      encoding: 'utf8',
    });
    return { present: true, reason: null };
  } catch (err) {
    const stderr = err?.stderr ? String(err.stderr).trim().split('\n')[0] : '';
    if (!stderr) {
      // `rev-parse --verify --quiet` exits non-zero and says nothing when the ref
      // simply is not there. That is the merged-and-deleted case.
      return {
        present: false,
        reason: `branch \`${branch}\` no longer exists in ${worktree}. The usual cause is that it was merged and cleaned up — the work is most likely on main, not lost.`,
      };
    }
    const detail = stderr || (err?.message ? String(err.message).split('\n')[0] : 'git gave no answer');
    return {
      present: false,
      reason: `branch \`${branch}\` could NOT be verified in ${worktree}: ${detail}. This is a different problem from a deleted branch — the repository itself did not answer. Unknown is not present, so this refuses rather than sending a session to a branch nobody confirmed.`,
    };
  }
}

function describeIndexed(entries) {
  if (entries.length === 0) return 'the index is empty — no programme state was found in any estate root';
  const shown = entries.slice(0, 12).map((e) => `${e.id}${e.aliases?.length ? ` (${e.aliases.join(', ')})` : ''}`);
  const more = entries.length > 12 ? `, and ${entries.length - 12} more` : '';
  return `indexed builds: ${shown.join('; ')}${more}`;
}

export function resolveBuild(name, { registry, execFile = execFileSync, exists = existsSync, read = readFileSync } = {}) {
  const wanted = typeof name === 'string' ? name.trim().toLowerCase() : '';
  const entries = Array.isArray(registry?.entries) ? registry.entries : [];

  const result = {
    name: wanted,
    status: RESOLVE.NOT_FOUND,
    entry: null,
    candidates: [],
    location: null,
    state: null,
    reason: '',
    checked: 0,
  };

  if (!wanted) {
    result.reason = 'no build name was given. Name a build — its id (BUILD-018), its number (018) or its slug (session-governor, governor).';
    return result;
  }

  const matches = [];
  for (const entry of entries) {
    result.checked += 1;
    const aliases = Array.isArray(entry?.aliases) ? entry.aliases : [];
    if (aliases.includes(wanted) || String(entry?.id ?? '').toLowerCase() === wanted) {
      matches.push(entry);
    }
  }

  if (matches.length === 0) {
    result.reason = `no build in the registry answers to "${wanted}" — ${describeIndexed(entries)}. If the build is new, or has moved, refresh the index.`;
    return result;
  }

  if (matches.length > 1) {
    const ids = [...new Set(matches.map((m) => String(m.id)))];
    result.status = RESOLVE.AMBIGUOUS;
    result.candidates = matches;
    result.reason =
      ids.length === 1
        ? `two or more copies of ${ids[0]} disagree about its canonical location, so "${wanted}" cannot be resolved to one place. This is a defect in the banked state, not in the name: the copies must be reconciled before a session is sent anywhere.`
        : `"${wanted}" matches ${ids.length} builds (${ids.join(', ')}). Refusing to choose — name the build more precisely.`;
    return result;
  }

  const entry = matches[0];
  result.entry = entry;

  // THE RE-READ. Everything below derives from `fresh.doc`, never from `entry`.
  const fresh = readStateFrom(entry.state_path, { exists, read });
  if (!fresh.ok) {
    result.status = RESOLVE.STATE_UNREADABLE;
    result.reason = `${entry.id}: ${fresh.error}`;
    return result;
  }
  result.state = fresh.doc;

  const live = canonicalFromState(fresh.doc, entry.state_path);
  if (!live) {
    result.status = RESOLVE.STATE_UNREADABLE;
    result.reason = `${entry.id}: ${entry.state_path} no longer names both a worktree and a branch, so no location can be derived from it.`;
    return result;
  }

  // Contest is judged between ACTIVE builds only, and it is judged on what the
  // other builds' state files say NOW — the index is used only to know which
  // files to open. Checked BEFORE the worktree-exists test on purpose: telling
  // Larry to recreate a worktree that a second build also claims would make the
  // conflict worse.
  if (fresh.doc?.programme?.status === 'active') {
    const contenders = [];
    for (const other of entries) {
      if (other === entry) continue;
      if (String(other.id).toLowerCase() === String(entry.id).toLowerCase()) continue;
      result.checked += 1;
      const otherState = readStateFrom(other.state_path, { exists, read });
      if (!otherState.ok) continue; // an unreadable stranger is not evidence of a contest
      if (otherState.doc?.programme?.status !== 'active') continue;
      const otherLive = canonicalFromState(otherState.doc, other.state_path);
      if (otherLive && samePath(otherLive.worktree, live.worktree)) contenders.push(other);
    }
    if (contenders.length > 0) {
      result.status = RESOLVE.CONTESTED_WORKTREE;
      result.candidates = [entry, ...contenders];
      result.reason = `${entry.id} and ${contenders.map((c) => c.id).join(', ')} all claim ${live.worktree} as their canonical worktree, and all are active. Two builds cannot own one worktree — sending a session there would put one build's work on the other's branch. Refusing until the estate says which.`;
      return result;
    }
  }

  if (!exists(live.worktree)) {
    result.status = RESOLVE.WORKTREE_MISSING;
    result.reason = `${entry.id} names ${live.worktree} as its canonical worktree, but nothing is there. The worktree was removed, renamed or never created on this machine.`;
    return result;
  }

  const branch = verifyBranch({ worktree: live.worktree, branch: live.branch, execFile });
  if (!branch.present) {
    result.status = RESOLVE.BRANCH_GONE;
    result.reason = `${entry.id}: ${branch.reason}`;
    return result;
  }

  result.status = RESOLVE.OK;
  result.location = {
    worktree: live.worktree,
    branch: live.branch,
    statePath: normalisePath(entry.state_path),
    ticket: live.ticket,
  };
  result.reason = `${entry.id} resolved from its own state file, re-read just now.`;
  return result;
}

// ---------------------------------------------------------------------------
// The Warwick-facing render
// ---------------------------------------------------------------------------
// AD-20: this text never contains a git command, in any form, for anyone. Larry
// owns the complete lifecycle; a launcher that ends "now just check out the
// branch" has converted an orchestration failure into Warwick's problem while
// looking helpful. AD-21's protocol is embedded verbatim rather than referenced,
// because at the moment it is needed nobody is reading the map.

const AD21_LINE = 'Approve the pending EnterWorktree request in the local Claude terminal';

function footer(resolution) {
  return `\n(${resolution.checked} registry entr${resolution.checked === 1 ? 'y' : 'ies'} examined)`;
}

export function renderLaunch(resolution, { liveCwd = null } = {}) {
  if (!resolution || typeof resolution !== 'object') {
    return 'No resolution was produced, so nothing can be reported. That is a defect in the caller, not an answer about a build.';
  }

  const label = resolution.name ? `"${resolution.name}"` : '(no name given)';

  if (resolution.status === RESOLVE.OK && resolution.location) {
    const loc = resolution.location;
    const state = resolution.state || {};
    const already = liveCwd && isInside(liveCwd, loc.worktree);
    const lines = [
      `▶ ${resolution.entry?.id ?? label}${resolution.entry?.title ? ` — ${resolution.entry.title}` : ''}`,
      '',
      `  worktree    : ${loc.worktree}`,
      `  branch      : ${loc.branch}`,
      `  next ticket : ${loc.ticket || '(none recorded)'}`,
      `  state file  : ${loc.statePath}`,
    ];
    if (state.resumption?.next_action) {
      lines.push(`  next action : ${state.resumption.next_action}`);
    }
    lines.push(
      '',
      'Every field above was derived from that state file, re-read just now. The',
      'registry supplied only its path.'
    );

    if (already) {
      lines.push('', 'This session is ALREADY in the canonical worktree. No move is required.');
    } else {
      lines.push(
        '',
        'A MOVE IS REQUIRED — Larry performs it AUTOMATICALLY; Warwick does nothing (AD-20):',
        `  1. Larry calls EnterWorktree with path: ${loc.worktree}`,
        '     This routes the session INTO the canonical checkout in-process. It needs no',
        '     relaunch, and in observed Remote Control use it needed no approval prompt.',
        '  2. Larry re-verifies cwd, repository root and branch, then continues the work.',
        '',
        '  FALLBACK — ONLY if EnterWorktree actually BLOCKS on an approval that Warwick',
        '  cannot see from Remote Control: Larry says this once, verbatim, then waits —',
        `     "${AD21_LINE}"`,
        '  Larry must NOT ask Warwick to relaunch, to open a terminal in a particular folder,',
        '  or to run git.',
        '',
        'Nothing here is for Warwick to do. Larry owns the complete lifecycle.'
      );
    }
    return lines.join('\n') + footer(resolution);
  }

  const heading = {
    [RESOLVE.NOT_FOUND]: 'NOT FOUND',
    [RESOLVE.AMBIGUOUS]: 'AMBIGUOUS',
    [RESOLVE.WORKTREE_MISSING]: 'WORKTREE MISSING',
    [RESOLVE.STATE_UNREADABLE]: 'STATE UNREADABLE',
    [RESOLVE.CONTESTED_WORKTREE]: 'CONTESTED WORKTREE',
    [RESOLVE.BRANCH_GONE]: 'BRANCH GONE',
  }[resolution.status] || String(resolution.status || 'UNRESOLVED').toUpperCase();

  const lines = [`🚧 CANNOT LAUNCH ${label} — ${heading}`, '', resolution.reason || '(no reason recorded)'];

  if (resolution.candidates?.length) {
    lines.push('', 'Candidates:');
    for (const c of resolution.candidates) {
      lines.push(`  - ${c.id} — ${c.worktree} on ${c.branch}  [${c.state_path}]`);
    }
  }

  const nextStep = {
    [RESOLVE.NOT_FOUND]:
      'Larry refreshes the index (node tools/governor/build-registry.mjs --refresh) from inside the estate, then tries again. If it is still absent, the build has no banked programme state — that is the thing to fix.',
    [RESOLVE.AMBIGUOUS]:
      'Larry asks for the id, or reconciles the disagreeing state copies. He does not pick one — a launcher that guesses is the failure this refusal prevents.',
    [RESOLVE.WORKTREE_MISSING]:
      'Larry re-creates the worktree himself and re-banks the state to match (AD-20). Warwick is not asked to do anything.',
    [RESOLVE.STATE_UNREADABLE]:
      'Larry repairs or re-banks the programme state. Until it reads, the governor has no idea where this build lives and will keep saying so — a governor that cannot read its own state must get louder, not quieter (INV-1).',
    [RESOLVE.CONTESTED_WORKTREE]:
      'Larry reconciles the estate: one of these builds is banked against a worktree that is not its own. Nothing is launched until exactly one claim stands.',
    [RESOLVE.BRANCH_GONE]:
      'Larry establishes whether the branch merged. If it did, the build is finished rather than lost, and the programme state should be closed out. If it did not, the branch must be restored before any session resumes on it.',
  }[resolution.status];

  if (nextStep) lines.push('', `WHAT HAPPENS NEXT: ${nextStep}`);
  return lines.join('\n') + footer(resolution);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
// Distinct exit codes so "did not run" can never read as "launchable" (INV-1,
// matching rotate-session.mjs's EXIT convention).

export const EXIT = {
  LAUNCHABLE: 0,
  CANNOT_LAUNCH: 1,
  BLIND: 2,
};

export function runCli(argv, { env = process.env, cwd = process.cwd(), stdout = (s) => process.stdout.write(s) } = {}) {
  const estateRoots = [];
  let refresh = false;
  let file = null;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--estate' && argv[i + 1]) estateRoots.push(argv[++i]);
    else if (argv[i] === '--registry' && argv[i + 1]) file = argv[++i];
    else if (argv[i] === '--refresh') refresh = true;
    else rest.push(argv[i]);
  }
  if (env.GOVERNOR_ESTATE_ROOT) estateRoots.push(env.GOVERNOR_ESTATE_ROOT);

  const target = file || registryPath({ env });
  const name = rest.join(' ').trim();

  if (refresh) {
    const registry = buildRegistry({ estateRoots: [cwd, ...estateRoots] });
    const written = writeRegistry(registry, target);
    if (!written.ok) {
      stdout(`BLIND — the registry could not be written to ${target}: ${written.error}\n`);
      return EXIT.BLIND;
    }
    stdout(
      `Indexed ${registry.entries.length} build(s) from ${registry.estate_roots.length} estate root(s) into ${target}.\n` +
        registry.entries.map((e) => `  ${e.id} [${e.status}] — ${e.worktree} on ${e.branch}\n`).join('') +
        (registry.unknown.length
          ? `  ${registry.unknown.length} state file(s) could not be indexed:\n` +
            registry.unknown.map((u) => `    - ${u.path}: ${u.why}\n`).join('')
          : '')
    );
    if (registry.entries.length === 0) {
      stdout(
        'BLIND — nothing was indexed. Run this from inside the estate, or pass --estate <path>.\n'
      );
      return EXIT.BLIND;
    }
    if (!name) return EXIT.LAUNCHABLE;
  }

  const loaded = readRegistry(target);
  if (!loaded.ok) {
    stdout(`BLIND — ${loaded.error}\n`);
    return EXIT.BLIND;
  }

  if (!name) {
    stdout(
      `${loaded.registry.entries.length} build(s) indexed at ${target} (generated ${loaded.registry.generated_at}):\n` +
        loaded.registry.entries
          .map((e) => `  ${e.id} [${e.status}] — ${e.aliases.join(', ')}\n`)
          .join('')
    );
    return EXIT.LAUNCHABLE;
  }

  const resolution = resolveBuild(name, { registry: loaded.registry });
  stdout(`${renderLaunch(resolution, { liveCwd: cwd })}\n`);
  return resolution.status === RESOLVE.OK ? EXIT.LAUNCHABLE : EXIT.CANNOT_LAUNCH;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runCli(process.argv.slice(2));
}
