// Tests for the build-session registry and launcher (BUILD-018 T-14, deliverable 1)
//
// The controls that matter here are the ones that prove the index CANNOT be
// believed about a location. Every one of them is a mutation: the registry is
// pointed at a real place, the place is then changed on disk behind its back, and
// the resolver is required to notice. A test that only ever asked "does the happy
// path work" would pass just as well against an implementation that trusts the
// index — which is the one implementation this module must not be.
//
// Real git, in os.tmpdir() only. Nothing here writes to the estate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REGISTRY_SCHEMA_VERSION,
  registryPath,
  aliasesFor,
  collapseCopies,
  buildRegistry,
  writeRegistry,
  readRegistry,
  resolveBuild,
  renderLaunch,
  runCli,
  RESOLVE,
  EXIT,
} from './build-registry.mjs';
import { findCanonical, normalisePath } from './worktree-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, 'fixtures', 'programme-state.minimal.json');
const COMMAND_FILE = join(__dirname, '..', '..', '.claude', 'commands', 'build.md');

// A rendered launch message must never contain a git INVOCATION (AD-20). This
// bans the command, not the word: "Larry owns the git lifecycle" is a sentence
// the invariant needs to be able to say. T-10 learned that a substring ban on the
// concept also bans the prose proving it held.
const GIT_COMMAND = /(^|[\s`"'$(])git\s+(checkout|switch|worktree|pull|fetch|clone|branch|rebase|merge|commit|push|add|reset|stash|init|restore|cherry-pick)\b/i;

function makeState({
  id,
  slug,
  worktree,
  branch,
  ticket = 'T-02',
  status = 'active',
  primary = 'C:/Primary',
}) {
  const s = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  s.programme.id = id;
  s.programme.title = `${id} — synthetic programme`;
  s.programme.home = `Deliverables/${slug}`;
  s.programme.status = status;
  s.repository.primary_checkout = primary;
  s.repository.worktree = worktree;
  s.repository.branch = branch;
  s.repository.upstream = `origin/${branch}`;
  s.branches[0].name = branch;
  s.branches[0].upstream = `origin/${branch}`;
  s.pull_requests[0].branch = branch;
  s.worktrees[0].path = worktree;
  s.worktrees[0].branch = branch;
  s.workers[0].worktree = worktree;
  s.resumption.worktree = worktree;
  s.resumption.branch = branch;
  s.resumption.ticket = ticket;
  return s;
}

function entryFor(state, statePath) {
  return {
    id: state.programme.id,
    title: state.programme.title,
    status: state.programme.status,
    aliases: aliasesFor(state),
    worktree: normalisePath(state.resumption.worktree),
    branch: state.resumption.branch,
    state_path: normalisePath(statePath),
    home: state.programme.home,
    banked_at: state.banked.at,
    ticket: state.resumption.ticket,
    primary_checkout: normalisePath(state.repository.primary_checkout),
  };
}

function writeState(dir, state) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'programme-state.json');
  writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`);
  return normalisePath(p);
}

// ---------------------------------------------------------------------------
// A real estate: one repository, three real worktrees, real branches.
// ---------------------------------------------------------------------------

function topLevel(p) {
  return execFileSync('git', ['-C', p, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' })
    .trim()
    .replace(/\\/g, '/');
}

function makeEstate() {
  const root = mkdtempSync(join(tmpdir(), 'governor-registry-'));
  const primaryDir = join(root, 'primary');
  mkdirSync(primaryDir, { recursive: true });
  execFileSync('git', ['-C', primaryDir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', primaryDir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', primaryDir, 'config', 'user.name', 'Test']);
  writeFileSync(join(primaryDir, 'seed.txt'), 'seed\n');
  execFileSync('git', ['-C', primaryDir, 'add', 'seed.txt']);
  execFileSync('git', ['-C', primaryDir, 'commit', '-q', '-m', 'seed']);

  const add = (name, branch) => {
    const p = join(root, name);
    execFileSync('git', ['-C', primaryDir, 'worktree', 'add', '-q', p, '-b', branch]);
    return topLevel(p);
  };

  const primary = topLevel(primaryDir);
  const alpha = add('alpha', 'build-701/alpha');
  const beta = add('beta', 'build-702/beta');
  const gamma = add('gamma', 'build-701/moved');

  const alphaState = makeState({
    id: 'BUILD-701',
    slug: 'BUILD-701-alpha-registry',
    worktree: alpha,
    branch: 'build-701/alpha',
    ticket: 'T-02',
    primary,
  });
  const betaState = makeState({
    id: 'BUILD-702',
    slug: 'BUILD-702-beta-launcher',
    worktree: beta,
    branch: 'build-702/beta',
    ticket: 'T-03',
    primary,
  });

  // The SAME programme's state, visible from two checkouts — the copies problem.
  // The self-consistent copy is the one inside the worktree it names.
  const offBranchCopy = writeState(join(primary, 'Deliverables', 'BUILD-701-alpha-registry'), alphaState);
  const selfConsistentCopy = writeState(join(alpha, 'Deliverables', 'BUILD-701-alpha-registry'), alphaState);
  const betaStatePath = writeState(join(beta, 'Deliverables', 'BUILD-702-beta-launcher'), betaState);

  // A state file that cannot be parsed at all.
  const brokenDir = join(primary, 'Deliverables', 'BUILD-703-broken');
  mkdirSync(brokenDir, { recursive: true });
  const brokenPath = normalisePath(join(brokenDir, 'programme-state.json'));
  writeFileSync(brokenPath, '{ this is not json');

  const cleanup = () => {
    for (const p of [join(root, 'alpha'), join(root, 'beta'), join(root, 'gamma')]) {
      try {
        execFileSync('git', ['-C', primaryDir, 'worktree', 'remove', '--force', p], { stdio: 'ignore' });
      } catch {
        /* best effort — the whole tree is removed next anyway */
      }
    }
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      /* Windows can hold a handle briefly; the temp dir is disposable */
    }
  };

  return {
    root,
    primary,
    alpha,
    beta,
    gamma,
    alphaState,
    betaState,
    offBranchCopy,
    selfConsistentCopy,
    betaStatePath,
    brokenPath,
    cleanup,
  };
}

// ---------------------------------------------------------------------------
// Pure surface
// ---------------------------------------------------------------------------

test('registryPath defaults under ~/.mypka/governor and honours MYPKA_GOVERNOR_REGISTRY', () => {
  const dflt = registryPath({ env: {}, home: 'C:/Users/Test' });
  assert.equal(normalisePath(dflt), 'C:/Users/Test/.mypka/governor/registry.json');
  assert.equal(
    registryPath({ env: { MYPKA_GOVERNOR_REGISTRY: 'D:/elsewhere/reg.json' }, home: 'C:/Users/Test' }),
    'D:/elsewhere/reg.json'
  );
});

test('aliasesFor derives exactly the documented forms, and derives them the same way twice', () => {
  const state = makeState({
    id: 'BUILD-018',
    slug: 'BUILD-018-session-governor',
    worktree: 'C:/Fusion247PKA-governor',
    branch: 'build-018/session-governor',
  });

  const aliases = aliasesFor(state);
  assert.deepEqual(aliases, ['build-018', '018', 'session-governor', 'session', 'governor']);

  // Determinism is the whole safety case for a fuzzy matcher: a launcher that
  // worked yesterday must not refuse today for unreproducible reasons.
  assert.deepEqual(aliasesFor(JSON.parse(JSON.stringify(state))), aliases);

  // Documented exclusions.
  assert.ok(!aliases.includes('18'), 'the un-padded number is deliberately not an alias');
  assert.ok(
    aliases.every((a) => a === a.toLowerCase()),
    'aliases are lower-cased'
  );
});

test('aliasesFor degrades instead of throwing on a state missing its home or its id', () => {
  assert.deepEqual(aliasesFor({ programme: { id: 'BUILD-042' } }), ['build-042', '042']);
  // No id to strip, so the whole basename is the slug and the >= 4-char word rule
  // applies to it unchanged — including the word "build". The rule is applied
  // consistently rather than special-cased, because a matcher with exceptions is a
  // matcher nobody can predict.
  assert.deepEqual(aliasesFor({ programme: { home: 'Deliverables/loose-build' } }), ['loose-build', 'loose', 'build']);
  assert.deepEqual(aliasesFor({}), []);
  assert.deepEqual(aliasesFor(null), []);
});

test('collapseCopies keeps the self-consistent copy, and keeps BOTH when copies genuinely disagree', () => {
  const agreeing = [
    { id: 'BUILD-701', worktree: 'C:/estate/alpha', branch: 'b/alpha', state_path: 'C:/estate/primary/Deliverables/x/programme-state.json' },
    { id: 'BUILD-701', worktree: 'C:/estate/alpha', branch: 'b/alpha', state_path: 'C:/estate/alpha/Deliverables/x/programme-state.json' },
  ];
  const collapsed = collapseCopies(agreeing);
  assert.equal(collapsed.length, 1, 'one programme is one entry however many checkouts hold its state');
  assert.equal(collapsed[0].state_path, 'C:/estate/alpha/Deliverables/x/programme-state.json');

  const disagreeing = [
    { id: 'BUILD-701', worktree: 'C:/estate/old', branch: 'b/old', state_path: 'C:/estate/primary/Deliverables/x/programme-state.json' },
    { id: 'BUILD-701', worktree: 'C:/estate/new', branch: 'b/new', state_path: 'C:/estate/other/Deliverables/x/programme-state.json' },
  ];
  assert.equal(collapseCopies(disagreeing).length, 2, 'a genuine disagreement is preserved for the resolver to refuse over');
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

test('writeRegistry is atomic and leaves no temp file; readRegistry refuses missing, corrupt and mis-versioned files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-regfile-'));
  const file = join(dir, 'nested', 'registry.json');
  try {
    const missing = readRegistry(file);
    assert.equal(missing.ok, false);
    assert.equal(missing.registry, null);
    assert.match(missing.error, /never been generated/);

    const registry = {
      schema_version: REGISTRY_SCHEMA_VERSION,
      generated_at: '2026-07-31T00:00:00.000Z',
      estate_roots: ['C:/estate'],
      entries: [entryFor(makeState({ id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/alpha', branch: 'b/alpha' }), 'C:/estate/alpha/Deliverables/BUILD-701-alpha/programme-state.json')],
      unknown: [],
    };
    assert.equal(writeRegistry(registry, file).ok, true);
    assert.deepEqual(
      readdirSync(join(dir, 'nested')),
      ['registry.json'],
      'the temp file is renamed away, never left behind'
    );

    const loaded = readRegistry(file);
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.registry.entries, registry.entries);

    writeFileSync(file, '{ broken');
    assert.equal(readRegistry(file).ok, false);

    writeFileSync(file, JSON.stringify({ schema_version: 99, entries: [] }));
    const versioned = readRegistry(file);
    assert.equal(versioned.ok, false);
    assert.match(versioned.error, /schema_version/);
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

// ---------------------------------------------------------------------------
// Building the index over a REAL estate
// ---------------------------------------------------------------------------

test('REAL GIT: buildRegistry indexes every programme once, collapsing copies and quarantining what it cannot read', () => {
  const estate = makeEstate();
  try {
    const registry = buildRegistry({ estateRoots: [estate.primary], now: () => '2026-07-31T00:00:00.000Z' });

    assert.ok(registry.estate_roots.length >= 4, 'every worktree of the repository is an estate root');
    assert.equal(registry.entries.length, 2, 'two programmes, not three copies of two programmes');
    assert.equal(registry.schema_version, REGISTRY_SCHEMA_VERSION);

    const byId = new Map(registry.entries.map((e) => [e.id, e]));
    const alpha = byId.get('BUILD-701');
    assert.ok(alpha, 'BUILD-701 is indexed');
    assert.equal(
      alpha.state_path,
      estate.selfConsistentCopy,
      'the copy INSIDE the worktree it names wins over the off-branch copy'
    );
    assert.equal(alpha.worktree, estate.alpha);
    assert.equal(alpha.branch, 'build-701/alpha');
    assert.equal(alpha.ticket, 'T-02');
    assert.equal(alpha.status, 'active');
    assert.deepEqual(alpha.aliases, ['build-701', '701', 'alpha-registry', 'alpha', 'registry']);
    assert.ok(!alpha.state_path.includes('\\'), 'paths are normalised to forward slashes');

    assert.equal(registry.unknown.length, 1, 'the unparseable state file is reported, not silently skipped');
    assert.equal(registry.unknown[0].path, estate.brokenPath);
  } finally {
    estate.cleanup();
  }
});

test('REAL GIT: the registry and findCanonical agree about the estate — one discovery implementation, proven', () => {
  const estate = makeEstate();
  try {
    const registry = buildRegistry({ estateRoots: [estate.primary] });
    // Two active programmes, so findCanonical correctly refuses to choose — but its
    // candidate set is the same set of programmes, resolved the same way.
    const found = findCanonical({ cwd: estate.primary });
    assert.equal(found.canonical, null);

    const shape = (list) =>
      list
        .map((c) => `${(c.worktree || '').toLowerCase()}|${c.branch}`)
        .sort()
        .join('\n');

    assert.equal(
      shape(registry.entries),
      shape(found.candidates),
      'the guard and the registry must never disagree about where the builds are'
    );
  } finally {
    estate.cleanup();
  }
});

// ---------------------------------------------------------------------------
// The resolver — positive control first, so the negatives below mean something
// ---------------------------------------------------------------------------

test('REAL GIT: resolveBuild takes a name and returns the location the state file gives now (INV-5: checked > 0)', () => {
  const estate = makeEstate();
  try {
    const registry = buildRegistry({ estateRoots: [estate.primary] });
    const resolution = resolveBuild('registry', { registry });

    assert.equal(resolution.status, RESOLVE.OK);
    assert.equal(resolution.entry.id, 'BUILD-701');
    assert.equal(resolution.location.worktree, estate.alpha);
    assert.equal(resolution.location.branch, 'build-701/alpha');
    assert.equal(resolution.location.ticket, 'T-02');
    assert.equal(resolution.location.statePath, estate.selfConsistentCopy);
    assert.ok(resolution.checked > 0, 'a resolve that examined nothing must never read as a clean bill');

    // The same build by id, and by number.
    assert.equal(resolveBuild('BUILD-701', { registry }).status, RESOLVE.OK);
    assert.equal(resolveBuild('  701 ', { registry }).status, RESOLVE.OK);
  } finally {
    estate.cleanup();
  }
});

test('MUTATION (mandatory): the index is NOT authoritative — moving the state on disk moves the answer, deleting it fails', () => {
  const estate = makeEstate();
  try {
    const registry = buildRegistry({ estateRoots: [estate.primary] });
    const indexed = registry.entries.find((e) => e.id === 'BUILD-701');
    assert.equal(indexed.worktree, estate.alpha, 'precondition: the index believes BUILD-701 lives in alpha');

    // Change the ON-DISK state to name a DIFFERENT real worktree and branch.
    // The index is left untouched and therefore now lies.
    const moved = makeState({
      id: 'BUILD-701',
      slug: 'BUILD-701-alpha-registry',
      worktree: estate.gamma,
      branch: 'build-701/moved',
      ticket: 'T-03',
      primary: estate.primary,
    });
    writeFileSync(estate.selfConsistentCopy, `${JSON.stringify(moved, null, 2)}\n`);

    const after = resolveBuild('registry', { registry });
    assert.equal(after.status, RESOLVE.OK);
    assert.equal(
      after.location.worktree,
      estate.gamma,
      'the location came from the re-read state file, not from the index'
    );
    assert.equal(after.location.branch, 'build-701/moved');
    assert.equal(after.location.ticket, 'T-03');
    assert.notEqual(after.location.worktree, indexed.worktree, 'the stale index entry was not believed');

    // And a stale index must FAIL rather than fall back to what it remembers.
    unlinkSync(estate.selfConsistentCopy);
    const gone = resolveBuild('registry', { registry });
    assert.equal(gone.status, RESOLVE.STATE_UNREADABLE);
    assert.equal(gone.location, null, 'never a remembered location');
    assert.match(gone.reason, /cannot supply a location by itself/);
  } finally {
    estate.cleanup();
  }
});

test('REAL GIT: a branch that does not exist is BRANCH_GONE, not a launch', () => {
  const estate = makeEstate();
  try {
    const state = makeState({
      id: 'BUILD-704',
      slug: 'BUILD-704-merged-away',
      worktree: estate.alpha,
      branch: 'build-704/deleted-after-merge',
      primary: estate.primary,
    });
    const statePath = writeState(join(estate.alpha, 'Deliverables', 'BUILD-704-merged-away'), state);
    const registry = { schema_version: REGISTRY_SCHEMA_VERSION, generated_at: 'x', entries: [entryFor(state, statePath)], unknown: [] };

    const resolution = resolveBuild('merged-away', { registry });
    assert.equal(resolution.status, RESOLVE.BRANCH_GONE);
    assert.equal(resolution.location, null);
    assert.match(resolution.reason, /no longer exists/);
    assert.match(resolution.reason, /merged and cleaned up/);
  } finally {
    estate.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Every remaining required failure mode
// ---------------------------------------------------------------------------

function syntheticRegistry(specs) {
  const files = new Map();
  const entries = specs.map((spec) => {
    const state = makeState(spec);
    const statePath = `C:/estate/${spec.slug}/programme-state.json`;
    files.set(statePath, spec.corrupt ?? `${JSON.stringify(spec.mutate ? spec.mutate(state) : state)}`);
    return entryFor(state, statePath);
  });
  return {
    registry: { schema_version: REGISTRY_SCHEMA_VERSION, generated_at: 'x', entries, unknown: [] },
    files,
  };
}

function fakeIo(files, { existingDirs = [], onExec } = {}) {
  return {
    exists: (p) => files.has(normalisePath(p)) || existingDirs.some((d) => normalisePath(d) === normalisePath(p)),
    read: (p) => {
      const v = files.get(normalisePath(p));
      if (v === undefined) throw new Error(`ENOENT ${p}`);
      return v;
    },
    execFile: onExec || (() => ''),
  };
}

test('a name that matches nothing is NOT_FOUND, and the reason names what WAS indexed', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/alpha', branch: 'b/alpha' },
    { id: 'BUILD-702', slug: 'BUILD-702-beta', worktree: 'C:/estate/beta', branch: 'b/beta' },
  ]);
  const resolution = resolveBuild('cockpit', { registry, ...fakeIo(files) });

  assert.equal(resolution.status, RESOLVE.NOT_FOUND);
  assert.equal(resolution.location, null);
  assert.equal(resolution.checked, 2, 'every entry was examined against the name');
  assert.ok(resolution.checked > 0);
  assert.match(resolution.reason, /BUILD-701/);
  assert.match(resolution.reason, /BUILD-702/);
});

test('NOT_FOUND over an EMPTY index says so — an unexamined index must not read like a searched one', () => {
  const empty = { schema_version: REGISTRY_SCHEMA_VERSION, generated_at: 'x', entries: [], unknown: [] };
  const resolution = resolveBuild('governor', { registry: empty });
  assert.equal(resolution.status, RESOLVE.NOT_FOUND);
  assert.equal(resolution.checked, 0);
  assert.match(resolution.reason, /the index is empty/);
});

test('a name that matches two different builds is AMBIGUOUS and refuses to pick', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-session-governor', worktree: 'C:/estate/alpha', branch: 'b/alpha' },
    { id: 'BUILD-702', slug: 'BUILD-702-fleet-governor', worktree: 'C:/estate/beta', branch: 'b/beta' },
  ]);
  const resolution = resolveBuild('governor', { registry, ...fakeIo(files) });

  assert.equal(resolution.status, RESOLVE.AMBIGUOUS);
  assert.equal(resolution.candidates.length, 2);
  assert.equal(resolution.location, null);
  assert.match(resolution.reason, /Refusing to choose/);
});

test('copies of ONE build that disagree resolve AMBIGUOUS, naming the disagreement', () => {
  const state = makeState({ id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/old', branch: 'b/old' });
  const other = makeState({ id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/new', branch: 'b/new' });
  const registry = {
    schema_version: REGISTRY_SCHEMA_VERSION,
    generated_at: 'x',
    entries: [entryFor(state, 'C:/estate/primary/a/programme-state.json'), entryFor(other, 'C:/estate/other/a/programme-state.json')],
    unknown: [],
  };
  const resolution = resolveBuild('alpha', { registry });
  assert.equal(resolution.status, RESOLVE.AMBIGUOUS);
  assert.match(resolution.reason, /disagree about its canonical location/);
  assert.equal(resolution.location, null);
});

test('a state file that is gone, corrupt, mis-versioned or schema-invalid is STATE_UNREADABLE — never a location', () => {
  const base = { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/alpha', branch: 'b/alpha' };

  // (a) gone
  const gone = syntheticRegistry([base]);
  gone.files.clear();
  assert.equal(resolveBuild('alpha', { registry: gone.registry, ...fakeIo(gone.files) }).status, RESOLVE.STATE_UNREADABLE);

  // (b) corrupt
  const corrupt = syntheticRegistry([{ ...base, corrupt: '{ not json at all' }]);
  const c = resolveBuild('alpha', { registry: corrupt.registry, ...fakeIo(corrupt.files) });
  assert.equal(c.status, RESOLVE.STATE_UNREADABLE);
  assert.equal(c.location, null);
  assert.match(c.reason, /not parseable JSON/);

  // (c) wrong schema version
  const versioned = syntheticRegistry([{ ...base, mutate: (s) => ({ ...s, schema_version: 99 }) }]);
  const v = resolveBuild('alpha', { registry: versioned.registry, ...fakeIo(versioned.files) });
  assert.equal(v.status, RESOLVE.STATE_UNREADABLE);
  assert.match(v.reason, /schema_version/);

  // (d) parses, right version, but is not a valid programme state
  const invalid = syntheticRegistry([
    {
      ...base,
      mutate: (s) => {
        const copy = JSON.parse(JSON.stringify(s));
        delete copy.privacy;
        return copy;
      },
    },
  ]);
  const i = resolveBuild('alpha', { registry: invalid.registry, ...fakeIo(invalid.files) });
  assert.equal(i.status, RESOLVE.STATE_UNREADABLE);
  assert.match(i.reason, /not a valid programme state/);
});

test('a worktree that is not on disk is WORKTREE_MISSING, and git is never consulted about its branch', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/vanished', branch: 'b/alpha' },
  ]);
  let execCalls = 0;
  const io = fakeIo(files, { onExec: () => { execCalls += 1; return ''; } });
  const resolution = resolveBuild('alpha', { registry, ...io });

  assert.equal(resolution.status, RESOLVE.WORKTREE_MISSING);
  assert.equal(resolution.location, null);
  assert.equal(execCalls, 0, 'there is nothing to ask git about a directory that is not there');
  assert.match(resolution.reason, /nothing is there/);
});

test('two ACTIVE builds claiming one worktree is CONTESTED_WORKTREE, decided on the re-read states', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/shared', branch: 'b/alpha' },
    { id: 'BUILD-702', slug: 'BUILD-702-beta', worktree: 'C:/estate/shared', branch: 'b/beta' },
  ]);
  const resolution = resolveBuild('alpha', {
    registry,
    ...fakeIo(files, { existingDirs: ['C:/estate/shared'] }),
  });

  assert.equal(resolution.status, RESOLVE.CONTESTED_WORKTREE);
  assert.equal(resolution.location, null);
  assert.equal(resolution.candidates.length, 2);
  assert.equal(resolution.checked, 3, 'both entries matched against the name, plus the contender re-read');
  assert.match(resolution.reason, /Two builds cannot own one worktree/);
});

test('a PARKED build sharing the worktree is not a contest — only active builds contend', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/shared', branch: 'b/alpha' },
    { id: 'BUILD-702', slug: 'BUILD-702-beta', worktree: 'C:/estate/shared', branch: 'b/beta', status: 'complete' },
  ]);
  const resolution = resolveBuild('alpha', {
    registry,
    ...fakeIo(files, { existingDirs: ['C:/estate/shared'] }),
  });
  assert.equal(resolution.status, RESOLVE.OK);
  assert.equal(resolution.location.worktree, 'C:/estate/shared');
});

test('BRANCH_GONE distinguishes "the branch was deleted" from "git would not answer" — same status, different repair', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/alpha', branch: 'b/alpha' },
  ]);
  const dirs = ['C:/estate/alpha'];

  const deleted = resolveBuild('alpha', {
    registry,
    ...fakeIo(files, {
      existingDirs: dirs,
      onExec: () => {
        const err = new Error('Command failed');
        err.status = 1;
        err.stderr = '';
        throw err;
      },
    }),
  });
  assert.equal(deleted.status, RESOLVE.BRANCH_GONE);
  assert.match(deleted.reason, /no longer exists/);

  const unanswerable = resolveBuild('alpha', {
    registry,
    ...fakeIo(files, {
      existingDirs: dirs,
      onExec: () => {
        const err = new Error('Command failed');
        err.status = 128;
        err.stderr = 'fatal: not a repository (or any of the parent directories)';
        throw err;
      },
    }),
  });
  assert.equal(unanswerable.status, RESOLVE.BRANCH_GONE);
  assert.match(unanswerable.reason, /could NOT be verified/);
  assert.match(unanswerable.reason, /not a repository/);
  assert.notEqual(deleted.reason, unanswerable.reason);
});

test('an empty name is refused rather than matched against anything', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/alpha', branch: 'b/alpha' },
  ]);
  const resolution = resolveBuild('   ', { registry, ...fakeIo(files) });
  assert.equal(resolution.status, RESOLVE.NOT_FOUND);
  assert.equal(resolution.location, null);
  assert.match(resolution.reason, /no build name was given/);
});

// ---------------------------------------------------------------------------
// The render (AD-20 / AD-21)
// ---------------------------------------------------------------------------

test('REAL GIT: a launch that needs a move carries the AD-21 protocol verbatim; one that does not, does not', () => {
  const estate = makeEstate();
  try {
    const registry = buildRegistry({ estateRoots: [estate.primary] });
    const resolution = resolveBuild('registry', { registry });
    assert.equal(resolution.status, RESOLVE.OK);

    const away = renderLaunch(resolution, { liveCwd: estate.beta });
    assert.match(away, /Approve the pending EnterWorktree request in the local Claude terminal/);
    assert.match(away, /Larry calls EnterWorktree with path: /);
    assert.ok(away.includes(estate.alpha), 'the destination is stated');
    assert.match(away, /T-02/, 'the next ticket travels with the launch');

    const inside = renderLaunch(resolution, { liveCwd: join(estate.alpha, 'tools') });
    assert.match(inside, /ALREADY in the canonical worktree/);
    assert.ok(
      !/Approve the pending EnterWorktree/.test(inside),
      'no move, no approval protocol — the recovery text must mean something when it appears'
    );
  } finally {
    estate.cleanup();
  }
});

test('no rendered launch or refusal ever contains a git command for Warwick to run (AD-20)', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/alpha', branch: 'b/alpha' },
    { id: 'BUILD-702', slug: 'BUILD-702-alpha-two', worktree: 'C:/estate/alpha', branch: 'b/beta' },
  ]);

  const renders = [
    renderLaunch(resolveBuild('nothing-like-this', { registry, ...fakeIo(files) })),
    renderLaunch(resolveBuild('alpha', { registry, ...fakeIo(files, { existingDirs: ['C:/estate/alpha'] }) })),
    renderLaunch(resolveBuild('BUILD-701', { registry, ...fakeIo(files) })),
    renderLaunch(resolveBuild('BUILD-701', { registry, ...fakeIo(new Map()) })),
    renderLaunch(resolveBuild('', { registry, ...fakeIo(files) })),
    renderLaunch({ status: RESOLVE.BRANCH_GONE, name: 'x', reason: 'branch gone', candidates: [], checked: 1 }),
    renderLaunch(null),
  ];

  for (const r of renders) {
    assert.ok(typeof r === 'string' && r.trim().length > 0, 'every state renders something');
    assert.ok(!GIT_COMMAND.test(r), `a git command reached Warwick-facing text:\n${r}`);
  }

  // Positive control on the ban itself: the pattern must actually catch one.
  assert.ok(GIT_COMMAND.test('Now run `git checkout build-018/session-governor`'), 'the git-command detector detects git commands');

  // Every refusal states what happens next, and it is always Larry doing it.
  assert.match(renders[0], /WHAT HAPPENS NEXT/);
  assert.match(renders[1], /WHAT HAPPENS NEXT/);
});

test('every refusal render reports how many entries were examined (INV-5 visible to the reader)', () => {
  const { registry, files } = syntheticRegistry([
    { id: 'BUILD-701', slug: 'BUILD-701-alpha', worktree: 'C:/estate/alpha', branch: 'b/alpha' },
  ]);
  const rendered = renderLaunch(resolveBuild('missing-build', { registry, ...fakeIo(files) }));
  assert.match(rendered, /\(1 registry entry examined\)/);
});

// ---------------------------------------------------------------------------
// CLI and command file
// ---------------------------------------------------------------------------

test('REAL GIT: the CLI refreshes, resolves, and uses a distinct exit code for each outcome', () => {
  const estate = makeEstate();
  const regFile = join(estate.root, 'registry.json');
  const out = [];
  const stdout = (s) => out.push(s);
  try {
    // No registry yet — BLIND, never a quiet "not found".
    assert.equal(runCli(['--registry', regFile, 'registry'], { env: {}, cwd: estate.primary, stdout }), EXIT.BLIND);
    assert.match(out.join(''), /BLIND/);

    out.length = 0;
    assert.equal(runCli(['--refresh', '--registry', regFile], { env: {}, cwd: estate.primary, stdout }), EXIT.LAUNCHABLE);
    assert.match(out.join(''), /Indexed 2 build\(s\)/);

    out.length = 0;
    assert.equal(runCli(['--registry', regFile, 'registry'], { env: {}, cwd: estate.beta, stdout }), EXIT.LAUNCHABLE);
    assert.match(out.join(''), /Approve the pending EnterWorktree request in the local Claude terminal/);

    out.length = 0;
    assert.equal(runCli(['--registry', regFile, 'nonexistent'], { env: {}, cwd: estate.primary, stdout }), EXIT.CANNOT_LAUNCH);
    assert.match(out.join(''), /CANNOT LAUNCH/);
  } finally {
    estate.cleanup();
  }
});

test('.claude/commands/build.md exists and matches the command frontmatter convention', () => {
  const raw = readFileSync(COMMAND_FILE, 'utf8');
  // Line-ending-agnostic on purpose. This repo has core.autocrlf=true and no
  // .gitattributes, so `.claude/commands/build.md` checks out with CRLF in any
  // fresh clone or worktree while the git blob stays LF. An `\n`-only regex
  // therefore failed on every fresh Windows worktree and passed only where the
  // file had been written directly — an environmental false negative that says
  // nothing about the convention being asserted, which is that frontmatter is
  // present and carries the expected keys.
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(fm, 'build.md opens with frontmatter');
  const keys = fm[1]
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.split(':')[0].trim());
  assert.deepEqual(keys, ['name', 'description', 'user_invocable']);
  assert.match(fm[1], /name:\s*build/);
  assert.match(fm[1], /user_invocable:\s*true/);
  assert.ok(!GIT_COMMAND.test(raw), 'the command file never tells anyone to run git');
});
