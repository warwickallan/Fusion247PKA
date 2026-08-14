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
// ── FIXTURES ARE SYNTHETIC, DELIBERATELY — AND NOT FOR PRIVACY ───────────────────────────────────
// ⛔ CORRECTED 2026-08-13. This block previously said the shopping payloads "are personal data that
// must never be committed". THAT IS FALSE, and it inverted a ruling Warwick has now had to give
// THREE times (2026-07-27, 2026-08-04, 2026-08-12): "nothing private about my shopping as I have
// told you a million times and is meant to be written down!" This repository is public and that is
// FINE. Product names, regulars, quantities, run outputs and itemised lists are COMMITTED on
// purpose. Only SECRETS stay out — credentials, tokens, connection strings.
//
// The fixtures under `fixtures/` are hand-written for a different and still-good reason:
// A GATE MUST BE DETERMINISTIC. Real captures change every week, so a harness pinned to one would
// go red on a change in the shop rather than a change in the code, and its failures would stop
// meaning anything. The fixtures are structurally faithful to the live payload shape and stable by
// construction. Point `--ws` at a live capture when you want to check against real data — and that
// capture may be committed if it is useful; there is no privacy reason to withhold it.
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
// ⛔ RECURRENCE GUARD — WP-B15-42. The Vue template in app.js is a JS TEMPLATE LITERAL, so a single
// backtick anywhere inside it (in an HTML comment, in copy, in a field name someone quoted the way
// they would in a code comment) TERMINATES THE STRING and the whole file stops parsing. Node reports
// that as `SyntaxError: Unexpected identifier` pointing at a word in the middle of a comment, which
// says nothing about the cause. It cost two debugging rounds in this WP alone, both self-inflicted.
//
// So the parse failure is caught and the LIKELY CAUSE is named. Deliberately advisory, not clever:
// the file has already failed to parse, so the template's real boundaries cannot be established —
// this reports every backtick inside an HTML comment, which is where the mistake is always made,
// and then rethrows the original error unchanged so nothing is hidden.
try {
  load('app.js');
} catch (e) {
  // ⛔ `e.name`, NOT `e instanceof SyntaxError`. The script is compiled inside a `vm` CONTEXT, which
  // has its own intrinsics — the SyntaxError it throws is not the host realm's SyntaxError, so
  // `instanceof` is FALSE and the guard silently did nothing. Found by making the guard fail on
  // purpose rather than by trusting that it worked, which is the only reason it was found at all.
  if (e && e.name === 'SyntaxError') {
    const src = readFileSync(path.join(PUB, 'app.js'), 'utf8').split(/\r?\n/);
    const hits = [];
    let inComment = false;
    src.forEach((line, i) => {
      if (line.includes('<!--')) inComment = true;
      if (inComment && line.includes('`')) hits.push('    app.js:' + (i + 1) + '  ' + line.trim().slice(0, 90));
      if (line.includes('-->')) inComment = false;
    });
    if (hits.length) {
      console.error('RENDER-VM-CHECK — app.js did not parse. LIKELY CAUSE: a backtick inside the Vue');
      console.error('  template literal. The template is delimited by backticks, so one inside it ends');
      console.error('  the string. Backticks found inside HTML comments:');
      hits.forEach((h) => console.error(h));
      console.error('  Remove them (plain words, not code quotes), then re-run. Original error follows.');
    }
  }
  throw e;
}

const Vue = sb.Vue;
const opts = captured[0];
// The real setup(), so the real computeds are exercised rather than stubbed.
const bindings = opts.setup ? opts.setup() : {};
const unwrap = (v) => (v && typeof v === 'object' && '__v_isRef' in v) ? v.value : v;
const app = sb.window.FUSION_APPS.find((a) => a.key === 'asdair');

// ══ WP-B15-45 — THE HOUSEHOLD SURFACE (public/shopping.js) ═══════════════════════════════════════
//
// A SECOND APP, IN THE SAME GATE, DELIBERATELY. shopping.js is a separate Vue application on a
// separate page with a separate stylesheet — that separateness is the product requirement
// (Addendum B §2: a separate surface, never a mode). But a second GATE is not implied by a second
// surface, and would be worse: two gates drift, and the one nobody runs is the one that goes red.
// So it loads into the same sandbox and captures the second createApp call.
//
// It must load AFTER app.js, because `captured[0]` is the operator app and every existing scenario
// indexes it. `captured[1]` is this one.
load('shopping.js');
const shopOpts = captured[1];
if (!shopOpts) {
  throw new Error('render-vm-check: public/shopping.js did not register a Vue app. It calls '
    + 'Vue.createApp(...).mount("#shop") at the end of its IIFE; if that line moved or the IIFE now '
    + 'returns early, every household-surface scenario below would silently disappear from this '
    + 'gate while it kept reporting PASS. Failing loudly instead.');
}
// The real setup(), for the same reason the operator app uses the real one: buildSections, the
// clamp and the count are the logic under test, and a stub would test the stub.
const shopBindings = shopOpts.setup ? shopOpts.setup() : {};
// The pure helpers, reached through the app's own published surface so the gate executes THE
// SHIPPING FUNCTIONS rather than a copy of them. clampQty is a safety property (Addendum B §6.4
// rule 5, "enforced in state, not only in the view") and a safety property tested only through a
// rendered template has not been tested at its boundaries at all.
const SHOP = sb.window.FUSION_SHOPPING;
if (!SHOP || typeof SHOP.clampQty !== 'function') {
  throw new Error('render-vm-check: window.FUSION_SHOPPING is not published by shopping.js, so the '
    + 'quantity clamp cannot be executed directly. Restore the export rather than weakening the check.');
}

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
  // ⛔ THE RECURRENCE GUARD. Vera, WP-B15-36 gate, LOW 3 — and it is here because the failure it
  // prevents already happened once, cost the AsdAIr screens every scrap of render coverage from
  // f7bf71a onward, and made three mutation "catches" vacuous.
  //
  // A scenario names its view by STRING against a registry that lives in another file. Rename a key
  // in apps.js and `find` silently returns undefined, `currentView.label` throws in the breadcrumb
  // BEFORE the mutation or the template can be reached, and `--self-test` scores that throw as a
  // catch. The run stays green and means nothing.
  //
  // So this fails LOUDLY and NAMES THE CAUSE, instead of leaving the next reader to work it back
  // from "Cannot read properties of undefined (reading 'label')". Deliberately a hard throw, not a
  // recorded error: a mis-keyed scenario is a broken harness, and a broken harness must never be
  // able to present itself as a passing one.
  //
  // NO_APP_VIEW is the honest way to say "this scenario does not render an app view at all" — the
  // Home and System plans override `area`, so the app workspace never renders and the view key is
  // irrelevant to them. They previously carried the string 'overview', which was ALSO a dead key;
  // that is a coincidence worth removing rather than preserving, because a real key sitting there
  // unused is indistinguishable from a real key that has silently gone stale.
  const resolvedView = viewKey === NO_APP_VIEW ? null : app.views.find((v) => v.key === viewKey);
  if (viewKey !== NO_APP_VIEW && !resolvedView) {
    throw new Error('render-vm-check: scenario "' + name + '" names view key "' + viewKey
      + '", which the app registry does not carry. Known keys: ' + app.views.map((v) => v.key).join(', ')
      + '. A view was almost certainly renamed in apps.js without this file being updated — fix the '
      + 'key here rather than letting the breadcrumb throw and be scored as a passing mutation.');
  }
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
    currentView: resolvedView,
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

/** Sentinel for a scenario that renders no app view (Home, System — they override `area`). A named
 * value, not a bare null, so the intent is legible at every call site and the guard in scenario()
 * can tell "deliberately no view" apart from "view key has gone stale". */
const NO_APP_VIEW = Symbol('no app view rendered by this scenario');

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
//
// ⛔ REPAIRED IN WP-B15-36, and the defect is worth recording because it is the failure mode this
// whole harness exists to prevent, committed by the harness itself. The heading in app.js reads
// "Raw payloadS (debugging only)" — plural, because the drawer holds three. This constant was the
// SINGULAR string, so `.includes()` never matched, the sanctioned drawer was reported as a stray
// blob on every run, and the ABOUT scenario has been red since. A permanently-red scenario is a
// gate nobody reads. The match is now on the STABLE STEM, which is what the discriminator actually
// depends on; the full label survives for the message. Confirmed pre-existing by executing this
// file on untouched HEAD 86cfc08.
const DRAWER_LABEL = 'Raw payloads (debugging only)';
const DRAWER_STEM = 'debugging only';
function strayJsonBlobs(textParts) {
  const out = [];
  // SECOND HALF OF THE SAME REPAIR. The three-part lookbehind assumed ONE drawer. Diagnostics
  // renders up to THREE (Workspace · Rulebook · Packet), and once the first drawer's own blob —
  // which is thousands of characters — sits between the heading and the second drawer, the window
  // can never reach back to it. So the second and third drawers were flagged as stray on every run.
  // The heading INTRODUCES A GROUP, so once it has appeared in this view, the raw-payload area has
  // begun. The trade is stated rather than hidden: a genuinely stray blob placed AFTER that heading
  // in the same view would now be missed. It is accepted because the heading is the last block on
  // the only screen that carries it, and because the alternative — a permanently red scenario — is
  // a gate nobody reads. The self-test's stray-blob mutation injects at `<div class="app-view">`,
  // BEFORE the heading, so it still fires; that is what keeps this non-vacuous.
  let drawerOpen = false;
  for (let i = 0; i < textParts.length; i++) {
    const s = textParts[i];
    if (s.includes(DRAWER_STEM)) drawerOpen = true;
    if (!s.startsWith('{') || s.length <= 200) continue;
    const behindDrawer = drawerOpen || textParts.slice(Math.max(0, i - 3), i).some((p) => p.includes(DRAWER_STEM));
    if (!behindDrawer) out.push(s.slice(0, 80));
  }
  return out;
}

// ══ WP-B15-42 — THE BANNED-VOCABULARY DETECTOR ═══════════════════════════════════════════════════
//
// WHY THIS IS A DETECTOR AND NOT A SWEEP. Three separate wording rules now bind this UI, and every
// one of them was previously enforced by looking at the screen once:
//
//   1. ⛔ "CORROBORATED", NEVER "VERIFIED" — Warwick, verbatim: "2-OF-3 IS CORROBORATION, NOT
//      VERIFICATION… Do not let UI, receipts or Veritas call it verified." Three readings by one
//      model of one photograph are correlated, so agreement is corroboration. This is a TRUTHFULNESS
//      requirement, not a wording preference: the word asserts a check that was never performed.
//   2. ⛔ `unknown` is the API's own word for a fact it does not hold, and must never reach a screen
//      as a value. Vera found this on the Shop screen (WP-B15-36), it was fixed there, and the
//      IDENTICAL leak was still rendering "#2 · unknown" on Rules two screens away.
//   3. ⛔ "ZZ (no brand recorded)" is a SORT SENTINEL carried by every held line of the real
//      reconciled artefact. It exists to sort unbranded lines last. Rendered, Warwick reads a brand
//      called "ZZ (no brand recorded)".
//
// A one-time sweep decays the moment anyone adds a string — which is not a hypothetical here, it is
// what happened between the Shop fix and the Rules leak IN THE SAME COMMIT. So this runs on EVERY
// scenario in this file, and `--self-test` carries a mutation per rule proving it still fires.
//
// SCOPE, STATED RATHER THAN ASSUMED: Diagnostics ('about') is EXEMPT. That screen exists to show raw
// technical detail behind a drawer — its whole job is to render the payload as it actually is,
// `unknown` and all — so a ban there would be a check that fights the feature. Every screen Warwick
// actually runs his shop from is covered. The exemption is by SCENARIO NAME, so a new primary screen
// is covered by default and only an explicit rename can opt out.
// THE ONE SANCTIONED USE, AND IT IS READ OUT OF THE APP RATHER THAN RETYPED HERE. The corroboration
// caveat is the sentence that DENIES the claim — "…is corroboration, not verification…" — so it
// necessarily contains the banned word, and it is the most important string on the screen.
//
// It is exempted by identity with `ASDAIR_CORROBORATION_CAVEAT` itself, not by a copy of its text.
// A copy would rot the moment the wording is improved, and the gate would go red on correct code;
// worse, someone would then relax the pattern instead of the exemption. Reading the constant means
// the exemption follows the wording automatically and covers exactly one sentence — never a second.
// (Found by executing this detector: it flagged seven scenarios on my own shipping copy.)
const VOCAB_EXEMPT = /^ABOUT\b/;
const SANCTIONED_CAVEAT = typeof bindings.ASDAIR_CORROBORATION_CAVEAT === 'string'
  ? bindings.ASDAIR_CORROBORATION_CAVEAT : null;
const BANNED_VOCABULARY = Object.freeze([
  // Word-boundary matched, and case-insensitive: "Verified", "VERIFIED" and "sort verified" are the
  // same claim. NOT a substring match — that would fire on nothing real here, but it would also fire
  // on any future honest word containing these letters, and a detector that cries wolf gets disabled.
  { rule: 'says VERIFIED where only CORROBORATION exists', re: /\bverif(y|ied|ication|ies)\b/i,
    allow: (s) => SANCTIONED_CAVEAT !== null && s.trim() === SANCTIONED_CAVEAT },
  { rule: 'leaks the API word "unknown" as a value', re: /^unknown$/i, whole: true },
  // VERA V-4. `unknown` is the API saying it does not hold a fact; `undefined`, `NaN` and
  // `[object Object]` are JAVASCRIPT leaking through a template — a missing binding, a number
  // derived from a null, an object where a string belonged. Same class, worse tell.
  //
  // ⛔ NOT WHOLE-NODE MATCHED, AND THAT IS A DELIBERATE DEPARTURE FROM THE RECOMMENDATION. The rule
  // was recommended as `/^(undefined|NaN|\[object Object\])$/` with a whole-node match. Implemented
  // that way it went GREEN — and the very leak it was recommended for was live in an executed
  // scenario at the time. The node reads "undefined/undefined", because Vue renders each
  // interpolation into the SAME text node as the literal "/" between them. A whole-node match can
  // never see that, and it is the normal shape: a leaked value almost always has punctuation, a
  // unit or a sibling field beside it.
  //
  // Word-matched instead. Safe against false positives because no product copy in this cockpit
  // contains these tokens — absence is said as "unknown", "not established" or "not confirmed" —
  // and `--self-test` mutates through a REAL undefined property to prove it still fires.
  { rule: 'leaks a raw JavaScript value (undefined / NaN / [object Object])',
    re: /\b(undefined|NaN)\b|\[object Object\]/ },
  { rule: 'leaks the "ZZ" brand sort sentinel', re: /\bZZ\b|no brand recorded/i,
    // "No brand recorded" IS the sanctioned heading for an unbranded run — it is a statement about
    // the record, not a brand name — so the heading form is allowed and the sentinel form is not.
    // Distinguished by the ZZ, which no honest rendering carries.
    allow: (s) => /^No brand recorded$/.test(s.trim()) || /^No brand is recorded for this line\.$/.test(s.trim()) },
]);
function bannedVocabulary(name, textParts) {
  if (VOCAB_EXEMPT.test(name)) return [];
  const out = [];
  for (const s of textParts) {
    for (const b of BANNED_VOCABULARY) {
      if (b.allow && b.allow(s)) continue;
      const hit = b.whole ? b.re.test(s.trim()) : b.re.test(s);
      if (hit) out.push(b.rule + ': "' + s.slice(0, 60) + '"');
    }
  }
  return out;
}

// ══ WP-B15-45 — THE BUILDER-VOCABULARY DETECTOR FOR THE HOUSEHOLD SURFACE ════════════════════════
//
// AC3, and Addendum B §10.2, which lists the banned words. The requirement was explicitly that this
// be a HARNESS ASSERTION rather than a sweep of the screen — "so the rule travels instead of being
// fixed at one site". The estate already has the evidence for why: between the Shop fix and the
// Rules leak in WP-B15-42, the IDENTICAL leak was re-introduced two screens away IN THE SAME COMMIT.
// A sweep decays the moment anyone adds a string.
//
// This runs IN ADDITION to bannedVocabulary above, not instead of it — that one bans dishonest and
// leaked-machine words everywhere, and everything it bans is also wrong here. This one bans the
// OPERATOR'S VOCABULARY, which is legitimate on Warwick's surface and never on hers.
//
// ⛔ "run" IS DELIBERATELY NOT BANNED, AND THE OMISSION IS THE INTERESTING PART.
// Addendum B §10.2 lists it. But Addendum B's OWN sanctioned copy, in §7.4 and §9.4, is "They've
// run out of the usual eggs" and "I couldn't find 'nice ham'". A /\brun\b/ rule fires on the
// feature — it would go red on the correct wording of the most human sentence on the surface. That
// is the exact trade the ZZ and drawer exemptions above are written about: a detector that cries
// wolf gets switched off, and then it is protecting nothing. The word is banned as a NOUN in the
// operator sense ("the run", "run id") by the status-enum rule below; the verb is left alone.
// Recorded here rather than silently dropped, because a rule missing from a list looks like an
// oversight and this one is a decision.
//
// Every other §10.2 word is here, word-boundary matched and case-insensitive. None of them collides
// with any sentence in Addendum B §10's sanctioned copy — checked line by line against §10.3's
// replacement table, not assumed.
const MUM_VOCABULARY = Object.freeze([
  // The headline. Addendum B §2: "'Cockpit' is a builder's word — it must not appear on her screen."
  { rule: 'the word COCKPIT reaches her screen', re: /\bcockpits?\b/i },
  // She never learns the system has a name, let alone what it is (Addendum B §1).
  { rule: 'names the system to her (AsdAIr / Fusion247)', re: /\basda[i1]r\b|\bfusion\s?247\b/i },
  // Catalogue identity. Addendum B §8.2: "She never sees, types or chooses a catalogue identity."
  { rule: 'leaks catalogue identity vocabulary',
    re: /\bcatalogues?\b|\bSKUs?\b|\bproduct[ _-]?ids?\b|\bregulars?\b|\bfavourite[ _-]?ids?\b|\basda[ _-]?(reference|product)\b|\baliase?s?\b/i },
  // Retail plumbing. She is CHOOSING, not shopping — Addendum B §10.3 removes "add to basket"
  // entirely rather than translating it.
  { rule: 'leaks retail-operator vocabulary', re: /\bbaskets?\b|\bcheckouts?\b|\bslots?\b|\bsubmits?\b|\bsubmitted\b/i },
  // Machine plumbing.
  { rule: 'leaks machine vocabulary',
    re: /\bAPIs?\b|\bendpoints?\b|\bpayloads?\b|\btokens?\b|\bsessions?\b|\bsync(ed|ing)?\b|\bpars(e|ed|ing)\b|\bpersist(ed|ing|ence)?\b|\bqueues?\b|\bJSON\b|\bnull\b/i },
  // Status enums and pipeline state. This is where "run" is banned in its operator sense, and it is
  // why the verb does not need to be.
  { rule: 'leaks a status enum or pipeline state',
    re: /\bneeds[_ ]decision\b|\bhuman[_ ]state\b|\bplan[_ ]status\b|\bunclassified\b|\bexcluded\b|\bresolv(e|ed|ing)\b|\bcandidates?\b|\b(shop|job|run)[_ ]?id\b|\bjobs?\b/i },
  // Addendum B §10.2 bans "any status code, service name, or SHA". A bare hex string of 7+ is the
  // shape of both a commit and an ASDA product id — and a product id on her screen is precisely the
  // §8.2 defect, so a hit here is a true positive either way.
  { rule: 'leaks a SHA or a bare numeric/hex identifier', re: /\b[0-9a-f]{7,40}\b/i },
]);
function mumVocabulary(textParts) {
  const out = [];
  for (const s of textParts) {
    for (const b of MUM_VOCABULARY) {
      if (b.re.test(s)) out.push(b.rule + ': "' + s.slice(0, 60) + '"');
    }
  }
  return out;
}

// Render one household-surface scenario. Mirrors scenario() above — including the Proxy `has` trap,
// which is the load-bearing mechanism and must not be weakened for the second app — but takes plain
// ref values instead of a view key, because this surface has no view registry: it is one page.
//
// `pure: true` renders nothing and is how a check EXECUTES a shipping function directly rather than
// inferring its behaviour from a screen. text(null) is [], so such a scenario's checks simply
// ignore the rendered parts. The quantity clamp is tested that way because Addendum B §6.4 rule 5
// makes it a STATE guarantee, and a boundary proven only by tapping a rendered button is a boundary
// nobody has actually reached.
function mumScenario(name, refs, render, opts2 = {}) {
  for (const [k, v] of Object.entries(refs || {})) {
    const b = shopBindings[k];
    if (!b || typeof b !== 'object' || !('value' in b)) {
      throw new Error('render-vm-check: household scenario "' + name + '" writes "' + k + '", which '
        + 'shopping.js setup() does not return as a writable ref. Known: '
        + Object.keys(shopBindings).join(', ') + '. Fix the name here rather than letting the '
        + 'scenario silently test default state — that is how coverage disappears while staying green.');
    }
    b.value = v;
  }
  if (opts2.pure) return { name, vnode: null, err: null, missing: [], mum: true };
  const base = {};
  for (const k of Object.keys(shopBindings)) {
    Object.defineProperty(base, k, {
      enumerable: true, configurable: true,
      get() { return unwrap(shopBindings[k]); },
      set() {},
    });
  }
  const missing = new Set();
  const proxy = new Proxy(base, {
    has: (t, k) => !(typeof k === 'string' && (k.startsWith('_') || k.startsWith('$')))
      // Vue's `with(_ctx)` would otherwise swallow the `v-for` scope variables the compiled render
      // function declares in its own closure. Same reason the operator trap excludes _ and $.
      ,
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
  return { name, vnode, err, missing: [...missing], mum: true };
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

// ── WP-B15-36 FIXTURES — the converged Cockpit UI ───────────────────────────────────────────────
//
// ⛔ FIRST, THE DEFECT THESE REPAIR, because it is the reason every assertion below is new rather
// than adjusted. Until this WP, the two AsdAIr scenarios named their views 'overview' and 'details'.
// B15-26 RENAMED those keys to 'shop' and 'questions' (apps.js) and did not update this file. So
// `app.views.find(v => v.key === viewKey)` returned `undefined`, `currentView.label` threw in the
// breadcrumb, and EVERY AsdAIr scenario died before rendering a single node — carrying four
// assertions down with it. Established by execution, not inference: the identical four failures
// reproduce on untouched HEAD 86cfc08 with this WP's changes stashed.
// The consequence is worth stating plainly: the AsdAIr Shop and Questions screens have had NO
// executed render coverage since f7bf71a, and a green run of this harness did not mean what it
// looked like it meant.
//
// SECOND, WHAT THE FIXTURES BELOW ARE FOR. `WS` (the committed sample) carries NO canonical state
// field, NO provenance block and NO regions — which is exactly the "backend has not landed it yet"
// case, and it stays as its own scenario because rendering an HONEST GAP is a requirement, not a
// degraded mode. The fixtures here add the cases the converged backend will produce.
//
// Every value is synthetic. Field names are taken from the real contract, never invented:
// `human_state` from migration 020 §5, the PHOTO/REGULARS/RULE/WARWICK vocabulary from that same
// migration's shop_line_provenance CHECK, and the four pixel bounds from shop_image_region.
const ws = (shopPatch, patch = {}) => ({
  ...WS, ...patch, shop: { ...WS.shop, ...shopPatch },
});
const PROVENANCE = {
  source_read_status_display: 'photograph read', source_lines_display: '39',
  reconciled_products_display: '41',
  photo_display: '39', regulars_display: '4', rules_display: '1', warwick_display: '2', skipped_display: '3',
  final_products_display: '43', final_items_display: '61',
};
// NEEDS_WARWICK with two open questions: the exact case Warwick's first example names.
const WS_NEEDS = ws({ human_state: 'NEEDS_WARWICK' }, {
  provenance: PROVENANCE,
  questions: { ...WS.questions, open_count_display: '2',
    items: [
      { ...WS.questions.items[0],
        // The four pixel bounds, per shop_image_region. This is the whole crop seam.
        region: { pixel_top: 100, pixel_left: 20, pixel_bottom: 160, pixel_right: 400 } },
      { ...WS.questions.items[0], id: 9, question_key: 'q_placeholder_9',
        question_text_display: 'A second placeholder question with no recorded region.', region: null },
    ] },
});
// ASDAIR_WORKING with open lines: Warwick's second example, verbatim in shape.
const WS_WORKING = ws({ human_state: 'ASDAIR_WORKING',
  lines_summary: { total_display: '5', resolved_display: '2', open_display: '3' } },
  { questions: { ...WS.questions, open_count_display: '0', items: [] } });
// READY_FOR_WARWICK: Warwick's third example.
const WS_READY = ws({ human_state: 'READY_FOR_WARWICK' },
  { questions: { ...WS.questions, open_count_display: '0', items: [] } });
// FAILED, from the basket half: Warwick's fourth example.
const WS_FAILED = ws({ human_state: 'FAILED',
  failure: { ...(WS.shop.failure || {}), failed_from_display: 'WAITING_FOR_BROWSER' } },
  { questions: { ...WS.questions, open_count_display: '0', items: [] } });
// THE CONTRADICTION. State says nothing needs him; two questions are still open. A naive UI shows
// "Nothing needs you" beside a 2 and lets Warwick work it out. This must be named as a FAULT.
const WS_CONTRADICT = ws({ human_state: 'ASDAIR_WORKING' },
  { questions: { ...WS.questions, open_count_display: '2' } });
// THE SEAM, both older shapes. Neither may regress to "Status unknown".
const WS_SEAM_CANONICAL = ws({ canonical_state: 'READY_FOR_WARWICK' });
const WS_SEAM_COCKPIT = ws({ cockpit_state: 'READY_FOR_WARWICK' });
// Per-line provenance with NO summary block — the 'lines' counting route.
const WS_LINE_PROV = ws({}, {
  interpretation: { ...WS.interpretation,
    lines: WS.interpretation.lines.map((l, i) => ({ ...l, provenance: ['PHOTO', 'REGULARS', 'RULE', 'WARWICK', 'PHOTO'][i % 5] })) },
});
// The API publishing a skip command — the only thing that may un-grey "Not this week" on a line.
const WS_SKIP_CMD = ws({ human_state: 'NEEDS_WARWICK' },
  { command_names: [...(WS.command_names || []), 'skipThisWeek'] });

// ══ WP-B15-42 FIXTURES ═══════════════════════════════════════════════════════════════════════════
//
// SYNTHETIC VALUES, REAL SHAPE. The field names below are taken from the artefact this UI must
// actually render — services/asdair/pipeline/finalise/out/final-shopping-list.json, produced by
// WP-B15-37 — and not invented: `brand`, `product`, `quantity`, `quantity_basis`, `quantity_note`,
// `shoppable`, `held_reason`, `held_detail`, `routed_question`, `list_item_name`, and
// `provenance_detail.{support, support_of, support_class}`. The VALUES are invented.
//
// ⛔ THE FIRST TWO ROWS ARE THE POINT, and they are the two things most likely to ship broken:
//   * `brand: "ZZ (no brand recorded)"` is a SORT SENTINEL, carried by every held line of the real
//     artefact. It must never render as a brand name.
//   * `product: null` is normal on a held line — nothing has been settled — so `list_item_name` is
//     the only honest title.
// Both are the same defect class as the API's word `unknown` reaching a product title, which is
// what Vera caught on WP-B15-36 and what the global vocabulary detector above now bans everywhere.
const finalLine = (o) => Object.assign({
  brand: null, product: null, product_id: null, quantity: 1, quantity_basis: 'explicit-on-page',
  quantity_settled: true, quantity_note: null, provenance: 'PHOTO', disposition: 'resolved',
  status: 'matched', shoppable: true, held_reason: null, held_detail: null, routed_question: null,
  list_item_name: null,
  provenance_detail: { kind: 'PHOTO', line_no: 1, raw_reading: null, support: 3, support_of: 3, support_class: 'unanimous' },
}, o);
const FINAL_LIST = {
  shop_ref: 'SHOP-SYNTHETIC', shop_status: 'NEEDS_DECISION', sorted_by: 'BRAND, then product name',
  totals: { photo_source_lines: 6, product_count: 6, item_count: 9, shoppable_lines: 4, held_lines: 2 },
  skipped: [
    { as_written: 'A SYNTHETIC UNSUPPORTED LINE', support: 1, support_of: 3, disposition: 'skipped',
      reason: 'seen by only 1 of 3 independent readings of the same photograph - an unsupported photo candidate' },
  ],
  lines: [
    finalLine({ brand: 'Alpha', product: 'Alpha Synthetic Oat Drink 1L', quantity: 3,
      quantity_note: null, quantity_basis: 'explicit-on-page',
      provenance_detail: { kind: 'PHOTO', line_no: 1, raw_reading: '3 ALPHA OAT', support: 3, support_of: 3, support_class: 'unanimous' } }),
    finalLine({ brand: 'Alpha', product: 'Alpha Synthetic Yoghurt 4pk', quantity: 1,
      quantity_basis: 'household-default-one',
      provenance_detail: { kind: 'PHOTO', line_no: 2, raw_reading: 'ALPHA YOG', support: 2, support_of: 3, support_class: 'corroborated' } }),
    finalLine({ brand: 'Beta', product: 'Beta Synthetic Bread', quantity: 2, provenance: 'REGULARS',
      provenance_detail: { kind: 'REGULARS', line_no: 3, raw_reading: null, support: 3, support_of: 3, support_class: 'unanimous' } }),
    finalLine({ brand: null, product: 'A synthetic own-label item', quantity: 1 }),
    // THE TWO HELD LINES — sentinel brand, null product, routed question, corroboration recorded.
    finalLine({ brand: 'ZZ (no brand recorded)', product: null, quantity: 1, shoppable: false,
      status: 'needs_confirmation', disposition: 'unresolved-routed',
      held_reason: 'awaiting_decision', held_detail: 'the planner left this line as needs_decision',
      routed_question: 'q_placeholder_1', list_item_name: '1 BAG SYNTHETIC SWEETS',
      provenance_detail: { kind: 'PHOTO', line_no: 5, raw_reading: '1 BAG SYNTHETIC SWEETS', support: 3, support_of: 3, support_class: 'unanimous' } }),
    finalLine({ brand: 'ZZ (no brand recorded)', product: null, quantity: 1, quantity_settled: false,
      shoppable: false, status: 'needs_confirmation', quantity_basis: 'conflicting-observations',
      quantity_note: 'the runs disagree about the quantity (1 vs 7) and no deterministic rule settles it - routed rather than guessed',
      held_reason: 'ambiguous', held_detail: null, routed_question: 'q_no_such_question',
      list_item_name: '1 x 6pts SYNTHETIC MILK',
      provenance_detail: { kind: 'PHOTO', line_no: 6, raw_reading: '1 x 6pts SYNTHETIC MILK', support: 1, support_of: 3, support_class: 'uncorroborated' } }),
  ],
};
// The declared Brand A-Z order BROKEN — the same brand in two separate runs. The UI must SHOW the
// breach rather than tidy it away, because the ordering is what makes the shop quick in ASDA.
const FINAL_LIST_UNSORTED = {
  ...FINAL_LIST,
  lines: [FINAL_LIST.lines[0], FINAL_LIST.lines[2], FINAL_LIST.lines[1], FINAL_LIST.lines[3]],
};
// The reconciled list arriving on the WORKSPACE payload — one of the two declared carriers.
const WS_FINAL = ws({ human_state: 'NEEDS_WARWICK' }, { final_list: FINAL_LIST });
const WS_FINAL_UNSORTED = ws({ human_state: 'NEEDS_WARWICK' }, { final_list: FINAL_LIST_UNSORTED });
// THE JOIN. A held line carries `routed_question: 'q_placeholder_1'`, and the workspace's own open
// question carries `question_key: 'q_placeholder_1'`. One board entry, not two.
const WS_BOARD = ws({ human_state: 'NEEDS_WARWICK' }, {
  final_list: FINAL_LIST,
  questions: { ...WS.questions, open_count_display: '1',
    items: [{ ...WS.questions.items[0],
      region: { pixel_top: 100, pixel_left: 20, pixel_bottom: 160, pixel_right: 400 } }] },
});
// ⛔ AC4 — THE STALE "NEEDS HUMAN" CASE, and it is the whole defect in one fixture. The
// interpretation line still carries `status: 'needs_confirmation'` — stale, because its routed
// question has ALREADY been answered and sits in `questions.resolved`. A UI that trusts the line's
// own status asks Warwick a second time for something he has already decided.
const WS_STALE = ws({ human_state: 'ASDAIR_WORKING' }, {
  interpretation: { ...WS.interpretation,
    lines: WS.interpretation.lines.map((l) => (l.status === 'needs_confirmation'
      ? { ...l, routed_question: 'q_placeholder_2' } : l)) },
  questions: { ...WS.questions, open_count_display: '0', items: [] },
});
// ⭐ THE SAME JOIN, SPELLED THE OTHER WAY. The reconciled artefact writes `routed_question`; Lane C
// additionally carries the identifier as `question_key` on held workspace lines. They are the same
// `shop_question.question_key` under two names, so the board must join on either — accepting only
// one would make the join depend on which producer happened to write the row.
const WS_BOARD_QKEY = ws({ human_state: 'NEEDS_WARWICK' }, {
  final_list: { ...FINAL_LIST,
    lines: FINAL_LIST.lines.map((l) => (l.routed_question === 'q_placeholder_1'
      ? { ...l, routed_question: null, question_key: 'q_placeholder_1' } : l)) },
  questions: { ...WS.questions, open_count_display: '1', items: [WS.questions.items[0]] },
});
// The API publishing a remember command — the only thing that may enable the durable-knowledge
// offer. Without it the control is rendered DISABLED and says why; it is never hidden, because
// Warwick is owed the knowledge that the choice exists.
const WS_REMEMBER_CMD = ws({ human_state: 'NEEDS_WARWICK' },
  { command_names: [...(WS.command_names || []), 'rememberDecision'] });

const ASDAIR_PLAN = [
    // ── AC1 · AC2 — the one sentence and the one status, one scenario per state Warwick named ────
    ['SHOP · NEEDS_WARWICK (2 open questions)', 'shop', { asdairWs: WS_NEEDS, asdairWsErr: null }, {}, [
      ['AC1 — Warwick\'s own sentence, verbatim in shape', (p) => hasText(p, '2 decisions still need you.')],
      ['AC2 — the one canonical status label is rendered', (p) => hasText(p, 'Needs you')],
      ['AC2 — the SERVICE availability band stands down, so there is no second status indicator',
        (p) => !hasText(p, 'running')],
      ['AC3 — Warwick\'s summary equation, assembled from real terms',
        (p) => hasText(p, '39 from the photograph + 4 from Regulars − 3 skipped = 43 products / 61 items')],
      ['AC3 — all four origins plus SKIPPED stay VISIBLY DISTINCT, never one blob',
        (p) => hasText(p, 'From the photograph') && hasText(p, 'Added from your Regulars')
          && hasText(p, 'From household rules') && hasText(p, 'You decided this week')
          && hasText(p, 'Skipped this week')],
      ['no raw canonical state token leaks onto the primary screen', (p) => !hasText(p, 'NEEDS_WARWICK')],
      ['no internal pipeline stage name leaks onto the primary screen', (p) => !hasText(p, 'PROCESSING')],
      ['no shop reference leaks onto the primary screen', (p) => !hasText(p, 'SHOP-2026-01-01')],
      ['no match-basis internal leaks onto the primary screen', (p) => !hasText(p, 'exact alias match')],
      // REGRESSION — found by READING the rendered text, not the diff. An unreadable line carries
      // the API's word "unknown" in both name fields, and the title expression printed it as the
      // product's name. "unknown" where a product belongs IS the database view Warwick prohibited.
      //
      // ⛔ THIS ASSERTION IS NOW REDUNDANT AND IS KEPT ANYWAY. WP-B15-42 promoted it to a GLOBAL
      // detector that runs on every scenario in this file (bannedVocabulary), because a per-screen
      // assertion is exactly how the identical defect survived two screens away on Rules. The local
      // copy stays as the named regression for the screen it was found on; deleting it would erase
      // the record of what was actually caught here.
      ['⛔ the word "unknown" is never a product title',
        (p) => !p.some((s) => s.trim() === 'unknown')],
      // ⛔ MOVED, NOT DELETED — WP-B15-42, AC2. The Shop screen no longer renders individual
      // exception lines: there is ONE exception board and it is the Questions screen. This
      // assertion followed the markup to 'EXCEPTIONS · one coherent board' below. Leaving it here
      // would have been a check bound to a pane that no longer contains the surface — the failure
      // mode this file's own SYS comment names, and which passes quietly rather than failing loudly.
      ['AC2 — the Shop screen ROUTES to the one board instead of rendering a second one',
        (p) => hasText(p, 'Answer them on one screen, with the photograph beside each.')],
    ]],
    ['SHOP · ASDAIR_WORKING (3 products reconciling)', 'shop', { asdairWs: WS_WORKING, asdairWsErr: null }, {}, [
      ['AC1 — Warwick\'s second example, verbatim in shape',
        (p) => hasText(p, 'Nothing needs you. AsdAIr is reconciling 3 products.')],
      ['AC2 — one status label', (p) => hasText(p, 'AsdAIr is working')],
    ]],
    ['SHOP · READY_FOR_WARWICK', 'shop', { asdairWs: WS_READY, asdairWsErr: null }, {}, [
      ['AC1 — Warwick\'s third example, verbatim',
        (p) => hasText(p, 'Everything is resolved. Ready to build the ASDA basket.')],
      ['AC2 — one status label', (p) => hasText(p, 'Ready for you')],
    ]],
    ['SHOP · FAILED (from the basket half)', 'shop', { asdairWs: WS_FAILED, asdairWsErr: null }, {}, [
      ['AC1 — Warwick\'s fourth example, verbatim',
        (p) => hasText(p, 'Basket build failed. Nothing was ordered.')],
    ]],
    // ── The thing Warwick must NEVER be asked to do himself ───────────────────────────────────────
    ['SHOP · state and counts CONTRADICT each other', 'shop', { asdairWs: WS_CONTRADICT, asdairWsErr: null }, {}, [
      ['the disagreement is named as a FAULT, in words',
        (p) => hasText(p, 'That is a fault in AsdAIr, not something for you to resolve.')],
      ['and Warwick is never left holding two bare numbers to reconcile',
        (p) => hasText(p, 'AsdAIr says nothing needs you, but still has 2 open questions')],
    ]],
    // ── The seam. Both older field names must still render, or integration silently blanks. ───────
    ['SHOP · seam: only shop.canonical_state present', 'shop', { asdairWs: WS_SEAM_CANONICAL, asdairWsErr: null }, {}, [
      ['reads the backend branch\'s CURRENT field name', (p) => hasText(p, 'Ready for you')],
      ['and answers the question from it', (p) => hasText(p, 'Everything is resolved. Ready to build the ASDA basket.')],
    ]],
    ['SHOP · seam: only shop.cockpit_state present (the B15-26 placeholder)', 'shop', { asdairWs: WS_SEAM_COCKPIT, asdairWsErr: null }, {}, [
      ['an older backend still renders rather than regressing to unknown', (p) => hasText(p, 'Ready for you')],
    ]],
    // ── AC3 fallback routes. A gap is NAMED; it is never filled with a zero. ──────────────────────
    ['SHOP · provenance counted from the lines themselves', 'shop', { asdairWs: WS_LINE_PROV, asdairWsErr: null }, {}, [
      ['the route is stated on screen, not silently assumed',
        (p) => hasText(p, 'Counted from the lines themselves')],
      ['origins are still shown one by one', (p) => hasText(p, 'Added from your Regulars')],
    ]],
    ['SHOP · no canonical state and no provenance at all (the honest gap)', 'shop', { asdairWs: WS, asdairWsErr: null }, {}, [
      ['⛔ nothing is invented — the missing answer is said, not guessed',
        (p) => hasText(p, 'AsdAIr hasn’t reported one overall status for this shop yet')],
      ['⛔ the five origin rows are BLANK, not filled with zeros',
        (p) => hasText(p, 'AsdAIr isn’t yet reporting where each product came from')],
      ['a per-origin row says so for itself too',
        (p) => hasText(p, 'AsdAIr isn’t reporting this count yet, so nothing is claimed for it.')],
    ]],
    // ── AC4 — exception-first. ───────────────────────────────────────────────────────────────────
    ['SHOP · exception-first grouping', 'shop', { asdairWs: WS_NEEDS, asdairWsErr: null }, {}, [
      // WP-B15-42: the heading moved from "Needs your attention" (a second board) to "Anything
      // unsettled" (a summary that routes). The PROPERTY under test is unchanged — the unsettled
      // things lead — so the assertion is re-keyed to the markup that now carries it rather than
      // deleted, which would have quietly dropped the coverage.
      ['the unsettled lines still LEAD the screen', (p) => hasText(p, 'Anything unsettled')],
      ['⛔ and the Shop screen does NOT render a second exception board',
        (p) => !hasText(p, 'Type an answer') && !hasText(p, 'Not this week')],
      ['resolved lines are COLLAPSED behind a control, never proofread by default',
        (p) => p.some((s) => /Show the \d+ lines? that are already settled/.test(s))],
    ]],
    // ── AC5 — the question board. ────────────────────────────────────────────────────────────────
    ['QUESTIONS · crop, and the honest absence of one', 'questions', { asdairWs: WS_NEEDS, asdairWsErr: null }, {}, [
      ['a question with no recorded region SAYS so rather than showing a fabricated crop',
        (p) => hasText(p, 'AsdAIr hasn’t recorded which part of the photograph this line came from')],
      // ⛔ RE-CUT AFTER VERA V-1 (HIGH), NOT DELETED. This asserted that the Shop screen's exact
      // sentence — "2 decisions still need you.", counting OPEN QUESTIONS — also leads this screen,
      // on the reasoning that one sentence in two places cannot tell two stories. That reasoning was
      // wrong, and this assertion was actively holding the defect in place: this screen's tally
      // counts a DIFFERENT population (questions plus unrouted held lines), so copying the
      // question-count sentence here guaranteed a contradiction the moment the two populations
      // differed. It did, by one, 49px apart, at 375px.
      //
      // The VALUE survives — two figures on one screen must not disagree — and is now expressed
      // correctly: the headline is derived from the same population as the tally beneath it. In THIS
      // fixture there are no held lines, so board and questions coincide and the figure is still 2;
      // the 'one coherent board' scenario carries the case where they differ.
      ['the headline is derived from THIS screen population, and agrees with its own tally',
        (p) => hasText(p, '2 things still need you.') && valueAfter(p, 'Needs you') === '2'],
      ['an answered question can be CHANGED', (p) => hasText(p, 'Change this answer')],
      ['applied-to-this-shop vs remembered-for-future is stated, never inferred',
        (p) => hasText(p, 'Applied to this shop.') || hasText(p, 'Remembered for future shops')],
    ]],
    // ── The command surface gate: a control with no command behind it is never dressed as working ─
    ['QUESTIONS · no skip command published', 'questions', { asdairWs: WS_NEEDS, asdairWsErr: null }, {}, [
      ['the API publishes no skip-a-line command in this fixture',
        (p) => !hasText(p, 'AsdAIr has no command for this yet')],
    ]],
    ['SHOP · the API publishes a skip command', 'shop', { asdairWs: WS_SKIP_CMD, asdairWsErr: null }],

    // ══ WP-B15-42 ═════════════════════════════════════════════════════════════════════════════
    // AC5 — THE FINAL LIST, SORTED BY BRAND. "not database order, not provenance order, not
    // question order". Compact per line, plain-English provenance on expansion, exceptions separated.
    ['LIST · brand-grouped, from the reconciled artefact', 'basket',
      { asdairWs: WS_FINAL, asdairPacket: PACKET_NOT_BUILT, asdairPacketErr: null }, {}, [
        ['AC5 — brands are the grouping, in A-Z runs',
          (p) => hasText(p, 'Alpha') && hasText(p, 'Beta')],
        ['AC5 — brand, product and quantity are the compact line',
          (p) => hasText(p, 'Alpha Synthetic Oat Drink 1L') && hasText(p, '×3')],
        ['AC5 — totals come from the data, never a hardcoded figure',
          (p) => hasText(p, '6 products') && hasText(p, '9 items')],
        ['AC5 — plain-English provenance on expansion, never an enum',
          (p) => hasText(p, 'no number was written, so one')],
        ['AC5 — exceptions are CLEARLY SEPARATED from resolved lines',
          (p) => hasText(p, 'Not on the list yet')],
        ['AC5 — and they are not answerable twice: the list ROUTES to the one board',
          (p) => hasText(p, 'Resolve these') && !hasText(p, 'Type an answer')],
        // ⛔ THE TWO DEFECTS THIS WP EXISTS TO PREVENT ON THIS SCREEN. Both are also covered by the
        // global vocabulary detector; asserted HERE too because a global ban proves the string is
        // absent, and these assert the RIGHT thing is present in its place.
        ['⛔ the ZZ sort sentinel never renders as a brand',
          (p) => !p.some((s) => /ZZ/.test(s))],
        ['⛔ a held line with product:null is titled by its raw reading, not by a blank or a null',
          (p) => hasText(p, '1 BAG SYNTHETIC SWEETS')],
        ['an unbranded line gets a heading that describes the RECORD, not a brand name',
          (p) => hasText(p, 'No brand recorded')],
        // ⛔ VERA V-2 — every disclosure row carries the cockpit's affordance glyph. Counted, not
        // spot-checked: one chev per list row, or the marker has gone missing from some of them
        // again. The rendered text is the only place a vnode-level check can see this glyph.
        ['⛔ V-2 — every brand-list row carries the .chev affordance, not a bare invisible summary',
          (p) => p.filter((s) => s.trim() === '›').length >= 4],
        // AC6 — Warwick's ruling, on the surface that carries the evidence.
        ['AC6 — support is reported as CORROBORATION',
          (p) => hasText(p, 'Corroborated') && hasText(p, 'All 3 readings of the photograph agreed on this line.')],
        ['AC6 — a 2-of-3 reading says so, and is still corroboration rather than proof',
          (p) => hasText(p, '2 of 3 readings of the photograph agreed on this line.')],
        ['AC6 — a single-reading line is NOT corroborated, and says which',
          (p) => hasText(p, 'Not corroborated') && hasText(p, 'Only 1 of 3 readings saw this line')],
        ['AC6 — the caveat is on the screen, not just in the code',
          (p) => hasText(p, 'is corroboration, not verification')],
      ]],
    ['LIST · the declared brand order is BROKEN', 'basket',
      { asdairWs: WS_FINAL_UNSORTED, asdairPacket: PACKET_NOT_BUILT, asdairPacketErr: null }, {}, [
        ['⛔ the breach is SHOWN, never tidied away by a UI-side re-sort',
          (p) => hasText(p, 'BRAND ORDER BROKEN')],
        ['and it says what is wrong in words a person reads',
          (p) => hasText(p, 'The same brand appears more than once in this list.')],
      ]],
    ['LIST · no reconciled list published at all (the honest gap)', 'basket',
      { asdairWs: WS, asdairPacket: PACKET_NOT_BUILT, asdairPacketErr: null }, {}, [
        ['⛔ an empty list is the honest answer; a plausible one he might act on is not',
          (p) => hasText(p, 'No reconciled list has been published for this shop')],
        ['and it says so rather than rendering an invented line',
          (p) => hasText(p, 'Nothing on this screen is invented')],
      ]],

    // AC2/AC3 — ONE COHERENT EXCEPTION BOARD.
    ['EXCEPTIONS · one coherent board, held lines JOINED to their question', 'questions',
      { asdairWs: WS_BOARD, asdairWsErr: null }, {}, [
        ['AC2 — the question and the line it holds up are ONE entry, not two',
          (p) => hasText(p, 'Is "placeholder juice" the Placeholder Orange Juice 1L you usually get?')
            && hasText(p, 'Read from the list as “1 BAG SYNTHETIC SWEETS”.')],
        ['AC2 — WHY it is uncertain, in words',
          (p) => hasText(p, 'Why it is uncertain: waiting on an answer from you')],
        ['AC2 — sensible alternatives, one tap each',
          (p) => hasText(p, '✓ Placeholder Orange Juice 1L')],
        ['AC2 — answerable in place by free text and by "not this week"',
          (p) => hasText(p, 'Type an answer') && hasText(p, 'Not this week')],
        ['AC2 — a joined entry is marked as HELD OUT OF THE BASKET, which is the blocking fact',
          (p) => hasText(p, 'HELD OUT OF THE BASKET')],
        ['AC3 — X NEED YOU / Y RESOLVED / Z STILL BLOCKING, at a glance',
          (p) => hasText(p, 'need you') && hasText(p, 'resolved') && hasText(p, 'still blocking')],
        // ⛔ VERA V-1 (HIGH), AND THE FIXTURE REPRODUCES IT EXACTLY. 1 open question + 1 unjoined
        // held line: the OLD headline counted questions and said "1 decision still needs you.",
        // 49px above a tally counting the board and reading "2". Two populations, one screen, on
        // the board built to stop precisely that. Three halves are pinned — the headline agrees
        // with the tally, the stale phrasing is GONE, and the difference from the Shop screen is
        // named rather than hidden.
        ['⛔ V-1 — the headline agrees with the tally it sits 49px above',
          (p) => hasText(p, '2 things still need you.') && valueAfter(p, 'Needs you') === '2'],
        ['⛔ V-1 — the open-question sentence no longer leads this board',
          (p) => !hasText(p, '1 decision still needs you.')],
        ['V-1 — and it NAMES why this figure differs from the Shop screen instead of hiding it',
          (p) => hasText(p, '1 question to answer, and 1 line AsdAIr held back without asking about it.')],
        // ⛔ VERA V-2 — the affordance glyph. AC5's provenance-on-expansion sits behind this control,
        // and it shipped with no visible marker at any breakpoint (SUMMARY_COUNT=4, WITH_VISIBLE=0).
        ['AC3 — answered questions stay VISIBLE and COLLAPSIBLE, never gone',
          (p) => hasText(p, 'Resolved') && hasText(p, 'Change this answer')
            && hasText(p, 'Kept on screen on purpose')],
        ['AC2 — a held line with NO question routed to it says so instead of offering a dead control',
          (p) => hasText(p, 'hasn’t routed a question for it')],
        ['⛔ the ZZ sort sentinel never reaches the board either',
          (p) => !p.some((s) => /ZZ/.test(s))],
      ]],
    ['EXCEPTIONS · the join spelled question_key instead of routed_question', 'questions',
      { asdairWs: WS_BOARD_QKEY, asdairWsErr: null }, {}, [
        ['the SAME identifier under the other name still joins line to question',
          (p) => hasText(p, 'Read from the list as “1 BAG SYNTHETIC SWEETS”.')],
        // ⛔ THIS ASSERTION TOOK THREE ATTEMPTS AND BOTH FAILURES ARE WORTH RECORDING, because each
        // is a way of passing for the wrong reason:
        //   1. "HELD OUT OF THE BASKET is present" stayed GREEN under a broken join — a failed join
        //      makes an unjoined held entry carrying the same eyebrow. Vacuous.
        //   2. "the unjoined sentence is ABSENT" went RED on correct code — this fixture also has a
        //      second, legitimately unjoined held line, so that sentence is on screen either way.
        //      A whole-screen text check cannot see WHICH row carried it.
        // What discriminates is the COUNT. Joined: one question entry (carrying its line) plus one
        // unjoined held = 2. Broken: one question entry plus TWO unjoined held = 3. The join is the
        // only thing that moves that number.
        ['⛔ and the join COLLAPSES line into question — 2 entries need him, not 3',
          (p) => valueAfter(p, 'Needs you') === '2'],
      ]],
    // AC2 — the durable-knowledge offer. Both halves: no command, and a published command.
    ['EXCEPTIONS · remember-this offer with NO command published', 'questions',
      { asdairWs: WS_BOARD, asdairWsErr: null,
        asdairRemember: { questionKey: 'q_placeholder_1', answer: 'Synthetic Orange Juice 1L', busy: false, done: null, error: null } }, {}, [
        ['AC2 — the offer is made, because Warwick is owed the knowledge that the choice exists',
          (p) => hasText(p, 'Should AsdAIr remember “Synthetic Orange Juice 1L” for future shops?')],
        ['⛔ and it says plainly that it cannot yet be made durable — never a button that silently discards',
          (p) => hasText(p, 'AsdAIr publishes no command for this yet')],
        ['the answer that DID land is still stated as applied',
          (p) => hasText(p, 'Your answer has been applied to this shop.')],
      ]],
    ['EXCEPTIONS · remember-this offer WITH a command published', 'questions',
      { asdairWs: WS_REMEMBER_CMD, asdairWsErr: null,
        asdairRemember: { questionKey: 'q_placeholder_1', answer: 'Synthetic Orange Juice 1L', busy: false, done: null, error: null } }, {}, [
        ['the honest "cannot do this yet" note is GONE once a command exists',
          (p) => !hasText(p, 'AsdAIr publishes no command for this yet')],
        ['and the offer still reads as a question, not as a completed action',
          (p) => hasText(p, 'Remember it') && hasText(p, 'Just this shop')],
      ]],
    // ⛔ AC4 — NO STALE "NEEDS HUMAN". The UI half.
    ['SHOP · a line already answered must NOT still be shown as needing him', 'shop',
      { asdairWs: WS_STALE, asdairWsErr: null }, {}, [
        // PRECISION MATTERS HERE, and my first attempt at this assertion was wrong in the way this
        // file's own comment warns about. The fixture carries TWO attention lines — one stale
        // (already answered) and one genuinely unreadable — so the correct output is "1 line needs a
        // decision", not silence. Asserting the ABSENCE of that phrase passed for the wrong reason
        // when the suppression worked and would have passed again if it stopped. The property under
        // test is the DROP from 2 to 1, so both halves are pinned.
        ['⛔ the stale line is not counted: 2 attention lines render as 1',
          (p) => hasText(p, '1 line needs a decision') && !hasText(p, '2 lines need a decision')],
        ['the suppression is COUNTED and STATED — a suppression nobody can see is its own kind of lie',
          (p) => hasText(p, 'not counted above, and nothing is being asked of you twice')],
        ['and it names how many, so Lane AB/C can see their data half is stale',
          (p) => hasText(p, '1 further line still carries')],
      ]],
    // ── The original coverage, with the view keys REPAIRED. ──────────────────────────────────────
    ['SHOP (live shop, committed sample)', 'shop', { asdairWs: WS, asdairWsErr: null }],
    // The two questions checks below are the regression this scenario exists to catch: the fixture
    // used to carry field names (question_display, answered_display...) that DO NOT EXIST on the
    // real assembleWorkspace.js payload, so a real drift in the template's field names would have
    // rendered "unknown" everywhere and passed silently — the harness could not see it because the
    // fixture was already wrong in the same way. It is now keyed field-for-field to the real payload.
    ['QUESTIONS (live shop)', 'questions', { asdairWs: WS, asdairWsErr: null }, {}, [
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
      ['no raw ISO timestamp anywhere in the Questions view (a machine instant is never primary content)',
        (p) => !p.some((s) => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))],
    ]],
    ['QUESTIONS (shop present, every section empty)', 'questions', { asdairWs: BARE_WS, asdairWsErr: null }],
    ['SHOP (shop present, every section empty)', 'shop', { asdairWs: BARE_WS, asdairWsErr: null }],
    ['QUESTIONS (service down)', 'questions', { asdairWs: null, asdairWsErr: 'service down' }],
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
  ['HOME (a prevention is in doubt)', NO_APP_VIEW, CAP_ATTN, { area: 'home' }, [
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
  ['HOME (nothing in doubt — the card must stay quiet)', NO_APP_VIEW, CAP_QUIET, { area: 'home' }, [
    ['⭐ no attention card at all when nothing needs attention',
      (p) => !hasText(p, 'needs attention') && !hasText(p, 'System →')],
    ['but the pane still renders',
      (p) => hasText(p, 'Recent activity')],
  ]],
];

const SYSTEM_PLAN = [
  // AC1 ① — two reports, most recent first. The ordering holds, so the ORDER WRONG branch must NOT
  // fire; a banner that appears on correct data is as bad as one that never appears on wrong data.
  ['SYSTEM (two rotation reports, most recent first)', NO_APP_VIEW,
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
  ['SYSTEM (reports supplied OUT of order)', NO_APP_VIEW,
    rrRefs([RR_OLDER, RR_RECENT]), SYS, [
      ['the order break is surfaced rather than silently re-sorted', (p) => hasText(p, 'ORDER WRONG')],
      ['the banner names the exact position the order first breaks',
        (p) => hasText(p, 'The order first breaks at report 2.')],
      ['the reports are still shown, in the order actually supplied',
        (p) => hasText(p, '2026-01-01') && hasText(p, '2026-01-02') && valueAfter(p, 'Closing head') === 'bbbbbbb'],
    ]],

  // AC1 ③ + ④ + AC2 — THE DECIDING SCENARIO. Each assertion binds to ONE field, and the unknown and
  // the zero it is paired against sit in the same block.
  ['SYSTEM (an unknown field beside a genuine measured zero)', NO_APP_VIEW,
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
  ['SYSTEM (a report whose every field and container is null)', NO_APP_VIEW,
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
  ['SYSTEM (reports read and there are none — a measured zero)', NO_APP_VIEW,
    rrRefs([]), SYS, [
      ['the empty state says they were READ and there are none',
        (p) => hasText(p, 'The reports were read and there are none recorded yet.')],
      ['it is not confused with a failed read', (p) => !hasText(p, 'COULD NOT BE READ')],
      ['it is not confused with not having asked', (p) => !hasText(p, 'have not been read yet')],
      ['nothing is guessed at in the meantime', (p) => hasText(p, 'Nothing is being guessed at in the meantime.')],
    ]],

  // Not asked yet. "We have not looked" is not "there are none", and this rung exists to keep those
  // two sentences apart.
  ['SYSTEM (the reports have not been asked for yet)', NO_APP_VIEW,
    rrRefs(null, { requested: false }), SYS, [
      ['the surface says it has not asked yet',
        (p) => hasText(p, 'The rotation reports have not been read yet.')],
      ['it does not claim there are none', (p) => !hasText(p, 'there are none recorded yet')],
      ['the trigger offers to read them', (p) => hasText(p, 'Read them')],
    ]],

  // In flight. Leads the chain on rrLoading alone so a RE-read announces too, and the already-read
  // cards stay on screen under it rather than blanking.
  ['SYSTEM (a read is in flight over already-read reports)', NO_APP_VIEW,
    rrRefs([RR_RECENT], { loading: true }), SYS, [
      ['the in-flight state is announced', (p) => hasText(p, 'Reading the rotation reports…')],
      ['the already-read card is NOT blanked while the re-read runs', (p) => hasText(p, 'aaaaaaa')],
      ['the trigger says what it is doing', (p) => hasText(p, 'Reading…')],
    ]],

  // AC1 ⑥ — the database read failed. Two separate properties: the failure is stated truthfully, AND
  // it is CONTAINED — "failure to load historical reports must not break the rest of the System tab".
  ['SYSTEM (the database read FAILED)', NO_APP_VIEW,
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

// ══ WP-B15-45 — THE HOUSEHOLD SURFACE PLAN ═══════════════════════════════════════════════════════
//
// Driven by the SAME committed fixture the operator scenarios use, so the two surfaces cannot
// disagree about the shape of a regular. The items are structurally faithful to GET /asdair/rules
// and every value is invented (see the fixture header).
const REG = (RULES.regulars && Array.isArray(RULES.regulars.items)) ? RULES.regulars.items : [];
// A row the data layer cannot name in any form. Not hypothetical: householdName() returns null when
// there is neither a display name nor a retailer string, and the surface must then omit the row and
// SAY SO rather than render a blank one or invent a name for it.
// `display_name: null` is stated explicitly rather than left off: after WP-B15-52 that field is the
// primary source, so a fixture that omitted it would be testing the fallback path by accident.
const REG_NAMELESS = REG.concat([{ id_display: '99', display_name: null, aka: [], name_display: '', high_level_category_display: 'Chilled', typical_qty_display: '1', active: true }]);
// ⛔ EVERY WRITABLE REF THE SURFACE OWNS IS RESET HERE, AND THE NEW ONES ARE NOT OPTIONAL.
// `mumScenario` writes into ONE setup() instance that is shared by every scenario in this plan, so
// any ref a scenario sets and this object does not reset LEAKS FORWARD. A later scenario would then
// render a state nobody asked for while reporting a pass on the state it names — coverage quietly
// testing the wrong thing, which is the exact failure mode this file exists to prevent.
const REST = {
  regulars: REG, loaded: true, loadFailed: false, openQuestions: 0, selected: {}, qty: {},
  sendState: 'idle', lastUndo: null,
  // WP-B15-49: the confirm step, the three settled outcomes, and her own words.
  sentCount: 0, hasSent: false, changedSinceSent: false,
  confirmShown: '', confirmDate: null,
  extras: [], addOpen: false, draft: '', addBusy: false,
};
const M = (over) => Object.assign({}, REST, over);

// ⛔ THE SUCCESS-LANGUAGE PREDICATE — RE-SCOPED AT WP-B15-49, NOT DELETED, AND THIS IS NOW THE
// PLACE ROUTE CONTRACT v3's CORE PROPERTY IS EASIEST TO FIND.
//
// It began life inside the single "she has pressed the send button" scenario, where its job was to
// stop the surface claiming success while there was NO WRITE PATH AT ALL. That job is UNCHANGED.
// What changed is that a success state became legitimate — and legitimate in exactly one
// circumstance: the server answered `created: true`, meaning a shop row was actually written.
//
// So instead of deleting it with the state it was attached to, it now travels with EVERY state
// EXCEPT that one. `confirm` has sent nothing yet. `failed` did not arrive. Both `already-sent-*`
// states were ACCEPTED by the server and changed today's shop not at all. If success language ever
// appears in any of them, the page is telling her something happened that did not — Addendum E
// criterion 9, "any answer that changes the display but not the durable record".
const NO_SUCCESS_LANGUAGE = (p) => !p.some((s) =>
  /thank you|on its way|all done|getting your shopping ready|i.ve sent|is on the way/i.test(s));

// ⛔ B §6.7, "after sending, it is replaced by the sent state, not left tappable". Carried across
// from the retired scenario rather than dropped: it was a GOOD assertion pointed at a dead state.
// It now holds on the confirm screen AND on all three settled outcomes — five states instead of one.
// EXACT-NODE MATCH, not `hasText`, for the reason the original recorded: since MEDIUM-2 the header
// instruction itself contains the string "SEND MY SHOPPING LIST", so a substring search anywhere on
// the page would pass while the BUTTON was missing.
const actionNotTappable = (p) => !p.some((x) => x.trim() === 'SEND MY SHOPPING LIST');

// ⛔⛔ THE PROMISE PREDICATE — AC7. SAME SHAPE AS `NO_SUCCESS_LANGUAGE`, AND FOR THE SAME REASON.
//
// "I've told Warwick" is not a description of a screen state. It is a claim about something that
// happened in the world, to a person, outside this browser — and it can be false while everything
// else about the submission is true. The route records her change and notifies Warwick as two
// SEPARATE acts, and it deliberately still answers `ok:true, recorded_new:true` when the second one
// fails, because her list IS durable at that point and a messaging outage must never present itself
// to her as a lost shop. That correct decision is precisely what makes `notified:false` reachable.
//
// So this predicate travels with EVERY state except the one where the server confirmed `notified`.
// If those words ever appear anywhere else, the page has told an 84-year-old that the person who
// can fix her shopping already knows — and she would then have no reason to mention it to him,
// which is the single action that would actually have fixed it.
//
// ⚠️ IT MATCHES THE CLAIM, NEVER THE MENTION. "Warwick will sort this one out for you" (the pending
// banner) and "Warwick hasn't heard about it yet" (the saved state) both name him without asserting
// he has been told, and both must stay legal — a predicate that simply banned his name would force
// the honest sentence out of the one state that most needs to say it.
const NO_TOLD_WARWICK_PROMISE = (p) => !p.some((s) =>
  /told warwick|warwick has been told|warwick knows|warwick has heard/i.test(s));

// Every quantity that reaches the screen is a bare integer text node; a product name never is, and
// a count renders as a whole sentence. So this is the rendered-side half of the Addendum B §6.4
// guarantee — the state-side half is executed directly in the clamp scenario below.
const noSubMinimumQty = (p) => !p.some((s) => /^-?\d+$/.test(s) && Number(s) < 1);

const MUM_PLAN = [
  ['MUM S1 (her list, nothing pending)', M({}), [
    ['the household list renders real items from the fixture', (p) => p.some((s) => /oat drink/i.test(s))],
    ['a section heading renders', (p) => hasText(p, 'Chilled') || hasText(p, 'Food cupboard')],
    ['⛔ NO banner occupies the slot when nothing is pending (B §9.1)', (p) => !hasText(p, 'question for you')],
    ['the zero state is a sentence, not a number', (p) => hasText(p, 'chosen anything yet')],
    // ⛔ EXACT-NODE MATCH, NOT `hasText`. Since MEDIUM-2 the header instruction also contains the
    // string "SEND MY SHOPPING LIST" — naming the control by its words is the whole point of that
    // fix — so a substring search anywhere on the page would pass while the BUTTON was missing.
    // The button is its own text node; the instruction is a sentence containing it.
    ['the primary action is present and worded in her language', (p) => p.some((x) => x.trim() === 'SEND MY SHOPPING LIST')],
    // ⛔ MEDIUM-2, VERA — a defect inherited from Addendum B §6.2's wireframe, not introduced here.
    // "Press the green button" is wrong at the one moment she reads it: on arrival, with nothing
    // chosen, B §6.7 requires that button to be visibly DISABLED, and it renders grey. Colour may
    // never be the sole carrier of meaning (WCAG 1.4.1); the control is named by its words.
    ['⛔ the instruction names the action by its WORDS, never by its colour',
      (p) => p.some((s) => /press SEND MY SHOPPING LIST/.test(s)) && !p.some((s) => /green button/i.test(s))],
    ['the disabled primary action states its reason beside it (B §6.7)', (p) => hasText(p, 'Tap some things first')],
    ['⛔ no quantity below the floor of 1 reaches the screen', noSubMinimumQty],
    ['⛔ the word COCKPIT never renders', (p) => !p.some((s) => /cockpit/i.test(s))],
  ]],

  ['MUM S1 (one question is waiting)', M({ openQuestions: 1 }), [
    ['the pending banner is present, in words and not a badge (B §7.1)', (p) => hasText(p, 'question for you')],
    // ⛔ HIGH-2, VERA. The banner asked her for something, offered no control to give it, and did
    // not say so — S3 being out of scope is correct, but silence in front of a demand is not.
    // Every other unbuilt affordance on this page states its own limit; this one now does too.
    ['⛔ the banner STATES that she cannot answer here yet, rather than asking silently',
      (p) => hasText(p, 'can’t ask you here just yet')],
    ['⛔ and it names the human who will act, so she is not left holding it (B §9.5)',
      (p) => p.some((s) => /Warwick will sort this one out/.test(s))],
    ['⛔ the banner carries NO dismiss control (B §7.1.2)', (p) => !p.some((s) => /^(×|x|close|dismiss|ok|got it)$/i.test(s.trim()))],
    ['her list is still fully present beneath it', (p) => p.some((s) => /oat drink/i.test(s))],
  ]],

  ['MUM S1 (two questions are waiting)', M({ openQuestions: 2 }), [
    ['the count is stated plainly rather than pluralised wrongly', (p) => hasText(p, '2 questions for you')],
  ]],

  ['MUM S1 (she has chosen things)', M({ selected: { 11: true, 12: true }, qty: { 11: 3 } }), [
    ['the running count reflects what she chose', (p) => hasText(p, 'chosen 2 things')],
    ['the changed quantity renders', (p) => p.includes('3')],
    ['⛔ still no quantity below 1 anywhere', noSubMinimumQty],
    ['the primary action no longer shows the empty-state reason', (p) => !hasText(p, 'Tap some things first')],
  ]],

  // AC2. The most important negative assertion on this surface: when the data cannot be read the
  // screen says so in her words and shows NOTHING ELSE. A screen of invented groceries is worse
  // than a blank one, because Warwick would believe it.
  ['MUM S1 (the list cannot be read)', M({ regulars: [], loadFailed: true }), [
    ['it says so plainly and reassures her nothing is lost', (p) => hasText(p, 'see your shopping list at the moment')],
    ['⛔ NOT ONE invented item name appears', (p) => !p.some((s) => /oat drink|cheese|juice/i.test(s))],
    ['⛔ no technical error, code or service name (B §9.5)', (p) => !p.some((s) => /error|failed|500|503|fetch|http/i.test(s))],
  ]],

  ['MUM S1 (nothing on her list yet)', M({ regulars: [] }), [
    ['the empty state is a plain sentence', (p) => hasText(p, 'nothing on your list yet')],
    ['⛔ it is NOT presented as a failure', (p) => !hasText(p, 'see your shopping list at the moment')],
  ]],

  // ══ THE SEND JOURNEY — FIVE STATES THAT EXIST, REPLACING ONE THAT DOES NOT ═══════════════════════
  //
  // ⛔ WHAT WAS HERE, AND WHY IT HAD TO GO. A single scenario drove `sendState: 'not-connected'` and
  // asserted the copy "that part isn't finished". WP-B15-49 connected the write path, so that state
  // and that sentence no longer exist — the scenario was asserting the ABSENCE of the feature the
  // order existed to build, and its three failures were the gate correctly reporting that it had
  // been left behind. A test that fails because the product improved is a stale test, not a defect.
  //
  // Both of its assertions worth keeping were KEPT and re-pointed rather than deleted — see
  // `actionNotTappable` and `NO_SUCCESS_LANGUAGE` above, which now cover five states between them
  // instead of one. Addendum B §9.6's rule is unchanged and is what all five of these enforce:
  // "The UI never claims something was sent when it was not."

  // 1. She has pressed SEND. Nothing has left the page. Warwick's accident guard (2026-08-13).
  ['MUM S4 (the confirm screen — nothing has been sent yet)',
    M({ selected: { 11: true }, sendState: 'confirm', confirmShown: 'Thursday 13 August' }), [
      ['the date she is being asked to confirm is on screen', (p) => hasText(p, 'Thursday 13 August')],
      ['it says plainly that nothing has gone yet', (p) => hasText(p, 'Nothing has been sent yet')],
      ['⛔ NO success or thank-you language — nothing has been written', NO_SUCCESS_LANGUAGE],
      ['⛔ NO promise that Warwick was told — nothing has been submitted at all', NO_TOLD_WARWICK_PROMISE],
      ['⛔ the primary action is REPLACED, not left tappable (B §6.7)', actionNotTappable],
      ['the commit control is present and is named in words', (p) => hasText(p, 'YES, SEND IT')],
      ['⛔ her way OUT is present — she is never cornered by a confirmation', (p) => hasText(p, 'No, not yet')],
      ['her list is still visible behind the question', (p) => p.some((s) => /oat drink/i.test(s))],
    ]],

  // 2. created:true — a shop row was written. THE ONLY STATE IN WHICH SUCCESS LANGUAGE IS HONEST.
  ['MUM S4 (sent — the server wrote a row)',
    M({ selected: { 11: true }, sendState: 'sent', sentCount: 1, hasSent: true }), [
      ['it tells her plainly that it went', (p) => hasText(p, 'Sent')],
      ['⛔ success language is PERMITTED HERE AND ONLY HERE, because a row was written',
        (p) => hasText(p, 'thank you') && hasText(p, 'getting your shopping ready')],
      ['it says how much went', (p) => p.some((s) => /sent 1 thing/i.test(s))],
      ['⛔ the primary action is REPLACED, not left tappable (B §6.7)', actionNotTappable],
      ['⛔ it makes NO claim that Warwick was told — this state does not mention him today, and an edit that began to would need its own notified evidence', NO_TOLD_WARWICK_PROMISE],
      ['the way back to editing is offered at full size (B §9.5)', (p) => hasText(p, 'I want to change something')],
      ['her list is still visible and unlost', (p) => p.some((s) => /oat drink/i.test(s))],
    ]],

  // 3. created:false, recorded_new:true — today's shop is untouched, but her change WAS recorded
  //    and Warwick has been told. The promise is only made because the server earned it.
  ['MUM S4 (already gone today — her change was recorded and Warwick told)',
    M({ selected: { 11: true }, sendState: 'already-sent-noted' }), [
      ['it says what actually happened to today-s list', (p) => hasText(p, 'already gone')],
      ['⛔ NO success or thank-you language — NOTHING was written to today-s shop', NO_SUCCESS_LANGUAGE],
      ['⛔ it does NOT tell her the list was sent', (p) => !p.some((s) => /^Sent/.test(s.trim()))],
      ['it makes the promise the server earned: a human has been told', (p) => hasText(p, 'Warwick has been told')],
      ['nothing she chose has been lost', (p) => hasText(p, 'has been lost')],
      ['⛔ the primary action is REPLACED, not left tappable (B §6.7)', actionNotTappable],
      ['she is not stranded — there is a worded route back (B §9.5)', (p) => hasText(p, 'Back to my shopping')],
    ]],

  // 3b. AC7 — recorded_new:true, notified:FALSE. Her change is saved and Warwick never heard.
  //     ⛔ THIS IS THE STATE THE OLD SINGLE SENTENCE GOT WRONG. Under the previous split, `noted`
  //     covered both, so a Telegram outage produced "I've told Warwick what you changed" while
  //     nobody had been told anything. She would then have had no reason to mention it to him —
  //     and mentioning it to him is the ONLY thing that recovers it.
  ['MUM S4 (already gone today — saved, but Warwick has NOT been told)',
    M({ selected: { 11: true }, sendState: 'already-sent-saved' }), [
      ['it says what actually happened to today-s list', (p) => hasText(p, 'already gone')],
      ['⛔ IT DOES NOT PROMISE WARWICK WAS TOLD — the notification did not get through',
        NO_TOLD_WARWICK_PROMISE],
      ['it says her change IS saved — the reassuring half comes first', (p) => hasText(p, 'saved what you changed')],
      ['...and it says plainly that he has not heard yet', (p) => hasText(p, 'heard about it yet')],
      ['it gives her the one action that actually fixes it', (p) => hasText(p, 'mention it to him')],
      ['nothing she chose has been lost', (p) => hasText(p, 'has been lost')],
      ['⛔ NO machine code reaches her — notify_failed / notify_not_configured are for the console',
        (p) => !p.some((s) => /notify|not_configured|telegram|notification/i.test(s))],
      ['⛔ NO success or thank-you language — today-s shop is untouched', NO_SUCCESS_LANGUAGE],
      ['⛔ the primary action is REPLACED, not left tappable (B §6.7)', actionNotTappable],
      ['she is not stranded — there is a worded route back (B §9.5)', (p) => hasText(p, 'Back to my shopping')],
    ]],

  // 4. created:false, recorded_new:false — an identical re-send. NOTHING happened anywhere.
  //    ⛔ THIS SCENARIO IS THE ONE THAT PROVES ROUTE CONTRACT v3 WAS WORTH HAVING. Under v2 this
  //    case and case 3 were indistinguishable, so both would have received the same sentence — and
  //    one of those sentences would have been a promise nobody had kept.
  ['MUM S4 (already gone today — and nothing at all changed)',
    M({ selected: { 11: true }, sendState: 'already-sent-unchanged' }), [
      ['MEDIUM-4: the headline is the reassuring fact — everything she wants IS on the list that went', (p) => hasText(p, 'already on today')],
      ['it says plainly that nothing changed', (p) => hasText(p, 'nothing has changed')],
      ['⛔ NO success or thank-you language — nothing was written', NO_SUCCESS_LANGUAGE],
      ['⛔⛔ IT DOES NOT PROMISE WARWICK WAS TOLD — no record was written, so no promise is earned',
        NO_TOLD_WARWICK_PROMISE],
      ['nothing she chose has been lost', (p) => hasText(p, 'has been lost')],
      ['⛔ the primary action is REPLACED, not left tappable (B §6.7)', actionNotTappable],
      ['she is not stranded — there is a worded route back (B §9.5)', (p) => hasText(p, 'Back to my shopping')],
    ]],

  // 5. It did not arrive at all.
  ['MUM S5 (not sent — it did not arrive)',
    M({ selected: { 11: true }, sendState: 'failed' }), [
      ['it says plainly that it could not send', (p) => hasText(p, 'send your list just now')],
      ['it says nothing has been lost and her choices are still here', (p) => hasText(p, 'Nothing has been lost')],
      ['⛔ NO success or thank-you language — it did not arrive', NO_SUCCESS_LANGUAGE],
      ['⛔ NO machine detail reaches her: no status code, no error code, no stack text',
        (p) => !p.some((s) => /\b(unknown|error|exception|failed|500|404|timeout|econn|json)\b/i.test(s))],
      ['⛔ NO promise that Warwick was told — it never arrived, so nobody was notified', NO_TOLD_WARWICK_PROMISE],
      ['a full-size way to try again is offered (B §9.6)', (p) => hasText(p, 'Try again')],
      ['⛔ the primary action is REPLACED, not left tappable (B §6.7)', actionNotTappable],
      ['her list is still visible and unlost', (p) => p.some((s) => /oat drink/i.test(s))],
    ]],

  // 6. ADDED AT WP-B15-49, not merely re-pointed. "Add something else" became a real input this
  //    package (Warwick, 2026-08-13), and a gate that covered the send journey while ignoring the
  //    other new surface would carry exactly the hole Vera named at Gate 3 — coverage that stops
  //    where the previous author stopped looking.
  ['MUM S2 (she has added something in her own words)',
    M({ extras: [{ id: 1, text: 'that nice ham', note: 'You have already got Cravendale on your list. I have kept this too.' }] }), [
      ['⛔ HER EXACT WORDS are shown back to her, unchanged and un-tidied',
        (p) => p.some((s) => s.trim() === 'that nice ham')],
      ['the sense-check nudge is rendered', (p) => hasText(p, 'already got Cravendale')],
      ['⛔ THE NUDGE IS A STATEMENT, NEVER A QUESTION — she is never asked to adjudicate a match',
        (p) => !p.some((s) => /already got/.test(s) && s.includes('?'))],
      ['⛔ NO disambiguation is ever put to her', (p) => !p.some((s) => /did you mean|which one|choose one|select one/i.test(s))],
      ['it tells her the item was KEPT anyway', (p) => hasText(p, 'kept')],
      ['she has a worded way to take it off again', (p) => hasText(p, 'Take it off')],
      ['the running count includes what she typed', (p) => hasText(p, 'chosen 1 thing')],
    ]],

  ['MUM S1 (a row the data cannot name)', M({ regulars: REG_NAMELESS }), [
    ['the unnameable row is counted and declared, never blank-rendered', (p) => hasText(p, 'show properly')],
    ['⛔ no empty-string name is rendered as a product', (p) => !p.some((s) => s.trim() === '')],
  ]],

  // ── EXECUTED DIRECTLY, NOT RENDERED ────────────────────────────────────────────────────────────
  // Addendum B §6.4 rule 5 makes the clamp a STATE guarantee: "so a repeated-event, double-fire or
  // race can never produce 0 or a negative. The disabled button is the affordance; the clamp is the
  // guarantee. Both are required." A boundary proven only by tapping a rendered button has not been
  // reached at all — so this calls the shipping function through the app's own published surface.
  // Addendum E A4 asks for exactly this pairing: adversarial tapping AND a state-level test.
  ['MUM (the quantity clamp, executed not rendered)', {}, [
    ['zero clamps up to the floor of 1', () => SHOP.clampQty(0) === 1],
    ['⛔ a negative can never survive the update', () => SHOP.clampQty(-1) === 1 && SHOP.clampQty(-9999) === 1],
    ['the floor itself is stable', () => SHOP.clampQty(1) === 1],
    ['the cap holds at 20', () => SHOP.clampQty(20) === 20 && SHOP.clampQty(21) === 20 && SHOP.clampQty(9999) === 20],
    ['a normal value passes through', () => SHOP.clampQty(3) === 3],
    ['⛔ a non-number resolves to the floor, never to NaN or 0', () => SHOP.clampQty(NaN) === 1 && SHOP.clampQty(undefined) === 1 && SHOP.clampQty(null) === 1 && SHOP.clampQty('nonsense') === 1],
    ['a numeric string from the API is accepted', () => SHOP.clampQty('3') === 3],
    ['a fractional value cannot land between whole items', () => SHOP.clampQty(2.4) === 2 && SHOP.clampQty(0.4) === 1],
  ], { pure: true }],

  // The naming rule, executed rather than described — and the "nothing invented" assertion is still
  // the one that matters most.
  // ⛔ REWRITTEN AT WP-B15-52. These assertions used to encode the `aka` fallback, and they PASSED
  // while doing it — which is the point worth keeping: a green gate proved the fallback worked, not
  // that it was the right source. `aka` is a matching term; display_name is what she reads. The two
  // `aka` assertions below now prove it is IGNORED rather than preferred.
  ['MUM (the naming rule, executed not rendered)', {}, [
    ['display_name is the name she reads', () => SHOP.householdName({ display_name: 'Bananas', name_display: 'ASDA 6 Bananas' }) === 'Bananas'],
    ['⛔ aka is a MATCHING TERM and never reaches her screen', () => SHOP.householdName({ aka: ['oat milk'], display_name: 'Oat drink', name_display: 'Example Brand Oat Drink 1L' }) === 'Oat drink'],
    ['⛔ aka is not a fallback either — an unnamed row shows the retailer string, not her matching word', () => SHOP.householdName({ aka: ['oat milk'], display_name: null, name_display: 'Example Brand Oat Drink 1L' }) === 'Example Brand Oat Drink 1L'],
    ['the retailer string is the fallback for a row Warwick has not named yet', () => SHOP.householdName({ display_name: null, name_display: 'Example Brand Oat Drink 1L' }) === 'Example Brand Oat Drink 1L'],
    ['a whitespace-only display name reads as not set', () => SHOP.householdName({ display_name: '   ', name_display: 'Example Brand Oat Drink 1L' }) === 'Example Brand Oat Drink 1L'],
    ['⛔ with neither, it returns nothing rather than inventing a name', () => SHOP.householdName({ display_name: null, name_display: '' }) === null && SHOP.householdName(null) === null],
    // The hazard Felix found in preflight and Keel closed at source. Belt and braces: if a future
    // projection change ever routes display_name through P.text() again, this fails HERE rather than
    // rendering the word "unknown" to an 84-year-old as the name of a product.
    ['⛔ the API word "unknown" is never rendered as a product name', () => SHOP.householdName({ display_name: null, name_display: 'unknown' }) === null && SHOP.householdName({ display_name: null, name_display: 'UNKNOWN' }) === null],
    ['⛔ the API word "unknown" never becomes a section heading', () => SHOP.sectionLabel({ high_level_category_display: 'unknown' }) === SHOP.OTHER && SHOP.sectionLabel({}) === SHOP.OTHER],
  ], { pure: true }],

  // The ASDA sub-line. Warwick's orientation line, and the rule that stops it being noise.
  ['MUM (the ASDA listing line, executed not rendered)', {}, [
    ['the listing is the ASDA string when the tile shows a household name', () => SHOP.listingName({ display_name: 'Bananas', name_display: 'ASDA 6 Bananas' }, 'Bananas') === 'ASDA 6 Bananas'],
    ['⛔ it is omitted when it would merely repeat the large line', () => SHOP.listingName({ display_name: null, name_display: 'Example Brand Oat Drink 1L' }, 'Example Brand Oat Drink 1L') === null],
    ['the repeat check ignores case', () => SHOP.listingName({ name_display: 'Bananas' }, 'bananas') === null],
    ['⛔ the word "unknown" is never shown as a listing either', () => SHOP.listingName({ name_display: 'unknown' }, 'Bananas') === null],
    ['a missing name yields no line rather than a blank one', () => SHOP.listingName({ name_display: '' }, 'Bananas') === null && SHOP.listingName(null, 'Bananas') === null],
  ], { pure: true }],

  // buildSections is what actually feeds the template, so the two fields are proven to arrive
  // TOGETHER on a row rather than only as separate helpers.
  ['MUM (a built row carries both lines)', {}, [
    ['a named row carries name and listing', () => {
      const s = SHOP.buildSections([{ id_display: '60', display_name: 'Bananas', name_display: 'ASDA 6 Bananas', high_level_category_display: 'Fruit', typical_qty_display: '1', active: true }]);
      const it = s.sections[0].items[0];
      return it.name === 'Bananas' && it.listing === 'ASDA 6 Bananas';
    }],
    ['⛔ an unnamed row shows the retailer string ONCE, with no duplicate beneath it', () => {
      const s = SHOP.buildSections([{ id_display: '61', display_name: null, name_display: 'Example Brand Oat Drink 1L', high_level_category_display: 'Chilled', typical_qty_display: '1', active: true }]);
      const it = s.sections[0].items[0];
      return it.name === 'Example Brand Oat Drink 1L' && it.listing === null;
    }],
    ['⛔ aka on the row changes nothing about either line', () => {
      const s = SHOP.buildSections([{ id_display: '62', aka: ['choc yazoo'], display_name: 'Chocolate milkshake', name_display: 'Yazoo Choc 400ml', high_level_category_display: 'Chilled', typical_qty_display: '1', active: true }]);
      const it = s.sections[0].items[0];
      return it.name === 'Chocolate milkshake' && it.listing === 'Yazoo Choc 400ml';
    }],
  ], { pure: true }],
];

function mumScenarios(shopRender) {
  return MUM_PLAN.map(([name, refs, checks, opts2]) => {
    const r = mumScenario(name, refs, shopRender, opts2 || {});
    r.checks = checks || null;
    return r;
  });
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
    // ⛔ 'shop', NOT the stale 'details'. WP-B15-36: with a view key the registry no longer carries,
    // `currentView` was undefined and the BREADCRUMB threw before any mutation could be reached — so
    // all three of these reported "caught -> threw: Cannot read properties of undefined (reading
    // 'label')" on untouched HEAD. Every one was VACUOUS: the has-trap detector this block exists to
    // prove was never exercised. A mutation test that passes for the wrong reason is worse than
    // none, because it gets quoted as evidence.
    const r = scenario('mutant', 'shop', Vue.compile(mutate(opts.template)));
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
    // 'shop' for the same reason as above: on HEAD this scenario THREW, `strays` was forced to [],
    // and the mutation was reported MISSED every run. Fixing the key is what makes it a real test.
    const r = scenario('mutant', 'shop', Vue.compile(mutated));
    const strays = r.err ? [] : strayJsonBlobs(text(r.vnode));
    if (strays.length) { caught++; console.log('  caught  ' + 'stray raw JSON outside a drawer'.padEnd(42) + ' -> ' + strays[0].slice(0, 60)); }
    else { missed.push('stray raw JSON outside a drawer'); console.log('  MISSED  stray raw JSON outside a drawer'); }
  }
  // ── WP-B15-42: THE BANNED-VOCABULARY MUTATIONS ──────────────────────────────────────────────
  // One per rule, because they are three different rules and a single mutation proving one of them
  // fires says nothing about the other two. Larry's instruction was explicit: the "verified" ban
  // must be a harness assertion, not a one-time sweep, "because a sweep decays the moment someone
  // adds a string". A detector nobody has made fail is not evidence — it is a hope.
  {
    const vocabCases = {
      'vocabulary: a screen calls corroboration VERIFIED':
        (t) => t.replace(anchor, anchor + '<p>Every line was verified against the photograph.</p>'),
      'vocabulary: the API word "unknown" reaches a value slot':
        (t) => t.replace(anchor, anchor + '<p>{{ "unknown" }}</p>'),
      'vocabulary: the ZZ brand sort sentinel is rendered as a brand':
        (t) => t.replace(anchor, anchor + '<p>ZZ (no brand recorded)</p>'),
      // VERA V-4. Mutated through a REAL undefined property, and CONCATENATED — which is how the
      // live leak actually rendered ("undefined/undefined"). A bare `{{ undefined }}` is useless as
      // a mutation: Vue renders it as an empty string, so it proves nothing. Found by running it.
      'vocabulary: a raw JavaScript undefined reaches the screen':
        (t) => t.replace(anchor, anchor + '<p>WO first pass {{ currentApp.noSuchField + "/" + currentApp.noSuchField }}</p>'),
    };
    total += Object.keys(vocabCases).length;
    for (const [name, mutate] of Object.entries(vocabCases)) {
      setRefs({ asdairWs: WS, asdairWsErr: null });
      const r = scenario('mutant', 'shop', Vue.compile(mutate(opts.template)));
      const hits = r.err ? [] : bannedVocabulary(r.name, text(r.vnode));
      if (hits.length) { caught++; console.log('  caught  ' + name.padEnd(48) + ' -> ' + hits[0].slice(0, 60)); }
      else { missed.push(name); console.log('  MISSED  ' + name); }
    }
    // The control both ways round: the SANCTIONED unbranded heading must NOT be flagged, or the
    // detector fires on the feature and gets switched off — the same trade the drawer control makes.
    setRefs({ asdairWs: WS, asdairWsErr: null });
    const clean = scenario('control', 'shop', Vue.compile(
      opts.template.replace(anchor, anchor + '<p>No brand recorded</p><p>Corroborated</p>')));
    const falsePos = clean.err ? [] : bannedVocabulary('SHOP control', text(clean.vnode));
    console.log(falsePos.length
      ? '  CONTROL FAILED — the sanctioned unbranded heading is being flagged: ' + falsePos[0]
      : '  control  sanctioned "No brand recorded" heading and "Corroborated" correctly NOT flagged');
    if (falsePos.length) missed.push('vocabulary false-positive');
  }
  // ...and the other half: the SANCTIONED drawer must NOT be flagged, or the check cries wolf and
  // gets ignored. A detector that fires on the feature is as useless as one that misses the bug.
  {
    setRefs({ asdairWs: WS, asdairWsErr: null });
    // 'about' — the drawer lives in Diagnostics, so that is the only view where this control is
    // testing anything at all. ('details' threw; before that it named a view without the drawer.)
    const r = scenario('control', 'about', Vue.compile(opts.template));
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

  // ── WP-B15-45: THE HOUSEHOLD BUILDER-VOCABULARY MUTATIONS ───────────────────────────────────
  //
  // One per rule in MUM_VOCABULARY, for the reason the WP-B15-42 block states and which applies
  // with more force here: a detector nobody has made fail is not evidence, it is a hope. AC3 asked
  // specifically that "Cockpit" and a status enum be injected and the harness shown to go red —
  // that is mutations 1 and 6 below. The other five are here because a ban that is only proven for
  // the word someone thought to test is a ban on that word, not on the vocabulary.
  //
  // Every mutation is IN MEMORY. public/shopping.js is never written, not even temporarily.
  {
    const mumAnchor = '<div class="page page-pad">';
    if (!shopOpts.template.includes(mumAnchor)) {
      console.error('SELF-TEST FAIL — the household template anchor is missing; rewrite the mutations.');
      process.exit(1);
    }
    const mumCases = {
      'household: the word COCKPIT reaches her screen':
        (t) => t.replace(mumAnchor, mumAnchor + '<p>Back to the Cockpit</p>'),
      'household: the system names itself to her':
        (t) => t.replace(mumAnchor, mumAnchor + '<p>AsdAIr is getting your shopping ready</p>'),
      'household: catalogue identity vocabulary leaks':
        (t) => t.replace(mumAnchor, mumAnchor + '<p>Choose a regular from the catalogue</p>'),
      'household: retail-operator vocabulary leaks':
        (t) => t.replace(mumAnchor, mumAnchor + '<p>Added to your basket</p>'),
      'household: machine vocabulary leaks':
        (t) => t.replace(mumAnchor, mumAnchor + '<p>The API endpoint did not answer</p>'),
      'household: a status enum leaks':
        (t) => t.replace(mumAnchor, mumAnchor + '<p>needs_decision</p>'),
      'household: a SHA or bare identifier leaks':
        (t) => t.replace(mumAnchor, mumAnchor + '<p>Build 3b2a574f</p>'),
    };
    total += Object.keys(mumCases).length;
    for (const [name, mutate] of Object.entries(mumCases)) {
      const r = mumScenario('mutant', M({}), Vue.compile(mutate(shopOpts.template)));
      const hits = r.err ? [] : mumVocabulary(text(r.vnode));
      if (hits.length) { caught++; console.log('  caught  ' + name.padEnd(48) + ' -> ' + hits[0].slice(0, 60)); }
      else { missed.push(name); console.log('  MISSED  ' + name); }
    }
    // The control both ways round, and it is not a formality: Addendum B §7.4 and §9.4 sanction
    // "They've run out of the usual eggs", which is why /\brun\b/ is deliberately absent from
    // MUM_VOCABULARY. If someone adds it back, this control goes red BEFORE the gate does, and the
    // message says which sentence it broke rather than leaving the next reader to find out.
    const cleanMum = mumScenario('control', M({}), Vue.compile(shopOpts.template.replace(
      mumAnchor, mumAnchor + '<p>They have run out of the usual eggs, so I have left them out.</p>')));
    const mumFalsePos = cleanMum.err ? [] : mumVocabulary(text(cleanMum.vnode));
    console.log(mumFalsePos.length
      ? '  CONTROL FAILED — sanctioned household copy is being flagged: ' + mumFalsePos[0]
      : '  control  sanctioned "run out of" copy correctly NOT flagged');
    if (mumFalsePos.length) missed.push('household vocabulary false-positive');
  }

  setRefs({ asdairWs: WS, asdairWsErr: null, asdairRules: RULES, asdairRulesErr: null });
  const control = scenarios(Vue.compile(opts.template))
    .concat(mumScenarios(Vue.compile(shopOpts.template)));
  // WP-B15-42: the vocabulary detector is part of the control, not only of the mutations. A detector
  // that fires on the SHIPPING template would make every run red for the wrong reason, and the first
  // thing anyone does with a permanently-red gate is stop reading it.
  // Both detectors, on whichever surface each scenario belongs to — the same pairing the gate uses.
  // A control that ran only the operator rules would leave the household ban unproven against false
  // positives, which is the half that actually decides whether a detector survives contact.
  const allVocab = (r) => (r.err ? [] : bannedVocabulary(r.name, text(r.vnode))
    .concat(r.mum ? mumVocabulary(text(r.vnode)) : []));
  const dirty = control.filter((r) => r.err || r.missing.length || allVocab(r).length);
  console.log(dirty.length
    ? '  CONTROL FAILED — unmutated template reports: ' + dirty.map((d) => d.name
      + (d.err ? ' threw' : (d.missing.length ? ' missing ' + d.missing.join(',')
        : ' banned vocabulary: ' + allVocab(d)[0]))).join(' | ')
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
const results = scenarios(render).concat(mumScenarios(Vue.compile(shopOpts.template)));

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
  // Both detectors on the household surface: the estate-wide honesty rules AND the operator-
  // vocabulary ban that is specific to her screen. Warwick's screens run only the first, because
  // status enums and service names are exactly what his surface exists to show him.
  const vocab = bannedVocabulary(r.name, t).concat(r.mum ? mumVocabulary(t) : []);
  const before = ran;
  runChecks(r, sink);
  console.log(String(n).padStart(5) + ' vnodes  ' + String(t.join(' ').length).padStart(6) + ' chars  ' +
    String(ran - before).padStart(3) + ' asserts  ' +
    (blob.length ? 'RAW-JSON-IN-TEXT:' + blob.length + '  ' : '') +
    (vocab.length ? 'BANNED-VOCABULARY:' + vocab.length + '  ' : '') + r.name +
    (r.missing.length ? '   MISSING BINDINGS: ' + r.missing.join(', ') : ''));
  for (const v of vocab) console.error('  BANNED VOCABULARY — ' + r.name + ' :: ' + v);
  if (r.missing.length || blob.length || vocab.length) bad++;
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
