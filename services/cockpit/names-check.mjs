// ═════════════════════════════════════════════════════════════════════════════════════════════════
// NAMES-CHECK — proof for Warwick's display-name editor (WP-B15-52 AC3)
//
// ⛔ THIS IS DELIBERATELY NOT A THIRD GATE HARNESS. The Work Order is explicit: "Your names page
// needs its own proof, and it need not be elaborate: render it, drive one save through a stub, show
// the saved and failed states. Do not build a third gate harness for it." So there are no viewport
// matrices, no mutation engine and no contrast maths here — shopping-geometry-check.mjs owns all of
// that for MUM'S surface, which is the one with the accessibility requirements. This file answers
// four questions about an operator page and stops:
//
//   1. Does it render the catalogue, with the ASDA listing and the current display name?
//   2. Does a save reach the route with the right body, and does the page then say it saved?
//   3. Does a REFUSED save say so plainly, without claiming anything was stored?
//   4. ⛔ Is `aka` absent from the page entirely?
//
// (4) is the one that matters most and is the reason this file exists at all. `display_name` is
// PRESENTATION ONLY — Warwick: "it must never feed display_name into catalogue resolution or mutate
// matching behaviour." The editor writing `aka` would be exactly that mutation, so its absence is
// asserted against the rendered DOM rather than trusted to the template.
//
// The rig is the same one shopping-geometry-check.mjs uses — Edge over the DevTools protocol on
// Node 22's built-in WebSocket, no new dependency — because a second mechanism for driving a browser
// would be a second thing to keep working.
//
// USAGE
//   node services/cockpit/names-check.mjs
// ═════════════════════════════════════════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, staticCtx } from './static.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CTX = staticCtx(HERE);
const PORT = 39411;
const CDP = 39412;

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const EDGE = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!EDGE) {
  console.error('NAMES-CHECK — no Edge binary found. Looked in:\n  ' + EDGE_CANDIDATES.join('\n  '));
  console.error('REQUIRED-BUT-UNAVAILABLE, which is not a pass. Exiting non-zero.');
  process.exit(2);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── THE STUB CATALOGUE ─────────────────────────────────────────────────────────────────────────
// Shaped exactly like presentRegular() in services/asdair/cockpit-api/readRules.js: `display_name`
// RAW AND NULLABLE beside `name_display`, plus `has_display_name`. `aka` is present precisely
// BECAUSE the page must ignore it — a stub that omitted it could not prove anything about it.
// id 51 is one of the eleven flagged rows, so the decision note is exercised too.
const REGULARS = [
  { id_display: '60', name_display: 'ASDA 6 Bananas', display_name: 'Bananas', has_display_name: true, aka: ['bananas', 'nanas'], active: true },
  { id_display: '69', name_display: 'Arla BOB Semi-Skimmed Milk 2L That Tastes Like Whole', display_name: 'BOB milk', has_display_name: true, aka: ['bob'], active: true },
  { id_display: '51', name_display: 'Always Discreet Incontinence Pads Women Normal 39 Count', display_name: null, has_display_name: false, aka: ['secretalias51'], active: true },
  { id_display: '99', name_display: 'Inactive Thing 1kg', display_name: 'Inactive', has_display_name: true, aka: [], active: false },
];

// The save outcomes the page must render. Driven from Node so one run can show both.
let saveMode = 'ok';
const saved = [];

const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/asdair/rules')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ regulars: { items: REGULARS } }));
  }
  if (req.url.startsWith('/api/asdair/display-name')) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let body = null;
      try { body = JSON.parse(raw); } catch { body = { UNPARSEABLE: raw }; }
      saved.push({ method: req.method, body });
      res.writeHead(saveMode === 'ok' ? 200 : 400, { 'content-type': 'application/json' });
      if (saveMode === 'ok') {
        return res.end(JSON.stringify({ ok: true, id: body.id, display_name: body.display_name }));
      }
      // The route's real refusal shape (displayName.js -> httpApi.js).
      return res.end(JSON.stringify({
        ok: false, error: 'display_name_too_long',
        message: 'That display name is 74 characters; the limit is 60.',
      }));
    });
    return undefined;
  }
  return serveStatic(req, res, CTX);   // the REAL production static path, not a stand-in
});
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));

const profile = path.join(os.tmpdir(), 'f247-names-check-' + process.pid);
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + profile, '--remote-debugging-port=' + CDP, 'about:blank'], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await wait(500);
  try { target = (await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl); }
  catch { /* not up yet */ }
}
if (!target) {
  console.error('NAMES-CHECK — Edge never exposed a debug target. REQUIRED-BUT-UNAVAILABLE, not a pass.');
  edge.kill(); srv.close(); process.exit(2);
}

const sock = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });
let msgId = 0; const pending = new Map();
sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const cmd = (method, params = {}, timeoutMs = 20000) => new Promise((res, rej) => {
  const i = ++msgId;
  const t = setTimeout(() => { pending.delete(i); rej(new Error('CDP ' + method + ' did not answer within ' + timeoutMs + 'ms')); }, timeoutMs);
  pending.set(i, (d) => { clearTimeout(t); res(d); });
  sock.send(JSON.stringify({ id: i, method, params }));
});
await cmd('Page.enable'); await cmd('Runtime.enable');

async function evalIn(expression, ms = 10000) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, ms);
  if (r.result && r.result.exceptionDetails) {
    throw new Error('page expression threw: '
      + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  }
  return r.result && r.result.result ? r.result.result.value : null;
}

/** Poll from NODE, never with an in-page sleep — the page's clock is throttleable, this one is not. */
async function until(expr, ms = 12000) {
  const stop = Date.now() + ms;
  for (;;) {
    if (await evalIn(expr)) return true;
    if (Date.now() > stop) return false;
    await wait(100);
  }
}

// ── CONTRAST, MEASURED ON THE RENDERED BOX ─────────────────────────────────────────────────────
// WCAG 2.x relative luminance, applied to the rgb() the browser actually resolved — the same method
// shopping-geometry-check.mjs uses. Declarations are not evidence: this whole section exists because
// a declaration that reads `color: #fff` is correct in one scheme and catastrophic in the other.
const lin = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (s) => (String(s).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);

/** The composited background behind an element — walks up past transparent ancestors. */
const BG_WALK = '(() => { let e = document.querySelector(SEL); '
  + 'while (e) { const c = getComputedStyle(e).backgroundColor; '
  + 'if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; e = e.parentElement; } '
  + 'return "rgb(255,255,255)"; })()';

async function measure(sel) {
  const fg = await evalIn('getComputedStyle(document.querySelector(' + JSON.stringify(sel) + ')).color');
  const bg = await evalIn(BG_WALK.split('SEL').join(JSON.stringify(sel)));
  return { fg, bg, ratio: ratio(rgb(fg), rgb(bg)) };
}

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log((pass ? 'ok    ' : 'FAIL  ') + name + (detail ? '\n        · ' + detail : ''));
};

await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/names.html' });
if (!await until('!!document.querySelector(".nm-row")')) {
  const why = await evalIn('({ url: location.href, readyState: document.readyState, vue: typeof Vue,'
    + ' mounted: !!(document.getElementById("names") && document.getElementById("names").children.length),'
    + ' text: (document.body ? document.body.innerText.slice(0,200) : "") })');
  console.error('NAMES-CHECK — the editor never rendered: ' + JSON.stringify(why));
  sock.close(); edge.kill(); srv.close(); process.exit(1);
}

// ── 1. IT RENDERS THE CATALOGUE ────────────────────────────────────────────────────────────────
const rowCount = await evalIn('document.querySelectorAll(".nm-row").length');
check('the three ACTIVE regulars render and the inactive one does not', rowCount === 3, 'rendered ' + rowCount + ' row(s); the stub holds 4 regulars, one inactive');

const firstAsda = await evalIn('document.querySelector(".nm-row .nm-asda").textContent.trim()');
check('the ASDA listing is shown in full, untruncated', firstAsda === 'ASDA 6 Bananas', 'first row reads "' + firstAsda + '"');

const firstValue = await evalIn('document.querySelector(".nm-row .nm-input").value');
check('the CURRENT display name is loaded into the editable field', firstValue === 'Bananas', 'field holds "' + firstValue + '"');

const unnamedHint = await evalIn('(() => { const rows=[...document.querySelectorAll(".nm-row")];'
  + ' const r=rows.find(x=>x.textContent.includes("Always Discreet"));'
  + ' return r ? (r.querySelector(".nm-hint")||{}).textContent||"" : ""; })()');
check('an unnamed row says so, rather than showing an empty box with no explanation',
  /Not named/.test(unnamedHint), 'reads "' + unnamedHint.trim() + '"');

// ── 2. ⛔ aka IS NOWHERE ON THE PAGE ────────────────────────────────────────────────────────────
// The stub gives row 51 the alias "secretalias51" for exactly this assertion. Checked against the
// rendered text AND every input value, because "not displayed" and "not editable" are two claims.
const akaInText = await evalIn('document.body.innerText.includes("secretalias51")');
const akaInInputs = await evalIn('[...document.querySelectorAll("input")].some(i => (i.value||"").includes("secretalias51"))');
const akaInHtml = await evalIn('document.body.innerHTML.includes("secretalias51")');
check('⛔ aka is not rendered as text', akaInText === false);
check('⛔ aka is not loaded into any editable field', akaInInputs === false);
check('⛔ aka is not present anywhere in the DOM, not even hidden', akaInHtml === false);

// ── 3. A FLAGGED ROW CARRIES ITS DECISION ──────────────────────────────────────────────────────
// Selected by CONTENT, not by ordinal. The first version took `.nm-row.flagged` and asserted row
// 51's wording against whatever happened to sort first — a test that passes or fails on list order
// is testing the order, not the flag.
const flaggedCount = await evalIn('document.querySelectorAll(".nm-row.flagged").length');
check('both flagged rows in the stub are marked', flaggedCount === 2, flaggedCount + ' of 3 rendered rows carry a decision note');

const flagText = await evalIn('(() => { const r=[...document.querySelectorAll(".nm-row")]'
  + '.find(x=>x.textContent.includes("Always Discreet"));'
  + ' const f=r && r.querySelector(".nm-flag"); return f ? f.textContent.trim() : ""; })()');
check('a flagged row explains WHY it needs him, inline', /yours alone/i.test(flagText), 'row 51 reads "' + flagText.slice(0, 60) + '…"');

// ── 4. A SAVE THAT SUCCEEDS ────────────────────────────────────────────────────────────────────
// Typed through the real input event so Vue's v-model updates, exactly as a thumb would.
const type = (sel, value) => evalIn('(() => { const el=document.querySelector(' + JSON.stringify(sel) + ');'
  + ' const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;'
  + ' setter.call(el, ' + JSON.stringify(value) + ');'
  + ' el.dispatchEvent(new Event("input",{bubbles:true})); return true; })()');

await type('.nm-row .nm-input', 'Nanas');
const enabled = await evalIn('!document.querySelector(".nm-row .nm-save").disabled');
check('Save becomes available once the name is changed', enabled === true);

await evalIn('document.querySelector(".nm-row .nm-save").click(); true');
const sawSaved = await until('(document.querySelector(".nm-row .nm-msg.ok")||{}).textContent === "Saved."');
check('the page reports SAVED only after the server confirmed it', sawSaved === true,
  sawSaved ? 'row shows "Saved."' : 'no confirmation appeared');

const sentOk = saved.length === 1 && saved[0].method === 'POST'
  && saved[0].body.id === 60 && saved[0].body.display_name === 'Nanas';
check('the write carried exactly { id, display_name } to POST /api/asdair/display-name', sentOk,
  JSON.stringify(saved[0]));

const onlyTwoKeys = saved.length === 1 && Object.keys(saved[0].body).sort().join(',') === 'display_name,id';
check('⛔ the request body carries NOTHING ELSE — no aka, no name, no matching hint', onlyTwoKeys,
  'body keys: ' + Object.keys(saved[0].body).join(', '));

// ── 5. A SAVE THAT IS REFUSED ──────────────────────────────────────────────────────────────────
saveMode = 'fail';
await type('.nm-row .nm-input', 'Something the server will refuse');
await evalIn('document.querySelector(".nm-row .nm-save").click(); true');
const sawFail = await until('!!document.querySelector(".nm-row .nm-msg.fail")');
const failText = await evalIn('(document.querySelector(".nm-row .nm-msg.fail")||{}).textContent || ""');
check('a refused save shows the SERVER\'S OWN sentence, not a status code', sawFail && /limit is 60/.test(failText),
  'row shows "' + failText.trim() + '"');

const keptTyping = await evalIn('document.querySelector(".nm-row .nm-input").value');
check('his words are still in the box after a failure, so he can retry or retype',
  keptTyping === 'Something the server will refuse', 'field holds "' + keptTyping + '"');

const noFalseClaim = await evalIn('!document.querySelector(".nm-row .nm-msg.ok")');
check('⛔ nothing on the row claims it saved', noFalseClaim === true);

// ── 6. CLEARING SENDS null ─────────────────────────────────────────────────────────────────────
saveMode = 'ok';
saved.length = 0;
await type('.nm-row .nm-input', '');
await evalIn('document.querySelector(".nm-row .nm-save").click(); true');
await until('!!document.querySelector(".nm-row .nm-msg.ok")');
const clearedNull = saved.length === 1 && saved[0].body.display_name === null;
check('clearing the field sends null, which is how the route spells "no display name"', clearedNull,
  JSON.stringify(saved[0] && saved[0].body));

const clearedMsg = await evalIn('(document.querySelector(".nm-row .nm-msg.ok")||{}).textContent || ""');
check('and it says what that MEANS for Mum, rather than just "saved"', /ASDA name/.test(clearedMsg),
  'row shows "' + clearedMsg.trim() + '"');

// ── 7. NO ROUTE INTO MUM'S SURFACE ─────────────────────────────────────────────────────────────
const linksOut = await evalIn('[...document.querySelectorAll("a[href]")].map(a=>a.getAttribute("href")).join(",")');
check('⛔ the editor offers no link into shopping.html', !/shopping/.test(linksOut || ''),
  'links found: ' + (linksOut || '(none)'));

// ── 8. ⛔ BOTH COLOUR SCHEMES, MEASURED — CRITICAL-1 ────────────────────────────────────────────
// THE DEFECT THIS EXISTS TO CATCH, stated plainly so nobody removes it as ceremony:
// `.nm-save` was `color: #fff` on `background: var(--accent-ink)`. In light that is 7.70:1 and
// passes. names.html declares `color-scheme: light dark` and loads /styles.css, whose dark :root
// flips --accent-ink from #0a5c64 to #6fd8dc — pale cyan. White on pale cyan is 1.68:1, the worst
// rendered text pairing in the estate, and WARWICK'S PHONE DEFAULTS TO DARK. The page's only
// primary action was effectively invisible to the one person who uses it.
// GL-003 §2a says it outright under --accent-ink: "What it must NEVER be: a fill behind white text."
//
// ⛔ NOTHING IN THIS ESTATE HAD EVER RENDERED A SECOND COLOUR SCHEME — `grep -c setEmulatedMedia`
// returned 0 across all three cockpit gates. A gate cannot see a defect in a scheme it never renders,
// which is the same sentence this file's sibling already carries about viewport SIZE and about LIST
// LENGTH. Three instances of one lesson.
//
// ⛔ AND IT IS MEASURED IN THE ENABLED STATE, WHICH IS THE OTHER HALF OF THE TRAP. Vera's first probe
// read the DISABLED button and got a comfortable 7.08 — the disabled rule sets its own --ink2 on
// --panel2 and hides the defect completely. So the field is dirtied first, and the button's own
// `disabled` property is asserted false BEFORE the pairing is trusted.
const SCHEMES = [
  { name: 'light', features: [{ name: 'prefers-color-scheme', value: 'light' }] },
  { name: 'dark', features: [{ name: 'prefers-color-scheme', value: 'dark' }] },
];
// Every pairing that renders text on this page. The button is the CRITICAL, the rest are the class.
const PAIRS = [
  ['.nm-save', 'the Save button — the page\'s only primary action', 4.5],
  ['.nm-asda', 'the ASDA listing', 4.5],
  ['.nm-input', 'the editable name field', 4.5],
  ['.nm-id', 'the row id he tells similar rows apart by', 4.5],
  ['.nm-flag strong', 'a flagged row\'s heading', 4.5],
  ['.nm-long strong', 'the long-name warning', 4.5],
];

for (const scheme of SCHEMES) {
  await cmd('Emulation.setEmulatedMedia', { features: scheme.features });
  await cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/names.html' });
  await until('!!document.querySelector(".nm-row")');

  // ⛔ ENABLE THE BUTTON AND PROVE IT IS ENABLED. Measuring the disabled state is how this was
  // missed the first time, so the assertion is on the property, not on the intent.
  await type('.nm-row .nm-input', 'A name long enough to warn');
  const isEnabled = await evalIn('!document.querySelector(".nm-row .nm-save").disabled');
  check('[' + scheme.name + '] the Save button is ENABLED before its contrast is read', isEnabled === true,
    isEnabled ? 'measuring the live control, not the disabled one' : 'button still disabled — the reading below would be meaningless');

  for (const [sel, label, floor] of PAIRS) {
    const present = await evalIn('!!document.querySelector(' + JSON.stringify(sel) + ')');
    if (!present) { check('[' + scheme.name + '] ' + label + ' is present to be measured', false, sel + ' rendered nothing'); continue; }
    const m = await measure(sel);
    check('[' + scheme.name + '] ' + label + ' clears ' + floor + ':1', m.ratio >= floor,
      sel + '  ' + m.ratio.toFixed(2) + ':1   fg=' + m.fg + ' on ' + m.bg);
  }
}
await cmd('Emulation.setEmulatedMedia', { features: [] });

sock.close(); edge.kill(); srv.close();

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error('\nNAMES-CHECK FAIL — ' + failed.length + ' of ' + results.length + ' assertion(s) failed.');
  process.exit(1);
}
console.log('\nNAMES-CHECK PASS — ' + results.length + ' assertions executed against the rendered editor in a real '
  + 'browser, IN BOTH COLOUR SCHEMES: catalogue rendered, one save driven through a stub, saved / refused / '
  + 'cleared states all shown, `aka` proven absent from the DOM and from every request body, and every text '
  + 'pairing measured on the composited box under prefers-color-scheme light AND dark.');
// ⛔ THE DARK ASSERTION IS MUTATION-PROVEN, and the figure is worth keeping here because a control
// nobody has watched fail is not evidence. Reverting .nm-save to `#fff` on `var(--accent-ink)` and
// re-running against that copy (COCKPIT_PUB) yields:
//     ok    [light] .nm-save  7.70:1
//     FAIL  [dark]  .nm-save  1.68:1   fg=rgb(255,255,255) on rgb(111,216,220)
// which is Vera's CRITICAL-1 measurement reproduced exactly. The light pass in that same run is the
// point: the defect is invisible to any check that renders one scheme.
