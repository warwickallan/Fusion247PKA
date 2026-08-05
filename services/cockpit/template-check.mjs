// Fusion247 Cockpit — TEMPLATE COMPILE + STRUCTURE CHECK.
//
// WHY THIS EXISTS AT ALL. `services/cockpit/public/*` is served straight from the working tree with
// no build step, so saving a file is INSTANTLY live on Warwick's phone. `node --check` validates JS
// syntax only — and a broken Vue TEMPLATE is a perfectly valid JS string. It passes `node --check`
// and then blanks the entire cockpit, every app, at runtime.
//
// The browser gate that was supposed to catch this — `render-check.mjs` — is BROKEN on this machine
// (DEFECT-LEDGER D-2026-08-03-11: headless Edge self-relaunches and detaches, and it fails
// identically on untouched HEAD, so it is environmental, not a code defect). `nav-check.mjs` is
// broken the same way. This file and its sibling `render-vm-check.mjs` are the COMPENSATING CONTROL
// that runs in their place. They need no browser: everything happens in a Node `vm`.
//
// ── THE FINDING THAT SHAPES THIS FILE ────────────────────────────────────────────────────────────
// TWO INSTRUMENTS, and the second one is not belt-and-braces — it is load-bearing. Established by
// executing it, not by assuming it:
//
//   A. `Vue.compile()` from the vendored PRODUCTION build. Catches malformed expressions and bad
//      directive syntax (`v-for="v of"`).
//      **MEASURED LIMIT: the production build does NOT report unclosed tags, stray closing tags, or
//      unterminated attribute quotes. It silently auto-recovers from all of them.** The dev build
//      would warn; the vendored prod build does not, and the prod build is what ships.
//
//   B. An independent structural scan (tag balance, quote balance, `{{ }}` balance) written here
//      from scratch. It covers exactly the class A is blind to.
//
// Relying on A alone is a green over ground it never examined — that is not a theoretical worry,
// it is why B exists. Run `--self-test` and read the output: three of the seven mutations are caught
// by `structure:` and never by `compiler:`.
//
// ── WHY IT IS EVIDENCE ───────────────────────────────────────────────────────────────────────────
// `--self-test` is a MUTATION TEST: it injects one deliberate breakage per named case and asserts
// each is caught, plus a control run on the unmutated template asserting no false positive. A check
// that has never been made to fail is not evidence. If you change the template structure enough that
// the self-test anchor disappears, the harness FAILS rather than silently testing nothing.
//
// ── HOW THE TEMPLATE IS OBTAINED ─────────────────────────────────────────────────────────────────
// vue → apps.js → app.js are run in ONE vm context, in the browser's own order, with
// `Vue.createApp` stubbed to capture the options object. So:
//   * the compiled string is the REAL post-interpolation template, not a regex guess at it; and
//   * a duplicate top-level `const APPS` across apps.js and app.js throws here exactly as it does in
//     the browser — the SyntaxError class `node --check` structurally cannot see, because each file
//     is valid on its own.
//
// USAGE
//   node services/cockpit/template-check.mjs              # gate: exit 0 clean, 1 on any finding
//   node services/cockpit/template-check.mjs --self-test  # prove the gate can fail
//   node services/cockpit/template-check.mjs --pub <dir>  # check a staging copy of public/
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Repo-relative by default. The scratchpad original hard-coded an absolute Windows path, which is
// precisely the sort of thing that makes a harness un-runnable on a fresh clone or in CI.
const pubFlag = process.argv.indexOf('--pub');
const PUB = pubFlag !== -1 && process.argv[pubFlag + 1]
  ? path.resolve(process.argv[pubFlag + 1])
  : path.join(HERE, 'public');
const SELF_TEST = process.argv.includes('--self-test');

// ---------------------------------------------------------------------------
// Instrument B — structural scan. Independent of Vue entirely.
// ---------------------------------------------------------------------------
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr']);

export function structuralErrors(tpl) {
  const errs = [];
  const stack = [];
  let i = 0;
  const line = (at) => tpl.slice(0, at).split('\n').length;

  while (i < tpl.length) {
    const lt = tpl.indexOf('<', i);
    if (lt === -1) break;
    if (tpl.startsWith('<!--', lt)) {
      const end = tpl.indexOf('-->', lt + 4);
      if (end === -1) { errs.push(`unterminated HTML comment opened at line ${line(lt)}`); break; }
      i = end + 3; continue;
    }
    // Walk to the matching '>', respecting quoted attribute values.
    let j = lt + 1, quote = null, gt = -1;
    while (j < tpl.length) {
      const c = tpl[j];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') { gt = j; break; }
      j++;
    }
    if (gt === -1) { errs.push(`unterminated tag (no closing '>') opened at line ${line(lt)}`); break; }
    const raw = tpl.slice(lt + 1, gt);
    if (quote) errs.push(`unterminated attribute quote in tag at line ${line(lt)}`);

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim().toLowerCase();
      if (!stack.length) errs.push(`stray closing </${name}> at line ${line(lt)} — nothing is open`);
      else {
        const top = stack[stack.length - 1];
        if (top.name !== name) {
          errs.push(`</${name}> at line ${line(lt)} does not match <${top.name}> opened at line ${top.line}`);
          const found = [...stack].reverse().findIndex((f) => f.name === name);
          if (found === -1) { /* leave the stack alone */ } else stack.length -= (found + 1);
        } else stack.pop();
      }
    } else if (!raw.startsWith('!') && !raw.startsWith('?')) {
      const name = (raw.match(/^[A-Za-z][-A-Za-z0-9_:.]*/) || [''])[0].toLowerCase();
      if (!name) errs.push(`unnamed tag at line ${line(lt)}`);
      else if (!raw.trimEnd().endsWith('/') && !VOID.has(name)) stack.push({ name, line: line(lt) });
    }
    i = gt + 1;
  }
  for (const open of stack) errs.push(`<${open.name}> opened at line ${open.line} is never closed`);

  // Interpolation balance, ignoring anything inside an HTML comment.
  const bare = tpl.replace(/<!--[\s\S]*?-->/g, '');
  let k = 0, depth = 0, opened = 0;
  while (k < bare.length) {
    if (bare.startsWith('{{', k)) { depth++; opened = k; k += 2; continue; }
    if (bare.startsWith('}}', k)) {
      if (depth === 0) errs.push(`stray '}}' at line ${bare.slice(0, k).split('\n').length}`);
      else depth--;
      k += 2; continue;
    }
    k++;
  }
  if (depth > 0) errs.push(`unterminated '{{' near line ${bare.slice(0, opened).split('\n').length}`);
  return errs;
}

// ---------------------------------------------------------------------------
// Load the real template out of the real files.
// ---------------------------------------------------------------------------
function domEl() {
  const o = { textContent: '', children: [], _h: '', focus() {}, setAttribute() {}, appendChild() {},
    addEventListener() {}, removeEventListener() {}, scrollIntoView() {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [] };
  Object.defineProperty(o, 'innerHTML', {
    get() { return o._h; },
    set(v) {
      o._h = String(v);
      o.textContent = String(v).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
      const m = /foo="([^"]*)"/.exec(String(v));
      o.children = [{ getAttribute: () => (m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '') }];
    },
  });
  return o;
}

const captured = [];
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ ok: false, status: 0, json: async () => ({}) }),
  location: { href: 'http://127.0.0.1:8090/', pathname: '/', search: '', hash: '' },
  navigator: { serviceWorker: { register: async () => ({}) }, userAgent: 'node' },
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    createElement: () => domEl(), createTextNode: () => domEl(),
    querySelector: () => domEl(), querySelectorAll: () => [], getElementById: () => domEl(),
    addEventListener() {}, removeEventListener() {}, body: domEl(), documentElement: domEl(), title: '',
  },
};
sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
const ctx = createContext(sandbox);
const load = (f) => { const p = path.join(PUB, f); runInContext(readFileSync(p, 'utf8'), ctx, { filename: p }); };
const fail = (m) => { console.error('TEMPLATE-CHECK FAIL — ' + m); process.exit(1); };

try { load('vendor/vue.global.prod.js'); } catch (e) { fail('vue did not load: ' + e.message); }
if (!sandbox.Vue || typeof sandbox.Vue.compile !== 'function') fail('this Vue build exposes no compile().');

sandbox.Vue.createApp = (options) => { captured.push(options); return { mount: () => ({}) }; };

try { load('apps.js'); } catch (e) { fail('apps.js threw: ' + e.message); }
if (!Array.isArray(sandbox.window.FUSION_APPS)) fail('apps.js published no window.FUSION_APPS.');
try { load('app.js'); } catch (e) { fail('app.js threw at load: ' + e.message); }
if (!captured.length) fail('app.js never called Vue.createApp — nothing to compile.');
if (typeof captured[0].template !== 'string' || !captured[0].template.trim()) fail('no template string captured.');

const TPL = captured[0].template;

// ---------------------------------------------------------------------------
// Run both instruments over one template. Returns a list of findings.
// ---------------------------------------------------------------------------
function inspect(tpl) {
  const out = structuralErrors(tpl).map((e) => 'structure: ' + e);
  const compilerErrors = [];
  try {
    sandbox.Vue.compile(tpl, { onError: (e) => compilerErrors.push(e.message || String(e)) });
  } catch (e) {
    compilerErrors.push(e.message || String(e));
  }
  for (const e of compilerErrors) out.push('compiler: ' + e);
  return out;
}

// ---------------------------------------------------------------------------
// MUTATION TEST. Each case must be caught, or this checker is not evidence.
//
// Note which instrument catches what when you read the output: 'unclosed tag', 'stray closing tag'
// and 'unterminated attribute quote' are caught ONLY by `structure:`. That is the prod-compiler
// blind spot, demonstrated rather than asserted.
// ---------------------------------------------------------------------------
if (SELF_TEST) {
  const anchor = '<div class="app-view">';
  if (!TPL.includes(anchor)) fail('self-test anchor "' + anchor + '" not present — rewrite the mutations.');
  const cases = {
    'unclosed tag': (t) => t.replace(anchor, anchor + '<span>'),
    'stray closing tag': (t) => t.replace(anchor, anchor + '</section>'),
    'unterminated interpolation': (t) => t.replace(anchor, anchor + '<p>{{ currentApp.label </p>'),
    'unterminated attribute quote': (t) => t.replace(anchor, '<div class="app-view>'),
    'malformed expression': (t) => t.replace(anchor, '<div :class="currentApp .">'),
    'bad v-for': (t) => t.replace(anchor, '<div v-for="v of">'),
    'mismatched close': (t) => t.replace(anchor, anchor.replace('div', 'section')),
  };
  let caught = 0; const missed = [];
  for (const [name, mutate] of Object.entries(cases)) {
    const found = inspect(mutate(TPL));
    if (found.length) { caught++; console.log('  caught  ' + name.padEnd(28) + ' -> ' + found[0].slice(0, 92)); }
    else { missed.push(name); console.log('  MISSED  ' + name); }
  }
  const clean = inspect(TPL);
  console.log(clean.length ? '  CONTROL FAILED — the unmutated template reports errors' : '  control  unmutated template is clean (no false positive)');
  if (missed.length || clean.length) { console.error('SELF-TEST FAIL — missed: ' + (missed.join(', ') || 'none') + (clean.length ? '; control dirty' : '')); process.exit(1); }
  console.log('SELF-TEST PASS — ' + caught + '/' + Object.keys(cases).length + ' mutations caught, control clean.');
  process.exit(0);
}

const findings = inspect(TPL);
if (findings.length) {
  console.error('TEMPLATE-CHECK FAIL — ' + findings.length + ' finding(s):');
  for (const f of findings.slice(0, 12)) console.error('  · ' + f);
  process.exit(1);
}
console.log('TEMPLATE-CHECK PASS — 1 template compiled + structurally balanced (' + TPL.length +
  ' bytes), ' + sandbox.window.FUSION_APPS.length + ' app(s) registered, views: ' +
  sandbox.window.FUSION_APPS.map((a) => a.key + '[' + a.views.map((v) => v.key).join('|') + ']').join(' '));
