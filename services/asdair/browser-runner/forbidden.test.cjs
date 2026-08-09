// =====================================================================
// THE STRUCTURAL SAFETY TEST.
//
// It scans this folder's OWN SOURCE and fails the suite if a path to any of the
// forbidden operations has appeared: checkout, payment, booking or changing a
// delivery slot, entering a password, changing payment details, enabling
// substitutions, or accepting an unapproved substitute.
//
// It scans EXECUTABLE CODE ONLY - comments and this test file are stripped -
// so the prose above (and the prose in every other file, which has to be able
// to say what is forbidden and why) cannot mask a real code path, and cannot
// raise a false alarm either.
//
// guards.cjs is the single deliberate exception: it is the refusal layer, and
// naming the forbidden vocabulary is its entire job. This test therefore ALSO
// asserts that guards.cjs actually refuses every one of those things, so the
// exception can never become a hiding place.
// =====================================================================
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const G = require('./guards.cjs');
const C = require('./commands.cjs');

const HERE = __dirname;
const GUARD_FILE = 'guards.cjs';

/** Remove line and block comments and string-free whitespace, leaving code. */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let mode = 'code';
  let quote = null;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; mode = 'string'; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += '\n'; } i += 1; continue; }
    if (mode === 'block') { if (c === '*' && d === '/') { mode = 'code'; i += 2; continue; } i += 1; continue; }
    if (mode === 'string') {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      out += c;
      if (c === quote) { mode = 'code'; quote = null; }
      i += 1; continue;
    }
  }
  return out;
}

function sourceFiles() {
  return fs.readdirSync(HERE)
    .filter((f) => /\.(js|cjs|mjs)$/.test(f))
    .filter((f) => !/\.test\.(js|cjs|mjs)$/.test(f))
    .filter((f) => f !== GUARD_FILE);
}

test('the comment stripper works, or the whole scan is theatre', () => {
  assert.strictEqual(stripComments('a // checkout\nb').trim().replace(/\s+/g, ''), 'ab');
  assert.strictEqual(stripComments('a /* checkout */ b').replace(/\s+/g, ''), 'ab');
  assert.ok(stripComments('const u = "/checkout";').includes('/checkout'), 'string literals must SURVIVE the strip');
  assert.ok(stripComments('const s = "a // b";').includes('a // b'), 'a comment marker inside a string is not a comment');
});

test('there is at least one source file to scan (a silent empty scan would pass vacuously)', () => {
  const files = sourceFiles();
  assert.ok(files.length >= 6, `expected the runner sources, found ${files.length}: ${files.join(', ')}`);
  for (const f of ['runner.js', 'browser.cjs', 'commands.cjs', 'lease.cjs', 'progress.cjs', 'control.cjs', 'store.cjs', 'cdp.js']) {
    assert.ok(files.includes(f), `${f} must be in the scan`);
  }
});

test('NO FORBIDDEN PATH exists in executable code anywhere in this folder', () => {
  const findings = [];
  for (const file of sourceFiles()) {
    const code = stripComments(fs.readFileSync(path.join(HERE, file), 'utf8'));
    for (const token of G.FORBIDDEN_TOKENS) {
      const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const m = re.exec(code);
      if (m) {
        const line = code.slice(0, m.index).split('\n').length;
        findings.push(`${file}:${line} contains forbidden token ${JSON.stringify(token)}`);
      }
    }
  }
  assert.deepStrictEqual(findings, [], `forbidden paths found:\n${findings.join('\n')}`);
});

test('NO CDP INPUT METHOD is used anywhere - the runner cannot type, by construction', () => {
  const findings = [];
  for (const file of sourceFiles().concat([GUARD_FILE])) {
    const code = stripComments(fs.readFileSync(path.join(HERE, file), 'utf8'));
    if (file === GUARD_FILE) continue;              // it names them only to refuse them
    if (/Input\.[a-zA-Z]/.test(code)) findings.push(`${file} references a CDP Input method`);
    if (/dispatchKeyEvent|insertText|dispatchMouseEvent/.test(code)) findings.push(`${file} synthesises input`);
  }
  assert.deepStrictEqual(findings, []);
});

test('every navigation in the source goes through the URL allowlist', () => {
  const urls = new Set();
  for (const file of sourceFiles()) {
    const code = stripComments(fs.readFileSync(path.join(HERE, file), 'utf8'));
    for (const m of code.matchAll(/https:\/\/[^"'`\s)]+/g)) urls.add(m[0]);
  }
  for (const u of urls) {
    if (!u.startsWith('https://www.asda.com')) continue;
    const concrete = u.replace(/\$\{[^}]*\}/g, '489747');
    assert.doesNotThrow(() => G.assertPermittedUrl(concrete), `source contains a non-allowlisted ASDA URL: ${u}`);
  }
});

test('guards.cjs - the one file allowed to name them - actually refuses every one', () => {
  const mustRefuseUrl = [
    'https://www.asda.com/groceries/checkout',
    'https://www.asda.com/checkout/payment',
    'https://www.asda.com/groceries/book-a-slot',
    'https://login.asda.com/shopper/authorise',
    'https://www.asda.com/account/cards',
  ];
  for (const u of mustRefuseUrl) assert.throws(() => G.assertPermittedUrl(u), /not on the navigation allowlist/, u);

  const mustRefuseClick = [
    'Checkout', 'Proceed to checkout', 'Pay now', 'Payment details', 'Card number',
    'Password', 'Sign in', 'Book a delivery slot', 'Change slot',
    'Allow substitutions', 'Accept this replacement',
  ];
  for (const l of mustRefuseClick) assert.throws(() => G.assertSafeTarget(l), /forbidden vocabulary/, l);

  for (const m of ['Input.insertText', 'Input.dispatchKeyEvent']) assert.throws(() => G.assertSafeCdpMethod(m));
});

test('the command allowlist contains no command that could order, pay, book or substitute', () => {
  for (const name of C.ALLOWED) {
    assert.doesNotMatch(name, /check|pay|order|slot|book|pass|substit|replace|card/i, `suspicious command name: ${name}`);
  }
});

// =====================================================================
// THE ONE-TAB INVARIANT, AT THE LEVEL OF THE SOURCE.
//
// BROWSER_METHOD `one_session_one_page_context`. The behaviour is proven in
// oneTab.test.cjs against a fake CDP endpoint; these two assert the SHAPE that
// makes the behaviour unavoidable, and they belong here because this is the
// file that already strips comments before scanning - prose describing the old
// behaviour must not trip the scan, and must not be able to hide the real thing
// either.
// =====================================================================

test('ONE TAB: no module outside cdp.js can create a page target', () => {
  const findings = [];
  for (const file of sourceFiles()) {
    if (file === 'cdp.js') continue;                  // it DEFINES the primitive, unexported
    const code = stripComments(fs.readFileSync(path.join(HERE, file), 'utf8'));
    if (/\bnewTab\b/.test(code)) findings.push(`${file} references newTab`);
    if (/\/json\/new/.test(code)) findings.push(`${file} issues its own /json/new`);
  }
  assert.deepStrictEqual(findings, [],
    'a module has found its own way to open a tab, which is how the arm came to open one per item:\n'
    + findings.join('\n'));
});

test('ONE TAB: the proof seam (_internal) is never reachable from production code', () => {
  const findings = [];
  for (const file of sourceFiles()) {
    if (file === 'cdp.js') continue;
    const code = stripComments(fs.readFileSync(path.join(HERE, file), 'utf8'));
    if (/_internal/.test(code)) findings.push(file);
  }
  assert.deepStrictEqual(findings, [],
    'cdp._internal exposes setTransport and setOneTabGuard so the guard can be REMOVED on purpose and the break '
    + 'observed. A production caller would make the guard optional at runtime, which is the same as not having '
    + `one: ${findings.join(', ')}`);
});

test('the dispatch table in runner.js covers the allowlist EXACTLY - no orphan, no extra', () => {
  const code = stripComments(fs.readFileSync(path.join(HERE, 'runner.js'), 'utf8'));
  const dispatch = code.slice(code.indexOf('switch (step.command)'));
  const cases = new Set(Array.from(dispatch.matchAll(/case '([a-z_]+)'/g)).map((m) => m[1]));
  for (const name of C.ALLOWED) assert.ok(cases.has(name), `${name} is on the allowlist but has no dispatch`);
  for (const c of cases) assert.ok(C.ALLOWED.includes(c), `${c} is dispatchable but is NOT on the allowlist`);
});
