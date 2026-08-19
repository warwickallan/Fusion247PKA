// =====================================================================
// BUILD-015 AsdAIr WO-2026-08-19-01 - EVERY IN-PAGE EXPRESSION MUST ACTUALLY
// PARSE, AND MUST STILL HAVE ITS BACKSLASHES.
//
// Runs under: node --test
//
// -- THE DEFECT THIS EXISTS TO CLOSE -----------------------------------------
// readTrolley.cjs built its TROLLEY_SNAPSHOT with an ordinary template literal.
// Node consumed every backslash while building the string, so what reached the
// page was:
//
//     /Order totals*£(d+.d{2})/     instead of   /Order total\s*£(\d+\.\d{2})/
//     /(d+)s+items? subtotal/       instead of   /(\d+)\s+items? subtotal/
//     .filter(x => x.name && //product//.test(x.href));
//
// The first two are regexes that can never match. The third is worse: `//`
// opens a LINE COMMENT, so the entire expression was a SyntaxError and
// Runtime.evaluate returned undefined. That module could not read a trolley
// under any circumstances.
//
// It went unnoticed because these strings are only ever executed by a BROWSER.
// Nothing in Node parses them, so a suite can be entirely green over an
// expression that cannot run. That is the whole gap this file closes, and it is
// the same shape as the browser lane that never executed: the code was there,
// the tests were green, and nothing had ever made it run.
//
// -- WHY IT ENUMERATES RATHER THAN NAMING THE ONE THAT BROKE -----------------
// browser.cjs escapes its copies correctly today. Pinning only readTrolley
// would leave four siblings one careless edit away from the same silent break,
// so this walks every string export that looks like page code and refuses to
// pass on an empty set.
//
// PURE ASCII. No browser, no network - which is the point: this catches the
// class WITHOUT needing one.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const browser = require('./browser.cjs');
const readTrolley = require('./readTrolley.cjs');

const BACKSLASH = String.fromCharCode(92);

/**
 * Every exported string that is meant to be evaluated inside a page. Detected
 * by shape rather than by a hand-kept list, so a new one is covered the day it
 * is added instead of the day someone remembers.
 */
function inPageExpressions() {
  const found = [];
  for (const [modName, mod] of [['browser.cjs', browser], ['readTrolley.cjs', readTrolley]]) {
    for (const [key, value] of Object.entries(mod)) {
      if (typeof value !== 'string') continue;
      if (!/document\.|JSON\.stringify|window\./.test(value)) continue;
      found.push({ where: `${modName}:${key}`, expr: value });
    }
  }
  return found;
}

test('there ARE in-page expressions to check - an empty sweep would pass vacuously', () => {
  const all = inPageExpressions();
  assert.ok(all.length >= 4,
    `expected at least 4 in-page expressions, found ${all.length}: ${all.map((e) => e.where).join(', ')}`);
});

test('EVERY in-page expression is syntactically valid JavaScript', () => {
  for (const { where, expr } of inPageExpressions()) {
    assert.doesNotThrow(
      () => new Function(`return (${expr})`),
      `${where} is not valid JavaScript, so Runtime.evaluate returns undefined and the caller `
      + 'sees "no data" rather than an error',
    );
  }
});

test('no in-page expression contains a COLLAPSED regex opening a line comment', () => {
  // The specific way the escape loss became fatal rather than merely wrong:
  // /\/product\// collapses to //product//, and `//` opens a line comment that
  // swallows the rest of the expression.
  //
  // NOTE THE REFINEMENT, because the first version of this check was wrong. It
  // flagged any `//` inside an unclosed bracket, which fires on the CORRECT
  // form too - /\/product\// genuinely ends in a backslash followed by two
  // slashes. A check that fails on correct code is noise, and a noisy gate gets
  // ignored. So it looks for the one shape that is actually diagnostic: a `//`
  // whose preceding character is neither a backslash (an escaped slash, fine)
  // nor a colon (a URL, fine).
  const suspect = (line) => {
    for (let i = 1; i < line.length - 1; i += 1) {
      if (line[i] !== '/' || line[i + 1] !== '/') continue;
      const prev = line[i - 1];
      if (prev === BACKSLASH || prev === ':') continue;
      return line.slice(Math.max(0, i - 30), i + 20);
    }
    return null;
  };
  let scanned = 0;
  for (const { where, expr } of inPageExpressions()) {
    for (const line of expr.split('\n')) {
      if (line.trim().startsWith('//')) continue;   // a real comment line
      scanned += 1;
      const hit = suspect(line);
      assert.equal(hit, null,
        `${where} has an unescaped // mid-expression - the collapsed-regex signature that turned `
        + `readTrolley into a SyntaxError: ...${hit}...`);
    }
  }
  assert.ok(scanned > 0, 'no lines were scanned - this proof would pass vacuously');
});

test('any expression using regex character classes still HAS its backslashes', () => {
  let checked = 0;
  for (const { where, expr } of inPageExpressions()) {
    // Shapes that only ever appear as the RESULT of a lost backslash: `(d+` was
    // `(\d+`, and `s*` after a word boundary was `\s*`.
    assert.doesNotMatch(expr, /\(d\+/,
      `${where} contains "(d+" - that is "(\\d+" with the backslash eaten by a template literal. `
      + 'Use String.raw.');
    if (/match\(|test\(|RegExp/.test(expr)) {
      checked += 1;
      assert.ok(expr.includes(BACKSLASH),
        `${where} uses regexes but contains no backslash at all - every escape was consumed when `
        + 'the string was built. Use String.raw.');
    }
  }
  assert.ok(checked > 0, 'no regex-bearing expression was examined - this proof would pass vacuously');
});

test('readTrolley TROLLEY_SNAPSHOT specifically: the four fields it must be able to read', () => {
  // The regression, pinned by behaviour rather than by source shape. Each of
  // these regexes was silently broken and each is a field reconcile() consumes.
  const { TROLLEY_SNAPSHOT } = readTrolley;
  assert.match(TROLLEY_SNAPSHOT, /Order total/, 'the order-total read is gone');
  assert.match(TROLLEY_SNAPSHOT, /items\? subtotal/, 'the item-count read is gone');
  assert.match(TROLLEY_SNAPSHOT, /Your products/, 'the product-count read is gone');
  assert.match(TROLLEY_SNAPSHOT, /quantity in cart/, 'the per-line quantity read is gone');

  // And it must evaluate against a DOM-less stub without throwing at PARSE
  // time. (Whether it extracts correctly against a real DOM is proven by
  // proof/ac2-lane-launches.cjs, which needs a real Chrome.)
  assert.doesNotThrow(() => new Function(`return (${TROLLEY_SNAPSHOT})`));
});
