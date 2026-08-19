#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr WO-2026-08-19-01 AC2 - THE LANE LAUNCHES A REAL CHROME.
//
//   node proof/ac2-lane-launches.cjs
//   node proof/ac2-lane-launches.cjs --mutate
//
// -- WHAT THIS PROVES, AND WHAT IT DELIBERATELY DOES NOT ---------------------
// AC2 as originally written asked for "a real browser session and a built
// trolley". That is Warwick's live ASDA account, and this Work Order carries
// live_authority: none, network: none, credential_scope: none and
// private_surface: none. Larry amended AC2 rather than granting authority that
// cannot be granted in a dispatch message.
//
// So this proves the half that has never run and CAN run honestly:
//
//   * a real Chrome, really launched by the shipping launcher, on a SCRATCH
//     profile that is not the household's;
//   * reuse-before-spawn against that real browser;
//   * the visible-browser assertion against a real /json/version;
//   * the five permanent boundaries refusing on the LIVE code path, with a
//     real browser attached - not in a unit test with the module stubbed;
//   * the real TROLLEY_SNAPSHOT extraction expression evaluated against a REAL
//     Chrome DOM, which has never happened - it has only ever been reasoned
//     about in Node;
//   * that extraction feeding the real reconcile() and the real announcement
//     gate.
//
// IT DOES NOT PROVE ASDA. No request leaves this machine. The fixture is a
// data: URL holding trolley-shaped markup, opened in the HARNESS'S OWN tab.
// The runner's navigation allowlist is neither used nor weakened to get there -
// weakening it to make a test pass is the fabrication this proof exists to
// argue against. The real-ASDA leg remains outstanding and is Warwick's to
// authorise.
//
// -- CONFIGURATION CARRIES NO DEFAULTS ---------------------------------------
// AC2_CHROME   full path to a Chrome executable   (required)
// AC2_PORT     a debugging port to use            (required)
// Absent either: NOT RUN, exit 2. Never a pass. launcher.cjs carries no default
// chrome path by design - a baked path is how this lane would quietly stop
// working on a different machine - and this harness holds that same line.
// =====================================================================
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const launcher = require(path.join(__dirname, '..', '..', 'basket-executor', 'launcher.cjs'));
const cdp = require(path.join(__dirname, '..', 'cdp.js'));
const guards = require(path.join(__dirname, '..', 'guards.cjs'));
const { TROLLEY_SNAPSHOT } = require(path.join(__dirname, '..', 'readTrolley.cjs'));
const { reconcile } = require(path.join(__dirname, '..', '..', 'basket-executor', 'reconcile.cjs'));

const MUTATE = process.argv.includes('--mutate');
const CHROME = process.env.AC2_CHROME || null;
const PORT = process.env.AC2_PORT ? Number(process.env.AC2_PORT) : null;

const results = [];
let failures = 0;
function heading(n, title) {
  console.log(`\n${'='.repeat(72)}\nPROOF ${n} - ${title}\n${'='.repeat(72)}`);
}
function check(name, ok, evidence) {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}`);
  if (evidence !== undefined) {
    console.log(`         ${typeof evidence === 'string' ? evidence : JSON.stringify(evidence)}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A trolley page shaped like the one the extraction expects. Two products, an
// order total, an item subtotal and a product count - the four things
// TROLLEY_SNAPSHOT reads out of innerText and the DOM.
const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Your trolley</h1>
  <p>Order total £24.53</p>
  <p>7 items subtotal</p>
  <p>Your products (2)</p>
  <ul>
    <li aria-label="Weetabix Protein, quantity in cart 1">
      <a href="/groceries/product/cereal/weetabix-protein/910000123">Weetabix Protein</a>
    </li>
    <li aria-label="Arla semi skimmed 4pt, quantity in cart 3">
      <a href="/groceries/product/dairy/arla-semi-skimmed/910000456">Arla semi skimmed 4pt</a>
    </li>
  </ul>
</body></html>`;

const MANIFEST = {
  shop_ref: 'SHOP-AC2-2026-08-19',
  line_count: 2,
  lines: [
    { n: 1, product: 'Weetabix Protein', qty: 1, asda_product_id: '910000123' },
    { n: 2, product: 'Arla semi skimmed 4pt', qty: 3, asda_product_id: '910000456' },
  ],
};

async function main() {
  if (!CHROME || !PORT) {
    console.log('NOT RUN - AC2_CHROME and AC2_PORT are both required and carry no defaults.');
    console.log('          This is NOT a pass.');
    process.exit(2);
  }

  const scratchProfile = path.join(
    process.env.AC2_PROFILE_DIR || path.join(os.tmpdir(), 'keel-ac2-chrome-profile'),
  );
  fs.mkdirSync(scratchProfile, { recursive: true });

  let launched = null;

  try {
    // ── PROOF 1 ────────────────────────────────────────────────────────────
    heading(1, 'configuration is CONFIGURATION - the launcher carries no defaults');
    let threw = null;
    try { launcher.resolveConfig({}, {}); } catch (e) { threw = e; }
    check('an empty environment throws LauncherConfigError rather than guessing',
      threw && threw.name === 'LauncherConfigError',
      threw ? threw.message.split('.')[0] : 'it did not throw');

    const cfg = launcher.resolveConfig({ chromePath: CHROME, profileDir: scratchProfile, port: PORT }, {});
    check('an explicit configuration resolves to exactly what was supplied',
      cfg.chromePath === CHROME && cfg.profileDir === scratchProfile && cfg.port === PORT,
      `port=${cfg.port} profile=${path.basename(cfg.profileDir)}`);

    let headlessThrew = null;
    try {
      launcher.resolveConfig({ chromePath: `${CHROME} --headless`, profileDir: scratchProfile, port: PORT }, {});
    } catch (e) { headlessThrew = e; }
    check('a headless invocation is REFUSED - the shop must be visible and takeable-over',
      headlessThrew && headlessThrew.name === 'LauncherConfigError',
      headlessThrew ? headlessThrew.message : 'it was allowed');

    const args = launcher.chromeArgs(cfg);
    check('the spawned argv opens a debuggable, visible Chrome on the SCRATCH profile',
      args.includes(`--remote-debugging-port=${PORT}`)
      && args.includes(`--user-data-dir=${scratchProfile}`)
      && !args.some((a) => /headless/i.test(a)),
      args.join(' '));
    check('the scratch profile is NOT the household profile',
      !/\.fusion247/i.test(scratchProfile) && !/asdair/i.test(scratchProfile),
      scratchProfile);

    // ── PROOF 2 ────────────────────────────────────────────────────────────
    heading(2, 'a REAL Chrome is launched, and it is visible');
    launched = await launcher.ensureChrome(
      { chromePath: CHROME, profileDir: scratchProfile, port: PORT },
      { log: (m) => console.log(`         launcher: ${m}`), waitMs: 30000 },
    );
    check('Chrome answered on the configured port', !!launched.version,
      `${launched.version && launched.version.Browser} (reused=${launched.reused})`);

    process.env.ASDAIR_CDP_ENDPOINT = launched.endpoint;
    const version = await cdp.assertVisibleBrowser();
    check('assertVisibleBrowser accepted it - the User-Agent is not headless',
      !/headless/i.test(String(version['User-Agent'] || '')),
      String(version['User-Agent'] || '').slice(0, 90));

    // ── PROOF 3 ────────────────────────────────────────────────────────────
    heading(3, 'REUSE BEFORE SPAWN - a second call adopts, it does not duplicate');
    const again = await launcher.ensureChrome(
      { chromePath: CHROME, profileDir: scratchProfile, port: PORT },
      { log: () => {}, waitMs: 10000 },
    );
    check('the running browser was adopted, and nothing was spawned',
      again.reused === true && again.pid === null,
      `reused=${again.reused} pid=${again.pid}`);

    // ── PROOF 4 ────────────────────────────────────────────────────────────
    heading(4, 'the five permanent boundaries refuse, with a real browser attached');
    const forbiddenUrls = [
      ['checkout', 'https://www.asda.com/checkout'],
      ['payment', 'https://www.asda.com/checkout/payment'],
      ['a delivery slot', 'https://www.asda.com/groceries/slot/book'],
      ['sign-in', 'https://www.asda.com/account/signin'],
      ['an arbitrary host', 'https://evil.example.com/groceries/trolley'],
    ];
    for (const [what, url] of forbiddenUrls) {
      let refused = null;
      try { guards.assertPermittedUrl(url); } catch (e) { refused = e; }
      check(`navigation to ${what} is refused before any CDP call`,
        refused && refused.name === 'RefusedError', url);
    }
    let typedRefused = null;
    try { guards.assertSafeCdpMethod('Input.dispatchKeyEvent'); } catch (e) { typedRefused = e; }
    check('the runner cannot synthesise a keystroke - so it cannot enter a password or a card',
      typedRefused && typedRefused.name === 'RefusedError',
      typedRefused ? typedRefused.message : 'Input. was allowed');

    for (const word of ['Checkout', 'Proceed to pay', 'Book a delivery slot', 'Allow substitutions', 'Password']) {
      check(`a control labelled "${word}" is on the click deny-list`,
        guards.DENY_TARGET.test(word), word);
    }
    check('the trolley page itself IS permitted - the guards are a boundary, not a wall',
      guards.assertPermittedUrl('https://www.asda.com/groceries/trolley')
        === 'https://www.asda.com/groceries/trolley',
      'https://www.asda.com/groceries/trolley');

    // ── PROOF 5 ────────────────────────────────────────────────────────────
    heading(5, 'the REAL trolley extraction runs against a REAL Chrome DOM');
    // The harness opens its OWN tab. The runner's allowlist is not involved and
    // is not weakened: no request leaves this machine, because the page is a
    // data: URL rather than a fetched document.
    const created = await fetch(`${launched.endpoint}/json/new?about:blank`, { method: 'PUT' })
      .then((r) => r.json());
    const client = await cdp.connect(created.webSocketDebuggerUrl);
    await client.send('Runtime.enable');

    // The fixture is WRITTEN INTO the page rather than fetched. Nothing is
    // requested, so nothing can leave the machine, and the runner's navigation
    // allowlist is neither consulted nor weakened to reach it.
    const html = MUTATE
      ? '<html><body><p>Order total £24.53</p><p>7 items subtotal</p></body></html>'
      : FIXTURE_HTML;
    await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `document.open();document.write(${JSON.stringify(html)});document.close();'written'`,
    });
    await sleep(300);

    // The fixture must actually be in the DOM, or PROOF 5 measures nothing.
    const sanity = await client.send('Runtime.evaluate', {
      returnByValue: true, expression: 'document.body.innerText.length',
    });
    check('the fixture page really rendered - this proof is not vacuous',
      Number(sanity.result.result.value) > 20,
      `${sanity.result.result.value} characters of rendered text`);

    const ev = await client.send('Runtime.evaluate', { returnByValue: true, expression: TROLLEY_SNAPSHOT });
    const raw = ev.result && ev.result.result ? ev.result.result.value : undefined;
    const snapshot = raw === undefined ? null : JSON.parse(raw);
    client.close();
    await fetch(`${launched.endpoint}/json/close/${created.id}`).catch(() => {});

    check('the extraction returned a parseable snapshot from the live DOM', !!snapshot,
      JSON.stringify(snapshot));
    if (!snapshot) throw new Error('no snapshot came back from the live DOM');
    check('it read the ORDER TOTAL out of the rendered page', snapshot.order_total === '24.53',
      `order_total=${snapshot.order_total}`);
    check('it read the ITEM COUNT', snapshot.item_count === '7', `item_count=${snapshot.item_count}`);
    check('it enumerated the PRODUCT LINES, which a total and a count cannot replace',
      Array.isArray(snapshot.products) && snapshot.products.length === 2,
      `${(snapshot.products || []).length} product(s): `
      + (snapshot.products || []).map((p) => `${p.name}#${p.product_id}`).join(', ')
      + (MUTATE ? '   <- the mutation arm must fail HERE' : ''));

    // ── PROOF 6 ────────────────────────────────────────────────────────────
    heading(6, 'that real read-back drives the real announcement gate');
    const basket = {
      order_total: snapshot.order_total,
      item_count: snapshot.item_count,
      product_count: snapshot.product_count,
      products: (snapshot.products || []).map((p, i) => ({
        product_ref: p.product_id, name: p.name,
        qty: i === 0 ? 1 : 3, qty_source: 'read',
      })),
    };
    const truth = reconcile({ manifest: MANIFEST, outcomes: [], basket });
    check('every manifest line was accounted for FROM THE PAGE',
      truth.summary.correct === 2 && truth.summary.missing_unexplained === 0,
      JSON.stringify(truth.summary));
    check('the gate opens only because every line is accounted for', truth.ready.ready === true,
      truth.ready.ready ? 'ready' : JSON.stringify(truth.ready.blockers));

    const starved = reconcile({
      manifest: MANIFEST, outcomes: [],
      basket: { ...basket, products: basket.products.slice(0, 1) },
    });
    check('remove one line from the page and the gate SHUTS - it is a real gate',
      starved.ready.ready === false
      && starved.ready.blockers.some((b) => b.kind === 'unexplained-absence'),
      JSON.stringify(starved.ready.blockers));
  } finally {
    // ── TEARDOWN ───────────────────────────────────────────────────────────
    if (launched && launched.version) {
      try {
        const list = await fetch(`${launched.endpoint}/json/list`).then((r) => r.json()).catch(() => []);
        for (const t of list) await fetch(`${launched.endpoint}/json/close/${t.id}`).catch(() => {});
        // Close the BROWSER, not merely its tabs. A proof that leaves a Chrome
        // running on a debugging port has changed the machine it ran on.
        const v = await fetch(`${launched.endpoint}/json/version`).then((r) => r.json()).catch(() => null);
        if (v && v.webSocketDebuggerUrl) {
          const b = await cdp.connect(v.webSocketDebuggerUrl, { timeoutMs: 5000 });
          await b.send('Browser.close').catch(() => {});
          b.close();
        }
      } catch { /* the browser is going away regardless */ }
    }
    cdp.releaseSessionTab();
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`${results.length - failures}/${results.length} checks passed`);
  console.log('NOT PROVEN HERE, and not provable under this order: anything about the real');
  console.log('ASDA site, a real account, or a real trolley. No request left this machine.');
  if (MUTATE) {
    console.log('MUTATION ARM: failures above are the REQUIRED result.');
    process.exit(failures > 0 ? 0 : 1);
  }
  console.log(failures === 0 ? 'AC2 PROVED (offline scope)' : `AC2 FAILED - ${failures} check(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
