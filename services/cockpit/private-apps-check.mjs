// Cockpit PRIVATE-APPS gate — proves the local app overlay works and that its controls hold.
//
// WHAT THIS CHECKS, and nothing more: the extension point in public/apps.js is generic and populated
// only from a local file; the path controls in private-apps.mjs refuse everything they claim to;
// the route cannot be reached by a differently-spelled URL; and an overlay can ADD an app but never
// rewrite a published one.
//
// WHAT THIS DOES NOT CHECK. It makes no claim about names appearing anywhere in this repository.
// An earlier revision of this file scanned services/cockpit/ for a digest-listed name and reported
// a clean tree — which was true, and useless: the name was already published 105 times elsewhere in
// the same repository, including in two tracked FILENAMES visible without opening a file, and was
// recoverable from this patch's own parent commit in eighteen thousand hashes. A control whose
// scope is narrower than the exposure it appears to address does not reduce that exposure; it
// documents it, and then gets cited later as assurance. It has been removed rather than widened,
// because the wider question is a strategic decision that was taken separately and is not this
// build's to answer. This gate is worth having for what it does check. It promises nothing else.
//
//   node services/cockpit/private-apps-check.mjs
//
// Exit 0 = every assertion passed AND a non-zero number ran. Exit 1 = a failure, or a vacuous run.
// Pure Node: no browser, no database, no credentials, no network.

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, posix as posixPath, win32 as winPath } from 'node:path';
import { Script, createContext } from 'node:vm';
import {
  EMPTY_BODY, PRIVATE_APPS_ENV, PRIVATE_APPS_ROUTE,
  insideGitWorkTree, privateAppsResponse, privateAppsStartupLine,
  resolvePrivateAppsPath, resolveStaticTarget,
} from './private-apps.mjs';
import { serveStatic, staticCtx } from './static.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));   // services/cockpit
const PUBLIC = join(HERE, 'public');
const REPO = resolve(HERE, '..', '..');

let ran = 0;
const failures = [];
const skipped = [];
/** @param {string} what @param {boolean} cond @param {string} [detail] */
function assert(what, cond, detail) {
  ran += 1;
  if (!cond) failures.push(detail ? `${what} — ${detail}` : what);
}
/**
 * Declare an assertion deliberately not run HERE, with the reason. Counted and printed, never
 * silently absent: a gate that quietly drops assertions on one platform reports a number that means
 * something different depending on where it ran, which is worse than reporting a smaller number.
 * @param {string} what @param {string} why
 */
function skip(what, why) { skipped.push(`${what} — ${why}`); }

const box = mkdtempSync(join(tmpdir(), 'cockpit-overlay-'));
try {
  // ---- 1. PATH CONTROLS -------------------------------------------------------------------------
  const outside = join(box, 'overlay.js');
  const BODY = 'window.FUSION_PRIVATE_APPS = [{ key: "synthetic", label: "Synthetic" }];\n';
  writeFileSync(outside, BODY, 'utf8');

  const at = (v, opts) => privateAppsResponse(v === undefined ? {} : { [PRIVATE_APPS_ENV]: v }, REPO, opts);

  const unset = at(undefined);
  assert('absent by default — no env, no overlay', unset.state === 'unset' && unset.body === EMPTY_BODY, unset.state);
  assert('"off" is distinguishable from "misconfigured"', unset.configured === false);
  assert('the empty body is valid JS that declares nothing', /^\/\*[^*]*\*\/\s*$/.test(EMPTY_BODY));

  assert('a relative path is refused', at('some/local/overlay.js').state === 'not-absolute');
  // UNC, asserted under BOTH platform rules. This is the assertion that passed on Windows and
  // failed on ubuntu for three review rounds: `\\host\share\x` is only ABSOLUTE on Windows, so on
  // posix the absoluteness check answered first and the verdict was 'not-absolute'. It is now
  // decided on SHAPE before absoluteness, which makes the property real on every platform rather
  // than real on one and inert on the other. Asserting it under both rules is what proves that.
  for (const platform of ['win32', 'linux']) {
    assert(`[${platform}] a UNC path is refused`, at('\\\\host\\share\\overlay.js', { platform }).state === 'unc',
      at('\\\\host\\share\\overlay.js', { platform }).state);
    assert(`[${platform}] a forward-slash UNC path is refused`, at('//host/share/overlay.js', { platform }).state === 'unc',
      at('//host/share/overlay.js', { platform }).state);
    assert(`[${platform}] a UNC path yields no readable path`, at('\\\\host\\share\\overlay.js', { platform }).body === EMPTY_BODY);
  }

  // The control that matters most: an overlay inside the working tree is one `git add -A` from
  // being committed, which is the exact outcome the mechanism exists to prevent.
  const insideRepo = join(REPO, 'services', 'cockpit', 'public', 'apps.js');
  const inside = at(insideRepo);
  assert('a path inside the repository is refused', inside.state === 'inside-repo', inside.state);
  assert('a refused in-repo path leaks no file content', inside.body === EMPTY_BODY);
  assert('the repository root itself is refused', at(REPO).state === 'inside-repo');
  assert('a misconfigured overlay still reports as configured', inside.configured === true);

  // Case-folding is asserted on EVERY platform by passing the platform in. Behind a
  // `process.platform === 'win32'` guard this ran nowhere but a developer's laptop, while CI —
  // ubuntu — proved only the configuration that is not deployed.
  //
  // It has to be asserted against a root that does NOT exist. `realpathSync.native` canonicalises
  // case on Windows, so for any path that is really there the true casing comes back and the fold
  // has nothing left to do — an assertion built on a real path passes identically with the fold
  // removed, which is a test that proves the control it is named after is unreachable. Two paths
  // that exist only as strings are the case the fold actually decides.
  const ghostRoot = join(box, 'GhostRepo');
  const ghostPath = join(box, 'ghostrepo', 'overlay.js');
  const atRoot = (p, root, opts) => resolvePrivateAppsPath({ [PRIVATE_APPS_ENV]: p }, root, opts);
  assert('win32 rules fold case when comparing against the repository root',
    atRoot(ghostPath, ghostRoot, { platform: 'win32' }).verdict === 'inside-repo',
    atRoot(ghostPath, ghostRoot, { platform: 'win32' }).verdict);
  assert('posix rules do NOT fold case — a differently-cased root is a different directory',
    atRoot(ghostPath, ghostRoot, { platform: 'linux' }).verdict === 'ok',
    atRoot(ghostPath, ghostRoot, { platform: 'linux' }).verdict);
  assert('an exact-case in-repo path is refused under either platform rule',
    at(insideRepo, { platform: 'linux' }).state === 'inside-repo' && at(insideRepo, { platform: 'win32' }).state === 'inside-repo');

  // A sibling worktree is OUTSIDE this checkout's root and still shares the remote. "Outside this
  // repository" was the wrong rule; "outside version control" is the right one.
  const fakeWt = join(box, 'sibling-worktree');
  mkdirSync(fakeWt, { recursive: true });
  writeFileSync(join(fakeWt, '.git'), 'gitdir: /somewhere/.git/worktrees/sibling\n', 'utf8');
  assert('insideGitWorkTree sees a linked worktree (.git as a FILE)', insideGitWorkTree(join(fakeWt, 'overlay.js')));
  assert('an overlay in a sibling worktree is refused', at(join(fakeWt, 'overlay.js')).state === 'in-git-worktree');
  const nestedWt = join(fakeWt, 'deep', 'deeper');
  mkdirSync(nestedWt, { recursive: true });
  assert('...and so is one buried below it', at(join(nestedWt, 'overlay.js')).state === 'in-git-worktree');
  assert('a path in no git tree at all is accepted', !insideGitWorkTree(outside) && at(outside).state === 'loaded');

  // The `root + path.sep` boundary, which had no test and turns out to be load-bearing. Without it
  // a bare startsWith makes a SIBLING directory look like the repository, and — the case that
  // actually bites — a repoRoot of `C:\` swallows the entire drive, refusing every legal overlay
  // location on the machine. `C:\` + `\` matches nothing, which is exactly why it survives.
  const sibRoot = join(box, 'repo');
  mkdirSync(join(sibRoot, 'inner'), { recursive: true });
  mkdirSync(join(box, 'repo-backup'), { recursive: true });
  writeFileSync(join(box, 'repo-backup', 'overlay.js'), BODY, 'utf8');
  writeFileSync(join(sibRoot, 'inner', 'overlay.js'), BODY, 'utf8');
  assert('a path inside the root IS refused', atRoot(join(sibRoot, 'inner', 'overlay.js'), sibRoot).verdict === 'inside-repo');
  assert('a SIBLING whose name merely starts with the root is NOT refused as in-repo',
    atRoot(join(box, 'repo-backup', 'overlay.js'), sibRoot).verdict === 'ok',
    atRoot(join(box, 'repo-backup', 'overlay.js'), sibRoot).verdict);
  // The filesystem root is spelled differently per platform but the property is identical: a root
  // that is a prefix of every path must not swallow every path. The INPUT is platform-selected —
  // `C:\` here, `/` on posix — and both genuinely exercise the boundary, because without `+ sep` a
  // bare startsWith makes every absolute path look in-repo under either spelling. This is a
  // platform-specific input to a platform-independent rule, not a platform-specific assertion.
  const driveRoot = process.platform === 'win32' ? resolve(box).slice(0, 3) : '/';
  assert(`a filesystem-root repoRoot (${driveRoot}) does not swallow the whole filesystem`,
    atRoot(outside, driveRoot).verdict === 'ok', `${driveRoot} -> ${atRoot(outside, driveRoot).verdict}`);

  const missing = at(join(box, 'not-there.js'));
  assert('a configured-but-missing overlay is simply no overlay', missing.state === 'absent' && missing.body === EMPTY_BODY, missing.state);

  const loaded = at(outside);
  assert('an overlay outside version control is served', loaded.state === 'loaded' && loaded.body === BODY, loaded.state);
  assert('the resolved verdict is ok', resolvePrivateAppsPath({ [PRIVATE_APPS_ENV]: outside }, REPO).verdict === 'ok');

  // Every refusal must be indistinguishable to the BROWSER from "switched off".
  for (const r of [unset, inside, missing, at('relative.js'), at('\\\\h\\s\\o.js')]) {
    assert(`a non-serving state (${r.state}) returns exactly the empty body`, r.body === EMPTY_BODY);
  }
  // ...while remaining distinguishable to the OPERATOR, once, at startup.
  assert('an unconfigured overlay logs quietly', privateAppsStartupLine(unset).level === 'log');
  assert('a loaded overlay logs quietly', privateAppsStartupLine(loaded).level === 'log');
  for (const r of [inside, missing, at('relative.js')]) {
    assert(`a misconfigured overlay (${r.state}) WARNS the operator`, privateAppsStartupLine(r).level === 'warn');
  }
  assert('the startup line never prints the path', !privateAppsStartupLine(loaded).message.includes(outside));
  assert('the startup line names the reason', /not absolute/.test(privateAppsStartupLine(at('relative.js')).message));

  // Never cached.
  for (const [name, r] of [['unset', unset], ['loaded', loaded], ['refused', inside]]) {
    assert(`the ${name} response is no-store`, r.headers['cache-control'] === 'no-store');
    assert(`the ${name} response is served as JavaScript`, /javascript/.test(r.headers['content-type']));
  }

  // ---- 2. THE ROUTE -----------------------------------------------------------------------------
  // One canonicalisation decides the containment guard, the overlay route and the read. Every shape
  // below reached the FILE READER as the overlay path while missing a router that compared raw URLs.
  //
  // BOTH PATH FLAVOURS, in one run. `platform` now selects the path module as well as the case
  // fold, so this asserts win32 and posix semantics on whichever OS is executing. That is not
  // decoration: `/private-apps.js\` IS this route under win32 and is NOT under posix, so a CI
  // runner on ubuntu and a production host on Windows were never proving the same thing. Passing
  // only `platform` while the module imported ambient `node:path` simulated nothing at all.
  const PUB = resolve(PUBLIC);
  const POSIX_PUB = '/repo/services/cockpit/public';
  const WIN_PUB = 'C:\\repo\\services\\cockpit\\public';
  const overlayShapes = [
    ['/private-apps.js', 'plain'],
    ['/private-apps.js?v=2', 'query string'],
    ['/private-apps.js#x', 'fragment'],
    ['/private-apps%2Ejs', 'percent-encoded dot'],
    ['/%70rivate-apps.js', 'percent-encoded letter'],
    ['/private%2Dapps.js', 'percent-encoded hyphen'],
    ['//private-apps.js', 'doubled leading slash'],
    ['/./private-apps.js', 'dot segment'],
    ['/x/../private-apps.js', 'traversal back to root'],
    ['/private-apps.js/', 'trailing slash'],
  ];
  for (const [url, shape] of overlayShapes) {
    for (const [platform, root] of [['linux', POSIX_PUB], ['win32', WIN_PUB]]) {
      const t = resolveStaticTarget(url, root, { platform });
      assert(`[${platform}] the overlay route catches: ${shape}`, t.isOverlay && !t.outside, url);
    }
  }
  // The shapes where the two flavours genuinely DISAGREE. Asserting the difference is the only way
  // to know the flavour is being honoured rather than silently ignored.
  assert('[win32] a backslash-suffixed path IS the route', resolveStaticTarget('/private-apps.js\\', WIN_PUB, { platform: 'win32' }).isOverlay);
  assert('[posix] a backslash-suffixed path is NOT the route', !resolveStaticTarget('/private-apps.js\\', POSIX_PUB, { platform: 'linux' }).isOverlay);
  assert('[win32] a case variant IS the route', resolveStaticTarget('/PRIVATE-APPS.JS', WIN_PUB, { platform: 'win32' }).isOverlay);
  assert('[posix] a case variant is NOT the route', !resolveStaticTarget('/PRIVATE-APPS.JS', POSIX_PUB, { platform: 'linux' }).isOverlay);

  for (const url of ['/app.js', '/apps.js', '/', '/index.html', '/vendor/vue.global.prod.js', '/sub/private-apps.js']) {
    for (const [platform, root] of [['linux', POSIX_PUB], ['win32', WIN_PUB]]) {
      const t = resolveStaticTarget(url, root, { platform });
      assert(`[${platform}] an ordinary asset is NOT the overlay route: ${url}`, !t.isOverlay && !t.outside);
    }
  }
  assert('a nested path of the same name is a normal 404 target, not the route',
    resolveStaticTarget('/sub/private-apps.js', POSIX_PUB, { platform: 'linux' }).fp === `${POSIX_PUB}/sub/private-apps.js`);
  // Containment — stated as what is actually true, which is not what an earlier revision claimed.
  // `path.normalize` collapses every traversal shape below to a path already inside public/, so the
  // `startsWith(pubRoot)` guard is a BACKSTOP that none of these inputs reaches: deleting it leaves
  // this loop green, and across twenty shapes it fired zero times. Traversal is genuinely blocked;
  // it is blocked by normalisation. Asserting the outcome is honest, and calling it evidence for
  // the startsWith guard was not — a test named after the wrong mechanism is how a control nobody
  // exercises keeps its reputation.
  for (const url of ['/../../server.mjs', '/..%2F..%2Fserver.mjs', '/a/../../db.mjs', '/%2e%2e/%2e%2e/db.mjs', '/....//server.mjs']) {
    for (const platform of ['linux', 'win32']) {
      const p = platform === 'win32' ? winPath : posixPath;
      const root = platform === 'win32' ? WIN_PUB : POSIX_PUB;
      const t = resolveStaticTarget(url, root, { platform });
      assert(`[${platform}] traversal resolves inside public/ (via normalise, not the backstop): ${url}`,
        t.outside || t.fp === root || t.fp.startsWith(root + p.sep), t.fp);
      assert(`[${platform}] traversal never lands on the overlay route: ${url}`,
        !t.isOverlay || t.fp === p.join(root, PRIVATE_APPS_ROUTE), t.fp);
    }
  }
  assert('a malformed percent-escape is refused, not thrown', resolveStaticTarget('/%ZZ', PUB).outside === true);

  // Filesystem aliases that would let the READER reach a file the ROUTER did not name. Both are
  // Windows-only in effect and unreachable today (nothing creates public/private-apps.js), but they
  // are the counterexample to "exactly one answer to which file this request is for", so they are
  // refused rather than left as a true-except-for footnote.
  for (const url of ['/PRIVAT~1.JS', '/private-apps.js::$DATA', '/PRIVATE-APPS.JS::$DATA', '/app.js::$DATA', '/APP~1.JS']) {
    assert(`an aliasing leaf is refused under win32 rules: ${url}`, resolveStaticTarget(url, WIN_PUB, { platform: 'win32' }).outside === true);
  }
  assert('ordinary leaves are not caught by the alias reject',
    ['/app.js', '/apps.js', '/index.html', '/vendor/vue.global.prod.js', '/dl/Managing-AI-Agents-vJEy3nP2_C8.txt']
      .every((u) => resolveStaticTarget(u, WIN_PUB, { platform: 'win32' }).outside === false));
  assert('the route constant matches the file apps.js expects', PRIVATE_APPS_ROUTE === 'private-apps.js');

  // ---- 2b. THE HANDLER, EXECUTED ----------------------------------------------------------------
  // The gate used to check server.mjs with a family of regexes and execute none of it. Deleting the single
  // load-bearing line of this whole feature — `if (t.isOverlay) return servePrivateApps(...)` —
  // left it green at 122 of 122, and so did sending `cache-control: public, max-age=600`, sending
  // `content-type: text/html`, and ignoring privateAppsResponse altogether. The `no-store`
  // assertions above test the exported CONSTANT; they say nothing about what a handler writes to
  // the socket. A cacheable private-app registry landing in a browser's on-disk cache is exactly
  // the accidental leak this build exists to prevent, so it is asserted where it happens.
  //
  // Run against a fake `res`, never the real server: db.mjs opens a live write pool on import.
  function fakeRes() {
    const r = { code: 0, headers: {}, body: '', ended: false };
    r.writeHead = (code, headers) => { r.code = code; r.headers = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v])); return r; };
    r.end = (b) => { r.body = b === undefined ? '' : String(b); r.ended = true; return r; };
    return r;
  }
  /** Execute the real handler. `files` is a fake filesystem: path -> contents. */
  function request(url, env, files = {}) {
    const res = fakeRes();
    const readFile = (fp, cb) => (Object.hasOwn(files, fp) ? cb(null, Buffer.from(files[fp])) : cb(new Error('ENOENT')));
    serveStatic({ url }, res, { pub: PUB, repoRoot: REPO, env, readFile });
    return res;
  }

  const overlayEnv = { [PRIVATE_APPS_ENV]: outside };
  // A DECOY at the very path an overlay would be committed to. If the handler ever returns this,
  // a file in the repository is reachable — the outcome the route exists to prevent.
  const decoyPath = join(PUB, PRIVATE_APPS_ROUTE);
  const decoy = { [decoyPath]: 'window.FUSION_PRIVATE_APPS=[{key:"decoy",label:"DECOY"}];\n' };

  for (const [url, shape] of overlayShapes) {
    const served = request(url, overlayEnv, decoy);
    assert(`handler serves the OVERLAY body for: ${shape}`, served.body === BODY, `${served.code} ${JSON.stringify(served.body.slice(0, 40))}`);
    assert(`handler never serves the repo decoy for: ${shape}`, !served.body.includes('DECOY'));
    assert(`handler writes cache-control: no-store for: ${shape}`, served.headers['cache-control'] === 'no-store', String(served.headers['cache-control']));
    assert(`handler writes a JavaScript content-type for: ${shape}`, /javascript/.test(String(served.headers['content-type'])), String(served.headers['content-type']));
    assert(`handler answers 200 for: ${shape}`, served.code === 200 && served.ended);
  }
  // With no overlay configured, the SAME route still wins over the decoy — it serves empty, not the file.
  const noOverlay = request('/private-apps.js', {}, decoy);
  assert('with no overlay configured the route still wins over a repo file', noOverlay.body === EMPTY_BODY && !noOverlay.body.includes('DECOY'));
  assert('...and is still no-store', noOverlay.headers['cache-control'] === 'no-store');
  // A misconfigured overlay must not fall through to the decoy either.
  const refused = request('/private-apps.js', { [PRIVATE_APPS_ENV]: insideRepo }, decoy);
  assert('a refused overlay path does not fall through to the repo file', refused.body === EMPTY_BODY);

  // Ordinary assets are unaffected: still read, still 200, still the ordinary cache header.
  const assetPath = join(PUB, 'app.js');
  const asset = request('/app.js', {}, { [assetPath]: 'const x = 1;\n' });
  assert('an ordinary asset is still read and served', asset.code === 200 && asset.body === 'const x = 1;\n');
  assert('an ordinary asset keeps the ordinary cache header', asset.headers['cache-control'] === 'no-cache');
  assert('an ordinary asset gets its MIME type', /javascript/.test(String(asset.headers['content-type'])));
  assert('a missing asset is a 404', request('/nope.js', {}, {}).code === 404);
  assert('an aliasing leaf is refused by the handler, not read', request('/PRIVAT~1.JS', overlayEnv, decoy).code === 403);

  // ---- 3. THE REGISTRY --------------------------------------------------------------------------
  // apps.js is a classic script with no build step and no exports, so the only honest way to test it
  // is to EXECUTE it against a fake window — the same thing the browser does.
  const APPS_SRC = readFileSync(join(PUBLIC, 'apps.js'), 'utf8');
  /** @param {unknown} overlay @returns {{apps: any[], modules: Record<string, any>}} */
  function runRegistry(overlay) {
    const win = /** @type {any} */ ({});
    if (overlay !== undefined) win.FUSION_PRIVATE_APPS = overlay;
    const ctx = createContext({ window: win });
    new Script(APPS_SRC, { filename: 'apps.js' }).runInContext(ctx);
    return { apps: win.FUSION_APPS, modules: win.FUSION_MODULES };
  }

  const base = runRegistry(undefined);
  assert('apps.js runs and publishes an apps array', Array.isArray(base.apps) && base.apps.length > 0);
  assert('apps.js publishes a module registry', base.modules && typeof base.modules === 'object');
  assert('the module registry has a null prototype', Object.getPrototypeOf(base.modules) === null);

  // The labels and lanes that used to be two hardcoded literals in app.js. These ARE the
  // "renders identically" guarantee for every row: same key in, same word out.
  const m = base.modules;
  assert("module 'brain' still prints as Brain", m.brain && m.brain.label === 'Brain' && m.brain.lane === 'build');
  assert("module 'builds' still prints as Builds", m.builds && m.builds.label === 'Builds' && m.builds.lane === 'build');
  assert("module 'shopping' still prints as Shopping, in the Life lane", m.shopping && m.shopping.label === 'Shopping' && m.shopping.lane === 'life');
  const shopApp = base.apps.find((a) => m[a.key] && m[a.key].label === 'Shopping' && a.label !== 'Shopping');
  assert('the shop app keeps its own tile label while its rows print as Shopping', Boolean(shopApp));
  assert('the shop app sits in the Life lane', Boolean(shopApp) && m[shopApp.key].lane === 'life');
  assert('an unregistered module resolves to nothing, so app.js falls back to the raw key', m.somethingNeverRegistered === undefined);

  // The overlay adds, and only adds.
  const synthetic = { key: 'synthetic', label: 'Synthetic', desc: 'a fixture', moduleLabel: 'Synth', lane: 'life' };
  const withOverlay = runRegistry([synthetic]);
  assert('an overlay entry becomes an app', withOverlay.apps.some((a) => a.key === 'synthetic' && a.label === 'Synthetic'));
  assert('an overlay entry becomes a module, with its own row label and lane',
    withOverlay.modules.synthetic && withOverlay.modules.synthetic.label === 'Synth' && withOverlay.modules.synthetic.lane === 'life');
  assert('the overlay leaves the public apps untouched', withOverlay.apps.length === base.apps.length + 1);

  // ADD-ONLY, over EVERY published key — apps AND module-only producers. The previous revision
  // asserted this against apps[0] alone, which was the one key that happened to be protected: the
  // collision set was seeded from the apps list only, so a module-only key sailed through and then
  // overwrote its published label and lane. Iterating every key is the assertion; indexing zero is
  // how a hole this size stays green.
  const publishedKeys = Object.keys(base.modules);
  assert('there are module-only keys to protect (otherwise this loop proves nothing)',
    publishedKeys.some((k) => !base.apps.some((a) => a.key === k)), publishedKeys.join(','));
  for (const k of publishedKeys) {
    const hijack = runRegistry([{ key: k, label: 'HIJACKED', desc: 'nope', moduleLabel: 'HIJACKED', lane: base.modules[k].lane === 'life' ? 'build' : 'life' }]);
    assert(`an overlay cannot rewrite published module '${k}' — label`, hijack.modules[k].label === base.modules[k].label, `became ${hijack.modules[k].label}`);
    assert(`an overlay cannot rewrite published module '${k}' — lane`, hijack.modules[k].lane === base.modules[k].lane, `became ${hijack.modules[k].lane}`);
    assert(`an overlay claiming '${k}' adds no app`, hijack.apps.length === base.apps.length);
    assert(`an overlay claiming '${k}' changes no app label`, !hijack.apps.some((a) => a.label === 'HIJACKED'));
  }
  assert('every public module label survives an overlay',
    publishedKeys.every((k) => withOverlay.modules[k].label === base.modules[k].label));

  assert('an overlay entry with no label is dropped', runRegistry([{ key: 'nolabel' }]).apps.length === base.apps.length);
  assert('an overlay entry with no key is dropped', runRegistry([{ label: 'nokey' }]).apps.length === base.apps.length);
  assert('a duplicate key WITHIN one overlay is dropped', runRegistry([{ key: 'dup', label: 'A' }, { key: 'dup', label: 'B' }]).apps.filter((a) => a.key === 'dup').length === 1);
  assert('overlay junk is ignored', runRegistry([null, 'string', 7, []]).apps.length === base.apps.length);
  assert('a non-array overlay is ignored', runRegistry({ not: 'an array' }).apps.length === base.apps.length);
  assert('a default-shaped overlay entry still normalises', runRegistry([{ key: 'bare', label: 'Bare' }]).apps.some((a) => a.key === 'bare' && a.icon && a.views.length === 1));
  assert('a bare overlay entry defaults to the Build lane', runRegistry([{ key: 'bare', label: 'Bare' }]).modules.bare.lane === 'build');
  // Prototype keys must not become modules by accident.
  for (const k of ['__proto__', 'constructor', 'prototype', 'toString']) {
    const r = runRegistry([{ key: k, label: 'Proto' }]);
    assert(`overlay key '${k}' cannot poison the registry`, Object.getPrototypeOf(r.modules) === null && typeof r.modules.toString !== 'function');
  }

  // ---- 4. THE WIRING ----------------------------------------------------------------------------
  const sw = readFileSync(join(PUBLIC, 'sw.js'), 'utf8');
  const shell = (sw.match(/const SHELL = \[[^\]]*\]/) || [''])[0];
  // Count the ENTRIES, not the match. `shell.length > 0` is satisfied by `const SHELL = []`, so
  // emptying the shell list entirely passed — a vacuity guard that guards its own regex instead of
  // the thing the regex is for.
  const shellEntries = [...shell.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert('the service-worker shell lists real entries', shellEntries.length >= 6, `${shellEntries.length} entries`);
  for (const must of ['/index.html', '/apps.js', '/app.js']) {
    assert(`the service-worker shell still caches ${must}`, shellEntries.includes(must));
  }
  assert('the service-worker shell does NOT cache the overlay', !shellEntries.some((e) => e.includes('private-apps')));
  // Any cache WRITE in the fetch handler, however it is spelled. The previous pattern was
  // `caches?.\w*\.?put\(|cache\.add`, which real service-worker code does not look like:
  // `caches.open(CACHE).then((c) => c.put(req, res))` matches neither alternative, so adding
  // exactly that line kept the gate green. Match the method call, not a guessed receiver name.
  const fetchHandler = sw.split("addEventListener('fetch'")[1] || '';
  assert('there is a fetch handler to inspect', fetchHandler.length > 0);
  assert('the service worker never writes to cache at runtime (so the overlay cannot enter it)',
    !/\.\s*(put|add|addAll)\s*\(/.test(fetchHandler), fetchHandler.slice(0, 120));

  const appsJs = APPS_SRC;
  assert('apps.js merges the overlay global', appsJs.includes('FUSION_PRIVATE_APPS'));
  assert('apps.js publishes the derived module registry', appsJs.includes('FUSION_MODULES'));
  const appJs = readFileSync(join(PUBLIC, 'app.js'), 'utf8');
  assert('app.js reads module labels from the registry', appJs.includes('window.FUSION_MODULES'));
  assert('app.js keeps no hardcoded lane set', !/new Set\(\[\s*'shopping'/.test(appJs));
  const html = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
  assert('index.html loads the overlay BEFORE the registry',
    html.indexOf('/private-apps.js') > -1 && html.indexOf('/private-apps.js') < html.indexOf('/apps.js'));
  // ---- 4a. THE WIRING, EXECUTED ----------------------------------------------------------------
  // `pub` IS the containment root, and until now nothing executed the argument that sets it.
  // Swapping the two arguments served the entire repository — `.git/config`, `PKM/.user.yaml`,
  // `services/cockpit/db.mjs` — and every gate passed at 220 of 220 while it did. There is now one
  // constructor, and it is run here with exactly the argument server.mjs passes it.
  // Never let a throw here abort the run: a gate that dies part-way leaves every later assertion
  // unexecuted, and an aborted gate and a passing gate are both "no failures printed".
  const tryCtx = (dir, env) => { try { return { ok: true, ctx: staticCtx(dir, env) }; } catch (e) { return { ok: false, err: e.message }; } };

  const built = tryCtx(HERE, {});
  assert('staticCtx builds a context at all', built.ok, built.err);
  const ctx = built.ok ? built.ctx : { pub: '', repoRoot: '', env: {} };
  assert('staticCtx serves public/, and nothing wider', ctx.pub === PUBLIC, ctx.pub);
  assert('staticCtx derives the repository root', ctx.repoRoot === REPO, ctx.repoRoot);
  assert('the served directory lies inside the repository by default', ctx.pub.startsWith(REPO + sep));
  assert('the served directory is NOT the repository root', ctx.pub !== ctx.repoRoot);
  assert('the served directory does not contain the repository root', Boolean(ctx.pub) && !REPO.startsWith(ctx.pub + sep));
  // The staging escape hatch still works, and is still not the repo.
  const stagedBuilt = tryCtx(HERE, { COCKPIT_PUB: join(box, 'staging-public') });
  assert('COCKPIT_PUB context builds', stagedBuilt.ok, stagedBuilt.err);
  assert('COCKPIT_PUB still redirects the served directory', stagedBuilt.ok && stagedBuilt.ctx.pub === join(box, 'staging-public'));
  assert('...without moving the repository root', stagedBuilt.ok && stagedBuilt.ctx.repoRoot === REPO);
  // The transposition itself must be refused, not merely unlikely.
  for (const [what, dir, env] of [
    ['pub set to an ancestor of the checkout', HERE, { COCKPIT_PUB: resolve(REPO, '..') }],
    ['pub set to the repository root', HERE, { COCKPIT_PUB: REPO }],
  ]) {
    assert(`staticCtx refuses ${what}`, !tryCtx(dir, env).ok);
  }
  assert('staticCtx refuses a relative dir', !tryCtx('services/cockpit', {}).ok);
  // And the handler refuses a hand-built transposed ctx rather than serving from it.
  {
    const res = fakeRes();
    serveStatic({ url: '/.git/config' }, res, { pub: REPO, repoRoot: PUBLIC, env: {}, readFile: (fp, cb) => cb(null, Buffer.from('SERVED ' + fp)) });
    assert('serveStatic refuses a transposed ctx', res.code === 500 && !res.body.includes('SERVED'), `${res.code} ${res.body.slice(0, 60)}`);
  }
  // Escape attempts against the REAL ctx: nothing outside public/ is reachable.
  for (const url of ['/.git/config', '/PKM/.user.yaml', '/services/cockpit/db.mjs', '/../.git/config']) {
    const res = fakeRes();
    let opened = '';
    serveStatic({ url }, res, { ...ctx, readFile: (fp, cb) => { opened = fp; cb(new Error('ENOENT')); } });
    assert(`no request escapes public/: ${url}`, opened === '' || opened.startsWith(PUBLIC + sep), opened);
  }

  // ---- SOURCE-SHAPE CHECKS — read, not executed. Say so. ---------------------------------------
  // SEVEN assertions below are read, not executed: six over server.mjs and one over static.mjs.
  // They carry the [source-shape] tag so they cannot be mistaken for the executed ones, because a
  // family of regexes pretending to be tests is precisely what let the load-bearing line be deleted
  // unnoticed. The count is stated because an earlier edition of this very comment said "four" when
  // there were six — a miscount in the one comment whose entire job is accurate framing.
  //
  // The highest-stakes member is no longer among them: whether the arguments server.mjs supplies
  // are the right ones is EXECUTED in §4a. What remains is negative source properties (this text is
  // absent) and one log line — none executable, because server.mjs loads db.mjs, which opens a live
  // write pool on import. A negative property cannot be executed at all; you can only read for it.
  const server = readFileSync(join(HERE, 'server.mjs'), 'utf8');
  const staticSrc = readFileSync(join(HERE, 'static.mjs'), 'utf8');
  assert('[source-shape] static.mjs canonicalises the request exactly once', (staticSrc.match(/resolveStaticTarget\(/g) || []).length === 1);
  assert('[source-shape] server.mjs builds its context with the constructor', /staticCtx\(DIR,\s*process\.env\)/.test(server));
  assert('[source-shape] server.mjs assembles no static context by hand', !/pub:\s*\w+,\s*repoRoot:/.test(server));
  assert('[source-shape] server.mjs no longer routes on a raw URL string', !server.includes("=== '/private-apps.js'"));
  assert('[source-shape] server.mjs holds no second copy of the static handler', !/function serveStatic/.test(server));
  // Both halves: computed AND emitted. `server.includes('privateAppsStartupLine')` was satisfied by
  // the import line alone, so deleting the entire startup report left this assertion green.
  assert('[source-shape] server.mjs computes the overlay verdict at startup', /privateAppsStartupLine\(/.test(server));
  assert('[source-shape] server.mjs actually emits it', /console\[\s*line\.level\s*\]\(\s*line\.message\s*\)/.test(server));
} finally {
  rmSync(box, { recursive: true, force: true });
}

// ---- verdict ---------------------------------------------------------------------------------
// The platform is printed on EVERY run, pass or fail. This gate passed 241/241 on Windows and
// failed 1/241 on ubuntu for three review rounds, and nothing in the output said which platform had
// produced the number — so two runs that disagreed looked like the same evidence. Any skips are
// listed with their reason, so a count is only ever comparable to a count from the same list.
const where = `${process.platform}, node ${process.versions.node}`;
if (skipped.length) {
  console.log(`ℹ  ${skipped.length} assertion(s) skipped on ${process.platform}:`);
  for (const s of skipped) console.log('   ·', s);
}
if (ran === 0) {
  console.error(`❌ PRIVATE-APPS FAILED [${where}] — zero assertions executed. A gate that asserts nothing cannot pass.`);
  process.exit(1);
}
if (failures.length) {
  console.error(`❌ PRIVATE-APPS FAILED [${where}] — ${failures.length} of ${ran} assertions failed:`);
  for (const f of failures) console.error('   ·', f);
  process.exit(1);
}
console.log(`✅ PRIVATE-APPS PASSED [${where}] — ${ran} assertions executed, ${skipped.length} skipped, 0 failed (path controls, route, registry, wiring).`);
