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
//   node services/cockpit/shopping-geometry-check.mjs               # the gate
//   node services/cockpit/shopping-geometry-check.mjs --self-test   # prove the gate can fail
//   node services/cockpit/shopping-geometry-check.mjs --json        # the raw measurements
//   node services/cockpit/shopping-geometry-check.mjs --send-cases  # WP-B15-49 AC1: eight server
//                                                                   # answers, eight rendered
//                                                                   # outcomes, executed not asserted
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
// `.again` is the way back out of an outcome state (B §9.3/§9.5). It is held to the LARGE 88px
// floor rather than the general 72px one because in the state where it appears it is the ONLY
// control on the screen — B §5.1 puts the primary action in this class, and in that state it is one.
// `confirm` and `a-add` are primary actions in the state they appear in, and `a-input` must be
// at least as tall as the control that submits it or she cannot read back what she typed.
const LARGE = /\b(tick|q-btn|send|again|confirm|a-add|a-input)\b/;

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
  // ⛔ THE THREE VERA MEASURED AT AND THIS FILE DID NOT. Every HIGH she returned was found at a
  // viewport absent from this list, which is the plainest possible statement of the gap: a gate
  // cannot see a defect at a size it never renders. 800x500 is where 10px of an 88px "YES, SEND IT"
  // was painted; 512x300 is Fire HD 8 landscape at 200% zoom, where the 16px opposite-effect gap
  // shipped; 300x512 is its portrait. They are kept permanently, not borrowed for one fix.
  { label: 'landscape  800x500', w: 800, h: 500 },
  { label: 'landscape  512x300 (Fire HD 8 at 200% zoom)', w: 512, h: 300 },
  { label: 'portrait   300x512', w: 300, h: 512 },
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
  q('.tick, .q-btn, .send, .undo, .add, .again, .confirm, .take-off, .a-input, .a-add, .a-cancel').forEach((e) => { if (vis(e)) targets.push({ cls: (e.className||'').split(' ')[0], w: Math.round(R(e).width), h: Math.round(R(e).height) }); });
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
  q('.h-title,.h-say,.r-name,.q-num,.sec,.send,.f-count,.f-why,.banner h2,.banner p,.note,.n-say,.n-sub,.again,.confirm,.empty,.undo,.add,.q-btn,.take-off,.e-note,.a-label,.a-add,.a-cancel')
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
  let outcomeVisible = null, outcomeWhy = null, confirmGap = null;

  // ⛔⛔ MEASURED AT THE SCROLL POSITION THE TRANSITION LEFT HER AT — NOT AT MAXIMUM SCROLL.
  // HIGH-1, VERA, and this is the correction. This ran after `scrollTo(0, documentElement
  // .scrollHeight)`, which sounds right and is not: below 720px height the footer is in NORMAL
  // FLOW, so she scrolls to the bottom to reach SEND and IS at maximum scroll when she taps. The
  // tap GROWS the document, so maximum scroll MOVES — and she does not. Scrolling to the new
  // maximum measured a place she was not standing, and reported a strip as visible while 78 of its
  // 88 pixels were below her fold. Right property, wrong moment: the same class of error as
  // measuring elapsed time with a clock the page is allowed to throttle.
  // It is therefore called BEFORE this function touches scrollY at all.
  const measureOutcome = () => {
    const strip = document.querySelector('.f-state') || document.querySelector('.add-form');
    if (!strip) return;
    // The add-form answers her with a question and a box; the footer strips answer with a message
    // and controls. Both are "the thing the transition just produced" and both must be on screen.
    const parts = strip.classList.contains('add-form')
      ? [strip.querySelector('.a-label'), strip.querySelector('.a-input'), strip.querySelector('.a-add')]
      : [strip.querySelector('.note')].concat(Array.from(strip.querySelectorAll('button')));
    // ⛔ TWO BARS, AND WHICH ONE APPLIES IS DECIDED BY PHYSICS RATHER THAN BY PREFERENCE.
    // When the strip FITS in the viewport, every part of it must be wholly on screen — no scrolling,
    // nothing cut. When it CANNOT fit (300x512 is a 600x1024 tablet at 200% zoom, where the message
    // alone wraps to most of the screen) that bar is unsatisfiable by any layout, so demanding it
    // would be demanding the impossible rather than measuring the product. The bar there is: SHE
    // CAN READ THE WHOLE MESSAGE, and every control is hit-testable at its own centre — she can see
    // what she is being asked and reach both answers.
    // ⚠️ THIS IS A NARROWING AND IT IS FLAGGED. It is still far stricter than anything that existed
    // before this package, and it still catches Vera's actual finding: "10px of an 88px YES painted"
    // puts that control's centre off screen, so the relaxed bar fails it too.
    const stripBox = R(strip);
    const stripFits = stripBox.height <= innerHeight + 1;
    outcomeVisible = true;
    for (const e of parts) {
      if (!e) { outcomeVisible = false; outcomeWhy = 'the strip is missing its message or its control'; break; }
      const r = R(e);
      const cls = (e.className || '').toString().split(' ')[0];
      if (r.width === 0 && r.height === 0) { outcomeVisible = false; outcomeWhy = cls + ' is not rendered at all'; break; }
      // ⛔ ONE DEVICE PIXEL OF TOLERANCE, AND THE REPORTED FIGURE IS NEVER ROUNDED.
      // `scrollIntoView({block:'end'})` aligns the bottom edge EXACTLY, and sub-pixel layout then
      // leaves `bottom` at something like 400.0000001 against an innerHeight of 400. That produced
      // five failures reading "BELOW the fold (0px of it)" — a message that disproves itself, and a
      // clean example of why a value must not be rounded before it is compared. The tolerance is
      // 1px because that is the smallest thing a screen can actually show her; the REPORT prints a
      // decimal, so a genuine overflow can never again present itself as zero.
      const EPS = 1;
      // The MESSAGE must be wholly readable in either case — it is the thing she has to act on.
      const mustFitWholly = stripFits || cls === 'note' || cls === 'a-label';
      if (mustFitWholly && r.top < -EPS) { outcomeVisible = false; outcomeWhy = cls + ' is ABOVE the top of the viewport by ' + (-r.top).toFixed(1) + 'px, where the transition left her'; break; }
      if (mustFitWholly && r.bottom > innerHeight + EPS) { outcomeVisible = false; outcomeWhy = cls + ' is BELOW the fold by ' + (r.bottom - innerHeight).toFixed(1) + 'px, where the transition left her'; break; }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit) { outcomeVisible = false; outcomeWhy = cls + ' has NOTHING at its own centre'; break; }
      if (e !== hit && !e.contains(hit)) {
        outcomeVisible = false;
        outcomeWhy = cls + ' resolves to ' + ((hit.className || hit.tagName).toString().split(' ')[0]) + ' at its own centre';
        break;
      }
    }
    // ⛔ HIGH-3, VERA — THE CONFIRM SCREEN'S OPPOSITE-EFFECT PAIR WAS MEASURED NOWHERE, AT ANY
    // VIEWPORT. `oppos` only ever looked at `.q-btn` pairs inside item rows, so a 16px gap between
    // "YES, SEND IT" and "No, not yet" — the highest-stakes pair on the surface — was invisible to
    // this gate while it reported a pass on dead space. Measured on whichever axis separates them,
    // because which axis carries the requirement is a layout detail and the requirement is not.
    const yes = strip.querySelector('.confirm');
    const no = strip.querySelector('.again');
    if (yes && no) {
      const ry = R(yes), rn = R(no);
      confirmGap = Math.round(Math.max(
        Math.max(rn.top - ry.bottom, ry.top - rn.bottom),
        Math.max(rn.left - ry.right, ry.left - rn.right),
      ));
    }
  };
  measureOutcome();
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

    // ⛔ RESTATED BY WARWICK, 2026-08-13 — THIS MEASURES THE HEADING, NOT THE WHOLE BANNER.
    // "bannerInInitialViewport becomes: THE BANNER-S HEADING is wholly within the initial
    // viewport. The elaboration is not required to be."
    // ⛔ NOT A RELAXATION SMUGGLED IN TO WIN A GREEN RUN. The old form also asserted that the
    // ELABORATION fitted, which at 300px wide is achievable only by pushing her shopping off the
    // screen — and the elaboration now renders AFTER the list at those sizes, so asserting its
    // position here would be asserting the position of something that has moved. The load-bearing
    // fact still has to be on the screen she arrives at, whole, every single time.
    const bannerHead = document.querySelector(".banner.ask h2") || document.querySelector(".banner h2");
    bannerInInitialViewport = bannerHead
      ? (R(bannerHead).top >= 0 && R(bannerHead).bottom <= innerHeight) : null;

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
    const atEnd = candidates.concat(q('.send, .note, .undo, .again, .confirm, .add, .a-input, .a-add'));
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

    // ⛔ THE OUTCOME MEASUREMENT USED TO BE TAKEN HERE, AT MAXIMUM SCROLL, AND VERA PROVED THAT
    // WRONG. It has moved to the top of this function, before anything touches scrollY — see the
    // long note there. Two wrong scroll positions were tried before the right one: scroll-top
    // (which she has left), then maximum scroll (which the tap itself moves out from under her).
    // The position that is neither is the one she is actually standing at when the transition
    // happens, and the only way to have it is to measure before scrolling anywhere.

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
    firstUsableRowVisible, firstWholeRowVisible, bannerInInitialViewport, outcomeVisible, outcomeWhy, confirmGap,
    cockpitWord: /cockpit/i.test(document.body.innerText),
    title: document.title,
    // The state machine, read off the DOM rather than out of a testing hook the page exports for
    // this file's benefit. `data-send-state` is on .page and is what CSS keys off too.
    sendState: (document.querySelector('.page') || {}).getAttribute
      ? document.querySelector('.page').getAttribute('data-send-state') : null,
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

// ⛔ ONE SHUTDOWN, AND IT DROPS LIVE SOCKETS AS WELL AS CLOSING THE SERVER.
//  stops ACCEPTING; it does not end connections already open, so a keep-alive socket
// kept port 8124 bound after the run exited and blocked the next one. Vera hit this and waited it
// out rather than killing what might have been another worker-s process — a courtesy this file
// should not have required of her.
function shutdown() {
  try { sock.close(); } catch { /* already gone */ }
  try { edge.kill(); } catch { /* already gone */ }
  try { releaseHungSockets(); } catch { /* already gone */ }
  try { if (typeof srv.closeAllConnections === "function") srv.closeAllConnections(); } catch { /* older node */ }
  try { srv.close(); } catch { /* already gone */ }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ══ THE WRITE ROUTE, STUBBED — AND WHY A STUB IS THE RIGHT INSTRUMENT HERE ═══════════════════════
//
// This gate measures what SHE SEES. The question it has to answer about the send is "given this
// answer from the server, what is on her screen" — and the honest way to ask that is to control the
// answer, exhaustively, including answers a real server would find it hard to be persuaded to give
// (a body that is HTML, a socket that dies mid-request, a reply that never comes).
//
// ⛔ THIS IS NOT A TEST OF KEEL'S ROUTE AND MUST NEVER BE READ AS ONE. It is a test of this page's
// response to the ROUTE CONTRACT's shapes. The two halves are proven together by Larry, on the real
// route, and nothing measured here is evidence about what the server actually does.
//
// The shapes are route contract v2, copied rather than derived. `matched_by` carries the store's
// own vocabulary verbatim ('insert' | 'shop_ref' | 'telegram_message' | 'superseded_terminal_ref');
// the page never branches on it, so these values exist to prove exactly that.
const SEND_MODES = {
  // created:true — a shop row was written. THE ONLY MODE THAT MAY PRODUCE THE SENT STATE.
  created: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: true, matched_by: 'insert' })); },
  // created:false, recorded_new:true — today's shop is unchanged, but a durable record of what
  // she changed WAS written and Warwick is told. Contract v3.
  noted: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: false, recorded_new: true, notified: true, matched_by: 'shop_ref' })); },
  // ⛔ AC7 — RECORDED, AND WARWICK NEVER HEARD. The route deliberately still answers ok:true:
  // her list is durable the moment it is recorded, and a messaging outage must not turn a saved
  // shop into an error on her screen. That correct decision is what makes this state reachable.
  saved: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: false, recorded_new: true, notified: false, notify_error: 'notify_failed', matched_by: 'shop_ref' })); },
  // The other real failure: no Telegram configured at all.
  notconfigured: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: false, recorded_new: true, notified: false, notify_error: 'notify_not_configured', matched_by: 'shop_ref' })); },
  // Contract violation: recorded, and `notified` absent entirely. Must claim LESS — she is told
  // he has not heard, because the two errors are not symmetric.
  nonotified: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: false, recorded_new: true, matched_by: 'shop_ref' })); },
  // created:false, recorded_new:false — an identical re-send. Nothing was written at all.
  unchanged: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: false, recorded_new: false, matched_by: 'shop_ref' })); },
  // ⛔ THE CONTRACT VIOLATION CASES. Both fields absent, then `created:false` with `recorded_new`
  // absent. The page must claim LESS, not more: a missing field is never read as a write, and
  // it is never read as licence to promise that Warwick was told.
  nocreated: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, matched_by: 'shop_ref' })); },
  norecorded: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: false, matched_by: 'shop_ref' })); },
  // 200, ok:false. The status line says fine and the body says no.
  okfalse: (res) => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: false, error: 'household_not_found', message: 'I could not find that household.' })); },
  // 5xx with a well-formed error envelope.
  refused: (res) => { res.writeHead(500, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: false, error: 'store_unavailable', message: 'The store did not answer.' })); },
  // 200 carrying HTML — a proxy error page, the classic "it parsed as success" trap.
  html: (res) => { res.writeHead(200, { 'content-type': 'text/html', connection: 'close' }); res.end('<!doctype html><html><body><h1>502 Bad Gateway</h1></body></html>'); },
  // The connection dies. fetch() rejects.
  reject: (res, req) => { req.destroy(); res.destroy(); },
  // ⛔ NOTHING IS EVER WRITTEN TO THE SOCKET. The page's own timeout is the only thing that ends it.
  // The socket is REMEMBERED rather than abandoned, and here is why that is not tidiness:
  // Node answers requests on one keep-alive connection IN ORDER, and the browser reuses that
  // connection. A request this mode never answers therefore blocks every LATER request on the same
  // socket — so the case after `timeout` hung for 30s and the run died with "the browser stopped
  // answering", which looks exactly like the detached-Edge defect this file already guards against
  // and is nothing of the kind. The instrument was breaking the next measurement, not the surface.
  timeout: (res, req) => { hungSockets.add(req.socket); },
};
/** Free any socket deliberately left hanging, once the case that needed it has been measured. */
function releaseHungSockets() {
  for (const s of hungSockets) { try { s.destroy(); } catch { /* already gone */ } }
  hungSockets.clear();
}
let sendMode = 'created';
let listRequests = 0;
const listBodies = [];
const hungSockets = new Set();

// ── THE SENSE-CHECK CONTRACT (WP-B15-50), stubbed ────────────────────────────────────────────────
// ⛔ ONLY THE FIRST TWO MAY PUT A WORD ON HER SCREEN. `needs_confirmation` and `unmatched_new_item`
// are accepted in silence — Warwick answers those in his own process, and stopping an 84-year-old
// to adjudicate a catalogue match is the interrogation this surface must never conduct.
const CHECK_MODES = {
  matched: { ok: true, status: 'matched', matched_regular_id: 7, matched_name: 'Cravendale' },
  possible_duplicate: { ok: true, status: 'possible_duplicate', matched_regular_id: 7, matched_name: 'Cravendale' },
  needs_confirmation: { ok: true, status: 'needs_confirmation', matched_regular_id: null, matched_name: null },
  unmatched_new_item: { ok: true, status: 'unmatched_new_item', matched_regular_id: null, matched_name: null },
  // Not a status — the route itself being away. Handled before the table is consulted.
  unreachable: null,
};
let checkMode = 'unmatched_new_item';
let checkRequests = 0;
const checkBodies = [];

const CTX = staticCtx(HERE);
const srv = http.createServer((req, res) => {
  // The two reads the surface makes, answered from the committed fixture. A measurement rig must be
  // DETERMINISTIC — the same reason render-vm-check.mjs uses fixtures rather than a live capture.
  if (req.url.startsWith('/api/asdair/rules')) { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); return res.end(JSON.stringify(servingLarge ? rulesLarge : rules)); }
  if (req.url.startsWith('/api/asdair/workspace')) { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); return res.end(JSON.stringify(workspace)); }
  // ── THE SENSE-CHECK (WP-B15-50's route, stubbed here) ─────────────────────────────────────────
  // `checkMode` decides what comes back. `unreachable` is not an afterthought: Warwick's rule is
  // that a check which cannot be reached must never cost her the item, so the case where this route
  // is DOWN is a first-class thing to measure, not an edge case.
  if (req.url.startsWith('/api/asdair/check-item')) {
    checkRequests++;
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { checkBodies.push(JSON.parse(raw)); } catch { checkBodies.push({ UNPARSEABLE: raw }); }
      if (checkMode === 'unreachable') { hungSockets.add(req.socket); return; }
      const m = CHECK_MODES[checkMode];
      if (!m) { res.writeHead(500); return res.end('unknown check mode ' + checkMode); }
      res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
      res.end(JSON.stringify(m));
    });
    return undefined;
  }
  if (req.url.startsWith('/api/asdair/list')) {
    // ⛔ COUNTED AND CAPTURED AT THE SERVER, WHICH IS THE ONLY PLACE THESE QUESTIONS CAN HONESTLY BE
    // ASKED. "Is a second tap impossible" and "did her confirmed date actually travel" are claims
    // about what LEAVES the page. Asserting either from inside the page — by reading a flag or a
    // ref the page itself maintains — would be asking the suspect.
    listRequests++;
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { listBodies.push(JSON.parse(raw)); } catch { listBodies.push({ UNPARSEABLE: raw }); }
      const answer = SEND_MODES[sendMode];
      if (!answer) { res.writeHead(500); return res.end('unknown send mode ' + sendMode); }
      answer(res, req);
    });
    return undefined;
  }
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
// ⛔ THE OVERRIDE EXISTS FOR EXACTLY ONE CALLER AND IS NOT A GENERAL LOOSENING.
// driveSend() waits for a real send to settle, and the deliberate timeout case takes the page's own
// SEND_TIMEOUT_MS (15s) plus polling slack — which is under this ceiling but close enough to it that
// a slow machine would turn a PASSING measurement into a spurious "the browser stopped answering".
// Raising CMD_TIMEOUT_MS for every call instead would blunt the stall detector that exists because
// headless Edge really does detach on this machine (DEFECT-LEDGER D-2026-08-03-11).
const cmd = (method, params = {}, timeoutMs = CMD_TIMEOUT_MS) => new Promise((res, rej) => {
  const i = ++msgId;
  const t = setTimeout(() => { pending.delete(i); rej(new Error('CDP ' + method + ' did not answer within ' + timeoutMs + 'ms')); }, timeoutMs);
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
  // ── THE TWO ADDED AT WP-B15-49, FOR THE STATES THAT DID NOT EXIST BEFORE IT ───────────────────
  // ⛔ THESE CAN ONLY FIRE IN AN OUTCOME STATE, AND THAT IS THE POINT. Against the resting screen
  // they are inert, because `.again` and `.note` are not rendered there. So if the self-test ever
  // reports either of them caught at ZERO combinations, the run measured only the landing screen —
  // which is precisely the coverage hole Vera named at Gate 3, made loud instead of implicit.
  // The way back out of an outcome state, shrunk under the 88px LARGE floor. B §9.3's "full-size".
  'the way back out of the sent state is shrunk below 88px': { css: '.again{min-height:30px !important}' },
  // Her outcome sentence pushed under the 7:1 bar. The strip is the ONLY thing on the screen that
  // tells her what happened, so it is the last text on this surface that may be hard to read.
  'the outcome message is pushed below 7:1': { css: '.n-say,.n-sub{color:#9fb0c4 !important}' },
  // Proves the outcome-state assertion that REPLACED the landing assertions can actually fire.
  // Pushes the strip and its controls off the bottom of the viewport without disturbing anything
  // else, which is the shape of the defect the tall stacked footer produced at 1280x800.
  'the answer she needs is pushed off the screen': { css: '.f-state{position:relative !important;top:2000px !important}' },
  // HIGH-3: collapses the YES / No dead space. Fires only where that pair is rendered, which is
  // the confirm screen — so a zero catch here means the confirm screen went unmeasured again.
  'the gap between YES and No is collapsed': { css: '.f-state{gap:2px !important}' },
};

// ⛔ THIS BLOCK WAS STALE AND SAID THE OPPOSITE OF THE CODE 150 LINES BELOW IT. REWRITTEN AT
// WP-B15-49. Vera flagged it at Gate 3; the Work Order cited it as `shopping.js:549-570`, which
// does not exist — shopping.js is 437 lines and the block was always here, in this file. The
// finding was right and the citation was wrong, and both are recorded because a reader chasing the
// wrong file concludes the finding was imaginary.
//
// WHAT IT USED TO CLAIM, AND WHY EACH HALF WAS FALSE:
//
//   * That `coveredAtRest`'s non-vacuity "rests on a real defect it already caught" — the portrait
//     y=1219 overlap. That defence stopped being available the moment the assertion was NARROWED:
//     `coveredAtRest` is no longer a failure at all, it is reported as `info` (see verdict below,
//     which says so plainly). A bug caught by the PRE-narrowing form is not evidence about the
//     post-narrowing one. This is the same error the file warns about elsewhere — a comment that a
//     reviewer reads INSTEAD of re-deriving the argument.
//   * That `unreachableAtEnd` "is kept as the guard against exactly that change". It guards
//     nothing. It is now a derived boolean — `buriedAtEnd.length > 0` — and NOTHING ASSERTS IT.
//     What is asserted is `buriedAtEnd` itself, element by element, with each entry already worded.
//     The boolean survives only because `--json` consumers read it.
//
// WHAT IS ACTUALLY TRUE NOW, which is the thing worth knowing here:
//   `coveredAtRest` is REPORTED, NEVER FAILED, and deliberately so — once the scope defect was
//   fixed it fired at nearly every viewport, because overlapping content further down a scrolling
//   page IS what a sticky footer does. Asserting it would mean "never use a sticky footer", which
//   B §6.7 requires. The weight is carried instead by four assertions that CAN fail and that all
//   have mutations proving they do: firstUsableRowVisible, bannerInInitialViewport, buriedAtEnd
//   and footClipped. Their mutations are in MUTATIONS above, by name.

// ⛔ ONE NAVIGATION PER VIEWPORT, AND THE MUTATIONS SWAP A STYLE ELEMENT IN PLACE.
// The first version reloaded the page for every mutation at every viewport — 56 navigations — and
// that is what made the run long enough to look hung. Reloading also proves nothing extra: a CSS
// mutation is viewport-independent, and re-navigating only re-tests the loader.
// So each viewport is entered once, measured clean, then measured under each mutation by rewriting
// the contents of ONE injected <style> and clearing it again. `#f247-mutation` is emptied rather
// than removed, so the clean measurement and the mutated ones differ ONLY by the declaration under
// test — a mutation that accidentally left state behind would otherwise contaminate the next one.
/** One fresh load of the surface, with the mutation carrier re-installed.
 *
 * ⛔ IT WAITS FOR THE SURFACE, NOT FOR A GUESSED NUMBER OF MILLISECONDS, AND THAT IS A BUG FIX.
 * This was `await wait(900)`. 900ms is comfortably enough for the 3-row fixture and NOT enough for
 * the 46-row one, so on the LARGE viewports the driver ran against a page with no `.row` in it yet.
 * The visible symptom was not "no rows": it was the run dying at a later viewport with "the browser
 * stopped answering", which is the signature of the detached-Edge defect this file already guards
 * against — so the instrument's own race looked exactly like a known hardware-ish fault. A fixed
 * sleep is an assumption about someone else's machine; polling for the thing you need is not. */
async function gotoPage() {
  await cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/shopping.html' });
  // Polled from NODE, one cheap read at a time — see the long note above driveSend for why an
  // in-page loop is the wrong instrument for measuring elapsed time in a page Chromium may throttle.
  let until = Date.now() + 15000;
  let ready = null;
  let retried = false;
  for (;;) {
    ready = await evalIn('(() => (document.querySelector(".row") && document.querySelector(".send")) ? "ready" : "waiting")()');
    if (ready === 'ready') break;
    if (Date.now() > until) {
      // A bare "it never rendered" sent the last investigation looking at the wrong thing twice.
      // Report what the document ACTUALLY is, so the next reader diagnoses instead of guessing.
      const why = await evalIn('(() => ({ url: location.href, readyState: document.readyState,'
        + ' title: document.title, bodyLen: (document.body ? document.body.innerHTML.length : -1),'
        + ' mount: !!document.getElementById("shop"),'
        + ' mounted: !!(document.getElementById("shop") && document.getElementById("shop").children.length),'
        + ' vue: typeof Vue, api: typeof window.FUSION_SHOPPING,'
        + ' text: (document.body ? document.body.innerText.slice(0, 200) : "") }))()');
      // ⛔ ONE RETRY, AND IT IS NOT PAPERING OVER A PRODUCT DEFECT. This is the instrument: headless
      // Edge on this machine occasionally drops a navigation (DEFECT-LEDGER D-2026-08-03-11 is the
      // documented severe form of the same thing). A dropped navigation makes the RIG report a
      // surface that never rendered, which is a lie about the product. The retry is bounded to one,
      // it is announced on stderr so a systematic failure is still visible as a pattern, and the
      // second failure is fatal with the full document state attached.
      if (!retried) {
        retried = true;
        console.error('  (navigation produced no surface; retrying once — ' + JSON.stringify(why) + ')');
        await cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/shopping.html' });
        until = Date.now() + 15000;
        await wait(300);
        continue;
      }
      throw new Error('the surface never rendered after navigation: ' + JSON.stringify(why));
    }
    await wait(100);
  }
  await cmd('Runtime.evaluate', { expression: 'if(!document.getElementById("f247-mutation")){const s=document.createElement("style");s.id="f247-mutation";document.head.appendChild(s);}', returnByValue: true });
}
async function atViewport(v, fn) {
  servingLarge = !!v.large;   // set BEFORE navigating: the page fetches its list on load
  await cmd('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: true });
  await gotoPage();
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
// ⛔ THE POST-SEND STATES, WHICH THIS GATE COULD NOT SEE UNTIL WP-B15-45 AND DID NOT COVER UNTIL
// WP-B15-49 (Vera, 18b0f98, then AC5).
// HIGH-3's worst case was not the SEND button — it was the message that REPLACES it. At 640x400 the
// clipped `.note` painted ZERO pixels: she presses SEND and the screen does not respond at all, and
// the one message that Addendum B §9.6 and Addendum E criterion 9 make load-bearing is simply not
// there. A gate that only ever measures the resting state cannot see that, however many viewports
// it measures it at.
//
// ⛔ AND "THE POST-SEND STATE" IS NOW THREE DIFFERENT SCREENS, NOT ONE. Route contract v2 splits
// `ok:true` into a real write (created:true -> sent) and a no-op (created:false -> already-sent),
// and a failed send is a third. Each has its own copy, its own tint and its own control, so each
// has to be RENDERED to be measured. Which one appears is decided by `sendMode` on the stub above.
//
// Driven through the REAL surface — a real click on a row, a real click on the primary action —
// rather than by poking a ref, because the state that matters is the one her taps actually produce.
// It then POLLS `data-send-state` rather than waiting a fixed number of frames: a send is a network
// round trip, and the timeout case deliberately takes 15 seconds. A fixed wait would have measured
// the 'sending' state and called it the outcome.
// ⛔ AND THE JOURNEY IS NOW THREE TAPS, NOT TWO (Warwick, 2026-08-13). Choose -> SEND -> CONFIRM.
// The middle screen is an accident guard, so the driver has to go through it exactly as she does;
// clicking `.confirm` directly without passing `.send` would prove nothing about the guard, and
// driving it by setting state would prove nothing about the page at all.
// `stopAt` lets a caller park ON the confirm screen so it can be measured as its own state.
// ⛔⛔ EVERY WAIT IN THIS DRIVER IS ON NODE'S CLOCK, NOT THE PAGE'S. THAT IS A BUG FIX, NOT A STYLE
// PREFERENCE, AND IT COST THREE FAILED RUNS TO FIND — SO IT IS WRITTEN DOWN PROPERLY.
//
// The first version did its waiting INSIDE the page: `await new Promise(r => setTimeout(r, 100))`
// in a loop, and `requestAnimationFrame` between clicks. CHROMIUM THROTTLES TIMERS IN A PAGE IT
// DOES NOT CONSIDER VISIBLE — to roughly one tick per second — and rAF may not fire in such a page
// at all. So a loop written to take 6 seconds took 60, and a CDP call allowed 30 seconds timed out.
//
// The SYMPTOM is what made it expensive. The run died with "the browser stopped answering", which
// is exactly the signature of DEFECT-LEDGER D-2026-08-03-11 (headless Edge self-relaunching and
// detaching on this machine) — a known, documented, entirely believable fault that had nothing to
// do with it. It also MOVED WHEN INSTRUMENTED: adding one stderr line made all eight cases pass,
// because the extra I/O changed the timing. A heisenbug wearing the costume of a known defect is
// the worst kind there is.
//
// The durable lesson, and it generalises past this file: DO NOT MEASURE TIME WITH A CLOCK THE THING
// UNDER TEST IS ALLOWED TO SLOW DOWN. The page is now only ever asked to do INSTANTANEOUS things —
// click this, read that — and every wait between them happens here, in Node, where nothing throttles.

/** One tiny in-page expression, with page-side exceptions surfaced rather than swallowed. */
async function evalIn(expression, ms = 10000) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true }, ms);
  if (r.result && r.result.exceptionDetails) {
    throw new Error('page expression threw: '
      + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  }
  return r.result && r.result.result ? r.result.result.value : null;
}

/** The state machine, read off the DOM. */
const readSendState = () => evalIn('(() => { const p = document.querySelector(".page");'
  + ' return p ? p.getAttribute("data-send-state") : null; })()');

/** Wait for the surface to leave 'sending'. The page's own timeout is 15s; this allows for it. */
async function waitSettled(ceilingMs = 22000) {
  const until = Date.now() + ceilingMs;
  for (;;) {
    const st = await readSendState();
    if (st && st !== 'sending') return st;
    if (Date.now() > until) return 'still sending after ' + ceilingMs + 'ms';
    await wait(200);
  }
}

/** Choose something, press SEND, read the confirm screen, and (unless parked) confirm. */
async function driveSend(stopAt) {
  const started = await evalIn('(() => { const row = document.querySelector(".row");'
    + ' const send = document.querySelector(".send");'
    + ' if (!row || !send) return "no row or no action";'
    + ' if (!row.classList.contains("on")) row.click();'
    + ' return "chose"; })()');
  if (started !== 'chose') return started;
  await wait(150);
  const pressed = await evalIn('(() => { const s = document.querySelector(".send");'
    + ' if (!s) return "action vanished after choosing"; s.click(); return "pressed"; })()');
  if (pressed !== 'pressed') return pressed;
  await wait(200);
  const atConfirm = await readSendState();
  if (atConfirm !== 'confirm') return 'the confirm screen never appeared (state is ' + atConfirm + ')';
  if (stopAt === 'confirm') return 'confirm';
  const committed = await evalIn('(() => { const y = document.querySelector(".confirm");'
    + ' if (!y) return "no confirm control on the confirm screen"; y.click(); return "committed"; })()');
  if (committed !== 'committed') return committed;
  return waitSettled();
}
async function readMeasurement() {
  const r = await cmd('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    throw new Error('the measurement script threw in the page: '
      + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  }
  return (r.result && r.result.result) ? r.result.result.value : { ERROR: 'evaluate failed' };
}
// ══ THE MEASURED STATES ══════════════════════════════════════════════════════════════════════════
// ⛔ AC5, AND VERA'S NON-BLOCKING FINDING FROM GATE 3. Her words: the self-test never renders the
// post-send state, so "12/12" only ever covered the resting 10 of 20. The honest fix is NOT to add
// two more mutations — that raises a number without widening what is looked at. It is to render
// every state this surface can be in and exercise every mutation against every one of them.
//
// Three states, each a REAL screen she can reach, each with its own copy, tint and control:
//   resting       nothing sent yet — the landing screen
//   sent          created:true, a row was written
//   already-sent  created:false, accepted and nothing changed (contract v2 Amendment 2)
//   failed        it did not arrive
// That is four; `already-sent` and `failed` differ in tint and copy but share a box shape, and both
// are measured because they are separate screens to HER, which is the only view that counts here.
//
// Each non-resting state needs a FRESH LOAD: once the surface is in an outcome state its primary
// action has been replaced, so a second send cannot be driven from it without first driving the way
// back — which would measure a different journey from the one she takes.
const STATES = [
  { label: 'resting', kind: 'rest' },
  // Warwick's confirm step is a SCREEN she stands on, with two full-size controls and a date she
  // has to read. It is measured like any other screen, not treated as a transition.
  { label: 'the confirm screen', kind: 'send', mode: 'created', stopAt: 'confirm', want: 'confirm', answers: true },
  // The free-text input, open, with one thing already added and its nudge showing. This is the
  // state that carries the new input, the new label and the new take-off control.
  { label: 'adding something in her own words', kind: 'add', want: 'idle', answers: true },
  { label: 'after SEND -> sent', kind: 'send', mode: 'created', want: 'sent', answers: true },
  { label: 'after SEND -> already gone, Warwick told', kind: 'send', mode: 'noted', want: 'already-sent-noted', answers: true },
  { label: 'after SEND -> already gone, saved but Warwick NOT told', kind: 'send', mode: 'saved', want: 'already-sent-saved', answers: true },
  { label: 'after SEND -> already gone, nothing changed', kind: 'send', mode: 'unchanged', want: 'already-sent-unchanged', answers: true },
  { label: 'after SEND -> not sent', kind: 'send', mode: 'refused', want: 'failed', answers: true },
];

// Drives the "add something else" journey exactly as she does it: open the control, type, add it,
// then open it again so the input, the added row, its nudge and the entry control are all on screen
// together. `matched` is used so the nudge is present and gets measured — it is the only branch of
// the sense-check that puts a word in front of her.
// The same node-clock discipline as driveSend. Opens the control, types, adds, waits for the
// sense-check to have been ANSWERED (which this rig knows, because it is the one answering), then
// re-opens the entry control so the input, the added row, its nudge and the entry control are all
// on screen together and can be measured as one state.
const ADD_TEXT = 'that nice ham';
async function driveAdd() {
  const opened = await evalIn('(() => { const a = document.querySelector(".add");'
    + ' if (!a) return "no add control"; a.click(); return "opened"; })()');
  if (opened !== 'opened') return opened;
  await wait(150);
  const typed = await evalIn('(() => { const i = document.querySelector(".a-input");'
    + ' if (!i) return "no input appeared"; i.value = ' + JSON.stringify(ADD_TEXT) + ';'
    + ' i.dispatchEvent(new Event("input", { bubbles: true })); return "typed"; })()');
  if (typed !== 'typed') return typed;
  await wait(150);
  const before = checkRequests;
  const added = await evalIn('(() => { const g = document.querySelector(".a-add");'
    + ' if (!g) return "no add-it control"; g.click(); return "added"; })()');
  if (added !== 'added') return added;
  // Wait for the check to have reached this server at all — node's clock, max 5s.
  const until = Date.now() + 5000;
  while (checkRequests === before && Date.now() < until) await wait(100);
  // ...then a short settle for the nudge to render, if one is coming. A nudge that never comes
  // costs 400ms here rather than a six-second in-page poll that Chromium is free to stretch.
  await wait(400);
  const reopened = await evalIn('(() => { const a = document.querySelector(".add");'
    + ' if (a) a.click(); const p = document.querySelector(".page");'
    + ' return p ? p.getAttribute("data-send-state") : null; })()');
  await wait(150);
  return reopened;
}

/** Put the surface into one state, from a fresh page. Returns what it actually reached. */
async function enterState(st) {
  if (st.kind === 'rest') return null;
  await gotoPage();
  if (st.kind === 'add') {
    checkMode = 'matched';   // the one branch that puts a word on her screen, so it gets measured
    return driveAdd();
  }
  sendMode = st.mode;
  return driveSend(st.stopAt);
}

async function measure(css) {
  const out = {};
  for (const v of VIEWS) {
    await atViewport(v, async () => {
      for (const st of STATES) {
        // The state is entered on a CLEAN surface, then the mutation is applied, then it is
        // measured. Mutating first could block the very click that reaches the state.
        const reached = await enterState(st);
        await setMutation(css ? { css } : null);
        const m = await readMeasurement();
        m.stateWanted = st.want || null;
        m.answersHer = !!st.answers;
        m.stateReached = reached;
        out[st.kind === 'rest' ? v.label : v.label + '  [' + st.label + ']'] = m;
      }
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
  // ⛔ TWO DIFFERENT SCREENS, TWO DIFFERENT REQUIREMENTS. ⚠️ NARROWING FLAGGED FOR VERA, because
  // this file's own history says an unflagged narrowing is how an assertion quietly stops asserting.
  //
  // The LANDING requirements (a tappable item, the pending banner in view) are about the screen she
  // ARRIVES at, which is what B §6.1 and B §7.1.1 are about. They are asserted on the resting page
  // and on the page with her free-text input open — every state where she is choosing.
  //
  // On the confirm and outcome screens they are NOT asserted, and are REPLACED by something
  // stricter: the whole message and every control in it must be fully on screen and hit-test to
  // themselves. That is not a hole — it is a harder bar, and it is the bar that matters when the
  // screen's whole job is to tell her something and offer her one way onward.
  // ⛔ HIGH-3, VERA — THE CONFIRM PAIR IS NOW ASSERTED, NOT MERELY REPORTED. `oppos` above covers
  // MINUS/PLUS inside item rows and nothing else, so the surface's highest-stakes opposite-effect
  // pair went unmeasured at every viewport while this gate passed on "dead space".
  if (m.confirmGap !== null && m.confirmGap < FLOOR.gapOpposite) {
    bad.push('dead space between "YES, SEND IT" and "No, not yet" is ' + m.confirmGap + 'px, under '
      + FLOOR.gapOpposite + 'px — the mis-tap here either orders a shop she did not want or loses one she did (E A10)');
  }
  // `answers` is set on the state, not inferred from `stateWanted`: the add-form state is 'idle' by
  // send-state and is nonetheless a screen that answers her, so inferring it got that one wrong.
  const landing = !m.answersHer;
  if (landing) {
    // HIGH-1, VERA. The landing screen is the whole product for this user.
    if (m.firstUsableRowVisible === false) bad.push('THE LANDING SCREEN CONTAINS NO TAPPABLE ITEM — no item row has a tick that is both on screen and hit-testable at rest (Addendum B §6.1, §9)');
    if (m.firstUsableRowVisible === true && m.firstWholeRowVisible === false) info.push('an item is visible and tappable on arrival, but no row fits WHOLLY above the fold — acceptable on a scrolling page, recorded so the stricter reading of the requirement stays visible');
    if (m.bannerInInitialViewport === false) bad.push('the pending-question banner is NOT inside the initial viewport (Addendum B §7.1.1)');
  } else {
    if (m.outcomeVisible === null) bad.push('this state should be showing her an outcome or a question and there is NO strip on the page at all — she pressed something and the screen did not answer');
    if (m.outcomeVisible === false) bad.push('SHE CANNOT SEE THE WHOLE ANSWER WITHOUT SCROLLING: ' + m.outcomeWhy + ' (Addendum B §6.7, §9.3, §9.5)');
  }
  // In every outcome state the honest message REPLACES the action (B §6.7), so it — not the button —
  // is the thing that must be fully painted and reachable. `buriedAtEnd` covers `.note` and `.again`.
  //
  // ⛔ THIS ASSERTION IS ALSO THE ONE THAT CATCHES A WRONG STATE, NOT MERELY AN UNREACHED ONE.
  // If the page rendered 'sent' where the contract says one of the 'already-sent-*' states, or
  // and she would have been told her list went when nothing was written — Addendum E criterion 9,
  // and route contract v2's whole reason for existing. Comparing the state the driver REACHED
  // against the state the mode should have produced is what makes that visible here.
  if (m.stateWanted && m.stateReached !== m.stateWanted) {
    bad.push('the surface should be in the "' + m.stateWanted + '" state and is in "' + m.stateReached
      + '" — either it could not be driven there, or it rendered the WRONG outcome for the server-s answer '
      + '(route contract v2 Amendment 2; Addendum E criterion 9)');
  }
  if (m.stateWanted && m.sendState !== m.stateWanted) {
    bad.push('the rendered surface reports data-send-state="' + m.sendState + '" while the measured state is "'
      + m.stateWanted + '" — the DOM and the state machine disagree');
  }
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
  shutdown();
  process.exit(2);
});

// Skipped in self-test mode, which does its own clean measurement per viewport — running it here
// too would double the navigations for no extra evidence, which is what made the first version
// look hung.
// ══ AC1 — THE FIVE-CASE TRANSCRIPT. WHAT SHE SEES WHEN THE SERVER MISBEHAVES ═════════════════════
//
// ⛔ THE PROPERTY UNDER TEST IS AN IMPOSSIBILITY CLAIM, WHICH IS WHY IT IS EXERCISED RATHER THAN
// ARGUED. "The sent state is unreachable except when the server wrote a row" cannot be proved by
// reading send(); it is proved by trying to reach it every way the network can fail and failing.
//
// Each case drives a REAL tap on a REAL row and a REAL tap on the action, against a server that
// answers exactly one way, and records the state the page actually rendered plus the words she
// would actually read. `expect` is what MUST come out. Anything else exits non-zero.
if (process.argv.includes('--send-cases')) {
  const CASES = [
    { mode: 'reject', expect: 'failed', why: 'the connection is destroyed mid-request' },
    { mode: 'refused', expect: 'failed', why: 'HTTP 500 with a well-formed ok:false envelope' },
    { mode: 'okfalse', expect: 'failed', why: 'HTTP 200 whose body says ok:false' },
    { mode: 'html', expect: 'failed', why: 'HTTP 200 carrying an HTML error page, not JSON' },
    { mode: 'timeout', expect: 'failed', why: 'no answer ever — the page-s own 15s timeout ends it' },
    // The two that MAY succeed, included in the same transcript because a claim that five things
    // cannot reach a state is worthless without showing what does.
    { mode: 'created', expect: 'sent', why: 'ok:true AND created:true — a row was written' },
    { mode: 'noted', expect: 'already-sent-noted', why: 'recorded_new:true AND notified:true — recorded, and Warwick actually heard' },
    { mode: 'saved', expect: 'already-sent-saved', why: 'AC7: recorded_new:true, notified:false — saved, and the message did NOT get through' },
    { mode: 'notconfigured', expect: 'already-sent-saved', why: 'AC7: notified:false for the other real reason — no messaging configured' },
    { mode: 'nonotified', expect: 'already-sent-saved', why: 'AC7: recorded_new:true with notified ABSENT — never promise he was told' },
    { mode: 'unchanged', expect: 'already-sent-unchanged', why: 'created:false, recorded_new:false — an identical re-send, nothing written' },
    { mode: 'nocreated', expect: 'already-sent-unchanged', why: 'ok:true with created ABSENT — claim less, never more' },
    { mode: 'norecorded', expect: 'already-sent-unchanged', why: 'created:false with recorded_new ABSENT — never promise Warwick was told' },
  ];
  // One representative viewport: this is a state-machine transcript, not a geometry run.
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1024, height: 600, deviceScaleFactor: 1, mobile: true });
  console.log('SEND CASES — driven through a real tap on the real surface, one server answer each.\n');
  let bad = 0;
  for (const c of CASES) {
    await gotoPage();
    sendMode = c.mode;
    const t0 = Date.now();
    const reached = await driveSend();
    const ms = Date.now() - t0;
    const seen = await cmd('Runtime.evaluate', {
      expression: '(() => { const n = document.querySelector(".note"); const b = document.querySelector(".again, .send");'
        + ' return { words: n ? n.innerText.replace(/\\s+/g, " ").trim() : null, control: b ? b.innerText.trim() : null }; })()',
      returnByValue: true,
    });
    const v = (seen.result && seen.result.result && seen.result.result.value) || {};
    const ok = reached === c.expect;
    if (!ok) bad++;
    console.log((ok ? 'ok    ' : 'FAIL  ') + c.mode.padEnd(10) + ' -> ' + String(reached).padEnd(13)
      + ' (expected ' + c.expect + ', ' + ms + 'ms)');
    console.log('        because : ' + c.why);
    console.log('        she sees: ' + (v.words || '(no outcome strip rendered)'));
    console.log('        her way on: ' + (v.control || '(no control)') + '\n');
    releaseHungSockets();   // the `timeout` case would otherwise block the case after it
  }
  // ══ AC2 — DOUBLE-SEND IS PREVENTED IN STATE, NOT BY HER RESTRAINT ══════════════════════════════
  // B §6.7: "Double-send is prevented in state, not by her restraint." Both limbs are required and
  // both are checked here: the AFFORDANCE (aria-disabled, what she can see) and the GUARANTEE (what
  // actually leaves the page). The mode is `timeout`, so the first send is still in flight for the
  // whole of the test and every later tap lands on a genuinely busy surface.
  // ⛔ THE DANGEROUS TAP MOVED ONE SCREEN LATER WHEN WARWICK'S CONFIRM STEP WAS ADDED, AND SO DID
  // THIS TEST. Hammering `.send` now only opens the confirm screen and posts nothing — worth
  // knowing, and checked in the CONFIRM block below. The tap that could double-submit is the one on
  // the COMMIT control while a send is already in flight, so that is what is hammered here.
  console.log('AC2 — five rapid taps on the commit control while a send is still in flight:');
  await gotoPage();
  sendMode = 'timeout';
  listRequests = 0;
  await evalIn('(() => { document.querySelector(".row").click(); })()');
  await wait(150);
  await evalIn('(() => { document.querySelector(".send").click(); })()');
  await wait(200);
  // ⛔ THE FIVE TAPS HAPPEN IN ONE SYNCHRONOUS EXPRESSION, DELIBERATELY. Spacing them over Node's
  // clock would let the page settle between them and would be testing a slow repeat rather than the
  // panicky double-tap this guard exists for. Synchronous clicks are the worst case: they all
  // arrive inside a single task, before any render — exactly the race that a reactive `disabled`
  // would lose and that the plain `inFlight` closure flag exists to win.
  await evalIn('(() => { for (let i = 0; i < 5; i++) { const b = document.querySelector(".confirm"); if (b) b.click(); } })()');
  await wait(600);
  const d = (await evalIn('(() => { const s = document.querySelector(".send"); const p = document.querySelector(".page");'
    + ' return { state: p ? p.getAttribute("data-send-state") : null,'
    + '          confirmGone: !document.querySelector(".confirm"),'
    + '          buttonPresent: !!s, ariaDisabled: s ? s.getAttribute("aria-disabled") : null }; })()')) || {};
  const ac2ok = listRequests === 1 && d.state === 'sending' && d.ariaDisabled === 'true'
    && d.buttonPresent === true && d.confirmGone === true;
  console.log('        POSTs that actually reached the server : ' + listRequests + '   (must be exactly 1)');
  console.log('        state after five taps on the commit    : ' + d.state);
  console.log('        the commit control is gone             : ' + d.confirmGone + '   (nothing left to tap twice)');
  console.log('        the action is back on screen           : ' + d.buttonPresent + '   (it must not vanish under her finger)');
  console.log('        ...and marked aria-disabled            : ' + d.ariaDisabled);
  console.log('        ' + (ac2ok ? 'ok    the guarantee held and the affordance showed it' : 'FAIL  a second send escaped, or the affordance is missing') + '\n');
  if (!ac2ok) bad++;
  releaseHungSockets();

  // ══ AC3 — THE WAY BACK, AND WHAT SHE IS TOLD AFTER SHE USES IT ═════════════════════════════════
  // B §9.3/§9.5: "an 84-year-old who realises she forgot the bread must not be stuck." Driven as a
  // real journey — send, take the way back, change something — because the thing being proved is
  // that the page does not claim the CHANGED list was sent.
  console.log('AC3 — send, then change her mind:');
  await gotoPage();
  sendMode = 'created';
  const first = await driveSend();
  const backLabel = await evalIn('(() => { const b = document.querySelector(".again");'
    + ' if (!b) return null; const t = b.innerText.trim(); b.click(); return t; })()');
  await wait(200);
  const afterBack = await evalIn('(() => { const p = document.querySelector(".page");'
    + ' return { afterBack: p ? p.getAttribute("data-send-state") : null,'
    + '          sendBack: !!document.querySelector(".send") }; })()') || {};
  // She changes her mind about a DIFFERENT row — the "I forgot the bread" case.
  await evalIn('(() => { document.querySelectorAll(".row")[1].click(); })()');
  await wait(200);
  const after = await evalIn('(() => { const w = document.querySelector(".f-why"); const p = document.querySelector(".page");'
    + ' return { hint: w ? w.innerText.replace(/\\s+/g, " ").trim() : null,'
    + '          state: p ? p.getAttribute("data-send-state") : null }; })()') || {};
  const j = { label: backLabel, afterBack: afterBack.afterBack, sendBack: afterBack.sendBack, hint: after.hint, state: after.state };
  const ac3ok = first === 'sent' && j.afterBack === 'idle' && j.sendBack === true
    && j.state === 'idle' && !!j.hint && /changed your list/i.test(j.hint);
  console.log('        after a real write she is in           : ' + first);
  console.log('        her way back reads                     : ' + JSON.stringify(j.label));
  console.log('        tapping it returns the page to         : ' + j.afterBack + '   (action restored: ' + j.sendBack + ')');
  console.log('        after she then changes a row, she reads: ' + JSON.stringify(j.hint));
  console.log('        ' + (ac3ok ? 'ok    she is never stuck, and the page never claims the CHANGED list was sent' : 'FAIL  the way back or the changed-list sentence is missing') + '\n');
  if (!ac3ok) bad++;

  // ══ WARWICK'S CONFIRM STEP — THE ACCIDENT GUARD, AND THE DATE THAT REACHES THE SERVER ══════════
  // "so she cant submit by accident and also we will then get a date for the actual shop."
  // Both halves are checked, and the second is checked AT THE SERVER: `list_date` is only real if
  // it arrives, so the assertion reads the captured request body rather than the page.
  console.log('CONFIRM — she is asked before anything is sent:');
  await gotoPage();
  sendMode = 'created';
  listRequests = 0; listBodies.length = 0;
  const atConfirm = await driveSend('confirm');
  const cshown = await cmd('Runtime.evaluate', {
    expression: '(() => ({ words: (document.querySelector(".note")||{}).innerText || null,'
      + ' sendGone: !document.querySelector(".send"),'
      + ' commit: (document.querySelector(".confirm")||{}).innerText || null,'
      + ' out: (document.querySelector(".again")||{}).innerText || null }))()',
    returnByValue: true,
  });
  const c = (cshown.result && cshown.result.result && cshown.result.result.value) || {};
  const postsBeforeConfirming = listRequests;
  // Five taps at the OLD position of the primary action, which is what an accidental double-tap is.
  await cmd('Runtime.evaluate', {
    expression: '(() => { for (let i=0;i<5;i++){ const b=document.querySelector(".send"); if(b) b.click(); } })()',
    returnByValue: true,
  });
  await wait(400);
  const postsAfterStrayTaps = listRequests;
  // Now she actually confirms.
  await cmd('Runtime.evaluate', { expression: '(() => { document.querySelector(".confirm").click(); })()', returnByValue: true });
  await wait(700);
  const body = listBodies[0] || {};
  const expectDate = new Date();
  const wantDate = expectDate.getFullYear() + '-'
    + String(expectDate.getMonth() + 1).padStart(2, '0') + '-'
    + String(expectDate.getDate()).padStart(2, '0');
  const confirmOk = atConfirm === 'confirm' && c.sendGone === true && postsBeforeConfirming === 0
    && postsAfterStrayTaps === 0 && listRequests === 1 && body.list_date === wantDate
    && !Object.prototype.hasOwnProperty.call(body, 'note');
  console.log('        she is asked                          : ' + JSON.stringify((c.words || '').replace(/\s+/g, ' ').trim()));
  console.log('        the commit control reads              : ' + JSON.stringify((c.commit || '').trim()) + '   (class .confirm, NOT .send)');
  console.log('        her way out reads                     : ' + JSON.stringify((c.out || '').trim()));
  console.log('        no .send element exists on this screen: ' + c.sendGone);
  console.log('        POSTs before she confirmed            : ' + postsBeforeConfirming + '   (must be 0 — SEND alone sends nothing)');
  console.log('        POSTs after five stray taps at .send  : ' + postsAfterStrayTaps + '   (must be 0 — the guard is structural)');
  console.log('        POSTs after she confirmed             : ' + listRequests);
  console.log('        list_date that reached the server     : ' + JSON.stringify(body.list_date) + '   (expected ' + wantDate + ')');
  console.log('        `note` key present in the request     : ' + Object.prototype.hasOwnProperty.call(body, 'note') + '   (contract v2 Amendment 3: must be false)');
  console.log('        ' + (confirmOk ? 'ok    nothing is sent until she says so, and the date she saw is the date that went'
    : 'FAIL  the confirm step or the date did not behave as specified') + '\n');
  if (!confirmOk) bad++;
  releaseHungSockets();

  // ══ THE TWO CROSS-LANE FACTS FROM WP-B15-50, ESTABLISHED BY EXECUTION ══════════════════════════
  // Both are claims about what LEAVES this page, so both are read off the CAPTURED REQUEST BODY.
  // Reading the source and reasoning about it is how a confident wrong answer gets given.
  console.log('CROSS-LANE — what this page actually puts on the wire:');
  // 1. An empty input box must never produce `extras: ['']`. Keel's route answers 400 to that, and
  //    it would fail her ENTIRE submission over a nicety she did not even use.
  const emptyBody = listBodies[0] || {};
  const hasExtrasKey = Object.prototype.hasOwnProperty.call(emptyBody, 'extras');
  console.log('        with nothing typed, `extras` key present : ' + hasExtrasKey + '   (contract: omit it entirely)');
  await gotoPage();
  checkMode = 'matched';
  checkRequests = 0; checkBodies.length = 0;
  listRequests = 0; listBodies.length = 0;
  // The exact gesture that could produce an empty string: open the box, add nothing, press Add it.
  await evalIn('(() => { document.querySelector(".add").click(); })()');
  await wait(150);
  await evalIn('(() => { const g = document.querySelector(".a-add"); if (g) g.click(); })()');
  await wait(300);
  const blankMadeAnExtra = await evalIn('(() => document.querySelectorAll(".extra").length)()');
  const blankHitTheCheck = checkRequests;
  // ⛔ THE BLANK ATTEMPT CORRECTLY LEAVES HER INPUT OPEN — addExtra() returns before closing it, so
  // a mis-tap on "Add it" does not throw away a box she is still using. That is right for her and
  // it broke this test: `.add` is `v-if="!addOpen"`, so driveAdd() found no entry control and
  // returned immediately, and the run reported a product failure that was mine. Close it as she
  // would, with the worded control, then drive the real journey.
  await evalIn('(() => { const c = document.querySelector(".a-cancel"); if (c) c.click(); })()');
  await wait(200);
  await driveAdd();
  const checkBody = checkBodies[checkBodies.length - 1] || {};
  sendMode = 'created';
  await driveSend();
  const withExtras = listBodies[0] || {};
  const extrasSent = Array.isArray(withExtras.extras) ? withExtras.extras : null;
  const noEmptyString = !!extrasSent && extrasSent.every((x) => typeof x === 'string' && x.trim() !== '');
  const chosenSent = Array.isArray(checkBody.chosen);
  const crossOk = hasExtrasKey === false && blankMadeAnExtra === 0 && blankHitTheCheck === 0
    && noEmptyString && chosenSent;
  console.log('        a blank box produced N extras            : ' + blankMadeAnExtra + '   (must be 0)');
  console.log('        ...and reached the check route N times   : ' + blankHitTheCheck + '   (must be 0)');
  console.log('        `extras` as sent                         : ' + JSON.stringify(extrasSent));
  console.log('        ...contains no empty string              : ' + noEmptyString + '   (an empty string is a 400 that fails her whole send)');
  console.log('        `chosen` sent to the check route         : ' + JSON.stringify(checkBody.chosen) + '   (without it possible_duplicate is unreachable)');
  console.log('        ' + (crossOk ? 'ok    a blank box emits nothing, and the check gets what it needs to spot a duplicate'
    : 'FAIL  this page would trip the 400, or cannot reach possible_duplicate') + '\n');
  if (!crossOk) bad++;
  releaseHungSockets();

  // ══ ADD SOMETHING ELSE — AND THE RULE THAT SHE IS NEVER ASKED A QUESTION ═══════════════════════
  console.log('ADD SOMETHING ELSE — her words, and a nudge that is never an interrogation:');
  const ADD_CASES = [
    { mode: 'matched', nudge: true, why: 'she already has it — tell her warmly, KEEP her item' },
    { mode: 'possible_duplicate', nudge: true, why: 'probably a duplicate — same treatment' },
    { mode: 'needs_confirmation', nudge: false, why: 'uncertain — accepted in SILENCE, Warwick handles it' },
    { mode: 'unmatched_new_item', nudge: false, why: 'genuinely new — accepted in silence' },
    { mode: 'unreachable', nudge: false, why: 'the check route is DOWN — her item is kept anyway' },
  ];
  for (const a of ADD_CASES) {
    await gotoPage();
    checkMode = a.mode;
    checkRequests = 0; checkBodies.length = 0;
    await driveAdd();
    const seen = await cmd('Runtime.evaluate', {
      // ⛔ WHAT "SHE IS NEVER ASKED A QUESTION" ACTUALLY FORBIDS, STATED PRECISELY — because the
      // first version of this assertion tested for a question mark anywhere on the page and went
      // red on the input's OWN LABEL, "What else would you like?". That label is the feature
      // Warwick asked for, not a violation of his rule.
      // The rule is about ADJUDICATION: she must never be asked to resolve a catalogue match. So
      // what is forbidden is (a) a question mark inside the sense-check's own message to her, and
      // (b) any disambiguation phrasing anywhere, and (c) any control inside the nudge — a nudge
      // with a button in it is a choice, whatever its words say.
      expression: '(() => { const n = document.querySelector(".e-note");'
        + ' return { item: (document.querySelector(".extra .r-name")||{}).innerText || null,'
        + ' note: n ? n.innerText : null,'
        + ' noteAsks: n ? /\\?/.test(n.innerText) : false,'
        + ' noteHasControl: n ? !!n.querySelector("button, a, input, select, [role=button]") : false,'
        + ' disambiguation: /did you mean|which one|which did you|choose one|select one|is this the/i.test(document.body.innerText),'
        + ' count: (document.querySelector(".f-count")||{}).innerText || null }; })()',
      returnByValue: true,
    });
    const g = (seen.result && seen.result.result && seen.result.result.value) || {};
    const sentText = (checkBodies[0] || {}).text;
    const kept = g.item === 'that nice ham';
    const nudgeRight = a.nudge ? !!g.note : !g.note;
    const wordsIntact = a.mode === 'unreachable' ? true : sentText === 'that nice ham';
    const notInterrogated = g.noteAsks === false && g.noteHasControl === false && g.disambiguation === false;
    const ok = kept && nudgeRight && wordsIntact && notInterrogated;
    if (!ok) bad++;
    console.log((ok ? 'ok    ' : 'FAIL  ') + a.mode.padEnd(19) + ' -> item kept: ' + kept
      + ', nudge: ' + (g.note ? 'yes' : 'no') + ' (wanted ' + (a.nudge ? 'yes' : 'no') + ')');
    console.log('        because : ' + a.why);
    console.log('        her words as sent to the check       : ' + JSON.stringify(sentText === undefined ? '(route was down)' : sentText));
    console.log('        she reads                            : ' + JSON.stringify(g.note));
    console.log('        the nudge asks her something         : ' + g.noteAsks + '   (must be false)');
    console.log('        the nudge contains a control         : ' + g.noteHasControl + '   (must be false — a choice is an interrogation)');
    console.log('        disambiguation wording on screen     : ' + g.disambiguation + '   (must be false)');
    console.log('        the footer now counts                : ' + JSON.stringify((g.count || '').trim()) + '\n');
    releaseHungSockets();
  }

  // ══ HIGH-2 — HER TYPED WORDS SURVIVE A MIS-TAP, AND BOTH UNDOS EXIST ═══════════════════════════
  // ⛔ MEDIUM-C, VERA, AND HER POINT IS THE ONE THIS SURFACE KEEPS RE-LEARNING: A JUSTIFICATION
  // WRITTEN IN A COMMENT IS NOT A CONTROL. HIGH-2 was the worst defect in the package — one mis-tap
  // on "Not now" destroyed something she had typed by hand, with no undo anywhere — and the fix was
  // closed with prose and nothing else. HIGH-3 was closed by ADDING THE MISSING MEASUREMENT. This
  // is that, for HIGH-2. Three things are exercised, because three separate things were broken.
  console.log('HIGH-2 — her typed words survive a mis-tap, and both undos exist:');
  await gotoPage();
  checkMode = 'unmatched_new_item';
  // 1. She types, mis-taps "Not now" (full size, directly beside "Add it"), and comes back.
  await evalIn('(() => { document.querySelector(".add").click(); })()');
  await wait(150);
  await evalIn('(() => { const i = document.querySelector(".a-input"); i.value = "yoghurts for grandad";'
    + ' i.dispatchEvent(new Event("input", { bubbles: true })); })()');
  await wait(150);
  await evalIn('(() => { document.querySelector(".a-cancel").click(); })()');
  await wait(250);
  await evalIn('(() => { const a = document.querySelector(".add"); if (a) a.click(); })()');
  await wait(250);
  const draftBack = await evalIn('(() => { const i = document.querySelector(".a-input"); return i ? i.value : null; })()');
  const draftKept = draftBack === 'yoghurts for grandad';
  console.log('        after "Not now" and reopening, the box holds : ' + JSON.stringify(draftBack));
  console.log('        ' + (draftKept ? 'ok    B §8.3 rule 8: text typed but not added is preserved'
    : 'FAIL  a mis-tap destroyed something she typed by hand') + '\n');
  if (!draftKept) bad++;

  // 2. Adding records an undo that NAMES what it will undo (B §6.6). Without it the undo control on
  //    screen still offered to un-tick the last ITEM she ticked — a second wrong thing, one tap on.
  await evalIn('(() => { const g = document.querySelector(".a-add"); if (g) g.click(); })()');
  await wait(700);
  const addUndo = await evalIn('(() => { const u = document.querySelector(".undo"); return u ? u.innerText.trim() : null; })()');
  const addUndoOk = !!addUndo && /yoghurts for grandad/.test(addUndo) && /added/i.test(addUndo);
  console.log('        the undo after ADDING reads                  : ' + JSON.stringify(addUndo));
  console.log('        ' + (addUndoOk ? 'ok    it names her words and says what it will do'
    : 'FAIL  adding records no undo, or one that does not name it') + '\n');
  if (!addUndoOk) bad++;

  // 3. Removing restores AT THE ORIGINAL INDEX. Re-appending would be an approximation of an undo
  //    rather than an undo, and with two entries the difference is visible to her.
  await evalIn('(() => { const a = document.querySelector(".add"); if (a) a.click(); })()');
  await wait(200);
  await evalIn('(() => { const i = document.querySelector(".a-input"); i.value = "a nice bit of fish";'
    + ' i.dispatchEvent(new Event("input", { bubbles: true })); })()');
  await wait(150);
  await evalIn('(() => { const g = document.querySelector(".a-add"); if (g) g.click(); })()');
  await wait(700);
  const orderBefore = await evalIn('(() => Array.from(document.querySelectorAll(".extra .r-name")).map((n) => n.innerText.trim()))()');
  await evalIn('(() => { document.querySelectorAll(".extra")[0].click(); })()');
  await wait(300);
  const removeUndo = await evalIn('(() => { const u = document.querySelector(".undo"); return u ? u.innerText.trim() : null; })()');
  await evalIn('(() => { const u = document.querySelector(".undo"); if (u) u.click(); })()');
  await wait(300);
  const orderAfter = await evalIn('(() => Array.from(document.querySelectorAll(".extra .r-name")).map((n) => n.innerText.trim()))()');
  const restoredInPlace = JSON.stringify(orderBefore) === JSON.stringify(orderAfter) && (orderAfter || []).length === 2;
  const removeUndoOk = !!removeUndo && /yoghurts for grandad/.test(removeUndo);
  console.log('        order before removing                        : ' + JSON.stringify(orderBefore));
  console.log('        the undo after REMOVING reads                : ' + JSON.stringify(removeUndo));
  console.log('        order after undoing the removal              : ' + JSON.stringify(orderAfter));
  console.log('        ' + (restoredInPlace && removeUndoOk
    ? 'ok    restored at its ORIGINAL INDEX, not re-appended'
    : 'FAIL  the undo is missing, or it restores in the wrong place') + '\n');
  if (!restoredInPlace || !removeUndoOk) bad++;
  releaseHungSockets();

  shutdown();
  if (bad) { console.error('SEND-CASES FAIL — ' + bad + ' case(s) rendered the wrong outcome.'); process.exit(1); }
  console.log('SEND-CASES PASS — ' + CASES.length + '/' + CASES.length + ' cases rendered the outcome the server actually justified. '
    + 'The sent state was reached by exactly ONE of them, and only by the one that wrote a row.');
  process.exit(0);
}

const clean = SELF_TEST ? {} : await measure(null);
if (AS_JSON) { console.log(JSON.stringify(clean, null, 1)); shutdown(); process.exit(0); }

if (SELF_TEST) {
  const names = Object.keys(MUTATIONS);
  const hits = Object.fromEntries(names.map((n) => [n, 0]));
  let baseline = 0;
  // Viewports OUTER, mutations INNER — one navigation each, and every mutation is exercised at
  // every viewport rather than at a chosen one. A mutation only has to be caught SOMEWHERE to
  // prove the detector fires; requiring it everywhere would fail honestly-viewport-specific ones
  // (the footer-clearance mutation is exactly that).
  // ⛔ VIEWPORTS OUTER, STATES MIDDLE, MUTATIONS INNER — AND THE STATE LOOP IS THE WP-B15-49 FIX.
  // Before it, this loop measured ONLY the resting screen: 12 of 12 mutations caught, across 10 of
  // the 20 states the gate rendered. Every mutation that can only fire once she has pressed SEND
  // was therefore unproven, and the number "12/12" concealed that rather than revealing it.
  // Now every mutation is exercised against every state at every viewport. A mutation only has to
  // be caught SOMEWHERE to prove the detector fires; requiring it everywhere would fail the
  // honestly state-specific ones (`.again` does not exist on the landing screen) and the honestly
  // viewport-specific ones (the footer-clearance mutation).
  const combos = VIEWS.length * STATES.length;
  for (const v of VIEWS) {
    await atViewport(v, async () => {
      for (const st of STATES) {
        const reached = await enterState(st);
        const tag = v.label + (st.kind === 'rest' ? '' : '  [' + st.label + ']');
        await setMutation(null);
        const cleanM = await readMeasurement();
        cleanM.stateWanted = st.want || null;
        cleanM.answersHer = !!st.answers;
        cleanM.stateReached = reached;
        const cleanN = verdict(tag, cleanM).bad.length;
        baseline += cleanN;
        if (cleanN !== 0) console.error('  CONTROL FAILED at ' + tag + ' — ' + cleanN + ' failure(s) before any mutation.');
        for (const n of names) {
          await setMutation(MUTATIONS[n]);
          const mm = await readMeasurement();
          mm.stateWanted = st.want || null;
          mm.answersHer = !!st.answers;
          mm.stateReached = reached;
          if (verdict(tag, mm).bad.length > cleanN) hits[n]++;
        }
        await setMutation(null);
      }
    });
  }
  let caught = 0; const missed = [];
  for (const n of names) {
    if (hits[n] > 0) { caught++; console.log('  caught  ' + n.padEnd(58) + ' -> went red at ' + hits[n] + ' of ' + combos + ' viewport/state combinations'); }
    else { missed.push(n); console.log('  MISSED  ' + n.padEnd(58) + ' -> red at NO viewport in ANY state'); }
  }
  console.log(baseline === 0
    ? '  control  all ' + combos + ' viewport/state combinations clean before mutation (no false positive)'
    : '  CONTROL FAILED — ' + baseline + ' failure(s) on the unmutated surface; the mutations above prove nothing.');
  shutdown();
  if (missed.length || baseline !== 0) { console.error('SELF-TEST FAIL'); process.exit(1); }
  console.log('SELF-TEST PASS — ' + caught + '/' + names.length + ' mutations caught, control clean, '
    + 'across ' + combos + ' viewport/state combinations (' + VIEWS.length + ' viewports x ' + STATES.length + ' states: '
    + STATES.map((s) => s.label).join(', ') + ').');
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
shutdown();
if (checked === 0) { console.error('SHOPPING-GEOMETRY-CHECK FAIL — zero viewports measured.'); process.exit(1); }
if (failures) { console.error('SHOPPING-GEOMETRY-CHECK FAIL — ' + failures + ' measured violation(s) across ' + checked + ' viewports.'); process.exit(1); }
console.log('SHOPPING-GEOMETRY-CHECK PASS — ' + checked + ' viewports measured in a real browser, 0 violations. '
  + 'Targets, dead space, text size, composited contrast and footer clearance all measured on the rendered box. '
  + '⚠️ Chromium at her viewport sizes — NOT Silk, and NOT her tablet.');
process.exit(0);
