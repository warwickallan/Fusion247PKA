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
// The REAL derivation, so these scenarios exercise the executive layer rather than a hand-made
// stand-in for it. A fixture without `summary` renders no L1 block at all — which is exactly how
// the re-cut could have shipped with 28 assertions silently passing against absent markup.
import { reportSummary, sessionEconomics } from './rotation-report.mjs';

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

// ── THE VERDICT LAYER, AND WHY RENDERING ALONE COULD NOT SEE THE FAILURE IT HAD TO SEE ──────────
//
// Everything above proves a view did not CRASH: it throws, it reaches an identifier nobody exposes,
// or it leaks a raw blob. None of those can see the failure Warwick actually prohibited —
// "`Unknown`, `not established` and `0` are materially different and must never be collapsed into
// one another."
//
// Concretely: drop the `v-if="rrHas(r.elapsedMinutes)"` guard on the rotation card and `rrInt(null)`
// returns the string "0", because `Number(null) === 0` and `isFinite(0)` is true. The template still
// compiles. Nothing throws. No binding is missing. No stray blob appears. **The check passes with a
// null on screen dressed as a measurement.** That is the whole defect, and no amount of additional
// rendering detects it.
//
// So the System scenarios carry ASSERTIONS over their rendered visible text, in the shape
// rotation-report-check.mjs already ships: ok(name, cond, detail), a ran/failed count, and a hard
// fail on zero executed assertions. A run that asserts nothing is a FAILURE, never a pass.
//
// Scope, deliberately: assertions are attached to the SYSTEM scenarios only. The 16 asdair scenarios
// keep exactly the coverage they had. Retro-fitting them is a different job and is not this one's.

// The visible text is a FLAT list in document order, so a <dt> label is immediately followed by the
// value rendered in its own <dd>. `valueAfter(parts, 'Elapsed')` is therefore that ONE field's
// rendered value, which is what lets an assertion bind to a single field.
//
// THIS PRECISION IS THE POINT. Asserting "the words 'not established' appear somewhere on this card"
// passes happily while the field under test prints 0 — every rotation card carries a dozen honest
// unknowns that would satisfy such a check. An assertion that cannot fail for the right reason is
// the same class of defect as a scenario that never runs.
function valueAfter(parts, label) {
  const i = parts.indexOf(label);
  if (i === -1) return null;
  return i + 1 < parts.length ? parts[i + 1] : null;
}
// Whole sentences are their own text nodes, so match within a node rather than across a join —
// joining first would let two unrelated fragments satisfy a phrase that is nowhere on screen.
const hasText = (parts, s) => parts.some((p) => p.includes(s));

// Run one scenario's assertions and push each result into `sink`. `sink` is supplied by the caller
// because the two callers want opposite things from a failure: the gate REPORTS it, while the
// mutation harness COUNTS it and expects it. A render that threw yields no text, so every assertion
// on it goes red — which is correct, and is why a thrown mutation still produces an honest count.
function runChecks(r, sink) {
  if (!r.checks) return;
  const parts = r.err ? [] : text(r.vnode);
  for (const [name, pred] of r.checks) {
    let pass = false, why = '';
    try { pass = !!pred(parts); } catch (e) { pass = false; why = 'predicate threw: ' + e.message; }
    if (!pass && r.err) why = why || 'the scenario threw before rendering: ' + r.err.message;
    sink(r.name + ' :: ' + name, pass, why);
  }
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

const ASDAIR_PLAN = [
    ['OVERVIEW (live shop)', 'overview', { asdairWs: WS, asdairWsErr: null }],
    // The two questions checks below are the regression this scenario exists to catch: the fixture
    // used to carry field names (question_display, answered_display...) that DO NOT EXIST on the
    // real assembleWorkspace.js payload, so a real drift in the template's field names would have
    // rendered "unknown" everywhere and passed silently — the harness could not see it because the
    // fixture was already wrong in the same way. It is now keyed field-for-field to the real payload.
    ['DETAILS (live shop)', 'details', { asdairWs: WS, asdairWsErr: null }, {}, [
      ['still-open question renders its real text, not a raw id',
        (p) => hasText(p, 'Is "placeholder juice" the Placeholder Orange Juice 1L you usually get?')],
      ['a RESOLVED question shows Warwick\'s own answer verbatim',
        (p) => hasText(p, 'You said: “Placeholder Sausages 400g”')],
      ['a RESOLVED question with a decision shows the plain-language resolution',
        (p) => hasText(p, 'Resolved to Placeholder Sausages 400g.')],
      ['the resolved count is shown next to the section, not just the open one',
        (p) => hasText(p, 'Resolved') && hasText(p, '1')],
      // REGRESSION — Vera, CONDITIONAL PASS, 2026-08-11: answered_at_display rendered as a raw
      // toISOString() instant right beside "You said: ..." / "-> Resolved to ...". The checked-in
      // fixture is now honest about the real formatter's output (see assembleWorkspace.js's
      // humanWhen()), so this assertion is a genuine render-layer guard, not one the fixture masks.
      ['no raw ISO timestamp anywhere in the Details view (a machine instant is never primary content)',
        (p) => !p.some((s) => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))],
    ]],
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

// ── SYSTEM AREA — the Session / Rotation Reports surface (Veritas Defect 5) ──────────────────────
//
// Every scenario above renders `area: 'apps'`. The System pane is the terminal `v-else` of the
// template, so until now NOTHING in this harness executed it: the whole rotation-report surface —
// its five-rung honesty chain, its order-break banner, its per-field unknown/zero distinction —
// was covered by the Proxy `has` trap only in areas that are actually rendered, and this one was
// not. A deleted binding or a broken v-if in there shipped green. That is Defect 5, verbatim.
//
// FIXTURES ARE SYNTHETIC, and here there is a second reason on top of the one in the header: the
// real rotation reports are Warwick's own session figures, and a report's own numbers must not
// appear as literals in this repository. Every value below is invented.
//
// The shape is keyed field-for-field to `mapRotation()` in services/cockpit/rotation-report.mjs.
// The frozen contract is "any field may be null", so throughout these fixtures `null` means NOT
// ESTABLISHED and `0` means MEASURED ZERO. Keeping those two apart on screen is the entire point of
// the assertions attached to each scenario.
const rrSpec = (specialist, dispatches, tokensIn, tokensOut, notes = null) =>
  ({ specialist, dispatches, tokensIn, tokensOut, notes });

// A fully-established report: every field measured. The baseline against which an unknown is visible
// as a difference rather than as the only thing on the card.
const RR_RECENT = {
  id: 'synthetic-rotation-a', createdAt: '2026-01-02T09:00:00.000Z', sessionDate: '2026-01-02',
  host: 'synthetic-host', hostVersion: '9.9.9-synthetic', branch: 'synthetic/branch-a',
  closingHead: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', closingHeadShort: 'aaaaaaa',
  mapPath: 'Deliverables/synthetic-map.md', deliverablePath: 'Deliverables/synthetic-report-a.md',
  elapsedMinutes: 95, contextTokensIn: 11000, contextTokensOut: 2200, subagentTokens: 340,
  specialistDispatches: 5,
  workOrders: { total: 4, firstDispatchSuccess: 3, amendments: 1, refusals: 1 },
  lines: { docChanged: 120, productChanged: 45 },
  gitStat: { insertions: 200, deletions: 60, doc_share_of_insertions_pct: 62.5 },
  allocation: { productPct: 40, adminPct: 20, evidencePct: 25, reworkPct: 10, waitingPct: 5 },
  findings: [{ confidence: 'high', text: 'A synthetic finding, carried verbatim.' }],
  unestablished: ['a synthetic unmeasured thing'],
  notes: 'A synthetic note.',
  specialists: [rrSpec('keel', 3, 9000, 1200, 'a synthetic dispatch note'), rrSpec('vera', 2, 4000, 800)],
};
// The older sibling. Its only job is to make ORDER a real property under test rather than an
// assumption: one report can never prove an ordering.
const RR_OLDER = {
  ...RR_RECENT,
  id: 'synthetic-rotation-b', createdAt: '2026-01-01T09:00:00.000Z', sessionDate: '2026-01-01',
  closingHead: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', closingHeadShort: 'bbbbbbb',
  deliverablePath: 'Deliverables/synthetic-report-b.md', elapsedMinutes: 40,
};

// THE CRITERION FIXTURE. Warwick's rule made concrete on ONE card: unknowns and measured zeros sit
// in adjacent rows of the same block, so a collapse in either direction is visible as a difference
// between two lines a reader can see at once.
//
//   NOT ESTABLISHED (null)          MEASURED ZERO (0)
//   elapsedMinutes                  workOrders.firstDispatchSuccess   <- the pairing WO-25's live
//   hostVersion                     lines.docChanged                     data actually contains
//   lines.productChanged            gitStat.doc_share_of_insertions_pct
//   allocation.reworkPct            allocation.productPct
//   findings[0].confidence          specialists[0].dispatches
const RR_UNKNOWN_AND_ZERO = {
  ...RR_RECENT,
  id: 'synthetic-rotation-c', createdAt: '2026-01-03T09:00:00.000Z', sessionDate: '2026-01-03',
  closingHead: 'cccccccccccccccccccccccccccccccccccccccc', closingHeadShort: 'ccccccc',
  deliverablePath: 'Deliverables/synthetic-report-c.md',
  hostVersion: null,
  elapsedMinutes: null,
  workOrders: { total: 6, firstDispatchSuccess: 0, amendments: 0, refusals: 2 },
  lines: { docChanged: 0, productChanged: null },
  gitStat: { insertions: 0, deletions: 0, doc_share_of_insertions_pct: 0 },
  allocation: { productPct: 0, adminPct: 20, evidencePct: 25, reworkPct: null, waitingPct: 5 },
  findings: [{ confidence: null, text: 'A synthetic finding whose confidence was never established.' }],
  unestablished: [],
  specialistDispatches: 0,
  specialists: [rrSpec('keel', 0, 0, null)],
};

// Every field and every CONTAINER null. This is where a sum over nothing becomes a measurement:
// rrAllocSum returns 0 for a card with no measured slice at all, and the note once read "the
// measured slices account for 0% of the session" — a computed zero presented as a measurement, at
// the aggregate level where it is easiest to miss. app.js carries a ⚠️ comment about exactly that
// regression; this scenario is what would now catch it coming back.
const RR_ALL_NULL = {
  id: null, createdAt: null, sessionDate: null, host: null, hostVersion: null, branch: null,
  closingHead: null, closingHeadShort: null, mapPath: null, deliverablePath: null,
  elapsedMinutes: null, contextTokensIn: null, contextTokensOut: null, subagentTokens: null,
  specialistDispatches: null,
  workOrders: null, lines: null, gitStat: null, allocation: null,
  findings: null, unestablished: null, notes: null, specialists: null,
};

// ⚠️ THESE SCENARIOS RUN AGAINST `system` — and this constant has now moved TWICE in one day.
//
// 2026-08-08 morning: Warwick placed Session/Rotation Reports and CAPAE in SETTINGS, so this read
// `settings`. 2026-08-08 afternoon: he corrected that placement — they belong in SYSTEM, which owns
// current operational state, CAPAE, session performance and operational history. Settings returns to
// configuration and app information.
//
// THE REASON THIS COMMENT IS LONGER THAN THE LINE IT EXPLAINS: each time the markup moved, 45 of the
// 54 assertions below went green against a pane that no longer contained the surface. A check bound
// to the wrong area does not fail loudly — it passes quietly, which is worse than having no check at
// all. If the placement moves again, move this constant IN THE SAME COMMIT.
//
// `currentView` is left pointing at a real app view so nothing OUTSIDE the area branches degrades:
// the scenario under test is the reports/CAPAE surface, not a half-initialised shell.
const SYS = { area: 'system' };
// The four rr* refs are set on EVERY System scenario, never partially: they are shared module state,
// and a scenario that inherits a previous one's rrErr is testing something nobody wrote down.
// `rrOpenCard: '0'` OPENS THE FIRST CARD, and it is load-bearing rather than convenience.
// The 2026-08-08 executive re-cut put every metric, identifier and "not established" line behind a
// per-card disclosure. Left closed, 28 of these assertions would have gone green by asserting
// against markup that no longer rendered at all — the failure mode this whole check exists to catch.
// Opening the card keeps every L3/L4 assertion testing real rendered output AND proves the
// disclosure actually reveals it.
const rrRefs = (reports, { loading = false, err = null, requested = true, open = '0' } = {}) =>
  ({ rrReports: Array.isArray(reports) ? reports.map((r) => ({ ...r, summary: reportSummary(r), econ: sessionEconomics(r) })) : reports,
    rrLoading: loading, rrErr: err, rrRequested: requested, rrOpenCard: open });

// ── HOME: the single attention signal and the widened Recent activity feed ───────────────────────
// Added 2026-08-08. There was NO Home scenario at all, so the attention card and the CAPAE rows in
// the feed would have shipped entirely uncovered — the third time in one day that new markup sat
// outside every check. `capOverview`/`capList` are written as REAL refs so the real computeds
// (`homeAttention`, `latest`) run rather than being stubbed.
const CAP_ATTN = {
  capRequested: true, capLoading: false, capErr: null,
  capFamilies: [
    { slug: 'record-amended-body-not-recut', title: 'A record is amended and the rows it contradicts are left standing',
      state: 'CHALLENGED', occurrences: 5, last_occurrence_at: '2026-08-08T04:03:00.000Z',
      root_cause: 'Amendment-by-append with no reconciliation step.', is_pilot: false, unmeasurable: false,
      exposures_clean: 0, exposures_required: 5, history: [] },
    { slug: 'work-order-not-generated', title: 'Work Order issued outside the generated envelope route',
      state: 'MONITORING', occurrences: 2, last_occurrence_at: '2026-08-07T09:00:00.000Z',
      root_cause: 'The generation route is treated as exempt.', is_pilot: true, unmeasurable: false,
      exposures_clean: 0, exposures_required: 5, history: [] },
  ],
  capOverview: { total: 2, counts: { MONITORING: 1, CHALLENGED: 1, EFFECTIVE: 0, INEFFECTIVE: 0, UNMEASURABLE: 0 },
    needsAttention: true, attention: '1 prevention in doubt', ineffective: [],
    reopened: [{ slug: 'record-amended-body-not-recut', title: 'A record is amended and the rows it contradicts are left standing', occurrences: 5 }],
    becameEffective: [], pilot: null, latest: null },
  capActive: [],
};
const CAP_QUIET = {
  ...CAP_ATTN,
  capOverview: { ...CAP_ATTN.capOverview, needsAttention: false, attention: 'Nothing in doubt', reopened: [] },
};

const HOME_PLAN = [
  ['HOME (a prevention is in doubt)', 'overview', CAP_ATTN, { area: 'home' }, [
    ['the attention card names the count in plain language',
      (p) => hasText(p, '1 prevention needs attention')],
    ['it names the actual family, not a slug',
      (p) => hasText(p, 'A record is amended and the rows it contradicts are left standing')],
    ['it carries the occurrence count and a way through to System',
      (p) => hasText(p, '5 occurrences') && hasText(p, 'System →')],
    ['⭐ Home does NOT become a second CAPAE dashboard',
      (p) => !hasText(p, 'CAPAE — the learning loop') && !hasText(p, 'MUST:')],
    ['Recent activity carries the CAPAE event, not just ingestion',
      (p) => hasText(p, 'Recent activity') && hasText(p, 'Prevention challenged')],
  ]],
  ['HOME (nothing in doubt — the card must stay quiet)', 'overview', CAP_QUIET, { area: 'home' }, [
    ['⭐ no attention card at all when nothing needs attention',
      (p) => !hasText(p, 'needs attention') && !hasText(p, 'System →')],
    ['but the pane still renders',
      (p) => hasText(p, 'Recent activity')],
  ]],
];

const SYSTEM_PLAN = [
  // AC1 ① — two reports, most recent first. The ordering holds, so the ORDER WRONG branch must NOT
  // fire; a banner that appears on correct data is as bad as one that never appears on wrong data.
  ['SYSTEM (two rotation reports, most recent first)', 'overview',
    rrRefs([RR_RECENT, RR_OLDER]), SYS, [
      ['the group count is the number of reports read', (p) => valueAfter(p, 'Session / Rotation Reports') === '2'],
      ['the plural sentence states they were read and are shown in the supplied order',
        (p) => hasText(p, 'rotation reports were') && hasText(p, 'shown below in the order supplied.')],
      ['no ORDER WRONG banner on a correctly ordered pair', (p) => !hasText(p, 'ORDER WRONG')],
      // Re-cut 2026-08-08: card 0 is OPEN so its short head renders; card 1 is COLLAPSED and is
      // identified by the session date on its L1 chip. Both cards must still be present — the second
      // report vanishing behind the first card's disclosure is the defect this guards.
      ['both reports render — the first expanded, the second as a collapsed card',
        (p) => hasText(p, 'aaaaaaa') && hasText(p, '2026-01-01') && hasText(p, '2026-01-02')],
      ['a measured elapsed time renders as a formatted duration, not as words',
        (p) => valueAfter(p, 'Elapsed') === '1h 35m'],
      ['a measured Work Order outcome renders as digits over its denominator',
        (p) => valueAfter(p, 'Survived first read-back') === '3 of 4'],
    ]],

  // AC1 ② — the SAME two reports supplied in the wrong order. The cockpit never re-sorts; a declared
  // order that is not the actual order is a PRODUCER defect and is surfaced, and this branch was
  // rendered by no scenario at all before now.
  ['SYSTEM (reports supplied OUT of order)', 'overview',
    rrRefs([RR_OLDER, RR_RECENT]), SYS, [
      ['the order break is surfaced rather than silently re-sorted', (p) => hasText(p, 'ORDER WRONG')],
      ['the banner names the exact position the order first breaks',
        (p) => hasText(p, 'The order first breaks at report 2.')],
      ['the reports are still shown, in the order actually supplied',
        (p) => hasText(p, '2026-01-01') && hasText(p, '2026-01-02') && valueAfter(p, 'Closing head') === 'bbbbbbb'],
    ]],

  // AC1 ③ + ④ + AC2 — THE DECIDING SCENARIO. Each assertion binds to ONE field, and the unknown and
  // the zero it is paired against sit in the same block.
  ['SYSTEM (an unknown field beside a genuine measured zero)', 'overview',
    rrRefs([RR_UNKNOWN_AND_ZERO]), SYS, [
      ['an unestablished elapsed time renders as words, NOT as 0',
        (p) => valueAfter(p, 'Elapsed') === 'not established'],
      ['a measured zero renders as digits over its denominator, NOT as "not established"',
        (p) => valueAfter(p, 'Survived first read-back') === '0 of 6'],
      ['unknown and zero are DIFFERENT on the same card',
        (p) => valueAfter(p, 'Elapsed') !== valueAfter(p, 'Survived first read-back')],
      ['an unestablished host version renders as words',
        (p) => valueAfter(p, 'Host version') === 'not established'],
      ['adjacent rows: unestablished product lines render as words',
        (p) => valueAfter(p, 'Product lines') === 'not established'],
      ['adjacent rows: zero documentation lines render as a digit',
        (p) => valueAfter(p, 'Documentation lines') === '0'],
      ['a measured zero percentage renders as 0%, not as words',
        (p) => valueAfter(p, 'Documentation share of insertions') === '0%'],
      ['a measured zero allocation slice renders as 0%',
        (p) => valueAfter(p, 'Product') === '0%'],
      ['an unmeasured allocation slice in the same list renders as words',
        (p) => valueAfter(p, 'Rework') === 'not established'],
      ['a partial allocation reports what the MEASURED slices account for',
        (p) => hasText(p, 'The measured slices account for 50% of the session.')],
      ['an unmeasured confidence gets the words and no chip',
        (p) => hasText(p, 'confidence not established')],
      ['the finding text is carried verbatim beside its unestablished confidence',
        (p) => hasText(p, 'A synthetic finding whose confidence was never established.')],
      ['an empty unestablished list is a measured emptiness, not an unknown',
        (p) => hasText(p, 'Nothing was left unestablished in this rotation.')],
      // Re-anchored 2026-08-08: the specialist drill-down now renders the count as a chip
      // ("0 dispatches") ahead of the older raw block, so `valueAfter` lands on the chip. THE
      // PROPERTY IS UNCHANGED and is the one that matters — a MEASURED zero must render as 0 and
      // must never degrade into "not measured", because those are different answers about a
      // specialist who was configured but never dispatched.
      ['a specialist with zero dispatches renders a zero, not an unknown',
        (p) => hasText(p, '0 dispatches') && !hasText(p, 'keel cost not measured')],
      ['an unestablished token count on that same specialist renders as words',
        (p) => valueAfter(p, 'Tokens out') === 'not established'],
    ]],

  // Every container null. The degenerate card must stay honest field by field, and — the part that
  // was once actually wrong — must NOT print a total over nothing.
  ['SYSTEM (a report whose every field and container is null)', 'overview',
    rrRefs([RR_ALL_NULL]), SYS, [
      ['the singular sentence is used for a single report',
        (p) => hasText(p, 'rotation report was') && !hasText(p, 'rotation reports were')],
      ['an unestablished session date is said in words in the card title',
        (p) => hasText(p, 'session date not established')],
      ['an unestablished host is said in words in the eyebrow',
        (p) => hasText(p, 'host not established')],
      ['a null workOrders CONTAINER degrades to per-field unknowns, not to zeros',
        (p) => valueAfter(p, 'Survived first read-back') === 'not established'],
      ['a null lines CONTAINER degrades to per-field unknowns',
        (p) => valueAfter(p, 'Product lines') === 'not established'],
      ['a null allocation CONTAINER degrades to per-field unknowns',
        (p) => valueAfter(p, 'Product') === 'not established' && valueAfter(p, 'Waiting') === 'not established'],
      ['a total over NO measurements is refused, not printed as 0%',
        (p) => !hasText(p, 'The measured slices account for')],
      ['and it is refused IN WORDS that say why',
        (p) => hasText(p, 'None of the effort allocation was measured for this rotation')],
      ['null findings are "not established", never "none recorded"',
        (p) => hasText(p, 'Findings were not established for this rotation.')
          && !hasText(p, 'recorded no findings')],
      ['a null unestablished-list is itself reported as not established',
        (p) => hasText(p, 'The list of unestablished measurements was itself not established.')],
      ['a null specialist breakdown is "not established", never "no dispatches"',
        (p) => hasText(p, 'The specialist breakdown was not established for this rotation.')
          && !hasText(p, 'recorded no specialist dispatches')],
      ['an unestablished elapsed time is still words on a card with nothing measured',
        (p) => valueAfter(p, 'Elapsed') === 'not established'],
    ]],

  // AC1 ⑤ — read, and there are none. A MEASURED ZERO at the list level, and the one rung most
  // easily confused with the two either side of it.
  ['SYSTEM (reports read and there are none — a measured zero)', 'overview',
    rrRefs([]), SYS, [
      ['the empty state says they were READ and there are none',
        (p) => hasText(p, 'The reports were read and there are none recorded yet.')],
      ['it is not confused with a failed read', (p) => !hasText(p, 'COULD NOT BE READ')],
      ['it is not confused with not having asked', (p) => !hasText(p, 'have not been read yet')],
      ['nothing is guessed at in the meantime', (p) => hasText(p, 'Nothing is being guessed at in the meantime.')],
    ]],

  // Not asked yet. "We have not looked" is not "there are none", and this rung exists to keep those
  // two sentences apart.
  ['SYSTEM (the reports have not been asked for yet)', 'overview',
    rrRefs(null, { requested: false }), SYS, [
      ['the surface says it has not asked yet',
        (p) => hasText(p, 'The rotation reports have not been read yet.')],
      ['it does not claim there are none', (p) => !hasText(p, 'there are none recorded yet')],
      ['the trigger offers to read them', (p) => hasText(p, 'Read them')],
    ]],

  // In flight. Leads the chain on rrLoading alone so a RE-read announces too, and the already-read
  // cards stay on screen under it rather than blanking.
  ['SYSTEM (a read is in flight over already-read reports)', 'overview',
    rrRefs([RR_RECENT], { loading: true }), SYS, [
      ['the in-flight state is announced', (p) => hasText(p, 'Reading the rotation reports…')],
      ['the already-read card is NOT blanked while the re-read runs', (p) => hasText(p, 'aaaaaaa')],
      ['the trigger says what it is doing', (p) => hasText(p, 'Reading…')],
    ]],

  // AC1 ⑥ — the database read failed. Two separate properties: the failure is stated truthfully, AND
  // it is CONTAINED — "failure to load historical reports must not break the rest of the System tab".
  ['SYSTEM (the database read FAILED)', 'overview',
    rrRefs(null, { err: 'the database is not answering' }), SYS, [
      ['the failure is stated as a failure', (p) => hasText(p, 'COULD NOT BE READ')],
      ['and it is explicitly NOT reported as an absence of reports',
        (p) => hasText(p, 'that is not the same as there being none.')],
      ['the underlying reason is shown in words', (p) => hasText(p, 'the database is not answering')],
      ['no empty-list wording appears on a failed read', (p) => !hasText(p, 'there are none recorded yet')],
      ['CONTAINMENT: the System header still renders', (p) => hasText(p, 'System')],
      ['CONTAINMENT: the status line above still renders', (p) => hasText(p, 'Building — nothing blocking me')],
      // Re-anchored TWICE on 2026-08-08, following the surface back into System. The PROPERTY never
      // changed and is Amendment 7's: a failed report read must not take the rest of the pane down
      // with it. Only the neighbouring group moved — "Happening now" is System's, and it is the
      // group that must survive a database failure in the reports below it.
      ['CONTAINMENT: the "Happening now" group above still renders',
        (p) => hasText(p, 'Happening now') && hasText(p, 'Nothing actively building.')],
      ['the failure offers a retry', (p) => hasText(p, 'Try again')],
    ]],
];

// One renderer for both plans, so a System scenario cannot drift onto a different mechanism from an
// asdair one. `overrides` and `checks` are optional: the 16 asdair entries supply neither and are
// rendered exactly as they were before.
function renderPlan(plan, render) {
  return plan.map(([name, view, refs, overrides, checks]) => {
    setRefs(refs);
    const r = scenario(name, view, render, overrides || {});
    r.checks = checks || null;
    return r;
  });
}
function scenarios(render) {
  return renderPlan(ASDAIR_PLAN, render).concat(renderPlan(SYSTEM_PLAN, render)).concat(renderPlan(HOME_PLAN, render));
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
  // ── THE ROTATION-REPORT MUTATIONS — non-vacuity of the verdict layer ────────────────────────
  //
  // These are PERMANENT, not a one-off run reported in a message. CI executes `--self-test` before
  // the gate, so the red counts below are regenerated by the machine on every run instead of
  // resting on one worker's word in a return that gets cleared. A control proven once is a memory;
  // one re-proven each run is durable.
  //
  // Every mutation is IN MEMORY. `public/app.js` is never written — not even temporarily — because
  // it is outside this work's file surface, and a temporary write is a write.
  //
  // The first case is the one that matters: it removes the `rrHas` guard so `rrInt(null)` prints
  // "0". Nothing throws, no binding goes missing, no blob appears — under the pre-existing detectors
  // alone this mutation was INVISIBLE. If it ever stops turning assertions red, the verdict layer
  // has stopped verdicting.
  const RR_ANCHOR = '<div><dt>Elapsed</dt><dd><span v-if="rrHas(r.elapsedMinutes)" class="rr-num">{{ rrMins(r.elapsedMinutes) }}</span><span v-else class="rr-unk">not established</span></dd></div>';
  if (!opts.template.includes(RR_ANCHOR)) {
    // Loud abort, deliberately: a mutation that silently stops mutating produces a green that means
    // nothing at all, and it looks identical to a clean run.
    console.error('SELF-TEST FAIL — the rotation-report Elapsed-row anchor no longer matches the template.');
    console.error('  The template changed. Re-derive the anchor from public/app.js and rewrite the mutation;');
    console.error('  do NOT delete this case, and do NOT relax it to a substring that still matches.');
    process.exit(1);
  }
  const rrCases = {
    'rotation: unknown COLLAPSES TO 0 (guard dropped)':
      (t) => t.replace(RR_ANCHOR, '<div><dt>Elapsed</dt><dd><span class="rr-num">{{ rrInt(r.elapsedMinutes) }}</span></dd></div>'),
    'rotation: the unknown branch is deleted (renders nothing)':
      (t) => t.replace(RR_ANCHOR, '<div><dt>Elapsed</dt><dd><span v-if="rrHas(r.elapsedMinutes)" class="rr-num">{{ rrMins(r.elapsedMinutes) }}</span></dd></div>'),
    'rotation: the guard helper is misspelled (missing binding)':
      (t) => t.replace(RR_ANCHOR, RR_ANCHOR.replace(/rrHas\(/g, 'rrHazz(')),
  };
  // Count reds rather than reporting them: here a failing assertion is the EXPECTED result, and
  // printing it as a failure would train a reader to ignore the word.
  //
  // `legacy` counts the scenarios in which the PRE-EXISTING detectors fired — a throw, a missing
  // binding, or a stray blob. It is reported beside the red count on purpose: for the first case it
  // is 0, and that zero is the whole argument for this layer existing. The claim "the old detectors
  // could not see this" is then regenerated by the machine on every run rather than asserted once by
  // whoever wrote the change.
  const redsUnder = (tmpl) => {
    let red = 0, total = 0, legacy = 0;
    for (const r of renderPlan(SYSTEM_PLAN, Vue.compile(tmpl))) {
      if (r.err || r.missing.length || (!r.err && strayJsonBlobs(text(r.vnode)).length)) legacy++;
      runChecks(r, (_n, pass) => { total++; if (!pass) red++; });
    }
    return { red, total, legacy };
  };
  total += Object.keys(rrCases).length;
  for (const [name, mutate] of Object.entries(rrCases)) {
    const { red, total: n, legacy } = redsUnder(mutate(opts.template));
    const seen = ' | pre-existing detectors fired in ' + legacy + ' scenario(s)';
    if (red > 0) { caught++; console.log('  caught  ' + name.padEnd(48) + ' -> ' + red + ' of ' + n + ' assertions RED' + seen); }
    else { missed.push(name); console.log('  MISSED  ' + name.padEnd(48) + ' -> 0 of ' + n + ' assertions red' + seen); }
  }

  setRefs({ asdairWs: WS, asdairWsErr: null, asdairRules: RULES, asdairRulesErr: null });
  const control = scenarios(Vue.compile(opts.template));
  const dirty = control.filter((r) => r.err || r.missing.length);
  console.log(dirty.length
    ? '  CONTROL FAILED — unmutated template reports: ' + dirty.map((d) => d.name + (d.err ? ' threw' : ' missing ' + d.missing.join(','))).join(' | ')
    : '  control  all ' + control.length + ' unmutated scenarios clean (no false positive)');
  // The verdict layer's own control: on the UNMUTATED template every assertion must pass, and there
  // must be some. A mutation harness that reports reds while the control is also red proves nothing.
  let cRan = 0, cRed = 0;
  for (const r of control) runChecks(r, (_n, pass) => { cRan++; if (!pass) cRed++; });
  console.log(cRed
    ? '  CONTROL FAILED — ' + cRed + ' of ' + cRan + ' assertions red on the UNMUTATED template'
    : '  control  ' + cRan + ' assertions executed on the unmutated template, all green');
  if (cRan === 0) { console.error('  CONTROL FAILED — zero assertions executed; the verdict layer is vacuous.'); }
  if (missed.length || dirty.length || cRed || cRan === 0) { console.error('SELF-TEST FAIL'); process.exit(1); }
  console.log('SELF-TEST PASS — ' + caught + '/' + total + ' mutations caught, control clean.');
  process.exit(0);
}

const render = Vue.compile(opts.template);
setRefs({ asdairWs: WS, asdairWsErr: null, asdairRules: RULES, asdairRulesErr: null });
const results = scenarios(render);

let bad = 0, ran = 0, failed = 0;
const sink = (name, pass, why) => {
  ran++;
  if (pass) return;
  failed++;
  console.error('  ASSERTION FAILED — ' + name + (why ? '  (' + why + ')' : ''));
};
const dump = [];
for (const r of results) {
  if (r.err) { console.error('RENDER FAIL — ' + r.name + ': ' + r.err.message); bad++; runChecks(r, sink); continue; }
  const t = text(r.vnode);
  const n = count(r.vnode).el;
  const blob = strayJsonBlobs(t);
  const before = ran;
  runChecks(r, sink);
  console.log(String(n).padStart(5) + ' vnodes  ' + String(t.join(' ').length).padStart(6) + ' chars  ' +
    String(ran - before).padStart(3) + ' asserts  ' +
    (blob.length ? 'RAW-JSON-IN-TEXT:' + blob.length + '  ' : '') + r.name +
    (r.missing.length ? '   MISSING BINDINGS: ' + r.missing.join(', ') : ''));
  if (r.missing.length || blob.length) bad++;
  dump.push('===== ' + r.name + ' =====\n' + t.join('\n'));
}
if (DUMP) writeFileSync(DUMP, dump.join('\n\n'), 'utf8');
// Zero executed assertions is a FAILURE, not a pass — the same rule the estate's other gates carry.
// A check that renders 24 scenarios and asserts nothing about any of them is exactly the vacuous
// green this file was extended to stop.
if (ran === 0) { console.error('RENDER-VM-CHECK FAIL — zero assertions executed.'); process.exit(1); }
if (bad || failed) {
  console.error('RENDER-VM-CHECK FAIL — ' + bad + ' scenario(s) with render defects, ' +
    failed + ' of ' + ran + ' assertions failed.');
  process.exit(1);
}
console.log('RENDER-VM-CHECK PASS — ' + results.length + ' scenarios rendered, ' + ran +
  ' assertions executed, 0 failed. No missing bindings, no raw JSON in visible text, and no unknown rendered as a zero.');
process.exit(0);
