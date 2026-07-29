// Cockpit LOCAL APP OVERLAY — resolves and reads the optional registry that public/apps.js merges.
//
// WHY THIS EXISTS. The apps registry is presentation: a label, a blurb, a lane. It is also the only
// way an app gets a cockpit surface, so "give this thing a surface" and "write down what this thing
// is" are the same edit. This module breaks that: the extension point is generic and carries no
// names, and the server serves `/private-apps.js` from a file OUTSIDE this repository. Absent by
// default; then it serves an empty body and nothing anywhere changes.
//
// WHAT THIS IS NOT. It is not a disclosure control, and it makes no claim about what the rest of
// the repository does or does not say. It keeps the cockpit's extension point generic. That is all.
//
// THE PATH CONTROLS, and what each one is actually for:
//   1. OPT-IN. No COCKPIT_PRIVATE_APPS, no overlay. The default posture is "there is nothing here".
//   2. ABSOLUTE ONLY. A relative path resolves against the server's cwd, which is not a stable
//      thing to make a boundary out of.
//   3. NO UNC. A `\\host\share` path can alias the same bytes under a different prefix, which is a
//      way round every check below. An overlay has no business on a network share regardless.
//   4. NOT INSIDE THIS REPOSITORY. Checked against the REAL path (symlinks, junctions and 8.3 short
//      names resolved) with a `root + sep` boundary so `..-repo-backup` is not mistaken for `..-repo`.
//   5. NOT INSIDE **ANY** GIT WORKING TREE. Control 4 alone is not enough, and this is the one that
//      bit: this repository has sibling worktrees, each with its own root and each sharing the same
//      remote. A path in a sibling is "outside" by control 4 and still one `git add -A` away from
//      being committed. So the real rule is not "outside this checkout" but "outside version control
//      entirely" — walk up looking for a `.git` entry and refuse if one is found.
//   6. NEVER CACHED. `no-store`, and deliberately absent from the service-worker shell list. The SW
//      also never writes to cache at runtime, so the overlay cannot enter it by another route.
//
// The overlay is LOCAL DATA, not trusted input: public/apps.js validates every entry and drops any
// key the public registry already claims. An overlay may ADD an app; it may never rewrite one.
//
// ─── STANDING HAZARD, for whoever adds the SECOND overlay ────────────────────────────────────────
// Moving an app onto an overlay means DELETING its key from the public registry, and that deletion
// is a commit. For the first one it disclosed nothing, because the name was already published all
// over this repository. For an app that is NOT already public, the removal commit is itself the
// first disclosure — a diff line saying exactly what was hidden, in the history, permanently, where
// no force-push reaches once it is pushed. Nothing in this build notices that: every control here
// governs the SERVED surface, and none of them reads a commit.
// So for a genuinely private app, the key must never enter the public registry in the first place.
// Add it to the overlay only. If it is already committed, moving it out is a decision about git
// history, not a refactor, and belongs to whoever owns that call — not to this file.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

export const PRIVATE_APPS_ENV = 'COCKPIT_PRIVATE_APPS';

/** Served when there is no overlay. Valid JS that declares nothing — apps.js then sees undefined. */
export const EMPTY_BODY = '/* no local app overlay */\n';

export const PRIVATE_APPS_HEADERS = Object.freeze({
  'content-type': 'text/javascript; charset=utf-8',
  'cache-control': 'no-store',
});

/** The one path the cockpit serves an overlay on. Compared post-canonicalisation, never raw. */
export const PRIVATE_APPS_ROUTE = 'private-apps.js';

const realpath = (p) => (fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p));

/** Resolve symlinks/junctions/short-names where we can. A not-yet-existing leaf resolves its parent. */
function real(p) {
  try { return realpath(p); } catch { /* may not exist yet */ }
  try { return path.join(realpath(path.dirname(p)), path.basename(p)); } catch { return p; }
}

/**
 * Case-fold for comparison on filesystems that are case-insensitive. Takes the platform explicitly
 * so the Windows behaviour is testable on a Linux CI runner — a control asserted only behind
 * `if (process.platform === 'win32')` is a control CI never actually runs.
 * @param {string} p @param {string} platform
 */
const fold = (p, platform) => (platform === 'win32' ? p.toLowerCase() : p);

/**
 * True if `p` sits inside any git working tree — this repository, a sibling worktree of it, or an
 * unrelated checkout. Walks ancestors looking for a `.git` entry; a linked worktree has `.git` as a
 * FILE rather than a directory, so both count as evidence.
 * @param {string} p
 */
export function insideGitWorkTree(p) {
  let dir = path.dirname(p);
  for (;;) {
    try { fs.statSync(path.join(dir, '.git')); return true; } catch { /* keep walking */ }
    const up = path.dirname(dir);
    if (up === dir) return false;
    dir = up;
  }
}

/**
 * @typedef {Object} StaticTarget
 * @property {string} fp          The file the request resolves to.
 * @property {boolean} outside    It escaped `pubRoot` (or the URL was malformed). Serve 403.
 * @property {boolean} isOverlay  It IS the overlay route. Serve the overlay, never the file.
 */

/**
 * Aliases that let the FILESYSTEM reach a file the router did not name. Both are Windows: `~` is an
 * 8.3 short name (`PRIVAT~1.JS` opens `private-apps.js`), `:` opens an NTFS alternate data stream
 * (`private-apps.js::$DATA` is the file's own contents). Either makes `resolveStaticTarget` and
 * `fs.readFile` disagree about which file a request is for — the exact disagreement this function
 * exists to prevent — so both are refused outright rather than resolved. Nothing under public/ has
 * ever contained either character, and refusing is the safe direction when one appears.
 */
const ALIASING_CHARS = /[:~]/;

/**
 * Canonicalise a request URL to a file under `pubRoot`, and decide whether it is the overlay route.
 *
 * This lives HERE, beside the overlay, on purpose. The route can only be enforced if there is
 * exactly ONE answer to "which file is this request for", and an earlier revision had two: the
 * router compared the raw undecoded URL while the reader decoded and normalised it. Anything the
 * two disagreed about — `%2E`, `%70`, `%2D`, a trailing slash, a doubled slash, a change of case on
 * a case-insensitive filesystem — reached the reader as this file while missing the route entirely.
 * One function, called once, is the fix; a longer list of special cases would not have been.
 *
 * `platform` selects BOTH the path flavour and whether names are case-folded, because those are one
 * decision, not two. Passing it lets a single run assert win32 AND posix behaviour — which matters
 * more than it sounds: `/private-apps.js\` IS this route under win32 and is NOT under posix, so a
 * CI runner on ubuntu and a production host on Windows do not prove the same thing about it.
 * @param {string} url
 * @param {string} pubRoot Absolute, already resolved, in the flavour named by `platform`.
 * @param {{platform?: string}} [opts]
 * @returns {StaticTarget}
 */
export function resolveStaticTarget(url, pubRoot, opts = {}) {
  const platform = opts.platform || process.platform;
  const p = platform === 'win32' ? path.win32 : path.posix;
  let rel;
  try { rel = decodeURIComponent(String(url).split('?')[0].split('#')[0]); }
  catch { return { fp: '', outside: true, isOverlay: false }; } // malformed %-escape: refuse, don't throw
  if (rel === '/' || rel === '') rel = '/index.html';
  const fp = p.join(pubRoot, p.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!fp.startsWith(pubRoot)) return { fp, outside: true, isOverlay: false };
  const leaf = p.relative(pubRoot, fp);
  if (ALIASING_CHARS.test(leaf)) return { fp, outside: true, isOverlay: false };
  return { fp, outside: false, isOverlay: fold(leaf, platform) === fold(PRIVATE_APPS_ROUTE, platform) };
}

/**
 * Write the overlay response to a ServerResponse. The whole of what the server does on this route,
 * so a test can execute it against a fake `res` and assert what actually reaches the socket.
 *
 * That is not a formality. The headers are the control — `no-store` is what keeps a private-app
 * registry out of the browser's on-disk cache — and asserting the exported CONSTANT proves nothing
 * about what a handler chose to write. Mutating this function to send `public, max-age=600`, or to
 * ignore privateAppsResponse entirely, left an earlier gate green at 122 of 122.
 * @param {import('node:http').ServerResponse} res
 * @param {NodeJS.ProcessEnv} env
 * @param {string} repoRoot
 */
export function servePrivateApps(res, env, repoRoot) {
  const r = privateAppsResponse(env, repoRoot);
  res.writeHead(200, { ...r.headers, 'content-length': Buffer.byteLength(r.body) });
  res.end(r.body);
}

/**
 * @typedef {'unset'|'not-absolute'|'unc'|'inside-repo'|'in-git-worktree'|'ok'} PathVerdict
 * @typedef {Object} Resolved
 * @property {string} path      Absolute path to read, or '' when there is no usable overlay.
 * @property {PathVerdict} verdict Why. Reported to the operator's console, never to the browser.
 */

/**
 * Decide whether the configured overlay path may be read at all.
 * @param {NodeJS.ProcessEnv} env
 * @param {string} repoRoot
 * @param {{platform?: string}} [opts]
 * @returns {Resolved}
 */
export function resolvePrivateAppsPath(env, repoRoot, opts = {}) {
  const platform = opts.platform || process.platform;
  const raw = String((env && env[PRIVATE_APPS_ENV]) || '').trim();
  if (!raw) return { path: '', verdict: 'unset' };
  if (!path.isAbsolute(raw)) return { path: '', verdict: 'not-absolute' };
  if (/^[\\/]{2}/.test(raw)) return { path: '', verdict: 'unc' };

  const abs = real(path.resolve(raw));
  const root = fold(real(path.resolve(repoRoot)), platform);
  const here = fold(abs, platform);
  if (here === root || here.startsWith(root + path.sep)) return { path: '', verdict: 'inside-repo' };
  if (insideGitWorkTree(abs)) return { path: '', verdict: 'in-git-worktree' };
  return { path: abs, verdict: 'ok' };
}

/**
 * @typedef {PathVerdict|'absent'|'loaded'} OverlayState
 * @typedef {Object} OverlayResponse
 * @property {string} body
 * @property {OverlayState} state    'loaded', or the reason there is nothing to load.
 * @property {boolean} configured    The env var was set. Distinguishes "off" from "misconfigured".
 * @property {Readonly<Record<string,string>>} headers
 */

/**
 * The whole HTTP contract for `/private-apps.js`, in one place so it can be exercised without
 * standing up the server (services/cockpit/db.mjs opens a live write pool on import).
 *
 * Every refusal yields exactly the response the "off" case yields — the browser learns nothing from
 * the difference. The distinction lives in `state`/`configured`, which the server reports once to
 * its own console at startup: a typo'd path that silently behaves like no overlay at all is how you
 * spend an afternoon wondering why a surface never appeared.
 * @param {NodeJS.ProcessEnv} env
 * @param {string} repoRoot
 * @param {{platform?: string}} [opts]
 * @returns {OverlayResponse}
 */
export function privateAppsResponse(env, repoRoot, opts = {}) {
  const configured = Boolean(String((env && env[PRIVATE_APPS_ENV]) || '').trim());
  const r = resolvePrivateAppsPath(env, repoRoot, opts);
  if (!r.path) return { body: EMPTY_BODY, state: r.verdict, configured, headers: PRIVATE_APPS_HEADERS };
  try {
    return { body: fs.readFileSync(r.path, 'utf8'), state: 'loaded', configured, headers: PRIVATE_APPS_HEADERS };
  } catch {
    return { body: EMPTY_BODY, state: 'absent', configured, headers: PRIVATE_APPS_HEADERS };
  }
}

/**
 * One line for the server's console at startup. Deliberately reports the VERDICT and never the
 * path: where an operator chose to put an overlay can itself say what the overlay is for.
 * @param {OverlayResponse} r
 * @returns {{level: 'log'|'warn', message: string}}
 */
export function privateAppsStartupLine(r) {
  if (!r.configured) return { level: 'log', message: 'private apps: none configured' };
  if (r.state === 'loaded') return { level: 'log', message: `private apps: overlay loaded (${Buffer.byteLength(r.body)} bytes)` };
  const why = {
    'not-absolute': 'the path is not absolute',
    unc: 'UNC paths are refused',
    'inside-repo': 'the path is inside this repository',
    'in-git-worktree': 'the path is inside a git working tree',
    absent: 'no file at that path',
  }[r.state] || r.state;
  return { level: 'warn', message: `private apps: ${PRIVATE_APPS_ENV} is set but NO overlay was served — ${why}` };
}
