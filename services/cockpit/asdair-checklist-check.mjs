// Fusion247 Cockpit — GATE: the checklist Warwick shops from must be REACHABLE from the surface he
// can actually open, and it must arrive as a document rather than a blob.
//
// WHY A GATE AND NOT A UNIT TEST. The defect this closes was never in a function. Every piece was
// individually correct: renderChecklist rendered, readChecklist read, the read service served, the
// card carried a path. The path pointed at 127.0.0.1:8710, which on Warwick's phone is the PHONE's
// own loopback — so the whole chain was green and the outcome reached nobody. Reachability is a
// property of the JOIN between two files, and only an execution can see it.
//
// WHAT THIS EXECUTES:
//   1. The REAL proxy handler, over a REAL socket, against a REAL fake upstream — streaming, the
//      content-type decision, upstream status forwarding, shop validation, and the fail-soft path.
//   2. The REAL proxy against the LIVE AsdAIr read service when it is reachable, which is the only
//      thing that proves the two services actually meet. Unreachable is reported as NOT PROVEN and
//      is never silently counted as a pass — CI has no read service and must not pretend otherwise.
//   3. THE JOIN: server.mjs dispatches the exported route constant, and runPipeline.js emits that
//      same route onto the card. Two literals that must agree, in two services, with nothing but
//      this check between them and another silent unreachable link.
//
// It cannot import server.mjs — that file imports db.mjs, which opens live credentialed pools at
// load. That is precisely why the handler lives in its own module.
//
// Exits non-zero on failure AND on a vacuous run.
//
// `--self-test` proves the SOURCE assertions can actually fail: it feeds them mutated source text in
// memory (never touching the tree) and requires each to reject it. An assertion that cannot go red
// is decoration, and a source scan is the easiest place in this estate to build one by accident.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASDAIR_CHECKLIST_ROUTE, SHOP_PATTERN, phoneContentType, proxyAsdairChecklist } from './asdair-checklist.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(DIR, '..', '..');
const SERVER = path.join(DIR, 'server.mjs');
const PIPELINE = path.join(REPO, 'services', 'asdair', 'pipeline', 'runPipeline.js');
const LIVE_ORIGIN = process.env.ASDAIR_ORIGIN || 'http://127.0.0.1:8710';
const LIVE_SHOP = process.env.ASDAIR_CHECK_SHOP || 'SHOP-2026-08-09';

let ran = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  ran++;
  if (cond) console.log('  PASS  ' + name + (detail ? ' — ' + detail : ''));
  else { failed++; console.error('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};

// ── The two SOURCE assertions, as functions, so --self-test can feed them a mutant ──────────────
// CRLF: every split is /\r?\n/. A source scan that splits on '\n' alone has silently passed on this
// estate before, on a file whose lines all ended \r.
// AN IMPORT IS NOT A DISPATCH, and the first version of this function could not tell them apart.
// Its rule was "one line mentions both names" — and server.mjs's IMPORT line mentions both names. A
// mutation that deleted the dispatch line entirely left this assertion GREEN. It was caught by the
// mutation run and by nothing else, which is the whole argument for doing one: the assertion was
// applied, was reasonable-looking, and examined ground that could not fail.
// So: the line must CALL the handler, and an import line is excluded explicitly.
export function serverDispatchesChecklist(source) {
  return source.split(/\r?\n/).some((l) => {
    const t = l.trim();
    if (t.startsWith('import ')) return false;
    return t.includes('ASDAIR_CHECKLIST_ROUTE') && t.includes('proxyAsdairChecklist(');
  });
}
export function pipelineEmitsRoute(source, route) {
  return source.split(/\r?\n/).some((l) => l.includes('checklistPath:') && l.includes(route + '?shop='));
}

// ── A fake read service, so this gate runs with no AsdAIr anywhere ──────────────────────────────
function fakeUpstream(handler) {
  const s = http.createServer(handler);
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r({ server: s, origin: `http://127.0.0.1:${s.address().port}` })));
}
// The proxy under a real socket, so the bytes are actually piped rather than returned.
async function throughProxy(origin, urlPath, opts = {}) {
  const s = http.createServer((req, res) => proxyAsdairChecklist(req, res, origin, opts.deps));
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const port = s.address().port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}${urlPath}`);
    return { status: r.status, type: r.headers.get('content-type'), body: await r.text() };
  } finally {
    s.closeAllConnections?.();
    await new Promise((r) => s.close(r));
  }
}

if (process.argv.includes('--self-test')) {
  const goodServer = 'if (x.startsWith(ASDAIR_CHECKLIST_ROUTE)) return proxyAsdairChecklist(a, b, c);\r\nmore\r\n';
  ok('SELF-TEST: the server assertion accepts the real shape', serverDispatchesChecklist(goodServer));
  ok('SELF-TEST: it REJECTS a dispatch that lost the handler',
    !serverDispatchesChecklist(goodServer.replace('proxyAsdairChecklist(a, b, c)', 'nothing()')));
  ok('SELF-TEST: it REJECTS the two halves split across separate lines',
    !serverDispatchesChecklist('ASDAIR_CHECKLIST_ROUTE\r\nproxyAsdairChecklist\r\n'));
  // THE MUTANT THAT CAUGHT THE FIRST VERSION OF THIS FUNCTION. server.mjs's own import line names
  // both symbols, so "both names on one line" was satisfied with the dispatch deleted.
  ok('SELF-TEST: it REJECTS the IMPORT line, which names both symbols and dispatches nothing',
    !serverDispatchesChecklist("import { ASDAIR_CHECKLIST_ROUTE, proxyAsdairChecklist } from './asdair-checklist.mjs';\r\n"));
  ok('SELF-TEST: and REJECTS a file that imports but never dispatches',
    !serverDispatchesChecklist("import { ASDAIR_CHECKLIST_ROUTE, proxyAsdairChecklist } from './x.mjs';\r\n"
      + "if (req.url.startsWith('/api/asdair/nothing')) return;\r\n"));
  const goodPipe = '  checklistPath: `/api/asdair/checklist?shop=${shop.shop_ref}`,\r\n';
  ok('SELF-TEST: the pipeline assertion accepts the real shape', pipelineEmitsRoute(goodPipe, ASDAIR_CHECKLIST_ROUTE));
  ok('SELF-TEST: it REJECTS the read-service-only path this order removed',
    !pipelineEmitsRoute('  checklistPath: `/asdair/checklist?shop=${shop.shop_ref}`,\r\n', ASDAIR_CHECKLIST_ROUTE));
  console.log(`\n${ran} self-test assertions, ${failed} failed`);
  process.exit(failed > 0 || ran === 0 ? 1 : 0);
}

// ── 1. THE JOIN — the two literals that must agree ──────────────────────────────────────────────
{
  const server = fs.readFileSync(SERVER, 'utf8');
  ok('server.mjs dispatches ASDAIR_CHECKLIST_ROUTE to proxyAsdairChecklist', serverDispatchesChecklist(server));
  ok('runPipeline.js emits the SAME route onto the handover card',
    pipelineEmitsRoute(fs.readFileSync(PIPELINE, 'utf8'), ASDAIR_CHECKLIST_ROUTE),
    ASDAIR_CHECKLIST_ROUTE);
}

// ── 2. The shop identifier the card actually carries ────────────────────────────────────────────
{
  ok('the shop pattern admits the ref Warwick is shown', SHOP_PATTERN.test('SHOP-2026-08-09'));
  ok('and still admits a numeric shop id', SHOP_PATTERN.test('4'));
  ok('and still refuses a traversal attempt', !SHOP_PATTERN.test('../etc/passwd'));
}

// ── 3. The content-type decision ────────────────────────────────────────────────────────────────
{
  ok('markdown is relabelled text/plain so a PHONE renders it inline, not a download',
    phoneContentType('text/markdown; charset=utf-8') === 'text/plain; charset=utf-8');
  ok('an upstream with no content-type still yields a readable document',
    phoneContentType(null) === 'text/plain; charset=utf-8');
  ok('the json view keeps its json type', phoneContentType('application/json') .startsWith('application/json'));
}

// ── 4. The REAL handler, over a REAL socket, against a fake read service ────────────────────────
{
  const md = '# Your checklist\n\n- [ ] 2 x Milk\n- [ ] 1 x Bread\n';
  const seen = [];
  const { server, origin } = await fakeUpstream((req, res) => {
    seen.push(req.url);
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(md);
  });
  try {
    const r = await throughProxy(origin, `${ASDAIR_CHECKLIST_ROUTE}?shop=SHOP-2026-08-09`);
    ok('the proxy answers 200 for a real shop ref', r.status === 200, String(r.status));
    ok('the body is the markdown VERBATIM — no re-render, no second renderer', r.body === md);
    ok('the body is not JSON-quoted and carries real newlines',
      !r.body.startsWith('"') && !r.body.includes('\\n') && r.body.includes('\n'));
    ok('it is served as text/plain so a phone displays it', String(r.type).includes('text/plain'));
    ok('the upstream was asked for the shop it was given', seen[0] === '/asdair/checklist?shop=SHOP-2026-08-09', seen[0]);
  } finally { server.closeAllConnections?.(); server.close(); }
}

// ── 5. States, refusals and failure — the paths a phone will actually meet ──────────────────────
{
  const { server, origin } = await fakeUpstream((req, res) => {
    if (req.url.includes('format=json')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, state: 'not_handed_over' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end('# No checklist yet\n\nThis shop has not been handed over.\n');
  });
  try {
    const notYet = await throughProxy(origin, `${ASDAIR_CHECKLIST_ROUTE}?shop=SHOP-2026-08-09`);
    // 200, NOT 404: "not handed over yet" is a true answer to a real question, and a 404 would make
    // a normal state look like the broken link this whole route exists to remove.
    ok('a not-yet-handed-over shop answers 200 with the reason, never 404', notYet.status === 200);
    ok('and says so in words a person can read', notYet.body.startsWith('# No checklist yet'));

    const asJson = await throughProxy(origin, `${ASDAIR_CHECKLIST_ROUTE}?shop=SHOP-2026-08-09&format=json`);
    ok('format=json is passed through and keeps its json type', String(asJson.type).includes('application/json'));
    ok('and its body parses', JSON.parse(asJson.body).state === 'not_handed_over');

    const noShop = await throughProxy(origin, ASDAIR_CHECKLIST_ROUTE);
    ok('a missing shop is refused 400 before any upstream call', noShop.status === 400);
    const badShop = await throughProxy(origin, `${ASDAIR_CHECKLIST_ROUTE}?shop=${encodeURIComponent('../secrets')}`);
    ok('a malformed shop is refused 400', badShop.status === 400);
  } finally { server.closeAllConnections?.(); server.close(); }
}
{
  // Upstream down: fail SOFT with a named reason, never a crash and never invented content.
  const dead = await throughProxy('http://127.0.0.1:1', `${ASDAIR_CHECKLIST_ROUTE}?shop=SHOP-2026-08-09`);
  ok('an unreachable read service answers 502 with a REASON, not a stack trace', dead.status === 502);
  ok('and the reason is named rather than a bare number',
    /not available right now — .+\./.test(dead.body), dead.body.trim());
}

// ── 6. THE LIVE LEG — the only thing that proves the two services meet ──────────────────────────
// NOT PROVEN is a first-class outcome here. CI has no read service, and a gate that quietly counts
// an absent dependency as a pass is worse than no gate.
{
  let live = null;
  try {
    live = await throughProxy(LIVE_ORIGIN, `${ASDAIR_CHECKLIST_ROUTE}?shop=${encodeURIComponent(LIVE_SHOP)}`);
  } catch { live = null; }
  if (live && live.status !== 502) {
    ok(`LIVE: the proxy reached the read service at ${LIVE_ORIGIN} and it answered ${live.status}`, live.status < 500);
    console.log('  LIVE BODY: ' + JSON.stringify(live.body.slice(0, 160)));
    // ── THE BODY SHAPE HERE MEASURES THE DEPLOYED SERVICE, NOT THIS SOURCE ──────────────────────
    // Reported, deliberately, as an OBSERVATION and not as an assertion. What is running on that
    // port is whatever was last started; this checkout cannot change it, and a gate that fails
    // because a separate process is out of date is a gate that gets ignored. The markdown-shape
    // property itself is PROVEN by execution elsewhere — services/asdair/cockpit-api/server.test.js
    // asserts the wire bytes end to end over a real socket — so nothing goes unproven by this line.
    const quoted = live.body.startsWith('"') || live.body.includes('\\n');
    console.log(quoted
      ? '  DEPLOYMENT LAGS SOURCE  the RUNNING read service still JSON-encodes its markdown body '
        + '(quoted, literal backslash-n). That is the defect fixed in this checkout at '
        + 'services/asdair/cockpit-api/server.js. It clears when that service is restarted onto this code.'
      : '  DEPLOYMENT MATCHES SOURCE  the running read service returns an unquoted markdown document.');
  } else {
    console.log(`  NOT PROVEN  the live read service at ${LIVE_ORIGIN} is not reachable from here, so the`
      + ' cockpit-to-read-service leg was exercised against a fake upstream only.');
  }
}

console.log(`\n${ran} assertions executed, ${failed} failed`);
if (ran === 0) { console.error('VACUOUS RUN — no assertion executed.'); process.exit(1); }
process.exit(failed > 0 ? 1 : 0);
