// Cockpit NAV-REACHABILITY gate — the safeguard for the "go('x') compiles fine and silently lands
// somewhere else" hazard. The cockpit routes on a single `area` ref through a v-if / v-else-if chain
// that ends in a `v-else` catch-all. A typo'd or retired target does NOT throw, does NOT blank the
// app, and does NOT fail render-check.mjs — it quietly renders the catch-all pane. That is how
// go('attention') survived: two call sites pointed at an area that has not existed for months, and
// every one of them rendered System while looking, in the source, entirely reasonable.
//
// This gate does two jobs, and it needs both:
//   1. STATIC  — extract every nav target the app can dispatch (literal go('…'), every AREAS key,
//                and every `area` carried by the two dynamic dispatchers, tiles and latest) and
//                assert each resolves to a section that is actually rendered. The `v-else` catch-all
//                resolves EXACTLY ONE key — 'system'. Anything else reaching it is an orphan.
//   2. RENDERED — a real headless browser, against a stubbed /api/state, confirming the Home entry
//                rows and the Later lane genuinely appear. Static analysis cannot tell you that a
//                template renders; it can only tell you the graph is consistent.
//
// It serves public/ itself on its own port with a fixture — NO database, NO credentials, NO live
// writes. (services/cockpit/db.mjs resolves the pg module and its credentials by absolute path, so a
// worktree copy of server.mjs would open a live cp_worker WRITE pool. Worktree isolation does not
// protect you there. This gate therefore never touches server.mjs.)
//
//   node services/cockpit/nav-check.mjs [--port 8099]
//
// Exit 0 = every assertion passed AND at least one ran. Exit 1 = a failure, or ZERO assertions —
// a gate that can pass by asserting nothing is not a gate.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, 'public');
const APP_JS = join(PUBLIC, 'app.js');

const portArg = process.argv.indexOf('--port');
const PORT = portArg > -1 ? Number(process.argv[portArg + 1]) : 8099;
const EDGE = process.env.EDGE_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// 8090 is the LIVE cockpit. Refuse rather than measure the wrong process — a check that silently
// probes production is worse than no check, because it reports a pass for code you did not build.
if (PORT === 8090) { console.error('nav-check: 8090 is the live cockpit. Pick another port.'); process.exit(1); }

// The nav's expected size, as a literal. Home · Apps · Ideas · Brain · Outputs · System.
// Deliberately NOT derived from AREAS: a count taken from the thing it is checking cannot detect a
// change to that thing. Editing this number is how you declare a nav change on purpose.
const NAV_SIZE = 6;

// ---- assertion bookkeeping -----------------------------------------------------------------
let ran = 0;
const failures = [];
/** @param {string} what @param {boolean} cond @param {string} [detail] */
function assert(what, cond, detail) {
  ran += 1;
  if (!cond) failures.push(detail ? `${what} — ${detail}` : what);
}

// ---- 1. STATIC: build the nav graph out of app.js ---------------------------------------------
const src = readFileSync(APP_JS, 'utf8');

/** Slice a balanced `open`…`close` block starting at the first `open` after `needle`. */
function blockAfter(text, needle, open = '{', close = '}') {
  const at = text.indexOf(needle);
  if (at < 0) return '';
  const i = text.indexOf(open, at);
  if (i < 0) return '';
  let depth = 0;
  for (let j = i; j < text.length; j += 1) {
    if (text[j] === open) depth += 1;
    else if (text[j] === close) { depth -= 1; if (depth === 0) return text.slice(i, j + 1); }
  }
  return '';
}
const uniq = (a) => [...new Set(a)];
const all = (re, text, g = 1) => [...text.matchAll(re)].map((m) => m[g]);

// Sections that are genuinely rendered: the v-if / v-else-if chain on `area`.
const rendered = uniq(all(/v-(?:else-)?if="area===\s*'([^']+)'"/g, src));
// The catch-all. It renders System, so it resolves 'system' and NOTHING else.
const CATCH_ALL_KEY = 'system';
const hasCatchAll = /<section v-else class="pane">/.test(src);

// AREAS is an ARRAY of objects — balance on `[`, not `{`. Balancing on `{` yields only the first
// element, which is how an earlier revision of this file "passed" while asserting one of six nav
// entries. The count assertion below is the guard that makes that failure loud instead of silent.
const areasKeys = uniq(all(/key:\s*'([^']+)'/g, blockAfter(src, 'const AREAS =', '[', ']')));
const goTargets = uniq(all(/\bgo\('([^']+)'\)/g, src));
const tilesAreas = uniq(all(/area:\s*'([^']+)'/g, blockAfter(src, 'const tiles = computed(')));
const latestAreas = uniq(all(/area:\s*'([^']+)'/g, blockAfter(src, 'const latest = computed(')));

const resolves = (k) => rendered.includes(k) || (hasCatchAll && k === CATCH_ALL_KEY);

assert('app.js declares a v-if/v-else-if area chain', rendered.length > 0);
assert('app.js has the v-else catch-all section', hasCatchAll);
assert('AREAS parsed', areasKeys.length > 0);
assert('go() call sites parsed', goTargets.length > 0);
assert('tiles dispatcher parsed', tilesAreas.length > 0);
assert('latest dispatcher parsed', latestAreas.length > 0);

const where = (k) => (rendered.includes(k) ? 'section' : k === CATCH_ALL_KEY ? 'v-else catch-all' : 'NOWHERE — falls through to the catch-all and silently renders System');
for (const k of areasKeys) assert(`AREAS key '${k}' resolves`, resolves(k), where(k));
for (const k of goTargets) assert(`go('${k}') resolves`, resolves(k), where(k));
for (const k of tilesAreas) assert(`tiles → '${k}' resolves`, resolves(k), where(k));
for (const k of latestAreas) assert(`latest → '${k}' resolves`, resolves(k), where(k));

// Every nav entry must be a real destination, and the nav is the only always-visible way around.
assert('every AREAS key has an explicit section or is the catch-all key', areasKeys.every(resolves));

// ---- 2. FIXTURE: one open, one deferred, one declined -----------------------------------------
const FIXTURE = {
  attention: [
    { id: 'fx-open', status: 'open', kind: 'decision', title: 'NAVCHECK open decision', reason: 'fixture — an item still awaiting a call', source_module: 'builds', source_type: 'fixture', priority: 'high' },
    { id: 'fx-deferred', status: 'deferred', kind: 'suggestion', title: 'NAVCHECK deferred item', reason: 'fixture — an item you parked', source_module: 'brain', source_type: 'fixture', priority: 'medium' },
  ],
  archived: [
    { id: 'fx-declined', status: 'declined', kind: 'suggestion', title: 'NAVCHECK declined item', reason: 'fixture — an item you declined', source_module: 'shopping', source_type: 'fixture' },
  ],
  // Latest MUST be non-empty. The "entry rows sit above Latest" assertion is only meaningful if
  // Latest actually rendered — an ordering check against an absent element passes by saying nothing.
  outputs: [{ id: 'fx-out', title: 'NAVCHECK output', value: 'fixture', source_module: 'brain', source_type: 'fixture', status: 'new', produced_at: new Date(Date.now() - 36e5).toISOString() }],
  wins: [{ id: 'fx-win', text: 'NAVCHECK win', happened_at: new Date(Date.now() - 72e5).toISOString() }],
  ingested: [], ingestedCount: 0, builds: [], ideas: [], opportunities: [], deliverables: [],
  housekeeping: 0, build: { version: 'navcheck', sha: 'fixture', startedAt: new Date().toISOString() },
};

// The probe page: the real shell, plus a script that drives the app into the Later lane. --dump-dom
// cannot click, so the click has to live in the page. Service-worker registration is stripped — a
// cache-first SW inside a test fixture is exactly how you end up asserting against yesterday's build.
function probePage(indexHtml) {
  return indexHtml.replace(/<script>[\s\S]*?<\/script>\s*<\/body>/, `<script>
    (function () {
      var tries = 0;
      var t = setInterval(function () {
        tries += 1;
        var row = document.querySelector('[aria-label^="Later —"]');
        if (row) { row.click(); clearInterval(t); }
        else if (tries > 120) { clearInterval(t); }
      }, 25);
    }());
  </script></body>`);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/api/state') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(FIXTURE)); return; }
  if (path.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":false,"error":"nav-check stub"}'); return; }
  try {
    if (path === '/__nav-probe.html') {
      const html = await readFile(join(PUBLIC, 'index.html'), 'utf8');
      res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(probePage(html)); return;
    }
    // Contain every read inside public/ — this process must never be able to read the estate.
    const rel = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
    const file = normalize(join(PUBLIC, rel));
    if (!file.startsWith(normalize(PUBLIC)) || !existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(500); res.end(String(e.message)); }
});

// MUST be async. This process is also the web server: a synchronous execFileSync would block the
// very event loop Edge is waiting on for /index.html, and the browser would time out against a
// server that is alive but never answers. (Cost of learning that the hard way: one run.)
const run = promisify(execFile);
async function dump(url) {
  const { stdout } = await run(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox', '--dump-dom', '--virtual-time-budget=8000', url],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

await new Promise((ok, no) => { server.on('error', no); server.listen(PORT, '127.0.0.1', ok); });
const base = `http://127.0.0.1:${PORT}`;

try {
  // ---- 3. RENDERED: Home ----------------------------------------------------------------------
  const home = await dump(`${base}/`);
  assert('Home mounted', !/<div id="app">\s*<\/div>/.test(home) && /nav-btn/.test(home));
  // Cross-check the static parse against the DOM. This guards ONE thing: parser fidelity. If the
  // AREAS extractor ever under-counts again — as it did, silently asserting 1 of 6 entries while
  // printing a green tick — the DOM disagrees loudly.
  //
  // It does NOT guard the nav's size, and an earlier revision of this comment claimed it did. The
  // nav renders from `v-for="a in AREAS"`, so both sides of this comparison derive from the same
  // array and move together: delete an entry and they still agree, at 5 == 5. Vera proved it by
  // mutation — the gate passed with the nav silently down to five. A guard that overstates its
  // reach is worse than one that says less, because it stops anyone writing the guard that is
  // actually missing. NAV_SIZE below is that guard.
  const navBtns = (home.match(/class="nav-btn/g) || []).length;
  assert('the rendered nav has exactly one button per AREAS entry (parser fidelity only)', navBtns === areasKeys.length, `rendered ${navBtns}, AREAS parsed ${areasKeys.length}`);
  // The nav's size, pinned to a LITERAL — the only shape of assertion that cannot move with the
  // thing it measures. Changing the nav now means editing this number, which is the point: it makes
  // adding or losing an entry a deliberate act rather than a diff nobody noticed. "Still six
  // entries?" has been asked across three review rounds and until now nothing held it; every
  // confirmation was a human counting.
  assert(`the nav has exactly ${NAV_SIZE} entries`, areasKeys.length === NAV_SIZE && navBtns === NAV_SIZE,
    `expected ${NAV_SIZE}, AREAS parsed ${areasKeys.length}, rendered ${navBtns} — if this change is intended, update NAV_SIZE and say so in the PR`);
  assert('Home shows the Later entry row with its count', /aria-label="Later — 1 parked"/.test(home));
  assert('Home shows the Archive entry row with its count', /aria-label="Archive — 1 declined"/.test(home));
  assert('the entry rows are keyboard-reachable', (home.match(/role="button" tabindex="0"/g) || []).length >= 2);
  // Order is the design decision: a surface you owe a decision to sits above a passive feed.
  const iLater = home.indexOf('aria-label="Later —');
  // Renamed 2026-08-08: 'Latest' behaved like 'recently ingested'; it is now RECENT ACTIVITY and
  // also carries CAPAE events. The non-vacuity guard below is the point — an ordering assertion
  // against an absent element passes by saying nothing, which is how this rename would have gone
  // unnoticed.
  const iLatest = home.indexOf('🕑 Recent activity');
  assert('Recent activity actually rendered (so the ordering check below is not vacuous)', iLatest > -1);
  assert('the entry rows sit above Recent activity', iLater > -1 && iLatest > -1 && iLater < iLatest, `later@${iLater} latest@${iLatest}`);

  // ---- 4. RENDERED: Later ---------------------------------------------------------------------
  const later = await dump(`${base}/__nav-probe.html`);
  assert('Later lane opened from the Home entry row', /<h1>Later<\/h1>/.test(later));
  assert('Later renders the deferred item', /NAVCHECK deferred item/.test(later));
  assert('Later offers "Bring back" — the same word as Archive', /Bring back<\/button>/.test(later));
  assert('Later does NOT show the open item', !/NAVCHECK open decision/.test(later));
  assert('Later does NOT show the declined item', !/NAVCHECK declined item/.test(later));
  // .item.deferred is opacity:.7, which composites --ink2 body text down to 3.63:1 (GL-003 D-18).
  // The Later lane must not apply it: in a lane where everything is deferred the fade signals
  // nothing and only costs contrast.
  assert('deferred items are NOT faded in the Later lane (GL-003 D-18 not shipped)', !/class="item[^"]*\bdeferred\b/.test(later));
} finally {
  server.close();
}

// ---- verdict ----------------------------------------------------------------------------------
if (ran === 0) { console.error('❌ NAV-CHECK FAILED — zero assertions executed. A gate that asserts nothing cannot pass.'); process.exit(1); }
console.log(`nav graph · sections=[${rendered.join(', ')}]${hasCatchAll ? ` +v-else→${CATCH_ALL_KEY}` : ''}`);
console.log(`  AREAS  (${areasKeys.length}): ${areasKeys.join(', ')}`);
console.log(`  go()   (${goTargets.length}): ${goTargets.join(', ')}`);
console.log(`  tiles  (${tilesAreas.length}): ${tilesAreas.join(', ')}`);
console.log(`  latest (${latestAreas.length}): ${latestAreas.join(', ')}`);
if (failures.length) {
  console.error(`❌ NAV-CHECK FAILED — ${failures.length} of ${ran} assertions failed:`);
  for (const f of failures) console.error('   ·', f);
  process.exit(1);
}
console.log(`✅ NAV-CHECK PASSED — ${ran} assertions executed, 0 failed (port ${PORT}, stubbed /api/state, no database).`);
