// Fusion247 Cockpit — GATE: the service-worker cache version must stay DERIVED, never hand-typed.
//
// The mechanism lives in sw-version.mjs: `/sw.js` is served with `__SHELL_HASH__` replaced by a hash
// of the shell's actual content, so cache invalidation happens by itself. This file is the belt to
// that braces. It fails if:
//
//   1. `public/sw.js` has lost the placeholder (someone reverted to a literal like 'f247-cockpit-v26'
//      — which silently reinstates the manual habit and its silent failure mode);
//   2. the derived version does not actually change when a shell file changes;
//   3. the derived version is not stable when nothing changes;
//   4. a file in SHELL does not exist on disk (it would be cached as a 404 forever);
//   5. the served bytes still contain an un-substituted placeholder.
//
// Checks 2 and 3 are the ones that matter, and they are MUTATION TESTS rather than assertions about
// the source: the version is computed over a real temporary copy of `public/` which is then really
// modified. "The code looks like it hashes the files" is a description of code, not evidence about
// it — this estate has already shipped a 122-of-122 green gate that was exactly that.
//
// Exits non-zero on failure AND on a vacuous run (zero assertions executed).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellVersion, renderServiceWorker, parseShellList, VERSION_TOKEN } from './sw-version.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, 'public');

let ran = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  ran++;
  if (cond) console.log('  PASS  ' + name + (detail ? ' — ' + detail : ''));
  else { failed++; console.error('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};

// --- 1. the placeholder is still there -------------------------------------------------------
const swSrc = fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8');
ok('sw.js carries the derived-version placeholder', swSrc.includes(VERSION_TOKEN),
  swSrc.includes(VERSION_TOKEN) ? VERSION_TOKEN : 'placeholder missing — has someone typed a version literal back in?');
// A hand-typed version literal is the specific regression this gate exists to catch.
const literal = /const\s+CACHE\s*=\s*['"]f247-cockpit-v\d+['"]/.exec(swSrc);
ok('sw.js has no hand-typed version literal', !literal, literal ? 'found ' + literal[0] : 'none');

// --- 4. every SHELL entry exists ---------------------------------------------------------------
const shell = parseShellList(swSrc);
const missing = shell.filter((u) => !fs.existsSync(path.join(PUB, u === '/' ? 'index.html' : u.replace(/^\//, ''))));
ok('every SHELL entry exists on disk', missing.length === 0, missing.length ? 'missing: ' + missing.join(', ') : shell.length + ' files');

// --- 5. the served worker is fully substituted -------------------------------------------------
const served = renderServiceWorker(PUB);
ok('served /sw.js contains no un-substituted placeholder', !served.body.includes(VERSION_TOKEN));
ok('served /sw.js carries a derived cache name', /const CACHE = 'f247-cockpit-[0-9a-f]{12}'/.test(served.body),
  'version=' + served.version);

// --- 2 & 3. MUTATION: does the version actually move when content moves? -----------------------
// Real copy, really modified. Nothing here touches the live public/ directory.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f247-swver-'));
try {
  fs.cpSync(PUB, tmp, { recursive: true });

  const before = shellVersion(tmp).version;
  const again = shellVersion(tmp).version;
  ok('version is STABLE when nothing changes', before === again, before + ' == ' + again);

  // Mutate a shell file — app.js is the one that changes most often in practice.
  const appPath = path.join(tmp, 'app.js');
  fs.appendFileSync(appPath, '\n// mutation-test marker\n');
  const afterApp = shellVersion(tmp).version;
  ok('version CHANGES when a shell file changes (app.js)', afterApp !== before, before + ' -> ' + afterApp);

  // Restore, and confirm it goes back — proves the change was caused by the content, not by drift.
  fs.writeFileSync(appPath, fs.readFileSync(path.join(PUB, 'app.js')));
  ok('version RETURNS to the original once the change is reverted', shellVersion(tmp).version === before,
    'restored=' + shellVersion(tmp).version);

  // Mutate a DIFFERENT shell file, to prove the hash is not keyed to one lucky file.
  fs.appendFileSync(path.join(tmp, 'styles.css'), '\n/* mutation-test marker */\n');
  const afterCss = shellVersion(tmp).version;
  ok('version CHANGES when a different shell file changes (styles.css)', afterCss !== before, before + ' -> ' + afterCss);
  fs.writeFileSync(path.join(tmp, 'styles.css'), fs.readFileSync(path.join(PUB, 'styles.css')));

  // Mutate sw.js's OWN logic — the worker's fetch/activate behaviour is part of the shell contract.
  fs.appendFileSync(path.join(tmp, 'sw.js'), '\n// mutation-test marker\n');
  ok('version CHANGES when sw.js\'s own logic changes', shellVersion(tmp).version !== before);
  fs.writeFileSync(path.join(tmp, 'sw.js'), fs.readFileSync(path.join(PUB, 'sw.js')));

  // A non-shell file must NOT move the version — otherwise every unrelated edit evicts every
  // device's cache, the cockpit reinstalls constantly, and people learn to distrust the mechanism.
  fs.writeFileSync(path.join(tmp, 'not-in-shell.txt'), 'irrelevant');
  ok('version does NOT change for a file outside SHELL', shellVersion(tmp).version === before);

  // Refusing to serve an un-derivable worker is itself a control — prove it fires.
  // split/join, NOT String.replace: the token appears TWICE in sw.js (the banner and the CACHE
  // literal) and `replace` with a string pattern only takes the first. The first version of this
  // mutation did exactly that, left the second token in place, and reported the control as broken
  // when the control was fine — the test was.
  fs.writeFileSync(path.join(tmp, 'sw.js'), swSrc.split(VERSION_TOKEN).join('v99'));
  let threw = false;
  try { renderServiceWorker(tmp); } catch { threw = true; }
  ok('renderServiceWorker REFUSES a sw.js with the placeholder removed', threw);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (ran === 0) { console.error('SW-VERSION-CHECK FAIL — zero assertions executed (a vacuous run is not a pass).'); process.exit(1); }
if (failed) { console.error(`SW-VERSION-CHECK FAIL — ${failed} of ${ran} assertions failed.`); process.exit(1); }
console.log(`SW-VERSION-CHECK PASS — ${ran} assertions executed, 0 failed. Cache invalidation is derived from content, not from a habit.`);
