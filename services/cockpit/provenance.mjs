// Fusion247 Cockpit — what code is ACTUALLY RUNNING, answered without taking git's word for it.
//
// The defect this exists to make structurally impossible: /api/health used to report a git-derived
// SHA and nothing else. A git answer describes the WORKING TREE. It does not describe the bytes this
// process loaded — so a running server whose files had since changed on disk, or which had been
// copied out of a repository entirely, confidently described code it was not executing.
//
// Two INDEPENDENT answers live here and neither may stand in for the other:
//
//   - the GIT answer    — `sha`, `dirty`, and which of four states git is in. Best-effort, and it is
//                         allowed to be absent: `not-a-repo` and `git-unavailable` are real answers,
//                         not errors to swallow.
//   - the SOURCE answer — `sourceHash`, a digest over the bytes of the modules server.mjs actually
//                         loads. Computed with `fs` ONLY. It never invokes git, never reads a git
//                         directory, and therefore cannot repeat the original failure even when the
//                         git answer is wrong, stale or missing.
//
// Extracted out of server.mjs so a gate can EXECUTE it. server.mjs imports db.mjs, which constructs
// two live Postgres pools AT MODULE LOAD, so nothing that imports server.mjs can run inside a check.
// The same reasoning that moved static serving into static.mjs applies here.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** The four states git can be in as far as this service is concerned. A closed list. */
export const PROVENANCE_STATES = ['clean', 'dirty', 'git-unavailable', 'not-a-repo'];

/**
 * The modules whose bytes ARE the running cockpit: `server.mjs` plus the transitive closure of its
 * relative imports.
 *
 * DECLARED as a literal, deliberately. The alternative — hashing every `*.mjs` in this directory —
 * is a defect: the directory also holds a dozen probe and check scripts the server never imports, so
 * editing a check script would change the hash and the hash would then misdescribe the running code.
 * That is the exact failure `sourceHash` exists to prevent.
 *
 * A hand-maintained list drifts silently, so this literal is NOT trusted on its own:
 * `provenance-check.mjs` recomputes the closure from `server.mjs`'s own import statements and fails
 * the gate when the two disagree. Add an import to server.mjs without adding it here and the check
 * goes red rather than quietly producing a wrong hash.
 */
export const SOURCE_MODULES = [
  // ⚠️ THIS LIST IS THE DIGEST'S ENTIRE FIELD OF VIEW, AND IT WENT BLIND TO 4D.
  // `capae.mjs` and the governor brief it imports were both in `server.mjs`'s real import closure
  // and both absent here, so `sourceHash()` returned an unchanged digest while the whole CAPAE
  // surface changed underneath it — a hash whose stated purpose is "what code is ACTUALLY RUNNING",
  // answering correctly only by coincidence. Veritas proved it by mutation at `83bcdec`: appending
  // a comment to `capae.mjs` left the digest at `b5a1529657be5225` before, during and after.
  // Adding a module to `server.mjs` means adding it HERE, in the same commit.
  'capae.mjs',
  'db.mjs',
  'down-reason.mjs',
  'private-api.mjs',
  'private-apps.mjs',
  'provenance.mjs',
  'rotation-report.mjs',
  'server.mjs',
  'static.mjs',
  'sw-version.mjs',
  // Outside `services/cockpit/`, and deliberately so: `capae.mjs` imports `selectActive` from the
  // governor to hold ONE brief-selection contract. A cross-tree import is still running code.
  '../../tools/governor/capae-brief.mjs',
];

/**
 * Default git runner. `windowsHide: true` is load-bearing, not cosmetic: without it every invocation
 * flashes a console window on this host, which is the whole reason this call site was rewritten.
 * `gitBin` is a parameter so a caller can point at a binary that does not exist and observe a REAL
 * ENOENT, rather than a hand-built error object that might not carry the field the branch reads.
 */
export function defaultRunGit(args, cwd, gitBin = 'git') {
  return execFileSync(gitBin, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
}

/**
 * Which of the four states, plus sha and dirty where git can answer at all.
 *
 * The two failure branches are distinguished by the error's own shape, established by execution on
 * this host: a missing binary throws `code: 'ENOENT'` with `status: null`; a directory that is not a
 * repository throws `status: 128` with `code: undefined`. Guessing between them by parsing stderr
 * text would break the first time git changed its wording.
 */
export function gitProvenance({ runGit = defaultRunGit, cwd = DIR } = {}) {
  const state = (e) => (e && e.code === 'ENOENT' ? 'git-unavailable' : 'not-a-repo');
  let sha;
  try {
    sha = String(runGit(['rev-parse', '--short', 'HEAD'], cwd)).trim();
  } catch (e) {
    return { sha: 'dev', dirty: null, provenance: state(e) };
  }
  let porcelain;
  try {
    porcelain = String(runGit(['status', '--porcelain'], cwd));
  } catch (e) {
    // The sha is real and is kept; we simply cannot say whether the tree is clean. `dirty: null`
    // says "unknown" — it must never degrade to `false`, which would be a claim we cannot support.
    return { sha, dirty: null, provenance: state(e) };
  }
  const dirty = porcelain.trim().length > 0;
  return { sha, dirty, provenance: dirty ? 'dirty' : 'clean' };
}

/**
 * Relative import specifiers in a module's source. Static and dynamic forms both match.
 *
 * This is a drift guard, not a parser, and it fails CLOSED: a false positive produces an extra entry,
 * the declared list stops matching, and the gate goes red. That is the safe direction. A missed
 * import would be the dangerous direction, so the pattern deliberately accepts more than it needs.
 */
export function relativeImports(source) {
  const out = new Set();
  const re = /\b(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) out.add(m[1]);
  return [...out].sort();
}

/**
 * The transitive closure of relative imports reachable from `entry`, as directory-relative POSIX
 * paths. Absolute and bare specifiers (`node:fs`, and db.mjs's absolute `file:///…/pg`) are not
 * cockpit source and are not part of the running-cockpit answer.
 */
export function moduleClosure(entry = 'server.mjs', { dir = DIR } = {}) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let src;
    try { src = fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { continue; }
    for (const spec of relativeImports(src)) {
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
      if (!seen.has(next)) queue.push(next);
    }
  }
  return [...seen].sort();
}

/**
 * A digest over the bytes of the declared modules. NO GIT. Not by convention — there is no code path
 * from here to a git invocation, which is what makes the property checkable rather than promised.
 *
 * Raw bytes are hashed, so a checkout whose line endings differ produces a different hash. That is
 * correct: it describes the files THIS process loaded, which is the question being asked.
 *
 * ── THE MISREADING THIS DIGEST WILL INVITE, so nobody "fixes" it ─────────────────────────────────
 * sourceHash is NOT comparable across checkouts or machines, and a difference between two of them is
 * NOT evidence that the code differs. Established by execution, not argued: two worktrees holding
 * byte-identical TRACKED content produced 916d0c67479c7edf and b21e69c0df49c916. Six of the modules
 * hashed identically; provenance.mjs was git blob ea800833 in both, but 7517 bytes with 164 CRLF in
 * one working copy against 7353 bytes with bare LF in the other — exactly 164 CR characters, from
 * git's autocrlf normalising on checkout. The digest was right; the comparison was meaningless.
 *
 * On Windows this will happen by default, and the live Cockpit runs from its own checkout, so it WILL
 * be seen. What the digest is good for is the question it was built for: has THIS RUNNING PROCESS
 * drifted from the files sitting beside it on THIS machine.
 *
 * DO NOT normalise line endings inside the digest to make the numbers match. That would make
 * sourceHash describe git's content rather than the loaded bytes, which is precisely the failure
 * /api/health had in the first place. An honest limitation beats a hash that lies more smoothly.
 */
export function sourceHash({ dir = DIR, modules = SOURCE_MODULES } = {}) {
  const h = crypto.createHash('sha256');
  for (const m of [...modules].sort()) {
    h.update(m, 'utf8');
    h.update('\0');
    h.update(fs.readFileSync(path.join(dir, m)));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

/**
 * The /api/health provenance payload. The endpoint returns exactly this object, so what the gate
 * executes and what Warwick sees are the same construction rather than two that must be kept in step.
 */
export function provenancePayload(opts = {}) {
  const git = gitProvenance(opts);
  return {
    sha: git.sha,
    dirty: git.dirty,
    provenance: git.provenance,
    sourceHash: sourceHash(opts),
  };
}
