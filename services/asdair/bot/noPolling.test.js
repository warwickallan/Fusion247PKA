// BUILD-015 AsdAIr bot — the HARD RULE, enforced by a test rather than by memory.
//
// Telegram long-polling is DESTRUCTIVE: fetching updates with an offset ACKS
// every update below it. Exactly ONE consumer of the @Fusion247shopperbot stream
// exists — services/asdair/intake/ — and if this control surface ever grew a
// second poller, the two would race and one of them would silently swallow the
// week's shopping list. That failure is invisible: no error, no alert, just a
// list that never arrives.
//
// So: no module in services/asdair/bot/ may contain the poll-method identifier,
// nor a webhook-setting call, nor anything that could order or pay. This file
// scans the folder's own source and fails if any of them ever appears. It is
// deliberately a SOURCE scan, not a behaviour test: a poller added inside an
// untested branch would still be caught.
//
// (The identifier is assembled from fragments below so that this file, which is
// itself in the scanned folder, does not trip its own check.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_VALUES } from './callbackProtocol.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = path.basename(fileURLToPath(import.meta.url));

/** Identifiers no module in this folder may contain, assembled to avoid self-tripping. */
const FORBIDDEN = [
  ['get', 'Updates'].join(''),      // the long-poll method — the intake receiver owns it
  ['set', 'Webhook'].join(''),      // would redirect the same stream away from the receiver
  ['delete', 'Webhook'].join(''),
  ['get', 'Updates', 'Offset'].join(''),
];

/**
 * Consequential actions this module must never be able to take, as CALL-SHAPED
 * tokens. Matching the bare words would be worse than useless: the modules
 * discuss checkout and payment at length precisely to record that they never do
 * either, and a scan that fired on the prose would be turned off within a week.
 * These patterns fire on a call or a member access, not on a sentence.
 */
const FORBIDDEN_CALLS = [
  /\bcheckout\s*\(/i, /\.checkout\b/i,
  /\bplaceOrder\b/i, /\bsubmitOrder\b/i, /\bpayNow\b/i, /\bmakePayment\b/i, /\bbookSlot\b/i,
];

/** Every .js in the folder except this scanner itself — modules AND their tests. */
async function sourceFiles() {
  const entries = await readdir(HERE, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.js') && e.name !== SELF)
    .map((e) => e.name);
}

/**
 * The shipped MODULES only. The capability scans below exclude test files on
 * purpose: a test legitimately mentions "checkout" in order to PROVE no such
 * action exists, and scanning the assertion that forbids a thing as if it were
 * the thing would make the guard unfalsifiable. The polling scan above is the
 * exception — it runs over the tests too, because nothing in this folder, test
 * or not, may ever open a second consumer of the update stream.
 */
async function moduleFiles() {
  return (await sourceFiles()).filter((n) => !n.endsWith('.test.js'));
}

test('NO module in services/asdair/bot/ polls Telegram — the intake receiver is the only consumer', async () => {
  const files = await sourceFiles();
  assert.ok(files.length >= 4, `expected the bot modules to be present, found: ${files.join(', ')}`);
  for (const name of files) {
    const src = await readFile(path.join(HERE, name), 'utf8');
    for (const forbidden of FORBIDDEN) {
      assert.ok(
        !src.includes(forbidden),
        `${name} contains "${forbidden}" — a second consumer of the ShopperBot update stream would silently lose the weekly list`,
      );
    }
  }
});

test('NO module in services/asdair/bot/ can check out, pay, book a slot or start a browser', async () => {
  const files = await moduleFiles();
  for (const name of files) {
    const src = await readFile(path.join(HERE, name), 'utf8');
    for (const forbidden of FORBIDDEN_CALLS) {
      assert.ok(!forbidden.test(src), `${name} matches a forbidden consequential call: ${forbidden}`);
    }
    for (const browser of ['puppeteer', 'playwright', 'chromium.launch', 'webdriver']) {
      assert.ok(!src.includes(browser), `${name} reaches for a browser (${browser})`);
    }
  }
});

test('the callback protocol offers NO consequential action — the whole vocabulary is inspect-or-decide', () => {
  // The definitive check, and the reason the source scan above can afford to be
  // narrow: an action that does not exist in the protocol cannot be put on a
  // button, cannot be parsed off one, and therefore cannot reach a handler.
  for (const action of ACTION_VALUES) {
    assert.ok(
      !/(checkout|pay|order|slot|purchase|buy)/i.test(action),
      `the protocol offers a consequential action: "${action}"`,
    );
  }
});

test('NO module in services/asdair/bot/ opens a database connection', async () => {
  const files = await moduleFiles();
  for (const name of files) {
    const src = await readFile(path.join(HERE, name), 'utf8');
    for (const db of ["require('pg')", 'from \'pg\'', 'new Client(', 'new Pool(', 'ASDAIR_DB_URL', 'ASDAIR_WRITE_DB_URL']) {
      assert.ok(!src.includes(db), `${name} reaches for a database (${db})`);
    }
  }
});

test('NO module in services/asdair/bot/ reads a credentials file — env NAMES only', async () => {
  const files = await moduleFiles();
  for (const name of files) {
    const src = await readFile(path.join(HERE, name), 'utf8');
    for (const io of ['readFileSync', 'readFile(', '.env"', ".env'", 'fusion247.env', 'dotenv']) {
      assert.ok(!src.includes(io), `${name} reads from the filesystem (${io}) — credentials come from the environment by name only`);
    }
  }
});

test('the pure modules import nothing outside this folder — no network, no fs, no clock', async () => {
  for (const name of ['callbackProtocol.js', 'renderMessages.js', 'inboundRouter.js']) {
    const src = await readFile(path.join(HERE, name), 'utf8');
    const imports = [...src.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gm)].map((m) => m[1]);
    for (const spec of imports) {
      assert.ok(spec.startsWith('./'), `${name} imports "${spec}" — the pure core must stay dependency-free`);
    }
    for (const impure of ['Date.now', 'new Date(', 'Math.random', 'fetch(', 'process.env']) {
      assert.ok(!src.includes(impure), `${name} is not pure: it uses ${impure}`);
    }
  }
});
