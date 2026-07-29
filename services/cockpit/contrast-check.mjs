// Cockpit CONTRAST measurement — the executable source for every ratio quoted in
// GL-003-design-system.md §2b/§2c. WCAG 2.x relative luminance, per GL-003 §2d.
//
// HARD PRECONDITION: this script self-validates against the five figures Iris pinned
// independently in GL-003 §2d before it prints anything. If any pinned figure disagrees,
// the script exits non-zero and NO figure it produces may be quoted.
//
//   node services/cockpit/contrast-check.mjs
//
// Token values are read from styles.css so the script cannot drift from the CSS.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'public', 'styles.css'), 'utf8');

/* ---------- token extraction (light = :root, dark = the :root inside the first
   prefers-color-scheme:dark block; dark inherits any token it does not override) ---------- */

function tokensFrom(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out['--' + m[1]] = m[2];
  return out;
}
const rootBlock = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('}', CSS.indexOf(':root {')));
const darkStart = CSS.indexOf('@media (prefers-color-scheme: dark)');
const darkBlock = CSS.slice(darkStart, CSS.indexOf('\n}', darkStart));

const LIGHT = { ...tokensFrom(rootBlock), '#fff': '#ffffff' };
const DARK = { ...LIGHT, ...tokensFrom(darkBlock) };
const SCHEME = { light: LIGHT, dark: DARK };

/* ---------- colour maths ---------- */

const hex2rgb = (h) => {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const rgb2hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

const lum = (hex) => {
  const [r, g, b] = hex2rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [la, lb] = [lum(a), lum(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// CSS `opacity` composites the element's rendered layer over its backdrop in
// gamma-encoded sRGB (simple source-over on the 8-bit values). Nested opacity
// multiplies: the inner layer flattens over the element's own background first,
// then the whole element flattens over the backdrop.
const over = (fgHex, bgHex, alpha) => {
  const f = hex2rgb(fgHex), b = hex2rgb(bgHex);
  return rgb2hex([0, 1, 2].map((i) => alpha * f[i] + (1 - alpha) * b[i]));
};

const r2 = (n) => Math.round(n * 100) / 100;
const resolve = (scheme, name) => (name.startsWith('#') ? name : SCHEME[scheme][name]);
const cr = (scheme, fg, bg) => r2(ratio(resolve(scheme, fg), resolve(scheme, bg)));

/* ---------- SELF-VALIDATION (hard precondition, GL-003 §2d) ---------- */

const PINNED = [
  ['.t-desc  --ink3 on --panel', 'light', '--ink3', '--panel', 3.80],
  ['.t-desc  --ink3 on --panel', 'dark', '--ink3', '--panel', 3.72],
  ['.empty   --ink3 on --bg', 'light', '--ink3', '--bg', 3.36],
  ['.empty   --ink3 on --bg', 'dark', '--ink3', '--bg', 4.21],
  ['.lane-sub --ink3 on --bg', 'light', '--ink3', '--bg', 3.36],
  ['.lane-sub --ink3 on --bg', 'dark', '--ink3', '--bg', 4.21],
  ['--ok on --ok-w (CSS comment "3.1")', 'light', '--ok', '--ok-w', 3.06],
  ['--warn on --warn-w (CSS comment "3.6")', 'light', '--warn', '--warn-w', 3.63],
];

let bad = 0;
for (const [label, scheme, fg, bg, expect] of PINNED) {
  const got = cr(scheme, fg, bg);
  if (got !== expect) {
    console.error(`SELF-VALIDATION FAILED  ${label} [${scheme}]: expected ${expect}, got ${got}`);
    bad++;
  }
}
if (bad) {
  console.error(`\n${bad} pinned figure(s) disagree with GL-003 §2d. STOP — no figure from this script may be quoted.`);
  process.exit(1);
}
console.log(`SELF-VALIDATION PASSED — ${PINNED.length}/${PINNED.length} of Iris's pinned figures reproduced exactly.\n`);

/* ---------- the report ---------- */

const AA = 4.5, AA_NONTEXT = 3.0;
const mark = (v, floor = AA) => (v >= floor ? 'PASS' : 'FAIL');
const row = (id, label, fg, bg, floor = AA) => {
  const l = cr('light', fg, bg), d = cr('dark', fg, bg);
  const verdict = l >= floor && d >= floor ? 'PASS both' : `${mark(l, floor)} light / ${mark(d, floor)} dark`;
  console.log(
    `${id.padEnd(7)} ${label.padEnd(46)} light ${String(l).padStart(6)}  dark ${String(d).padStart(6)}   ${verdict}`
  );
  return { l, d };
};

console.log('=== D-1…D-10 · the --ink3 → --ink2 lift (floor 4.5:1 normal text) ===');
row('D-4', '.nav-btn        --ink2 on --panel', '--ink2', '--panel');
row('D-1', '.t-desc         --ink2 on --panel', '--ink2', '--panel');
row('D-3', '.lane-sub       --ink2 on --bg', '--ink2', '--bg');
row('D-2', '.empty/.big     --ink2 on --bg', '--ink2', '--bg');
row('D-6', '.opp-atom       --ink2 on --panel', '--ink2', '--panel');
row('D-5', '.i-why          --ink2 on --panel', '--ink2', '--panel');
row('D-7', '.fresh          --ink2 on --panel', '--ink2', '--panel');
row('D-8', '.d-eyebrow      --ink2 on --panel', '--ink2', '--panel');
row('D-9', '.tech summary   --ink2 on --panel2', '--ink2', '--panel2');
row('D-10', '.mono           --ink2 on --panel2', '--ink2', '--panel2');
row('D-10', '.mono (in .opp-body, on --panel)  --ink2', '--ink2', '--panel');

console.log('\n=== Retained --ink3 (ornament — 3:1 non-text floor applies, not 4.5) ===');
row('keep', '.chev           --ink3 on --panel', '--ink3', '--panel', AA_NONTEXT);
row('keep', '.crumb-sep      --ink3 on --bg', '--ink3', '--bg', AA_NONTEXT);

console.log('\n=== D-14 / D-15 / D-16 · status colour used as TEXT → --ink2 ===');
row('D-14', '.done-pill/.chip.ok  --ink2 on --ok-w', '--ink2', '--ok-w');
row('D-15', '.chip.block          --ink2 on --stop-w', '--ink2', '--stop-w');
row('D-16', '.i-eyebrow.decision  --ink2 on --panel', '--ink2', '--panel');
console.log('       (was: --ok on --ok-w, --stop on --stop-w, --warn on --panel)');
row('was', '  --ok on --ok-w', '--ok', '--ok-w');
row('was', '  --stop on --stop-w', '--stop', '--stop-w');
row('was', '  --warn on --panel', '--warn', '--panel');
console.log('       D-16 state colour survives on the rail (non-text, 3:1 floor):');
row('rail', '  --warn rail on --panel (.item.amber)', '--warn', '--panel', AA_NONTEXT);
console.log('       Dots keep the signal colour (non-text, 3:1 floor against their tint):');
row('dot', '  --ok dot on --ok-w', '--ok', '--ok-w', AA_NONTEXT);
row('dot', '  --stop dot on --stop-w', '--stop', '--stop-w', AA_NONTEXT);

console.log('\n=== D-11 · .act.accept — the question Larry asked me to MEASURE, not estimate ===');
row('now', '  #fff on --ok            (shipping)', '#fff', '--ok');
row('optA', '  --ink on --ok           (keep the fill)', '--ink', '--ok');
row('optB', '  --ink on --ok-w         (tint alternative)', '--ink', '--ok-w');
row('optB2', '  --ink2 on --ok-w        (tint, muted)', '--ink2', '--ok-w');
row('optC', '  --bg on --ok            (bg-as-ink on fill)', '--bg', '--ok');

console.log('\n=== D-12 · .nav-badge / .load-err — white on --stop, dark-only failure ===');
row('now', '  #fff on --stop          (shipping)', '#fff', '--stop');
row('fix', '  --bg on --stop          (dark override)', '--bg', '--stop');
console.log('       light keeps #fff (5.02 PASS); dark swaps to --bg. Per-scheme values:');
console.log(`         light  #fff on --stop = ${cr('light', '#fff', '--stop')}   (ship this in light)`);
console.log(`         dark   --bg on --stop = ${cr('dark', '--bg', '--stop')}   (ship this in dark)`);

console.log('\n=== D-13 · .opp-conflict — white on --warn, fails BOTH schemes ===');
row('now', '  #fff on --warn          (shipping)', '#fff', '--warn');
row('optA', '  --ink on --warn         (keep the fill)', '--ink', '--warn');
row('optB', '  --ink2 on --warn-w      (tint alternative)', '--ink2', '--warn-w');
row('optC', '  --bg on --warn          (bg-as-ink on fill)', '--bg', '--warn');
console.log('       Per-scheme best of the fill-keeping options:');
console.log(`         light  --ink on --warn = ${cr('light', '--ink', '--warn')}`);
console.log(`         dark   --bg  on --warn = ${cr('dark', '--bg', '--warn')}`);
console.log('       Shipped: --ink2 on --warn-w + 1px --warn ring (ring is non-text, 3:1 floor):');
row('ring', '  --warn ring on --warn-w', '--warn', '--warn-w', AA_NONTEXT);

console.log('\n=== .act.accept border keeps the weight (non-text, 3:1 floor) ===');
row('D-11', '  --ok border on --panel', '--ok', '--panel', AA_NONTEXT);

console.log('\n=== OPACITY-COMPOSITED figures (the second thing Larry asked me to measure) ===');
console.log('CSS opacity flattens the element layer over its backdrop. Nested opacity multiplies.\n');

const composited = (scheme, fgTok, panelTok, bgTok, alphas) => {
  let fg = resolve(scheme, fgTok);
  const panel = resolve(scheme, panelTok);
  const bg = resolve(scheme, bgTok);
  // inner alpha flattens text over the card's own background
  if (alphas.inner) fg = over(fg, panel, alphas.inner);
  let effBg = panel;
  if (alphas.outer) {
    fg = over(fg, bg, alphas.outer);
    effBg = over(panel, bg, alphas.outer);
  }
  return { fg, effBg, ratio: r2(ratio(fg, effBg)) };
};

const opRow = (label, fgTok, alphas, floor = AA) => {
  const L = composited('light', fgTok, '--panel', '--bg', alphas);
  const D = composited('dark', fgTok, '--panel', '--bg', alphas);
  const verdict = L.ratio >= floor && D.ratio >= floor ? 'PASS both' : `${mark(L.ratio, floor)} light / ${mark(D.ratio, floor)} dark`;
  console.log(
    `  ${label.padEnd(52)} light ${String(L.ratio).padStart(6)}  dark ${String(D.ratio).padStart(6)}   ${verdict}`
  );
  return { L, D };
};

console.log('-- .i-eyebrow  opacity:.85  (text over --panel) --');
opRow('.i-eyebrow.blocked   --stop  @ .85', '--stop', { inner: 0.85 });
opRow('.i-eyebrow.suggestion --accent-ink @ .85', '--accent-ink', { inner: 0.85 });
opRow('.i-eyebrow.decision  --warn  @ .85  (pre-fix)', '--warn', { inner: 0.85 });
opRow('.i-eyebrow.decision  --ink2  @ .85  (post-fix)', '--ink2', { inner: 0.85 });
console.log('  pure (uncomposited) reference:');
console.log(`    --stop on --panel        light ${cr('light', '--stop', '--panel')}  dark ${cr('dark', '--stop', '--panel')}`);

console.log('\n-- .item.deferred  opacity:.7  (whole card over --bg) --');
opRow('.i-title   --ink   @ .7', '--ink', { outer: 0.7 });
opRow('.i-why     --ink2  @ .7  (post-fix)', '--ink2', { outer: 0.7 });
opRow('.i-why     --ink3  @ .7  (pre-fix)', '--ink3', { outer: 0.7 });
opRow('.fresh     --ink2  @ .7  (post-fix)', '--ink2', { outer: 0.7 });

console.log('\n-- compound: .i-eyebrow (.85) inside .item.deferred (.7) --');
opRow('.i-eyebrow.blocked  --stop @ .85 x .7', '--stop', { inner: 0.85, outer: 0.7 });
opRow('.i-eyebrow.decision --ink2 @ .85 x .7 (post-fix)', '--ink2', { inner: 0.85, outer: 0.7 });

console.log('\nDone.');
