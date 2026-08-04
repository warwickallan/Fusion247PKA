// Fusion247 Cockpit — RENDER EXECUTION CHECK (no browser).
//
// WHAT THIS ADDS OVER template-check.mjs, and why both exist.
// Compiling proves the template is WELL-FORMED. It does not prove the expressions inside it survive
// real data. `asdairWs.plan[grp.k]` on a null plan, a helper that setup() never returned, a field
// that does not exist on the payload — every one of those compiles perfectly and then blanks the
// view at runtime.
//
// That is not hypothetical. It is exactly what shipped: the Details view referenced `raw_display`
// and `title`, FIELDS THAT DO NOT EXIST on the workspace payload, so all 34 lines fell through to
// `JSON.stringify(ln)`. The raw JSON Warwick saw on his phone was a FALLBACK, not a deliberate
// technical drawer, and it survived a compile check because a compile check cannot see it.
//
// So this harness EXECUTES the compiled render function against payloads and reports:
//   * anything it throws;
//   * any identifier the template reached for that the component does not expose ("missing
//     bindings") — caught by a Proxy `has` trap, see below;
//   * any raw-JSON blob that leaked into visible text, which is the signature of the bug above.
//
// It replaces `render-check.mjs`, which is BROKEN on this machine (DEFECT-LEDGER D-2026-08-03-11 —
// headless Edge self-relaunches and detaches; it fails identically on untouched HEAD, so it is
// environmental). See VERIFICATION.md.
//
// ── FIXTURES ARE SYNTHETIC, DELIBERATELY ─────────────────────────────────────────────────────────
// This repository is PUBLIC. The real payloads this harness was developed against are a real
// household's shopping list, and they are personal data that must never be committed. The fixtures
// under `fixtures/` are therefore hand-written, structurally faithful to the live payload shape, and
// contain no household data whatsoever. Point `--ws` at a live capture when you want to check
// against real data; keep that capture OUT of the repository.
//
// USAGE
//   node services/cockpit/render-vm-check.mjs               # gate, using committed fixtures
//   node services/cockpit/render-vm-check.mjs --self-test   # prove the gate can fail
//   node services/cockpit/render-vm-check.mjs --ws <file>   # check against a live capture
//   node services/cockpit/render-vm-check.mjs --dump <file> # write the visible text out to read
import { readFileSync, writeFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, 'public');
const FIX = path.join(HERE, 'fixtures');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const SELF_TEST = process.argv.includes('--self-test');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const WS = readJson(arg('--ws', path.join(FIX, 'workspace.sample.json')));
const RULES = readJson(arg('--rules', path.join(FIX, 'rules.sample.json')));
const PACKET = readJson(arg('--packet', path.join(FIX, 'packet.sample.json')));
const DUMP = arg('--dump', null);

function domEl() {
  const o = { textContent: '', children: [], _h: '', focus() {}, style: {}, setAttribute() {},
    classList: { add() {}, remove() {}, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(o, 'innerHTML', {
    get() { return o._h; },
    set(v) {
      o._h = String(v);
      o.textContent = String(v).replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const m = /foo="([^"]*)"/.exec(String(v));
      o.children = [{ getAttribute: () => (m ? m[1] : '') }];
    },
  });
  return o;
}
const captured = [];
const sb = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  // Intrinsics the TEMPLATE itself reaches for (`JSON.stringify` in the technical drawer, `Object`,
  // `Number`...). They must be OWN properties of `sb`, not merely present on the vm context: the
  // Proxy `has` trap below claims every identifier, so `with(_ctx)` never falls through to the
  // context's own globals. Omitting them makes real intrinsics report as "missing bindings" —
  // which this harness did on its first run, and which is the harness lying, not the app failing.
  JSON, Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, Promise, Symbol, Map, Set,
  isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  fetch: async () => ({ ok: false, status: 0, json: async () => ({}) }),
  location: { href: 'http://127.0.0.1:8090/', pathname: '/', search: '', hash: '' },
  navigator: { serviceWorker: { register: async () => ({}) }, userAgent: 'node' },
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    createElement: () => domEl(), createTextNode: () => domEl(), querySelector: () => domEl(),
    querySelectorAll: () => [], getElementById: () => domEl(), addEventListener() {},
    removeEventListener() {}, body: domEl(), documentElement: domEl(), title: '',
  },
};
sb.window = sb; sb.globalThis = sb; sb.self = sb;
const ctx = createContext(sb);
const load = (f) => runInContext(readFileSync(path.join(PUB, f), 'utf8'), ctx, { filename: f });

load('vendor/vue.global.prod.js');
sb.Vue.createApp = (o) => { captured.push(o); return { mount: () => ({}) }; };
load('apps.js');
load('app.js');

const Vue = sb.Vue;
const opts = captured[0];
// The real setup(), so the real computeds are exercised rather than stubbed.
const bindings = opts.setup ? opts.setup() : {};
const unwrap = (v) => (v && typeof v === 'object' && '__v_isRef' in v) ? v.value : v;
const app = sb.window.FUSION_APPS.find((a) => a.key === 'asdair');

// Write into the REAL refs, so the REAL computeds (asdairShop, asdairTally, asdairRuleGroups,
// asdairPacketLines, asdairRecon) run. Overriding the context property instead left asdairShop
// reading a null ref, and the Details scenario silently rendered the offline placeholder WHILE
// REPORTING A PASS. Found by reading the rendered text, not by trusting the vnode count — which is
// the whole reason this harness dumps text rather than counting nodes.
function setRefs(refs) {
  for (const [k, v] of Object.entries(refs)) {
    const b = bindings[k];
    if (!b || typeof b !== 'object' || !('value' in b)) throw new Error('not a writable ref: ' + k);
    b.value = v;
  }
}

function scenario(name, viewKey, render, overrides = {}) {
  const base = {};
  for (const k of Object.keys(bindings)) {
    Object.defineProperty(base, k, {
      enumerable: true, configurable: true,
      get() { return unwrap(bindings[k]); },
      set() { /* the template never assigns to a binding except via @click, which we do not fire */ },
    });
  }
  // defineProperty, not assign: the binding getters above are ACCESSOR properties, so a plain
  // assignment is swallowed and the scenario silently tests the wrong data.
  const fixed = Object.assign({
    area: 'apps', appKey: 'asdair', currentApp: app,
    currentView: app.views.find((v) => v.key === viewKey),
    statusOf: () => ({ state: 'up', detail: 'answering' }),
    appStatusLine: () => 'running',
    detail: null, busy: false,
  }, overrides);
  for (const [k, v] of Object.entries(fixed)) {
    Object.defineProperty(base, k, { value: v, enumerable: true, configurable: true, writable: true });
  }
  // Vue's browser build compiles with `with(_ctx)`, so an unknown identifier would fall through to
  // the outer scope and silently resolve to a sandbox global. A Proxy trapping `has` forces EVERY
  // identifier to resolve against the context — which is what the real runtime does, and it is how
  // a missing binding is CAUGHT rather than quietly reading `undefined`. This trap is the
  // load-bearing mechanism of this whole file; `--self-test` is what proves it still works.
  const missing = new Set();
  // `has` must return FALSE for _- and $-prefixed keys, exactly as Vue's own
  // PublicInstanceProxyHandlers does: the compiled render function closes over `_Vue`,
  // `_createElementVNode` etc. OUTSIDE the `with(_ctx)` block, and a blanket `has: true` would
  // shadow every one of them with undefined. (Found by executing it.)
  const proxy = new Proxy(base, {
    has: (t, k) => !(typeof k === 'string' && (k.startsWith('_') || k.startsWith('$'))),
    get(t, k) {
      if (k === Symbol.unscopables) return undefined;
      if (k in t) return t[k];
      if (typeof k === 'string' && k in sb) return sb[k];
      if (typeof k === 'string' && !k.startsWith('_') && !k.startsWith('$')) missing.add(k);
      return undefined;
    },
  });
  let vnode = null, err = null;
  try { vnode = render.call(proxy, proxy, {}); } catch (e) { err = e; }
  return { name, vnode, err, missing: [...missing] };
}

// Walk the vnode tree and recover the VISIBLE TEXT, so the output can be read by a human rather
// than only counted. Counting nodes is how a view that rendered the wrong thing passes.
function text(v, out = []) {
  if (v == null || v === false || v === true) return out;
  if (typeof v === 'string' || typeof v === 'number') { const s = String(v).trim(); if (s) out.push(s); return out; }
  if (Array.isArray(v)) { for (const c of v) text(c, out); return out; }
  if (typeof v === 'object') {
    if (typeof v.children === 'string') { const s = v.children.trim(); if (s) out.push(s); return out; }
    if (v.children) text(v.children, out);
  }
  return out;
}
function count(v, n = { el: 0 }) {
  if (Array.isArray(v)) { v.forEach((c) => count(c, n)); return n; }
  if (v && typeof v === 'object' && v.type !== undefined) { n.el++; if (v.children && typeof v.children !== 'string') count(v.children, n); }
  return n;
}

// The JSON.stringify-fallback detector, and why it is not simply "is there a `{` in the text".
//
// The bug it exists to catch: a per-line `JSON.stringify(ln)` fallback that fires when the template
// reads fields that do not exist. It put a raw JSON blob on screen for EVERY line.
//
// The complication: the Details and Rules views now carry a DELIBERATE collapsed "Raw payload
// (debugging only)" drawer, which is also a raw JSON blob and is entirely correct. A naive blob
// scan flags it and cries wolf — it did exactly that on this harness's first run.
//
// The discriminator is position, not size: a sanctioned blob is immediately preceded by its own
// drawer label. An unsanctioned one is not. That still catches the original bug (34 blobs, none
// behind a drawer label) and stops flagging the feature. `--self-test` proves both halves.
const DRAWER_LABEL = 'Raw payload (debugging only)';
function strayJsonBlobs(textParts) {
  const out = [];
  for (let i = 0; i < textParts.length; i++) {
    const s = textParts[i];
    if (!s.startsWith('{') || s.length <= 200) continue;
    const behindDrawer = textParts.slice(Math.max(0, i - 3), i).some((p) => p.includes(DRAWER_LABEL));
    if (!behindDrawer) out.push(s.slice(0, 80));
  }
  return out;
}

// A shop that EXISTS but has been read with nothing filled in — the shape a brand-new shop has, and
// the one most likely to hit an unguarded `.length` or `[0]`.
const BARE_WS = {
  ok: true, shop: WS.shop, timeline: [], evidence: null, interpretation: null,
  plan: null, questions: null, browser: null, order: null, history: null, shops: [],
  packet: null, reconciliation: null,
};
// No shop at all — the packet view must say "nothing to have a packet FOR", not error.
const BARE_NO_SHOP = { ok: false, shop: null, timeline: [], evidence: null, interpretation: null,
  plan: null, questions: null, browser: null, order: null, history: null, shops: [] };
const EMPTY_RULES = {
  ...RULES,
  rules: { total_display: '0', active_display: '0', without_note_display: '0', groups: [], items: [] },
  decisions: { total_display: '0', standing_display: '0', promoted_display: '0', unpromoted_standing_display: '0', items: [] },
  regulars: { total_display: '0', active_display: '0', with_aliases_display: '0', alias_total_display: '0', without_product_id_display: '0', items: [] },
};

// The packet/reconciliation degradation ladder. Every rung is a DIFFERENT fact and the UI must show
// each differently — "not built", "not produced", "produced and empty" and "produced" are four
// answers, not one, and collapsing any pair is the exact class of dishonesty this view exists to
// avoid. So each rung gets its own scenario rather than being assumed to follow from the others.
const PACKET_NOT_BUILT = { ok: true, shop_id_display: '1', packet: null, reconciliation: null,
  packet_state: 'not_built', reconciliation_state: 'not_built' };
const PACKET_NOT_PRODUCED = { ok: true, shop_id_display: '1', packet: null, reconciliation: null,
  packet_state: 'not_produced', reconciliation_state: 'not_produced' };
const PACKET_NO_RECON = { ...PACKET, reconciliation: null, reconciliation_state: 'not_produced' };
const PACKET_EMPTY = {
  ...PACKET,
  packet: { ...PACKET.packet, lines: [], held: [], lines_count_display: '0', held_count_display: '0',
    new_items_count_display: '0', known_items_count_display: '0' },
  reconciliation: { ...PACKET.reconciliation, lines: [], unavailable: [], unexpected: [],
    lines_count_display: '0', unavailable_count_display: '0', unexpected_count_display: '0',
    mismatched_lines_count_display: '0', fully_reconciled: false, counts_agree_but_lines_do_not: false },
};
const PACKET_BAD_SORT = {
  ...PACKET,
  packet: { ...PACKET.packet, sort_verified: false, sort_first_break_display: '2' },
};

function scenarios(render) {
  const plan = [
    ['OVERVIEW (live shop)', 'overview', { asdairWs: WS, asdairWsErr: null }],
    ['DETAILS (live shop)', 'details', { asdairWs: WS, asdairWsErr: null }],
    ['DETAILS (shop present, every section empty)', 'details', { asdairWs: BARE_WS, asdairWsErr: null }],
    ['DETAILS (service down)', 'details', { asdairWs: null, asdairWsErr: 'service down' }],
    ['RULES (live rulebook)', 'rules', { asdairRules: RULES, asdairRulesErr: null }],
    ['RULES (read failed)', 'rules', { asdairRules: null, asdairRulesErr: 'not answering' }],
    ['RULES (empty rulebook)', 'rules', { asdairRules: EMPTY_RULES, asdairRulesErr: null }],
    ['BASKET (packet + reconciliation)', 'basket', { asdairWs: WS, asdairPacket: PACKET, asdairPacketErr: null }],
    ['BASKET (producers not built yet)', 'basket', { asdairWs: WS, asdairPacket: PACKET_NOT_BUILT, asdairPacketErr: null }],
    ['BASKET (built, nothing produced)', 'basket', { asdairWs: WS, asdairPacket: PACKET_NOT_PRODUCED, asdairPacketErr: null }],
    ['BASKET (packet, no reconciliation yet)', 'basket', { asdairWs: WS, asdairPacket: PACKET_NO_RECON, asdairPacketErr: null }],
    ['BASKET (produced but EMPTY - a measured zero)', 'basket', { asdairWs: WS, asdairPacket: PACKET_EMPTY, asdairPacketErr: null }],
    ['BASKET (declared sort is a lie)', 'basket', { asdairWs: WS, asdairPacket: PACKET_BAD_SORT, asdairPacketErr: null }],
    ['BASKET (read failed)', 'basket', { asdairWs: WS, asdairPacket: null, asdairPacketErr: 'not answering' }],
    ['BASKET (no shop in flight)', 'basket', { asdairWs: BARE_NO_SHOP, asdairPacket: null, asdairPacketErr: null }],
    ['ABOUT', 'about', { asdairWs: WS, asdairWsErr: null }],
  ];
  return plan.map(([name, view, refs]) => { setRefs(refs); return scenario(name, view, render); });
}

// ---------------------------------------------------------------------------
// MUTATION TEST — the `has` trap is the mechanism; prove it still catches.
// A harness whose detector has silently stopped detecting looks exactly like a clean run.
// ---------------------------------------------------------------------------
if (SELF_TEST) {
  const anchor = '<div class="app-view">';
  if (!opts.template.includes(anchor)) { console.error('SELF-TEST FAIL — anchor missing; rewrite the mutations.'); process.exit(1); }
  const cases = {
    'missing binding (undeclared identifier)':
      (t) => t.replace(anchor, anchor + '<p>{{ noSuchBindingAnywhere }}</p>'),
    'missing binding (undeclared helper call)':
      (t) => t.replace(anchor, anchor + '<p>{{ noSuchHelper(1) }}</p>'),
    'expression throws on real data':
      (t) => t.replace(anchor, anchor + '<p>{{ currentApp.nope.deeper }}</p>'),
  };
  let caught = 0, total = Object.keys(cases).length + 1; // +1 = the stray-JSON mutation below
  const missed = [];
  for (const [name, mutate] of Object.entries(cases)) {
    setRefs({ asdairWs: WS, asdairWsErr: null });
    const r = scenario('mutant', 'details', Vue.compile(mutate(opts.template)));
    const hit = r.err || r.missing.length;
    if (hit) { caught++; console.log('  caught  ' + name.padEnd(42) + ' -> ' + (r.err ? 'threw: ' + r.err.message.slice(0, 60) : 'missing: ' + r.missing.join(', '))); }
    else { missed.push(name); console.log('  MISSED  ' + name); }
  }
  // The stray-JSON detector gets its own mutation: reinstate the ACTUAL shipped bug — a per-line
  // `JSON.stringify` fallback outside any drawer — and assert it is caught. Without this, the
  // discriminator added above could quietly stop discriminating and every run would look clean.
  {
    setRefs({ asdairWs: WS, asdairWsErr: null });
    const mutated = opts.template.replace(anchor, anchor + '<p>{{ JSON.stringify(asdairWs) }}</p>');
    const r = scenario('mutant', 'details', Vue.compile(mutated));
    const strays = r.err ? [] : strayJsonBlobs(text(r.vnode));
    if (strays.length) { caught++; console.log('  caught  ' + 'stray raw JSON outside a drawer'.padEnd(42) + ' -> ' + strays[0].slice(0, 60)); }
    else { missed.push('stray raw JSON outside a drawer'); console.log('  MISSED  stray raw JSON outside a drawer'); }
  }
  // ...and the other half: the SANCTIONED drawer must NOT be flagged, or the check cries wolf and
  // gets ignored. A detector that fires on the feature is as useless as one that misses the bug.
  {
    setRefs({ asdairWs: WS, asdairWsErr: null });
    const r = scenario('control', 'details', Vue.compile(opts.template));
    const strays = strayJsonBlobs(text(r.vnode));
    console.log(strays.length
      ? '  CONTROL FAILED — the sanctioned "' + DRAWER_LABEL + '" drawer is being flagged as stray'
      : '  control  sanctioned raw-payload drawer correctly NOT flagged');
    if (strays.length) missed.push('drawer false-positive');
  }
  setRefs({ asdairWs: WS, asdairWsErr: null, asdairRules: RULES, asdairRulesErr: null });
  const control = scenarios(Vue.compile(opts.template));
  const dirty = control.filter((r) => r.err || r.missing.length);
  console.log(dirty.length
    ? '  CONTROL FAILED — unmutated template reports: ' + dirty.map((d) => d.name + (d.err ? ' threw' : ' missing ' + d.missing.join(','))).join(' | ')
    : '  control  all ' + control.length + ' unmutated scenarios clean (no false positive)');
  if (missed.length || dirty.length) { console.error('SELF-TEST FAIL'); process.exit(1); }
  console.log('SELF-TEST PASS — ' + caught + '/' + total + ' mutations caught, control clean.');
  process.exit(0);
}

const render = Vue.compile(opts.template);
setRefs({ asdairWs: WS, asdairWsErr: null, asdairRules: RULES, asdairRulesErr: null });
const results = scenarios(render);

let bad = 0;
const dump = [];
for (const r of results) {
  if (r.err) { console.error('RENDER FAIL — ' + r.name + ': ' + r.err.message); bad++; continue; }
  const t = text(r.vnode);
  const n = count(r.vnode).el;
  const blob = strayJsonBlobs(t);
  console.log(String(n).padStart(5) + ' vnodes  ' + String(t.join(' ').length).padStart(6) + ' chars  ' +
    (blob.length ? 'RAW-JSON-IN-TEXT:' + blob.length + '  ' : '') + r.name +
    (r.missing.length ? '   MISSING BINDINGS: ' + r.missing.join(', ') : ''));
  if (r.missing.length || blob.length) bad++;
  dump.push('===== ' + r.name + ' =====\n' + t.join('\n'));
}
if (DUMP) writeFileSync(DUMP, dump.join('\n\n'), 'utf8');
console.log(bad
  ? 'RENDER-VM-CHECK FAIL (' + bad + ' scenario(s))'
  : 'RENDER-VM-CHECK PASS — ' + results.length + ' scenarios rendered, no missing bindings, no raw JSON in visible text.');
process.exit(bad ? 1 : 0);
