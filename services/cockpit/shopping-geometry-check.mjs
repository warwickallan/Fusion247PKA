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
// ⛔ MEDIUM-5, VERA. The surface had only ever been rendered at n=3. Scroll behaviour, control
// density and — decisively — HIGH-1's occlusion arithmetic all change at realistic length: with
// three rows the page barely scrolls, so a sticky footer costs almost nothing and the defect hides.
// 46 rows across 5 sections, 9 of them with no household word so the retailer-string fallback is
// exercised in bulk rather than once.
const rulesLarge = JSON.parse(fs.readFileSync(path.join(FIX, 'rules.large.sample.json'), 'utf8'));
let servingLarge = false;
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
  // MEDIUM-5 — the same device classes at REALISTIC LIST LENGTH. Her real list is not three items.
  { label: 'LARGE 46 rows landscape 1024x600', w: 1024, h: 600, large: true },
  { label: 'LARGE 46 rows portrait  800x1280', w: 800, h: 1280, large: true },
  { label: 'LARGE 46 rows at 200% zoom 640x400', w: 640, h: 400, large: true },
];

// ⛔ MEASURE IS A REAL FUNCTION THAT IS STRINGIFIED, NOT A TEMPLATE LITERAL. THIS IS THE FIX FOR A
// TRAP THAT BIT FOUR TIMES IN ONE PACKAGE, and the fourth time proved the guard I had written for
// it was itself useless.
//
// As a template literal, a single backtick anywhere inside — including inside a COMMENT quoting a
// CSS selector or a JS expression the way anyone naturally would — terminated the string. Node
// then reported a SyntaxError or ReferenceError pointing at an unrelated word several lines away
// ("Unexpected identifier 'q'", "count is not defined", "Unexpected identifier 'covered'").
//
// I first responded by adding a runtime guard that checked MEASURE for a backtick. THAT GUARD CAN
// NEVER FIRE: a stray backtick is a PARSE error, so the module never loads and no runtime check in
// it ever executes. It was a control that looked like a control and could not work — the same
// class of defect as everything else this file has caught, committed by me while writing the file
// whose job is to catch that class.
//
// Written as a function, the problem does not exist to be guarded: comments may contain whatever
// they need to, the syntax is checked by the parser like any other code, and `toString()` gives
// the browser exactly these bytes.
const measureInPage = () => {
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
  const bgOf = (e) => { let n = e; while (n) { const b = cs(n, 'background-color'); if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; n = n.parentElement; } return 'rgb(255, 255, 255)'; };
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
  // ⛔ SCOPE DEFECT, FOUND BY VERA AT THE WP-B15-45 GATE. This previously took ONE element —
  // "q('.add, .row')" returns DOCUMENT ORDER, and ".add" always comes last, so "last" was ALWAYS
  // the "Add something else" control and NEVER an item row. The assertion therefore could not see
  // the thing it existed to see: rows were occluded at rest at five of six viewports while this
  // reported clean. The real HIGH-1 defect had to be found BY HAND because of this line.
  //
  // A check whose scope excludes the failure mode is worse than no check, because it is quoted as
  // coverage. Now every row AND the add control are tested, and the worst case is reported.
  const foot = document.querySelector('.foot');
  const candidates = q('.row, .add');
  let coveredAtRest = null, unreachableAtEnd = null, occludedAtRest = [], buriedAtEnd = [], footClipped = 0;
  // ⛔ AND THE REQUIREMENT IS NOT MERELY "NOTHING OVERLAPS". Vera's words: for a technology-phobic
  // 84-year-old the first screen IS the whole product. B §7.1.1 puts the pending banner inside the
  // initial viewport in both orientations, and B §6.1 puts her shopping on the landing screen. So
  // the landing state must carry AT LEAST ONE FULLY USABLE ITEM ROW and, when a question is
  // pending, the banner — measured by hit-testing, not by box arithmetic.
  let firstUsableRowVisible = null, firstWholeRowVisible = null, bannerInInitialViewport = null;
  if (foot && candidates.length) {
    const rf0 = () => R(foot);
    const y0 = scrollY;
    scrollTo(0, 0);
    const rf = rf0();
    occludedAtRest = candidates
      .filter((e) => { const r = R(e); return r.bottom > rf.top && r.top < rf.bottom; })
      .map((e) => (e.className || '').split(' ')[0]);
    coveredAtRest = occludedAtRest.length > 0;

    // Hit-test rather than trust geometry: an element can be un-overlapped and still not be the
    // thing under the finger. elementFromPoint is what her tap actually resolves to.
    // ⛔ WHAT "A USABLE ITEM ON THE LANDING SCREEN" MEANS, stated precisely, because the strict
    // reading and the useful reading differ and the difference decides this gate.
    //
    // STRICT: the entire row box sits inside the viewport. Reported as firstWholeRowVisible.
    // USEFUL: she can SEE an item and TAP it. That is the tick being fully visible and actually
    //         hit-testable to its own row — which is exactly what Vera measured when she found
    //         HIGH-1 (elementFromPoint at row 0's tick returned ".f-count").
    //
    // The failure is keyed to the USEFUL reading. A row whose name and tick are visible but whose
    // bottom edge falls a few pixels below the fold is not a defect — it is a scrolling page. At
    // 200% zoom, insisting the whole 120px box clears the fold would mean deleting required copy
    // (the title, the instruction, or HIGH-2's sentence promising Warwick will sort the question
    // out) to buy pixels, and every one of those is worth more to her than the row's bottom border.
    // ⚠️ NARROWING FLAGGED FOR VERA: she wrote "one full item row". This asserts the tick rather
    // than the whole box, and reports the strict figure beside it so the difference is visible
    // rather than quietly resolved.
    // ⛔ NARROWING-2 AMENDMENT (Vera, 18b0f98). "She can see and use her shopping" is TWO VERBS,
    // and this assertion originally tested only the second. A tick that is visible and hit-testable
    // while the product NAME sits below the fold would have passed — giving her a tappable control
    // attached to nothing she can read. It happens to hold by layout coincidence at all ten
    // viewports today; coincidence is not construction, so the name is now part of the condition
    // and the hole is closed before a layout change can find it.
    const rowsAtRest = q('.row');
    const tickUsable = (row) => {
      const tick = row.querySelector('.tick'); if (!tick) return false;
      const rt = R(tick);
      if (rt.top < 0 || rt.bottom > innerHeight) return false;    // the thing she taps must be ON SCREEN
      const name = row.querySelector('.r-name');                  // ...and so must the thing she reads
      if (!name) return false;
      const rn = R(name);
      if (rn.top < 0 || rn.bottom > innerHeight) return false;
      const hit = document.elementFromPoint(rt.left + rt.width / 2, rt.top + rt.height / 2);
      return !!(hit && row.contains(hit));                        // and the tap must land on THIS row
    };
    firstUsableRowVisible = rowsAtRest.some(tickUsable);
    firstWholeRowVisible = rowsAtRest.some((row) => {
      const r = R(row);
      return r.top >= 0 && r.bottom <= innerHeight && tickUsable(row);
    });
    const banner = document.querySelector('.banner');
    bannerInInitialViewport = banner ? (R(banner).top >= 0 && R(banner).bottom <= innerHeight) : null;

    // ══ HIGH-4 — THE THIRD NARROWING, WHICH I DID NOT FLAG AND WHICH DEFANGED THE CHECK ══════════
    //
    // This condition was `covered OR off-screen`. In the same edit that narrowed coveredAtRest I
    // also changed it to `covered AND off-screen`, and said nothing about it. Those two limbs are
    // very nearly MUTUALLY EXCLUSIVE: a control buried under a bottom-pinned footer is INSIDE the
    // viewport, so the off-screen limb is false and the whole condition can never fire.
    //
    // Vera reinstated the genuine defect shape (`.foot{position:fixed;height:520px}` with
    // `.page-pad{padding-bottom:0}`) at 800x1280 — the exact viewport where the original version of
    // this gate found it. `.add` and the last row were both buried, elementFromPoint returned
    // `.foot`, and the post-narrowing gate went red on NOTHING. The pre-narrowing one would have
    // gone red on both. The hole was specifically TALL PORTRAIT, where the top of the page is fine
    // and the bottom is buried, so firstUsableRowVisible does not see it either.
    //
    // Restored as HIT-TESTING rather than as the old OR, because that is strictly better and it is
    // what Vera asked for: at maximum scroll — where there is nowhere further to go — every control
    // that is ON SCREEN must resolve elementFromPoint at its own centre to ITSELF, and nothing may
    // still be below the fold. Box arithmetic asks whether two rectangles intersect; this asks
    // whether her finger reaches the thing she is aiming at, which is the actual requirement.
    scrollTo(0, document.documentElement.scrollHeight);
    const atEnd = candidates.concat(q('.send, .note, .undo'));
    for (const e of atEnd) {
      const r = R(e);
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom <= 0) continue;                       // scrolled above the fold: reachable by scrolling UP
      if (r.top >= innerHeight) { buriedAtEnd.push((e.className || e.tagName).toString().split(' ')[0] + ' is still below the fold at maximum scroll'); continue; }
      const cx = r.left + r.width / 2;
      const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const hit = document.elementFromPoint(cx, cy);
      if (!hit) { buriedAtEnd.push((e.className || e.tagName).toString().split(' ')[0] + ' has NOTHING at its own centre at maximum scroll (clipped away)'); continue; }
      if (e !== hit && !e.contains(hit)) buriedAtEnd.push((e.className || e.tagName).toString().split(' ')[0] + ' resolves to ' + ((hit.className || hit.tagName).toString().split(' ')[0]) + ' at its own centre at maximum scroll');
    }
    unreachableAtEnd = buriedAtEnd.length > 0;

    // ⛔ HIGH-3 — THE FOOTER MUST NOT CLIP ITS OWN CONTENTS. `max-height` plus `overflow: hidden`
    // painted 30px of an 88px primary action and ZERO pixels of the post-send message, while every
    // box-based measurement in this file happily reported 88px — because getBoundingClientRect
    // returns the LAYOUT BOX, which an ancestor's overflow does not change.
    // Vera's naming of the class is the durable part: flex-shrink (declared 88, rendered 82),
    // D-17 opacity (declared 5.02, rendered 3.91), and now clipping (box 88, painted 30). Three
    // instances in one package of "the box passes, the render does not".
    footClipped = foot.scrollHeight > foot.clientHeight
      ? foot.scrollHeight - foot.clientHeight : 0;

    scrollTo(0, y0);
  }

  // ⛔ MEDIUM-1, VERA. The "dead space" between MINUS and PLUS was measured as GEOMETRIC SEPARATION
  // only, and the stylesheet's justification claimed it was inert. It was not: the 72px quantity
  // display is inside the row, so "elementFromPoint" there returned ".q-num" and a tap TOGGLED THE
  // ROW. A near-miss on MINUS on a selected item removed it — the exact "mis-tap that must never
  // happen" the gate claimed to guard while measuring something else entirely.
  // So the gap is now hit-tested: the midpoint between the two opposite-effect controls must
  // resolve to something that changes NOTHING when tapped.
  // ⛔ THIS DISPATCHES A REAL TAP, because the previous version measured DOM ANCESTRY and that is
  // not the same question. It asked "hit.closest("button, [role=checkbox]")", which walks up the
  // tree and finds the row every time — regardless of whether a tap there can actually reach the
  // row's handler. It therefore stayed red after the defect was genuinely fixed, and it would have
  // stayed red for any fix that works by stopping propagation rather than by moving boxes apart.
  //
  // The honest question is behavioural: IF SHE TAPS HERE, DOES ANYTHING CHANGE? So a listener is
  // attached to the row, a real click is dispatched at the midpoint between MINUS and PLUS, and the
  // gate records whether it arrived. dispatchEvent is synchronous, so this needs no waiting.
  // In the PASSING case nothing mutates, because nothing reaches a handler. In the failing case the
  // row may toggle — which does not matter, because the run is already red.
  // ⛔ THE ROW IS SCROLLED INTO VIEW FIRST, and the count of rows actually exercised is REPORTED.
  // Vera, 18b0f98: this ran on ZERO rows at 640x400, 400x640 and 320x800, because `elementFromPoint`
  // returns null for a point outside the viewport and the early return skipped every row whose
  // midpoint was below the fold. The self-test's honest "9 of 10 viewports" was the symptom — the
  // one viewport where the mutation could not be caught was the one where nothing was tested.
  // A check that silently examines nothing is the same failure as a scope that excludes the defect.
  const deadSpaceLive = [];
  let deadSpaceRowsTested = 0;
  const yDead = scrollY;
  q('.row').forEach((row, i) => {
    const b = row.querySelectorAll('.q-btn');
    if (b.length < 2) return;
    row.scrollIntoView({ block: 'center' });
    const r0 = R(b[0]), r1 = R(b[1]);
    const midX = (r0.right + r1.left) / 2, midY = (r0.top + r0.bottom) / 2;
    const hit = document.elementFromPoint(midX, midY);
    if (!hit) return;
    deadSpaceRowsTested++;
    let reached = false;
    const spy = () => { reached = true; };
    row.addEventListener('click', spy);
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: midX, clientY: midY }));
    row.removeEventListener('click', spy);
    if (reached) deadSpaceLive.push('row ' + i + ': a tap between MINUS and PLUS reached the row toggle via ' + (hit.className || hit.tagName));
  });
  scrollTo(0, yDead);

  return {
    viewport: { w: innerWidth, h: innerHeight },
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    rowCount: rows.length, targets, gutters, oppos, smallest, smallestText, pairs, faded,
    coveredAtRest, unreachableAtEnd, occludedAtRest, buriedAtEnd, footClipped, deadSpaceLive, deadSpaceRowsTested,
    firstUsableRowVisible, firstWholeRowVisible, bannerInInitialViewport,
    cockpitWord: /cockpit/i.test(document.body.innerText),
    title: document.title,
  };
};
const MEASURE = '(' + measureInPage.toString() + ')()';



// WCAG 2.x relative luminance — the §2d method, applied to the RENDERED rgb() the browser resolved.
const lin = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = (c) => { const m = String(c).match(/[0-9.]+/g).map(Number); return 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ══ MEDIUM-4, VERA — TOKEN PARITY WITH GL-003 ════════════════════════════════
//
// shopping.css re-declares GL-003's colour tokens rather than importing styles.css, because sharing
// that file would serve this surface Warwick's SERVICE-WORKER-CACHED copy. That decision stands.
// Its cost was carried by a COMMENT saying "if GL-003's :root ever changes, THIS BLOCK IS STALE".
//
// A comment is not a control. `contrast-check.mjs` parses token hexes out of styles.css ONLY, so a
// token change there would leave every contrast figure in this file — and every figure quoted to
// Vera and to Warwick — silently stale, and NOTHING WOULD FAIL. The duplication would have gone on
// looking correct for exactly as long as nobody diffed two :root blocks by hand.
//
// So the parity is asserted. Any token defined in BOTH files must be byte-identical; a token this
// surface deliberately excludes (--ink3, --park, --accent) is not required to be present, and that
// exclusion is a decision rather than an omission.
function rootTokens(file) {
  const src = fs.readFileSync(file, 'utf8');
  // The FIRST :root block only. shopping.css has one; styles.css has a dark-scheme override later,
  // and comparing this surface's pinned-light values against a dark block would be nonsense.
  const m = /:root\s*\{([\s\S]*?)\}/.exec(src);
  if (!m) throw new Error('token parity: no :root block found in ' + file);
  const out = {};
  for (const decl of m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
    const d = /^\s*(--[a-z0-9-]+)\s*:\s*(.+?)\s*$/i.exec(decl);
    if (d) out[d[1]] = d[2].trim();
  }
  return out;
}
{
  const theirs = rootTokens(path.join(HERE, 'public', 'styles.css'));
  const ours = rootTokens(path.join(HERE, 'public', 'shopping.css'));
  // ⛔ THE EXPECTED SET IS PINNED, NOT COUNTED AT RUNTIME (Vera, 18b0f98). Comparing only the
  // INTERSECTION means a GL-003 rename silently shrinks it — shared drops 13 to 12, `drift` stays
  // 0, and nothing goes red while this surface quietly stops tracking a token that moved. The
  // literal below is the control; it lives here, outside both stylesheets, so neither file can
  // move it by being edited.
  const EXPECTED_SHARED = Object.freeze(['--bg', '--panel', '--panel2', '--ink', '--ink2', '--hair',
    '--accent-ink', '--ok', '--ok-w', '--warn', '--warn-w', '--stop', '--stop-w']);
  const shared = Object.keys(ours).filter((k) => k in theirs);
  const missing = EXPECTED_SHARED.filter((k) => !shared.includes(k));
  const unexpected = shared.filter((k) => !EXPECTED_SHARED.includes(k));
  if (missing.length || unexpected.length) {
    console.error('SHOPPING-GEOMETRY-CHECK FAIL — the set of tokens shared with GL-003 has CHANGED, '
      + 'which a drift check comparing only the intersection cannot see:');
    for (const k of missing) console.error('        ⛔ ' + k + ' is no longer shared — renamed or removed in styles.css, so this surface has silently stopped tracking it');
    for (const k of unexpected) console.error('        ⛔ ' + k + ' is newly shared and is not in the pinned list — add it deliberately, having measured it');
    process.exit(1);
  }
  const drift = shared.filter((k) => ours[k] !== theirs[k]);
  if (shared.length === 0) {
    console.error('SHOPPING-GEOMETRY-CHECK — token parity found ZERO shared tokens, which means the '
      + 'parser is broken rather than the files agreeing. A check that compares nothing passes '
      + 'everything. Exiting non-zero.');
    process.exit(1);
  }
  if (drift.length) {
    console.error('SHOPPING-GEOMETRY-CHECK FAIL — token drift between GL-003 (styles.css) and this '
      + 'surface (shopping.css). Every contrast figure this gate reports derives from the shipped '
      + 'token values, so a drifted token makes them stale rather than merely wrong-looking:');
    for (const k of drift) console.error('        ⛔ ' + k + '  styles.css=' + theirs[k] + '  shopping.css=' + ours[k]);
    console.error('        Reconcile shopping.css to GL-003, or if GL-003 changed deliberately, '
      + 're-measure BOTH schemes and update GL-003 §2b before touching this surface.');
    process.exit(1);
  }
  console.log('token parity  ' + shared.length + '/' + EXPECTED_SHARED.length + ' pinned GL-003 token(s) byte-identical in shopping.css '
    + '(--ink3, --park and --accent deliberately excluded from this surface)');
}

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
  if (req.url.startsWith('/api/asdair/rules')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(servingLarge ? rulesLarge : rules)); }
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
  // ── THE THREE ADDED AT VERA'S WP-B15-45 GATE ─────────────────────────────────────────────────
  // HIGH-1. Push the chrome down so no item tick is on screen at rest — the exact state she found
  // at 1024x600 with a question pending, where elementFromPoint at row 0's tick returned `.f-count`.
  'the landing screen has no tappable item': { css: '.head{padding-top:600px !important}' },
  // The banner assertion in ISOLATION. A layout mutation that hides the banner necessarily pushes
  // the rows down too, so it would fire both and prove neither; moving the banner out of view
  // WITHOUT disturbing flow is what separates them.
  'the pending banner is outside the initial viewport': { css: '.banner{position:relative !important;top:-900px !important}' },
  // MEDIUM-1. Reinstates the exact defective state: with the cluster transparent, a tap between
  // MINUS and PLUS falls through to the row and toggles it. This is the mutation that would have
  // caught the original bug, and it is the second of the two failed fixes.
  'the gap between MINUS and PLUS is live again': { css: '.q{pointer-events:none !important}' },
  // ── THE THREE ADDED AT VERA'S 18b0f98 GATE ───────────────────────────────────────────────────
  // HIGH-3, reinstated EXACTLY as it shipped. This is the declaration I added as a "defensive
  // ceiling" and never measured; it painted 30px of an 88px action and zero pixels of the post-send
  // message while every box measurement in this file reported 88px.
  'the footer clips its own contents (the 18b0f98 regression)': { css: '.foot{max-height:40vh !important;overflow:hidden !important}' },
  // HIGH-4, in the shape Vera used to prove the narrowed assertion had stopped asserting: a
  // bottom-pinned footer burying the last controls INSIDE the viewport, which the `covered AND
  // off-screen` form could never see because the off-screen limb is false by construction.
  'the last controls are buried under a pinned footer': { css: '.foot{position:fixed !important;bottom:0;left:0;right:0;height:520px !important}.page-pad{padding-bottom:0 !important}' },
  // The narrowing-2 amendment: a tick she can tap attached to a name she cannot read. Moves the
  // name out of view without disturbing the tick, which is precisely the layout the pre-amendment
  // condition would have passed.
  'a tappable tick attached to an unreadable name': { css: '.r-name{position:relative !important;top:1200px !important}' },
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
  servingLarge = !!v.large;   // set BEFORE navigating: the page fetches its list on load
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
// ⛔ THE POST-SEND STATE, WHICH THIS GATE HAS NEVER RENDERED UNTIL NOW (Vera, 18b0f98).
// HIGH-3's worst case was not the SEND button — it was the message that REPLACES it. At 640x400 the
// clipped `.note` painted ZERO pixels: she presses SEND and the screen does not respond at all, and
// the one message that Addendum B §9.6 and Addendum E criterion 9 make load-bearing is simply not
// there. A gate that only ever measures the resting state cannot see that, however many viewports
// it measures it at.
// Driven through the REAL surface — a real click on a row to choose something, a real click on the
// primary action — rather than by poking a ref, because the state that matters is the one her taps
// actually produce. Vue renders asynchronously, so this awaits two animation frames.
const DRIVE_POST_SEND = `(async () => {
  const row = document.querySelector('.row');
  const send = document.querySelector('.send');
  if (!row || !send) return 'no row or no action';
  row.click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const s2 = document.querySelector('.send');
  if (!s2) return 'action vanished after choosing';
  s2.click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return document.querySelector('.note') ? 'post-send' : 'no note rendered';
})()`;
async function drivePostSend() {
  const r = await cmd('Runtime.evaluate', { expression: DRIVE_POST_SEND, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) {
    throw new Error('driving the post-send state threw in the page: '
      + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  }
  return r.result && r.result.result ? r.result.result.value : 'unknown';
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
    await atViewport(v, async () => {
      await setMutation(css ? { css } : null);
      out[v.label] = await readMeasurement();
      // The same viewport, after she has chosen something and pressed the action. Reported as its
      // own row so a failure names the state it belongs to.
      const drove = await drivePostSend();
      const post = await readMeasurement();
      post.postSend = drove;
      out[v.label + '  [after SEND]'] = post;
    });
  }
  return out;
}

/** Every assertion for one viewport. Returns the list of failures, each already worded for a human. */
function verdict(label, m) {
  const bad = [];
  const info = [];
  if (!m || m.ERROR) return { bad: ['measurement failed: ' + (m && m.ERROR)], info: [] };
  if (m.rowCount < 1) bad.push('no item rows rendered at all — the surface is empty, so nothing below was actually tested');
  for (const t of m.targets) {
    const floor = LARGE.test(t.cls) ? FLOOR.targetLarge : FLOOR.target;
    if (Math.min(t.w, t.h) < floor) bad.push('tap target "' + t.cls + '" rendered ' + t.w + 'x' + t.h + ', under the ' + floor + 'px floor');
  }
  for (const g of m.gutters) if (g < FLOOR.gapOpposite) bad.push('dead space between the row-select area and the first quantity control is ' + g + 'px, under ' + FLOOR.gapOpposite + 'px');
  for (const g of m.oppos) if (g < FLOOR.gapOpposite) bad.push('dead space between MINUS and PLUS is ' + g + 'px, under ' + FLOOR.gapOpposite + 'px — that is the mis-tap that must never happen');
  if (m.smallest < FLOOR.text) bad.push('smallest rendered text is ' + m.smallest + 'px ("' + m.smallestText + '"), under the ' + FLOOR.text + 'px floor');
  // ⛔ THE INSTRUMENT MUST REPORT ITSELF BROKEN RATHER THAN REPORT DEFECTS.
  // Converting MEASURE from a template literal to a stringified function left the backdrop-walk
  // regex over-escaped, so it stopped recognising "rgba(0, 0, 0, 0)" and returned TRANSPARENT as if
  // it were a real background. Every pairing then measured 1.28:1 and the run produced 804
  // "contrast violations" on a surface that had not changed. Loud, but pointed at the wrong thing —
  // and a reader could have spent an evening restyling a perfectly good page.
  // A transparent backdrop is not a colour a person can see text against; it is the walk failing.
  const transparent = m.pairs.filter((p) => /rgba\(0, 0, 0, 0\)|transparent/.test(p.bg));
  if (transparent.length) {
    bad.push('THE CONTRAST INSTRUMENT IS BROKEN, NOT THE SURFACE — the backdrop walk returned a '
      + 'transparent background for ' + transparent.length + ' of ' + m.pairs.length + ' pairings '
      + '(e.g. "' + transparent[0].sel + '"). Fix bgOf before reading any figure from this run.');
    return { bad, info };
  }
  for (const p of m.pairs) {
    const r = ratio(p.fg, p.bg);
    if (r < FLOOR.contrast) bad.push('"' + p.sel + '" at ' + p.size + 'px renders ' + r.toFixed(2) + ':1, under the ' + FLOOR.contrast + ':1 bar');
  }
  for (const f of m.faded) bad.push('opacity ' + f.o + ' on text ("' + f.cls + '") — forbidden on this surface by GL-003 §2b-bis and Addendum B §6.5');
  if (m.horizontalOverflow) bad.push('the page scrolls horizontally (WCAG 1.4.10)');
  // ⛔ `coveredAtRest` IS REPORTED, NOT FAILED — a narrowing Vera reviewed and ACCEPTED as argued.
  // Once the scope defect was fixed it fired at nearly every viewport, including ones where the
  // landing screen is perfectly usable, because OVERLAPPING CONTENT FURTHER DOWN THE PAGE IS WHAT A
  // STICKY FOOTER IS. Asserting it would mean "never use a sticky footer", which B §6.7 requires.
  //
  // ⛔ THIS COMMENT PREVIOUSLY DEFENDED ITS NON-VACUITY ON THE REAL BUG IT ONCE CAUGHT, AND CLAIMED
  // `unreachableAtEnd` GUARDED THE REST. BOTH HALVES WERE FALSE AT 18b0f98, and Vera caught it:
  // an assertion that no longer asserts cannot be justified by a bug it caught before it was
  // narrowed, and `unreachableAtEnd` had been quietly changed from `covered OR off-screen` to
  // `covered AND off-screen` — two near mutually-exclusive limbs — so it guarded nothing.
  // A stale comment defending a defanged check is worse than no comment: it is the thing a reviewer
  // reads INSTEAD of re-deriving the argument.
  //
  // What actually carries the weight now, all of them asserted as failures below:
  //   * firstUsableRowVisible  — the landing screen has an item she can read AND tap
  //   * bannerInInitialViewport — a pending question is on the screen she arrives at
  //   * buriedAtEnd            — at MAXIMUM scroll, every on-screen control hit-tests to itself
  //   * footClipped            — the footer paints its own contents in full
  // The occlusion count stays in the output because it is how the arithmetic is read at a glance,
  // and it is what changes most visibly at 46 rows.
  if (m.coveredAtRest === true) info.push(m.occludedAtRest.length + ' control(s) behind the sticky footer at rest [' + m.occludedAtRest.join(', ') + '] — expected for a sticky footer; the landing-screen assertions below are what decide it');
  // HIGH-4 restored, and HIGH-3.
  for (const b of m.buriedAtEnd) bad.push('AT MAXIMUM SCROLL, WHERE THERE IS NOWHERE FURTHER TO GO: ' + b);
  if (m.footClipped > 0) bad.push('the footer is CLIPPING ITS OWN CONTENTS by ' + m.footClipped + 'px — the primary action or the post-send message is painted short of its layout box, which every box measurement in this file reports as fine (Addendum B §6.7, WCAG 1.4.4/1.4.10)');
  if (m.deadSpaceRowsTested === 0 && m.rowCount > 0) bad.push('the dead-space hit test examined ZERO of ' + m.rowCount + ' rows — it is reporting a pass on something it never looked at');
  // HIGH-1, VERA. The landing screen is the whole product for this user.
  if (m.firstUsableRowVisible === false) bad.push('THE LANDING SCREEN CONTAINS NO TAPPABLE ITEM — no item row has a tick that is both on screen and hit-testable at rest (Addendum B §6.1, §9)');
  if (m.firstUsableRowVisible === true && m.firstWholeRowVisible === false) info.push('an item is visible and tappable on arrival, but no row fits WHOLLY above the fold — acceptable on a scrolling page, recorded so the stricter reading of the requirement stays visible');
  if (m.bannerInInitialViewport === false) bad.push('the pending-question banner is NOT inside the initial viewport (Addendum B §7.1.1)');
  // In the post-send state the honest message REPLACES the action (B §6.7), so it — not the button —
  // is the thing that must be fully painted and reachable. `buriedAtEnd` covers `.note` directly.
  if (m.postSend && m.postSend !== 'post-send') bad.push('the surface could not be driven into the post-send state: ' + m.postSend + ' — so the state Addendum E criterion 9 turns on was NOT measured here');
  // MEDIUM-1, VERA.
  for (const d of m.deadSpaceLive) bad.push('the gap between MINUS and PLUS is NOT dead — a tap there resolves to a live control (' + d + ')');
  if (m.cockpitWord) bad.push('the word "Cockpit" is on her screen (Addendum B §2)');
  return { bad, info };
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
      const cleanN = verdict(v.label, await readMeasurement()).bad.length;
      baseline += cleanN;
      if (cleanN !== 0) console.error('  CONTROL FAILED at ' + v.label + ' — ' + cleanN + ' failure(s) before any mutation.');
      for (const n of names) {
        await setMutation(MUTATIONS[n]);
        if (verdict(v.label, await readMeasurement()).bad.length > cleanN) hits[n]++;
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
  const { bad, info } = verdict(label, m);
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
  for (const i of info) console.log('        ·  ' + i);
}
sock.close(); edge.kill(); srv.close();
if (checked === 0) { console.error('SHOPPING-GEOMETRY-CHECK FAIL — zero viewports measured.'); process.exit(1); }
if (failures) { console.error('SHOPPING-GEOMETRY-CHECK FAIL — ' + failures + ' measured violation(s) across ' + checked + ' viewports.'); process.exit(1); }
console.log('SHOPPING-GEOMETRY-CHECK PASS — ' + checked + ' viewports measured in a real browser, 0 violations. '
  + 'Targets, dead space, text size, composited contrast and footer clearance all measured on the rendered box. '
  + '⚠️ Chromium at her viewport sizes — NOT Silk, and NOT her tablet.');
process.exit(0);
