// Fusion247 Cockpit — GATE: the provenance answer must be true, and it must be provable WITHOUT a
// database.
//
// Three things this gate exists to hold, none of which inspection can establish:
//
//  1. All FOUR git states are reachable — clean, dirty, not-a-repo, git-unavailable. Reached against
//     REAL throwaway repositories and a REAL missing binary, never against hand-built error objects.
//     A synthetic stand-in is exactly how the down-reason defect survived for weeks: the map looked
//     correct on inspection and was wrong on execution.
//  2. NO POSTGRES IS TOUCHED. `db.mjs` constructs two live pools against production Postgres at
//     MODULE LOAD. So this is not proved by reading imports and reasoning — a load hook records every
//     module the process actually resolves, and the assertion reads that record.
//  3. `SOURCE_MODULES` has not drifted from what `server.mjs` really imports. A hand-maintained list
//     rots silently; here the closure is recomputed from server.mjs's own import statements and a
//     mismatch fails the gate instead of quietly producing a hash that misdescribes the running code.
//
// Exits non-zero on failure AND on a vacuous run.

import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// --- module-load recorder, installed BEFORE provenance.mjs is imported ---------------------------
// Registered first and the import below is dynamic for that reason: a static import would be hoisted
// and resolved before this line ran, and the recorder would have watched nothing.
const LOADED = [];
registerHooks({
  load(url, context, nextLoad) {
    LOADED.push(url);
    return nextLoad(url, context);
  },
});

const provenance = await import('./provenance.mjs');
const {
  PROVENANCE_STATES, SOURCE_MODULES, defaultRunGit, gitProvenance,
  moduleClosure, provenancePayload, relativeImports, sourceHash,
} = provenance;

let ran = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  ran++;
  if (cond) console.log('  PASS  ' + name + (detail ? ' — ' + detail : ''));
  else { failed++; console.error('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};

const tmps = [];
const mktmp = (prefix) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmps.push(d);
  return d;
};
const git = (args, cwd) => defaultRunGit(args, cwd);

// --- 1. no Postgres, and the recorder is not looking at nothing ----------------------------------
{
  const loadedNames = LOADED.map((u) => u.split('/').pop());
  // Non-vacuity FIRST. "db.mjs is absent" is worthless if the recorder observed no modules at all —
  // a control that reports on ground it did not examine is worse than no control.
  ok('the load recorder actually observed provenance.mjs (the check is not vacuous)',
    loadedNames.includes('provenance.mjs'), `${LOADED.length} module(s) recorded`);
  ok('db.mjs was NEVER loaded — no live Postgres pool was constructed',
    !loadedNames.includes('db.mjs'), loadedNames.join(', ') || 'none');
  ok('nothing resolving to pg was loaded',
    !LOADED.some((u) => /[/\\]pg[/\\]/.test(u) || u.endsWith('/pg')),
    LOADED.filter((u) => /pg/i.test(u)).join(', ') || 'no pg-shaped module');
}

// --- 2. all four git states, against real repositories -------------------------------------------
const seenStates = new Set();

{
  // clean — a real repository with a real commit and nothing outstanding.
  const repo = mktmp('prov-clean-');
  git(['init', '-q'], repo);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n');
  git(['add', 'a.txt'], repo);
  git(['-c', 'user.name=provenance-check', '-c', 'user.email=check@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'seed'], repo);
  const r = gitProvenance({ cwd: repo });
  seenStates.add(r.provenance);
  ok('CLEAN — a real committed repo with nothing outstanding', r.provenance === 'clean', JSON.stringify(r));
  ok('CLEAN — dirty is false, not null', r.dirty === false, JSON.stringify(r.dirty));
  ok('CLEAN — a real short sha came back', /^[0-9a-f]{7,}$/.test(r.sha), r.sha);

  // dirty — the SAME repository, one file changed. Same code path, different world.
  fs.writeFileSync(path.join(repo, 'a.txt'), 'two\n');
  const d = gitProvenance({ cwd: repo });
  seenStates.add(d.provenance);
  ok('DIRTY — the same repo after a real modification', d.provenance === 'dirty', JSON.stringify(d));
  ok('DIRTY — dirty is true', d.dirty === true, JSON.stringify(d.dirty));
  ok('DIRTY — the sha is unchanged by the working-tree edit', d.sha === r.sha, `${r.sha} -> ${d.sha}`);
}

{
  // not-a-repo — a real directory, real git, real exit 128.
  const plain = mktmp('prov-norepo-');
  const r = gitProvenance({ cwd: plain });
  seenStates.add(r.provenance);
  ok('NOT-A-REPO — real git in a real non-repository directory', r.provenance === 'not-a-repo', JSON.stringify(r));
  ok('NOT-A-REPO — sha degrades to "dev" rather than throwing', r.sha === 'dev', r.sha);
  ok('NOT-A-REPO — dirty is null (unknown), never false', r.dirty === null, JSON.stringify(r.dirty));
}

{
  // git-unavailable — a REAL ENOENT from a binary that genuinely does not exist. Not a fake error:
  // the branch keys off `code === 'ENOENT'`, and only a real spawn failure carries it.
  const plain = mktmp('prov-nogit-');
  const runGit = (args, cwd) => defaultRunGit(args, cwd, 'git-this-binary-does-not-exist-4f2a');
  const r = gitProvenance({ runGit, cwd: plain });
  seenStates.add(r.provenance);
  ok('GIT-UNAVAILABLE — a real missing binary, distinguished from not-a-repo',
    r.provenance === 'git-unavailable', JSON.stringify(r));
  ok('GIT-UNAVAILABLE — dirty is null (unknown), never false', r.dirty === null, JSON.stringify(r.dirty));

  // The distinction is only meaningful if the two really are told apart. Prove it with one probe.
  let realCode = null;
  try { defaultRunGit(['--version'], plain, 'git-this-binary-does-not-exist-4f2a'); } catch (e) { realCode = e.code; }
  ok('the missing-binary probe really produced ENOENT (the branch is not guessing)',
    realCode === 'ENOENT', String(realCode));
}

{
  // Enumeration, not spot-check: every declared state must have been REACHED by this run.
  const missing = PROVENANCE_STATES.filter((s) => !seenStates.has(s));
  ok('EVERY state in PROVENANCE_STATES was reached', missing.length === 0,
    missing.length ? 'never reached: ' + missing.join(', ') : [...seenStates].sort().join(', '));
  ok('no state outside the declared closed list was produced',
    [...seenStates].every((s) => PROVENANCE_STATES.includes(s)), [...seenStates].sort().join(', '));
}

// --- 3. sourceHash never consults git ------------------------------------------------------------
{
  const baseline = sourceHash();
  ok('sourceHash returns a digest', /^[0-9a-f]{16}$/.test(baseline), baseline);

  // Break git completely and take the answer again. If sourceHash consulted git in any way, this is
  // where it would change or throw.
  const exploding = () => { throw Object.assign(new Error('git must not be called'), { code: 'ENOENT' }); };
  const payload = provenancePayload({ runGit: exploding, cwd: DIR });
  ok('sourceHash is IDENTICAL with git entirely broken', payload.sourceHash === baseline,
    `${baseline} vs ${payload.sourceHash}`);
  ok('the git half correctly degraded while the source half stood', payload.provenance === 'git-unavailable',
    JSON.stringify({ provenance: payload.provenance, dirty: payload.dirty }));

  // And it does not need to be inside a repository at all: the same bytes in a plain directory must
  // produce the same digest.
  // THE COPY ROOT IS NESTED TWO LEVELS DEEP, AND THAT IS THE WHOLE FIX.
  //
  // `SOURCE_MODULES` is no longer flat: `capae.mjs` imports the governor's brief across trees to
  // hold one selection contract, so the list legitimately contains
  // `../../tools/governor/capae-brief.mjs`. Mirroring the real `services/cockpit/` depth means that
  // entry resolves to `<root>/tools/governor/…` — INSIDE the isolation directory, exactly as it
  // resolves inside the repository.
  //
  // ⚠️ TWO EARLIER ATTEMPTS FAILED, AND THE SECOND FAILED SILENTLY ON THIS HOST.
  //   1. A bare `copyFileSync` threw ENOENT — visible, harmless.
  //   2. Adding `mkdirSync(dirname)` against a FLAT copy dir let `../../` escape the temp root by
  //      two levels. On Linux CI that is `mkdir /tools/governor` → EACCES and a red run. On Windows
  //      `os.tmpdir()` is deep enough that it SUCCEEDED, writing a real file into
  //      `%LOCALAPPDATA%\tools\governor\` that cleanup never removed — and hashing that module from
  //      a path OUTSIDE the isolated copy, quietly narrowing what this assertion exercises while its
  //      text stayed identical. Veritas caught it; a local exit 0 is what produced it.
  //
  // The containment assertion below is the guard that makes a third variant impossible.
  const copyRoot = mktmp('prov-copy-');
  const copy = path.join(copyRoot, 'services', 'cockpit');
  fs.mkdirSync(copy, { recursive: true });
  const escaped = SOURCE_MODULES.filter((m) => {
    const dest = path.resolve(copy, m);
    return !dest.startsWith(path.resolve(copyRoot) + path.sep);
  });
  ok('⭐ every copied module lands INSIDE the isolation directory (no `../` escape)',
    escaped.length === 0, escaped.join(', ') || 'none escape');
  for (const m of SOURCE_MODULES) {
    const dest = path.resolve(copy, m);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(DIR, m), dest);
  }
  ok('the same bytes OUTSIDE any repository hash identically', sourceHash({ dir: copy }) === baseline,
    sourceHash({ dir: copy }));

  // Mutation test of the digest itself: a hash that never changes proves nothing.
  fs.appendFileSync(path.join(copy, 'down-reason.mjs'), '\n// mutated\n');
  ok('changing ONE module byte changes the digest (the hash is not a constant)',
    sourceHash({ dir: copy }) !== baseline, sourceHash({ dir: copy }));
}

// --- 4. the declared module list has not drifted from server.mjs ---------------------------------
{
  const computed = moduleClosure('server.mjs', { dir: DIR });
  ok('SOURCE_MODULES matches the closure recomputed from server.mjs\'s own imports',
    JSON.stringify(computed) === JSON.stringify([...SOURCE_MODULES].sort()),
    `declared=[${[...SOURCE_MODULES].sort().join(', ')}] computed=[${computed.join(', ')}]`);

  const onDisk = SOURCE_MODULES.filter((m) => fs.existsSync(path.join(DIR, m)));
  ok('every declared module exists on disk', onDisk.length === SOURCE_MODULES.length,
    `${onDisk.length}/${SOURCE_MODULES.length}`);

  ok('server.mjs itself is part of the hashed set', SOURCE_MODULES.includes('server.mjs'));
  ok('the parser sees static, bare and dynamic relative forms',
    JSON.stringify(relativeImports("import a from './x.mjs';\nimport './y.mjs';\nawait import('./z.mjs');\nimport n from 'node:fs';"))
      === JSON.stringify(['./x.mjs', './y.mjs', './z.mjs']));
}

// --- 5. the payload the endpoint actually returns -------------------------------------------------
{
  const p = provenancePayload();
  const keys = Object.keys(p).sort();
  ok('the payload carries exactly sha, dirty, provenance, sourceHash',
    JSON.stringify(keys) === JSON.stringify(['dirty', 'provenance', 'sha', 'sourceHash']), keys.join(', '));
  ok('provenance is one of the declared states', PROVENANCE_STATES.includes(p.provenance), p.provenance);
  ok('sourceHash is present and well-formed', /^[0-9a-f]{16}$/.test(p.sourceHash), p.sourceHash);
}

for (const d of tmps) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }

if (ran === 0) { console.error('PROVENANCE-CHECK FAIL — zero assertions executed.'); process.exit(1); }
if (failed) { console.error(`PROVENANCE-CHECK FAIL — ${failed} of ${ran} assertions failed.`); process.exit(1); }
console.log(`PROVENANCE-CHECK PASS — ${ran} assertions executed, 0 failed.`);
