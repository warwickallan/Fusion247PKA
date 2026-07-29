// Cockpit STATIC FILE SERVING — the whole of it, extracted so it can be EXECUTED by a test.
//
// WHY IT IS NOT IN server.mjs. It used to be, and that put it out of reach: server.mjs imports
// db.mjs, which opens a live write pool the moment it loads, so no gate could import it and nothing
// executed this code. What the gate did instead was read server.mjs as TEXT and assert regexes
// against it. That is not a test of behaviour, and it failed exactly as you would expect once
// somebody looked: deleting the single load-bearing line of the whole feature —
// `if (t.isOverlay) return servePrivateApps(...)` — left the gate green at 122 of 122, and so did
// replacing the response headers with `public, max-age=600`.
//
// The rule this establishes: if a line is load-bearing, put it somewhere a test can RUN it. A
// regex over source is a description of code, not evidence about it.
import fs from 'node:fs';
import path from 'node:path';
import { resolveStaticTarget, servePrivateApps } from './private-apps.mjs';

export const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
});

/**
 * True when `a` contains `b`. Used to detect the one wiring mistake nothing else catches.
 * @param {string} a @param {string} b
 */
const contains = (a, b) => b === a || b.startsWith(a.endsWith(path.sep) ? a : a + path.sep);

/**
 * Build the serving context. ONE constructor, so the two arguments can never be supplied — or
 * swapped — at a call site.
 *
 * WHY THIS EXISTS RATHER THAN AN OBJECT LITERAL IN server.mjs. `pub` IS the containment root:
 * every request is confined to it and to nothing else. `repoRoot` is only ever handed to the
 * overlay path resolver, where a wrong value merely demotes one control to redundancy because
 * "inside any git working tree" is strictly stronger than "inside this repository" and still holds
 * the line. The two arguments are therefore NOT equally dangerous, and they used to sit adjacent in
 * a literal, same type, easy to transpose. Swapped, the cockpit serves the entire repository over
 * the tailnet — `.git/`, untracked files, anything gitignored sitting in the tree — and every gate
 * passed while it did, because nothing executed the wiring.
 *
 * The guard below catches the transposition specifically: a `pub` that CONTAINS `repoRoot` cannot
 * be a public asset directory, it can only be an ancestor of the checkout. It deliberately does not
 * require `pub` to sit inside `repoRoot`, because COCKPIT_PUB legitimately points a throwaway
 * instance at a staging copy anywhere on disk.
 *
 * @param {string} dir Directory of the cockpit service (where public/ lives).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{pub: string, repoRoot: string, env: NodeJS.ProcessEnv}}
 */
export function staticCtx(dir, env = process.env) {
  if (!dir || !path.isAbsolute(dir)) throw new Error(`staticCtx: dir must be an absolute path, got ${JSON.stringify(dir)}`);
  const repoRoot = path.resolve(dir, '..', '..');
  // COCKPIT_PUB points a throwaway instance at a STAGING copy so cockpit UI changes can be
  // render-checked before they replace the live assets. Resolved so the containment guard matches
  // regardless of slash style.
  const pub = path.resolve(env.COCKPIT_PUB || path.join(dir, 'public'));
  if (contains(pub, repoRoot)) {
    throw new Error('staticCtx: pub contains repoRoot — arguments look transposed. pub is the containment root; serving from an ancestor of the checkout would expose the whole repository.');
  }
  return { pub, repoRoot, env };
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{pub: string, repoRoot: string, env?: NodeJS.ProcessEnv, readFile?: Function}} ctx
 */
export function serveStatic(req, res, ctx) {
  const { pub, repoRoot, env = process.env, readFile = fs.readFile } = ctx;
  // Same guard, applied to whatever ctx actually arrives — staticCtx is the only constructor, but a
  // hand-built object must not be able to walk past the check by skipping it. Fails loud: a wiring
  // error should be a 500 on the first request, not a quietly wider filesystem.
  if (!pub || !repoRoot || contains(pub, repoRoot)) { res.writeHead(500); return res.end('server misconfigured'); }
  // ONE canonicalisation, shared by the containment guard, the overlay route and the read — see
  // resolveStaticTarget in private-apps.mjs for why that is load-bearing rather than tidy.
  const t = resolveStaticTarget(req.url, pub);
  if (t.outside) { res.writeHead(403); return res.end('forbidden'); }
  // The overlay path is OWNED by private-apps.mjs: a file of that name in public/ is never served.
  // The one place an overlay could be committed by accident is the one place it cannot come from.
  if (t.isOverlay) return servePrivateApps(res, env, repoRoot);
  return readFile(t.fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(t.fp)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
}
