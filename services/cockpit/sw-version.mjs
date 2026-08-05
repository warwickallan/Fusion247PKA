// Fusion247 Cockpit — SERVICE-WORKER CACHE VERSION, DERIVED FROM CONTENT.
//
// ── THE PROBLEM THIS REPLACES ────────────────────────────────────────────────────────────────────
// `public/sw.js` is cache-first for the app shell. An installed PWA keeps serving the OLD bundle
// until the cache name changes, so a correct edit that never reaches the device is indistinguishable
// from no edit at all. Until now the cache name was a hand-typed literal (`f247-cockpit-v25`) and
// the rule was "remember to bump it".
//
// **That is a habit, not a control.** It had already been bumped by hand three times in two days,
// and nothing whatsoever prevented the next change shipping without a bump — the failure is silent,
// and it looks exactly like the change not working. (COCKPIT-OPERATIONAL-STATUS row 8, PARTIAL.)
//
// ── WHAT REPLACES IT ─────────────────────────────────────────────────────────────────────────────
// The cache name is now DERIVED from a hash of the shell's actual bytes, computed when `/sw.js` is
// served. Change any shell file and the cache name changes by itself. Change nothing and it stays
// put. There is no human in the loop and no bump to forget.
//
// ── THE TRADE, STATED LOUDLY ─────────────────────────────────────────────────────────────────────
// **The bytes served for `/sw.js` are NOT the bytes on disk.** On disk the file carries the literal
// placeholder `__SHELL_HASH__`; over HTTP that placeholder is replaced with the computed hash.
//
// If you are diffing served-vs-disk and see that difference: **the server is not corrupting your
// assets — this is the mechanism, and this is the only file it applies to.** `/sw.js` is the sole
// transformed response; every other static file is served byte-for-byte off disk.
//
// ── WHY THE SHELL LIST IS PARSED OUT OF sw.js RATHER THAN RESTATED HERE ──────────────────────────
// The set of files whose content defines the cache MUST be the same set the service worker actually
// caches. Restating that list in this module would create two lists that drift, and the drift would
// be invisible — a file added to SHELL but missing here would be cached and never invalidated, which
// is precisely the bug class this module exists to close. So SHELL is read out of `sw.js` itself.
//
// ── NO MEMOISATION, DELIBERATELY ─────────────────────────────────────────────────────────────────
// Hashing ~300KB on a request that arrives rarely costs nothing worth optimising, and an mtime-keyed
// memo would give this cache-invalidation mechanism a cache-invalidation bug of its own. The
// simplest correct thing is to read the files every time.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** The placeholder that must appear in public/sw.js where a version literal used to be. */
export const VERSION_TOKEN = '__SHELL_HASH__';

/**
 * Read the SHELL array out of sw.js source. One source of truth for "what is cached".
 * @param {string} swSource
 * @returns {string[]} URL paths, e.g. ['/', '/index.html', ...]
 */
export function parseShellList(swSource) {
  const m = /const\s+SHELL\s*=\s*\[([\s\S]*?)\]/.exec(swSource);
  if (!m) throw new Error('sw-version: could not find `const SHELL = [...]` in sw.js');
  const list = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  if (!list.length) throw new Error('sw-version: SHELL list in sw.js is empty');
  return list;
}

/**
 * Map a SHELL URL path to a file on disk. '/' means index.html.
 * @param {string} urlPath @param {string} pub
 */
function shellFile(urlPath, pub) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  return path.join(pub, rel);
}

/**
 * Compute the cache version from the shell's content.
 *
 * Includes sw.js's OWN source (with the placeholder still in it, so this is not self-referential),
 * so that editing the worker's fetch/activate logic also rotates the cache. Hashing the RENDERED
 * output instead would be a fixed point that never converges.
 *
 * A shell file that cannot be read is a hard error, not a skipped entry: silently hashing 7 of 8
 * files would produce a stable-looking version that ignores the missing one.
 *
 * @param {string} pub Absolute path to public/
 * @returns {{version: string, files: string[]}}
 */
export function shellVersion(pub) {
  const swPath = path.join(pub, 'sw.js');
  const swSource = fs.readFileSync(swPath, 'utf8');
  const shell = parseShellList(swSource);
  const h = crypto.createHash('sha256');
  // Sorted, so the hash depends on content rather than on the order the list happens to be written.
  const files = [...shell].sort();
  for (const urlPath of files) {
    const fp = shellFile(urlPath, pub);
    // Hash the NAME too: renaming a file with identical content is still a shell change.
    h.update(urlPath).update('\0').update(fs.readFileSync(fp)).update('\0');
  }
  h.update('sw.js\0').update(swSource);
  return { version: h.digest('hex').slice(0, 12), files };
}

/**
 * The bytes to serve for /sw.js.
 *
 * Fails loud rather than serving an un-substituted worker: a `sw.js` whose cache name is literally
 * '__SHELL_HASH__' would pin every device to one permanent cache — worse than the manual bump it
 * replaced, and completely silent.
 *
 * @param {string} pub Absolute path to public/
 * @returns {{body: string, version: string}}
 */
export function renderServiceWorker(pub) {
  const swPath = path.join(pub, 'sw.js');
  const src = fs.readFileSync(swPath, 'utf8');
  if (!src.includes(VERSION_TOKEN)) {
    throw new Error(`sw-version: public/sw.js does not contain ${VERSION_TOKEN}. The derived-version ` +
      'mechanism has been broken or reverted to a hand-typed literal. Refusing to serve a worker ' +
      'whose cache name cannot be derived from content.');
  }
  const { version } = shellVersion(pub);
  const body = src.split(VERSION_TOKEN).join(version);
  if (body.includes(VERSION_TOKEN)) throw new Error('sw-version: substitution failed');
  return { body, version };
}
