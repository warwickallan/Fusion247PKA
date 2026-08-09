// =====================================================================
// BUILD-015 AsdAIr browser runner - THE ONE-TAB INVARIANT.
//
// BROWSER_METHOD step `one_session_one_page_context` (handoff/instructions.js).
// Warwick, 2026-08-09: one persistent Chrome profile, one session, ONE TAB, ten
// trolley items, basket ready for checkout.
//
// WHAT WAS WRONG, AND WHY A GUARD INSIDE cdp.js WOULD NOT HAVE BEEN ENOUGH.
// `newTab` was exported. `withPage()` in actions.cjs called it on every product
// page and `openAndEval()` in readTrolley.cjs called it again to read the
// trolley - so the arm opened a tab per item while the method file two packages
// away said not to. A guard placed inside `newTab` would have been walked
// around by the very callers it was written for, because they imported the
// primitive directly. The fix is structural: THE PRIMITIVE IS NOT EXPORTED.
// This file proves that, and proves the refusal actually fires.
//
// FULLY OFFLINE. A fake CDP transport is injected, so there is no Chrome, no
// network, no websocket and no ASDA anywhere in this file.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cdp = require('./cdp.js');

const ASDA = 'https://www.asda.com/groceries';
const HERE = __dirname;

/**
 * A fake /json endpoint. It counts creations, because "how many tabs did this
 * open" is the entire question and an assertion on anything else would be
 * measuring a proxy.
 */
function fakeChrome({ initialPages = [] } = {}) {
  const state = { pages: initialPages.map((p) => ({ ...p })), created: 0, nextId: 100 };
  const transport = async (pathname) => {
    if (pathname === '/json/list') return state.pages.map((p) => ({ ...p }));
    if (pathname.startsWith('/json/new')) {
      state.created += 1;
      const url = decodeURIComponent(pathname.slice('/json/new?'.length));
      const page = {
        id: `T${state.nextId += 1}`, type: 'page', url,
        webSocketDebuggerUrl: `ws://fake/devtools/page/T${state.nextId}`,
      };
      state.pages.push(page);
      return { ...page };
    }
    if (pathname.startsWith('/json/close/')) {
      const id = pathname.slice('/json/close/'.length);
      state.pages = state.pages.filter((p) => p.id !== id);
      return 'Target is closing';
    }
    throw new Error(`fakeChrome: unexpected CDP path ${pathname}`);
  };
  return { state, transport };
}

function install(fake) {
  cdp._internal.setTransport(fake.transport);
  cdp._internal.setOneTabGuard(true);
  cdp.releaseSessionTab();
}

function uninstall() {
  cdp._internal.setTransport(null);
  cdp._internal.setOneTabGuard(true);
  cdp.releaseSessionTab();
}

// ---------------------------------------------------------------------
// The instrument first. A fake that cannot count is not evidence.
// ---------------------------------------------------------------------
test('the fake CDP transport actually counts tab creations', async () => {
  const fake = fakeChrome();
  install(fake);
  try {
    assert.equal(fake.state.created, 0);
    await cdp._internal.createPageTarget(ASDA);
    assert.equal(fake.state.created, 1, 'the fake did not observe a creation - every other test here would be vacuous');
    assert.equal(fake.state.pages.length, 1);
  } finally { uninstall(); }
});

// ---------------------------------------------------------------------
// THE BYPASS IS CLOSED
// ---------------------------------------------------------------------
test('cdp.js does NOT export a raw tab-creating primitive - the direct-import bypass is gone', () => {
  assert.equal(cdp.newTab, undefined,
    'cdp.js exports `newTab` again. An exported tab-creating primitive is a bypass of the one-tab invariant: '
    + 'any module can import it and open a page per call, which is exactly how actions.cjs and readTrolley.cjs '
    + 'came to open a tab per item while the method said one session, one page context.');
  assert.equal(typeof cdp.sessionTab, 'function', 'the one sanctioned accessor must exist');
  assert.equal(typeof cdp.openShoppingTab, 'function');
});

// The two SOURCE-LEVEL halves of this invariant - that no module imports a
// tab-creating primitive, and that no production file reaches into `_internal` -
// live in forbidden.test.cjs. That file already owns the comment-stripping
// scanner this estate uses for structural assertions, and a second copy of a
// stripper is a second thing that can be subtly wrong. This file proves the
// BEHAVIOUR; that one proves the SHAPE OF THE SOURCE.

// ---------------------------------------------------------------------
// ONE TAB, ACROSS A WHOLE SHOP
// ---------------------------------------------------------------------
test('ten sequential product pages open exactly ONE tab', async () => {
  const fake = fakeChrome();
  install(fake);
  try {
    const ids = [];
    for (let i = 0; i < 10; i += 1) {
      const tab = await cdp.sessionTab(`${ASDA}/product/${489747 + i}`);
      ids.push(tab.id);
    }
    assert.equal(fake.state.created, 1,
      `ten items opened ${fake.state.created} tabs. This is the exact regression Warwick watched: a tab per item.`);
    assert.equal(new Set(ids).size, 1, 'the ten calls did not all land on the same target');
    assert.equal(fake.state.pages.filter((p) => p.type === 'page').length, 1);
  } finally { uninstall(); }
});

test('reading the trolley reuses the shopping tab rather than opening its own', async () => {
  const fake = fakeChrome();
  install(fake);
  try {
    const product = await cdp.sessionTab(`${ASDA}/product/489747`);
    const trolley = await cdp.sessionTab(`${ASDA}/trolley`);
    assert.equal(trolley.id, product.id, 'the trolley read landed on a different target');
    assert.equal(fake.state.created, 1);
  } finally { uninstall(); }
});

test("an ASDA tab Warwick already has open is ADOPTED, never duplicated", async () => {
  const fake = fakeChrome({
    initialPages: [
      { id: 'W1', type: 'page', url: 'https://www.asda.com/groceries', webSocketDebuggerUrl: 'ws://fake/W1' },
      { id: 'X9', type: 'background_page', url: 'chrome-extension://x' },
    ],
  });
  install(fake);
  try {
    const tab = await cdp.sessionTab(`${ASDA}/product/489747`);
    assert.equal(tab.id, 'W1', 'the runner opened its own tab beside the one Warwick was already watching');
    assert.equal(fake.state.created, 0);
  } finally { uninstall(); }
});

// ---------------------------------------------------------------------
// AND IT FAILS LOUDLY
// ---------------------------------------------------------------------
test('a code path that WOULD open a second page target throws OneTabViolationError', async () => {
  const fake = fakeChrome();
  install(fake);
  try {
    await cdp.sessionTab(`${ASDA}/product/489747`);
    assert.equal(fake.state.created, 1);

    await assert.rejects(
      () => cdp._internal.createPageTarget(`${ASDA}/product/222222`),
      (err) => {
        assert.equal(err.name, 'OneTabViolationError', 'a second tab must be a NAMED, loud refusal');
        assert.ok(err instanceof cdp.OneTabViolationError);
        assert.match(err.message, /second page target/i);
        assert.equal(err.detail.heldTargetId, cdp._internal.heldTargetId());
        return true;
      },
      'opening a second page target must FAIL, not succeed quietly',
    );
    assert.equal(fake.state.created, 1, 'the refusal did not actually prevent the creation');
  } finally { uninstall(); }
});

test('when the held tab has GONE, a fresh one is legitimate - the guard is not a deadlock', async () => {
  const fake = fakeChrome();
  install(fake);
  try {
    const first = await cdp.sessionTab(`${ASDA}/product/489747`);
    fake.state.pages = fake.state.pages.filter((p) => p.id !== first.id);   // Warwick closed it

    const second = await cdp.sessionTab(`${ASDA}/trolley`);
    assert.notEqual(second.id, first.id);
    assert.equal(fake.state.created, 2, 'a session whose tab was closed must be able to open another');
    assert.equal(fake.state.pages.length, 1, 'and still hold only one');
  } finally { uninstall(); }
});

test('releaseSessionTab lets the NEXT shop start cleanly', async () => {
  const fake = fakeChrome();
  install(fake);
  try {
    await cdp.sessionTab(`${ASDA}/product/489747`);
    assert.notEqual(cdp._internal.heldTargetId(), null);
    cdp.releaseSessionTab();
    assert.equal(cdp._internal.heldTargetId(), null);
  } finally { uninstall(); }
});
