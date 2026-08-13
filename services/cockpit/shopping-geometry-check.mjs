// Fusion247 — HOUSEHOLD SURFACE GEOMETRY AND CONTRAST CHECK (real browser).
//
// WHAT THIS ADDS OVER render-vm-check.mjs, and why both exist.
// render-vm-check executes the TEMPLATE and proves what the surface SAYS: the words, the states,
// the clamp, the banned vocabulary. It cannot see a single pixel. Every requirement that decides
// whether an 84-year-old with poor eyesight and poor coordination can actually operate this screen
// is a RENDERED requirement — a tap target's real box, a gap's real distance, a colour pair's real
// composited ratio, whether a sticky footer sits on top of the last control.
//
// ⛔ THIS FILE EXISTS BECAUSE THE STYLESHEET LIED TWICE, in ways only measurement could see:
//
//   1. `.q-btn { width: 88px }` rendered at 82x88 under width pressure. A flex item's default is
//      `flex-shrink: 1`, so a declared width is a PREFERENCE. Addendum B §5.1 calls these numbers
//      "floors, not targets to design down to" — and a floor that compresses when the row gets
//      tight is not a floor at all. The declaration read 88 the whole time.
//
//   2. The scroll clearance under the sticky footer was correct arithmetic for a ONE-LINE footer
//      and wrong for the two-line footer that portrait actually produces. At 800x1280 the "Add
//      something else" control rendered underneath it. Addendum B §6.7 names this exact failure
//      ("it must not overlap the last row") and the CSS still had it.
//
// Neither was a typo. Both were correct-looking declarations whose RESULT was wrong, which is the
// same class of defect as GL-003 §2b-bis's opacity compositing: the declared value passes and the
// rendered value does not. A design-system check that stops at declarations is incomplete by
// construction — GL-003 §2d already says so and ships two tools for exactly this reason.
//
// NO NEW DEPENDENCY. Edge is driven over the DevTools protocol using Node 22's built-in WebSocket.
// This is deliberate: `render-check.mjs` is broken on this machine (DEFECT-LEDGER D-2026-08-03-11 —
// headless Edge self-relaunches and detaches under its invocation), and adding puppeteer to fix a
// launch flag would be a runtime dependency bought for a test.
//
// USAGE
//   node services/cockpit/shopping-geometry-check.mjs              # the gate
//   node services/cockpit/shopping-geometry-check.mjs --self-test  # prove the gate can fail
//   node services/cockpit/shopping-geometry-check.mjs --json       # the raw measurements
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, staticCtx } from './static.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF_TEST = process.argv.includes('--self-test');
const AS_JSON = process.argv.includes('--json');

// Edge, not Chrome: Chrome is not installed on this machine and Edge is, and Silk is Chromium like
// both. This measures BLINK's layout, which is the engine Silk ships (Addendum A Finding 2).
// ⚠️ It is NOT Silk and it is NOT her tablet. What it proves is that the layout is correct in
// Chromium at her viewport sizes. Only the device proves the device.
const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const EDGE = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!EDGE) {
  console.error('SHOPPING-GEOMETRY-CHECK — no Edge binary found. Looked in:\n  ' + EDGE_CANDIDATES.join('\n  '));
  console.error('This check is REQUIRED-BUT-UNAVAILABLE, which is not a pass. Exiting non-zero.');
  process.exit(2);
}

const PORT = 8124, CDP = 9333;
const FIX = path.join(HERE, 'fixtures');
const rules = JSON.parse(fs.readFileSync(path.join(FIX, 'rules.sample.json'), 'utf8'));
const workspace = JSON.parse(fs.readFileSync(path.join(FIX, 'workspace.sample.json'), 'utf8'));

// ── THE FLOORS ───────────────────────────────────────────────────────────────────────────────────
// Every number is a REQUIREMENT with a named source, not a preference. Where Addendum B and
// Addendum E disagree, the stricter is used and both are cited — that disagreement is real and is
// recorded rather than quietly resolved.
const FLOOR = {
  target: 72,        // B §5.1 any control  (E A9 asks 60; B is stricter)
  targetLarge: 88,   // B §5.1 select / minus / plus / primary  (E A9 asks 72; B is stricter)
  gapOpposite: 24,   // E A10 between controls of OPPOSITE effect  (B §5.1's blanket 24 is unbuildable — see shopping.css)
  text: 22,          // B §5.1 body floor  (E A1 asks 20, E A3 asks 18; B is strictest)
  contrast: 7.0,     // B §5.1 / §11, WCAG 1.4.6 AAA — deliberately not the 4.5 AA floor
};
const LARGE = /\b(tick|q-btn|send)\b/;

// Her device class, both orientations, plus the two stress cases. Addendum E A20 sets the rig;
// Addendum A Finding 1 records that the actual device is UNKNOWN and must not be assumed, which is
// why this is a RANGE and not a model.
const VIEWS = [
  { label: 'landscape 1280x800 (Fire HD 10 class)', w: 1280, h: 800 },
  { label: 'landscape 1024x600 (Fire HD 8 class)', w: 1024, h: 600 },
  { label: 'portrait  800x1280', w: 800, h: 1280 },
  { label: 'portrait  600x1024', w: 600, h: 1024 },
  // 200% browser zoom halves the CSS viewport at the same physical size. WCAG 1.4.4 / E A4.
  // ⚠️ This is the honest test for this surface. Addendum A Finding 4 establishes that Fire OS's
  // own font-size setting does NOT scale Silk web content, so the WO's premise that "she has
  // already turned the display size up" probably does not reach the page at all. Browser zoom is
  // the mechanism that does, and it is stricter, so it is what is measured.
  { label: 'landscape 1280x800 at 200% zoom', w: 640, h: 400 },
  { label: 'portrait  800x1280 at 200% zoom', w: 400, h: 640 },
  // WCAG 1.4.10 reflow. B §11 calls it "the cheapest proof the layout is not brittle".
  { label: 'reflow 320px equivalent', w: 320, h: 800 },
];

const MEASURE = `(() => {
  const q = (s) => Array.from(document.querySelectorAll(s));
  const cs = (e, p) => getComputedStyle(e).getPropertyValue(p);
  const px = (e, p) => parseFloat(cs(e, p));
  const R = (e) => e.getBoundingClientRect();
  const vis = (e) => e.offsetParent !== null || getComputedStyle(e).position === 'sticky';

  const rows = q('.row');
  const targets = [];
  q('.tick, .q-btn, .send, .undo, .add').forEach((e) => { if (vis(e)) targets.push({ cls: (e.className||'').split(' ')[0], w: Math.round(R(e).width), h: Math.round(R(e).height) }); });
  rows.forEach((e) => targets.push({ cls: 'row', w: Math.round(R(e).width), h: Math.round(R(e).height) }));

  // The inert gutter between the row-select area and the FIRST quantity control. Measured
  // horizontally when the row is on one line and VERTICALLY when it has wrapped in portrait —
  // because the requirement is dead space, and which axis carries it is a layout detail.
  const gutters = rows.map((r) => {
    const b = r.querySelector('.r-body'), m = r.querySelector('.q-btn');
    if (!b || !m) return null;
    const rb = R(b), rm = R(m);
    return Math.round(rm.top >= rb.bottom - 1 ? rm.top - rb.bottom : rm.left - rb.right);
  }).filter((v) => v !== null);

  // Dead space between MINUS and PLUS — the opposite-effect pair, and the mis-tap that must never
  // happen. The quantity display sits between them and is inert.
  const oppos = rows.map((r) => {
    const b = r.querySelectorAll('.q-btn');
    if (b.length < 2) return null;
    return Math.round(R(b[1]).left - R(b[0]).right);
  }).filter((v) => v !== null);

  // Smallest RENDERED text anywhere that a person can see.
  let smallest = 999, smallestText = '';
  q('*').forEach((e) => { if (!e.children.length && e.textContent.trim() && vis(e)) { const s = px(e, 'font-size'); if (s < smallest) { smallest = s; smallestText = e.textContent.trim().slice(0, 40); } } });

  // Composited colour pairs, resolved by walking up for the first non-transparent backdrop — the
  // same model GL-003 §2b-bis uses, applied to what the browser actually produced.
  const bgOf = (e) => { let n = e; while (n) { const b = cs(n, 'background-color'); if (b && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(b)) return b; n = n.parentElement; } return 'rgb(255, 255, 255)'; };
  const pairs = [];
  q('.h-title,.h-say,.r-name,.q-num,.sec,.send,.f-count,.f-why,.banner h2,.banner p,.note,.empty,.undo,.add,.q-btn')
    .forEach((e) => { if (vis(e) && e.textContent.trim()) pairs.push({ sel: (e.className||e.tagName).split(' ')[0], fg: cs(e, 'color'), bg: bgOf(e), size: px(e, 'font-size') }); });

  // GL-003 §2b-bis and Addendum B §6.5: no opacity on text on this surface, at all.
  const faded = [];
  q('*').forEach((e) => { const o = parseFloat(cs(e, 'opacity')); if (o < 1 && e.textContent.trim()) faded.push({ cls: (e.className||e.tagName).toString().slice(0,30), o }); });

  // ⛔ B §6.7: the sticky footer must never sit on top of the last control — and the honest place
  // to ask that is AT THE BOTTOM OF THE SCROLL, not at the top.
  // Measured at scroll-top this returned "no overlap" for a layout that genuinely buried the "Add
  // something else" control, and it also made the self-test's footer mutation unfirable, which is
  // how the vacuity was found. The question is not "do these boxes intersect on arrival" — it is
  // "when she scrolls to the end, can she still reach the last thing". So: scroll to the end, let
  // the sticky footer settle, then measure.
  // TWO DIFFERENT QUESTIONS, and conflating them is what made the first version unfirable:
  //
  //   coveredAtRest    — on the view she ARRIVES at, is the sticky footer sitting on top of the
  //                      last control? This is Addendum B §6.7's actual words, and it is the one
  //                      that caught the real portrait defect (the "Add something else" control
  //                      rendered at y=1219 under a two-line footer at 800x1280).
  //   unreachableAtEnd — after scrolling to the very end, is it STILL covered or off-screen? This
  //                      is the harder failure: not "awkward" but "she can never get to it".
  //
  // Only the first can be provoked by a CSS mutation while the footer stays in normal flow, which
  // is why both are reported and both are asserted. An assertion that cannot fail is not a control.
  const foot = document.querySelector('.foot');
  const scrollables = q('.add, .row');
  const last = scrollables.length ? scrollables[scrollables.length - 1] : null;
  let coveredAtRest = null, unreachableAtEnd = null;
  if (foot && last) {
    const overlap = () => { const rl = R(last), rf = R(foot); return rl.bottom > rf.top && rl.top < rf.bottom; };
    const y0 = scrollY;
    scrollTo(0, 0);
    coveredAtRest = overlap();
    scrollTo(0, document.documentElement.scrollHeight);
    unreachableAtEnd = overlap() || R(last).top >= innerHeight;
    scrollTo(0, y0);
  }

  return {
    viewport: { w: innerWidth, h: innerHeight },
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    rowCount: rows.length, targets, gutters, oppos, smallest, smallestText, pairs, faded,
    coveredAtRest, unreachableAtEnd,
    cockpitWord: /cockpit/i.test(document.body.innerText),
    title: document.title,
  };
})()`;

// WCAG 2.x relative luminance — the §2d method, applied to the RENDERED rgb() the browser resolved.
const lin = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = (c) => { const m = String(c).match(/[0-9.]+/g).map(Number); return 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ⛔ SELF-VALIDATION, the same hard precondition contrast-check.mjs carries. If the arithmetic here
// cannot reproduce a figure GL-003 §2b independently pins, then no figure it produces may be
// quoted. --ink on --panel is 16.40 and --ink2 on --panel2 is 7.08 in light.
{
  const a = ratio('rgb(22, 32, 46)', 'rgb(255, 255, 255)');
  const b = ratio('rgb(71, 86, 107)', 'rgb(247, 249, 252)');
  if (Math.abs(a - 16.40) > 0.02 || Math.abs(b - 7.08) > 0.02) {
    console.error('SHOPPING-GEOMETRY-CHECK — the contrast model does not reproduce GL-003 §2b anchors '
      + '(--ink on --panel expected 16.40, got ' + a.toFixed(2) + '; --ink2 on --panel2 expected 7.08, got '
      + b.toFixed(2) + '). No figure from this run may be quoted. Fix the model, never the anchors.');
    process.exit(1);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CTX = staticCtx(HERE);
const srv = http.createServer((req, res) => {
  // The two reads the surface makes, answered from the committed fixture. A measurement rig must be
  // DETERMINISTIC — the same reason render-vm-check.mjs uses fixtures rather than a live capture.
  if (req.url.startsWith('/api/asdair/rules')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(rules)); }
  if (req.url.startsWith('/api/asdair/workspace')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(workspace)); }
  return serveStatic(req, res, CTX);   // the REAL production static path, not a stand-in
});
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));

const profile = path.join(os.tmpdir(), 'f247-shopping-geom-' + process.pid);
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + profile, '--remote-debugging-port=' + CDP, 'about:blank'], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await wait(500);
  try { target = (await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl); }
  catch { /* not up yet */ }
}
if (!target) {
  console.error('SHOPPING-GEOMETRY-CHECK — Edge never exposed a debug target. REQUIRED-BUT-UNAVAILABLE, not a pass.');
  edge.kill(); srv.close(); process.exit(2);
}

const sock = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });
let msgId = 0; const pending = new Map();
sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
// ⛔ EVERY CDP CALL IS TIMED OUT, and that is not defensive padding.
// DEFECT-LEDGER D-2026-08-03-11 records headless Edge self-relaunching and detaching on this
// machine; the first version of this file hung indefinitely on a stalled call, wrote nothing
// (stdout to a file is buffered until exit) and left 38 orphan processes. A gate that hangs is
// indistinguishable from a gate that is slow, and neither is a result. A stalled call now REJECTS,
// and the run exits 2 as REQUIRED-BUT-UNAVAILABLE — which is not a pass.
const CMD_TIMEOUT_MS = 20000;
const cmd = (method, params = {}) => new Promise((res, rej) => {
  const i = ++msgId;
  const t = setTimeout(() => { pending.delete(i); rej(new Error('CDP ' + method + ' did not answer within ' + CMD_TIMEOUT_MS + 'ms')); }, CMD_TIMEOUT_MS);
  pending.set(i, (d) => { clearTimeout(t); res(d); });
  sock.send(JSON.stringify({ id: i, method, params }));
});
await cmd('Page.enable'); await cmd('Runtime.enable');

// The self-test injects a stylesheet that breaks one floor at a time and requires the gate to go
// red. A detector nobody has made fail is not evidence; it is a hope.
// ⛔ TWO OF THESE WERE WRONG ON FIRST RUN, AND THE CORRECTIONS ARE THE INTERESTING PART — both were
// mutations that could never fire, which would have left the assertion they were supposed to prove
// completely vacuous while the self-test reported a clean catch rate.
//
//   * The footer mutation was `.page-pad{padding-bottom:0}`. That makes the page SHORTER, so the
//     content fits the viewport, the sticky footer stays in normal flow, and nothing overlaps.
//     It is the real bug's opposite. The footer must instead be made TALL, so it covers content on
//     a page that still scrolls — which is the actual shape of the defect this caught in portrait.
//   * The banned-word mutation used `::after { content: " Cockpit" }`. CSS generated content is NOT
//     part of `innerText`, so the detector could not have seen it however broken the surface was.
//     A DOM mutation is required, so `js` exists alongside `css` — with its own undo, because a
//     node injected into the document is not cleared by emptying a <style>.
const MUTATIONS = {
  'a tap target is shrunk below the 88px floor': { css: '.q-btn{width:40px !important}' },
  'text is dropped below the 22px floor': { css: '.h-say{font-size:12px !important}' },
  'a text pairing is pushed below 7:1': { css: '.r-name{color:#8a97a8 !important}' },
  'text is faded with opacity (the D-17 rule)': { css: '.r-name{opacity:.6 !important}' },
  'the opposite-effect gap is collapsed': { css: '.q-num{width:0 !important;overflow:hidden}' },
  'the banned word reaches her screen': { js: 'const n=document.createElement("p");n.id="f247-jsmut";n.textContent="Back to the Cockpit";document.body.appendChild(n);' },
};

// ⛔ THE FOOTER-OVERLAP ASSERTION HAS NO MUTATION, AND THAT IS A DELIBERATE, RECORDED DECISION
// RATHER THAN AN OVERSIGHT. Read this before "fixing" it by adding one.
//
// `coveredAtRest` fires only in a narrow geometry: the last control must sit INSIDE the band the
// stuck footer occupies at scroll-top — not above it, and not below the fold. Every CSS mutation
// tried either pushed the control below the fold (a taller footer does this, and then nothing
// overlaps) or tripped a DIFFERENT assertion on the way (shrinking the rows breaks the 72px target
// floor first). A mutation that goes red for the wrong reason is a VACUOUS catch, and this file
// exists partly because of exactly that failure elsewhere in the estate.
//
// So its non-vacuity rests on something better than a synthetic mutation: IT ALREADY CAUGHT A REAL
// DEFECT IN THIS WORK PACKAGE. Before the portrait clearance was corrected, a headless measurement
// at 800x1280 reported the "Add something else" control at y=1219 underneath a two-line sticky
// footer — `lastRowCovered: true`, on the shipping stylesheet. The fix is the `.page-pad` override
// in the portrait media query, and the assertion has read false at all seven viewports since.
// That is a control proven by the bug it found, which is the strongest evidence available and is
// stronger than proof by injected fault.
//
// `unreachableAtEnd` is likewise unmutated and is honestly the weaker of the two: with the footer
// in NORMAL FLOW (sticky, not fixed) the last control is always reachable at maximum scroll, so
// this can only fire if someone changes the footer to `position: fixed`. It is kept as the guard
// against exactly that change.

// ⛔ ONE NAVIGATION PER VIEWPORT, AND THE MUTATIONS SWAP A STYLE ELEMENT IN PLACE.
// The first version reloaded the page for every mutation at every viewport — 56 navigations — and
// that is what made the run long enough to look hung. Reloading also proves nothing extra: a CSS
// mutation is viewport-independent, and re-navigating only re-tests the loader.
// So each viewport is entered once, measured clean, then measured under each mutation by rewriting
// the contents of ONE injected <style> and clearing it again. `#f247-mutation` is emptied rather
// than removed, so the clean measurement and the mutated ones differ ONLY by the declaration under
// test — a mutation that accidentally left state behind would otherwise contaminate the next one.
async function atViewport(v, fn) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: true });
  await cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/shopping.html' });
  await wait(900);
  await cmd('Runtime.evaluate', { expression: 'if(!document.getElementById("f247-mutation")){const s=document.createElement("style");s.id="f247-mutation";document.head.appendChild(s);}', returnByValue: true });
  return fn();
}
/** Apply one mutation, or clear back to the shipping surface when given nothing.
 *  Both halves are undone every time — the style element is emptied AND any injected node removed —
 *  so a mutation can never leak into the measurement after it. */
// ⛔ WRAPPED IN AN IIFE, AND NOT FOR STYLE. Runtime.evaluate runs at the TOP LEVEL of a persistent
// execution context, so a bare `const` survives the call — and the SECOND invocation throws
// "Identifier has already been declared". The mutation then never applies, and because the throw is
// inside the page rather than in this process, every mutation silently reported MISSED while the
// control stayed clean. That is a self-test that has stopped testing and still looks orderly.
// Found by running it: all seven went from caught to missed in one edit.
// `exceptionDetails` is now checked too, so a page-side throw can never again be read as "the
// detector did not fire".
async function setMutation(mut) {
  const m = mut || {};
  const expr = '(() => {'
    + 'document.getElementById("f247-mutation").textContent=' + JSON.stringify(m.css || '') + ';'
    + 'const old = document.getElementById("f247-jsmut"); if (old) old.remove();'
    + (m.js || '')
    + '})()';
  const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    throw new Error('mutation script threw in the page: '
      + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  }
  await wait(180);
}
async function readMeasurement() {
  const r = await cmd('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    throw new Error('the measurement script threw in the page: '
      + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  }
  return (r.result && r.result.result) ? r.result.result.value : { ERROR: 'evaluate failed' };
}
async function measure(css) {
  const out = {};
  for (const v of VIEWS) {
    out[v.label] = await atViewport(v, async () => { await setMutation(css ? { css } : null); return readMeasurement(); });
  }
  return out;
}

/** Every assertion for one viewport. Returns the list of failures, each already worded for a human. */
function verdict(label, m) {
  const bad = [];
  if (!m || m.ERROR) return ['measurement failed: ' + (m && m.ERROR)];
  if (m.rowCount < 1) bad.push('no item rows rendered at all — the surface is empty, so nothing below was actually tested');
  for (const t of m.targets) {
    const floor = LARGE.test(t.cls) ? FLOOR.targetLarge : FLOOR.target;
    if (Math.min(t.w, t.h) < floor) bad.push('tap target "' + t.cls + '" rendered ' + t.w + 'x' + t.h + ', under the ' + floor + 'px floor');
  }
  for (const g of m.gutters) if (g < FLOOR.gapOpposite) bad.push('dead space between the row-select area and the first quantity control is ' + g + 'px, under ' + FLOOR.gapOpposite + 'px');
  for (const g of m.oppos) if (g < FLOOR.gapOpposite) bad.push('dead space between MINUS and PLUS is ' + g + 'px, under ' + FLOOR.gapOpposite + 'px — that is the mis-tap that must never happen');
  if (m.smallest < FLOOR.text) bad.push('smallest rendered text is ' + m.smallest + 'px ("' + m.smallestText + '"), under the ' + FLOOR.text + 'px floor');
  for (const p of m.pairs) {
    const r = ratio(p.fg, p.bg);
    if (r < FLOOR.contrast) bad.push('"' + p.sel + '" at ' + p.size + 'px renders ' + r.toFixed(2) + ':1, under the ' + FLOOR.contrast + ':1 bar');
  }
  for (const f of m.faded) bad.push('opacity ' + f.o + ' on text ("' + f.cls + '") — forbidden on this surface by GL-003 §2b-bis and Addendum B §6.5');
  if (m.horizontalOverflow) bad.push('the page scrolls horizontally (WCAG 1.4.10)');
  if (m.coveredAtRest === true) bad.push('on the view she arrives at, the sticky footer is sitting on top of the last control (Addendum B §6.7)');
  if (m.unreachableAtEnd === true) bad.push('after scrolling to the very end the last control is STILL covered or off-screen — she can never reach it');
  if (m.cockpitWord) bad.push('the word "Cockpit" is on her screen (Addendum B §2)');
  return bad;
}

// A stalled DevTools call must end the run LOUDLY as required-but-unavailable, never leave it
// hanging with nothing on stdout. See the CMD_TIMEOUT_MS note.
process.on('unhandledRejection', (e) => {
  console.error('SHOPPING-GEOMETRY-CHECK — the browser stopped answering: ' + (e && e.message));
  console.error('REQUIRED-BUT-UNAVAILABLE. That is not a pass.');
  try { sock.close(); edge.kill(); srv.close(); } catch { /* shutting down anyway */ }
  process.exit(2);
});

// Skipped in self-test mode, which does its own clean measurement per viewport — running it here
// too would double the navigations for no extra evidence, which is what made the first version
// look hung.
const clean = SELF_TEST ? {} : await measure(null);
if (AS_JSON) { console.log(JSON.stringify(clean, null, 1)); sock.close(); edge.kill(); srv.close(); process.exit(0); }

if (SELF_TEST) {
  const names = Object.keys(MUTATIONS);
  const hits = Object.fromEntries(names.map((n) => [n, 0]));
  let baseline = 0;
  // Viewports OUTER, mutations INNER — one navigation each, and every mutation is exercised at
  // every viewport rather than at a chosen one. A mutation only has to be caught SOMEWHERE to
  // prove the detector fires; requiring it everywhere would fail honestly-viewport-specific ones
  // (the footer-clearance mutation is exactly that).
  for (const v of VIEWS) {
    await atViewport(v, async () => {
      await setMutation(null);
      const cleanN = verdict(v.label, await readMeasurement()).length;
      baseline += cleanN;
      if (cleanN !== 0) console.error('  CONTROL FAILED at ' + v.label + ' — ' + cleanN + ' failure(s) before any mutation.');
      for (const n of names) {
        await setMutation(MUTATIONS[n]);
        if (verdict(v.label, await readMeasurement()).length > cleanN) hits[n]++;
      }
      await setMutation(null);
    });
  }
  let caught = 0; const missed = [];
  for (const n of names) {
    if (hits[n] > 0) { caught++; console.log('  caught  ' + n.padEnd(58) + ' -> went red at ' + hits[n] + ' of ' + VIEWS.length + ' viewports'); }
    else { missed.push(n); console.log('  MISSED  ' + n.padEnd(58) + ' -> red at NO viewport'); }
  }
  console.log(baseline === 0
    ? '  control  all ' + VIEWS.length + ' viewports clean before mutation (no false positive)'
    : '  CONTROL FAILED — ' + baseline + ' failure(s) on the unmutated surface; the mutations above prove nothing.');
  sock.close(); edge.kill(); srv.close();
  if (missed.length || baseline !== 0) { console.error('SELF-TEST FAIL'); process.exit(1); }
  console.log('SELF-TEST PASS — ' + caught + '/' + names.length + ' mutations caught, control clean.');
  process.exit(0);
}

let failures = 0, checked = 0;
for (const [label, m] of Object.entries(clean)) {
  const bad = verdict(label, m);
  checked++;
  const worst = (m.pairs || []).reduce((w, p) => Math.min(w, ratio(p.fg, p.bg)), 99);
  const minT = (m.targets || []).reduce((w, t) => Math.min(w, t.w, t.h), 999);
  console.log((bad.length ? 'FAIL  ' : 'ok    ') + label.padEnd(38)
    + ' rows=' + m.rowCount
    + '  min-target=' + minT + 'px'
    + '  gutter=' + (m.gutters && m.gutters.length ? Math.min(...m.gutters) : '-') + 'px'
    + '  min-text=' + m.smallest + 'px'
    + '  worst-contrast=' + (worst === 99 ? '-' : worst.toFixed(2)) + ':1');
  for (const b of bad) { failures++; console.error('        ⛔ ' + b); }
}
sock.close(); edge.kill(); srv.close();
if (checked === 0) { console.error('SHOPPING-GEOMETRY-CHECK FAIL — zero viewports measured.'); process.exit(1); }
if (failures) { console.error('SHOPPING-GEOMETRY-CHECK FAIL — ' + failures + ' measured violation(s) across ' + checked + ' viewports.'); process.exit(1); }
console.log('SHOPPING-GEOMETRY-CHECK PASS — ' + checked + ' viewports measured in a real browser, 0 violations. '
  + 'Targets, dead space, text size, composited contrast and footer clearance all measured on the rendered box. '
  + '⚠️ Chromium at her viewport sizes — NOT Silk, and NOT her tablet.');
process.exit(0);
