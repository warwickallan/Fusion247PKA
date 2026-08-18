// BUILD-015 - cockpit-api/cockpitUi.test.js
//
// The Vue workspace cannot be imported by `node --test`, but the two things
// that would actually hurt if they drifted CAN be checked from its source:
//
//   1. the command names it calls must be the SHARED surface, exactly -
//      otherwise a button in the cockpit silently stops matching the button in
//      Telegram;
//   2. the existing cockpit areas must still be there - a Vue error in this
//      module blanks the WHOLE app, so "additive" has to be verifiable, not
//      merely intended.
//
// Offline. Reads files, compiles nothing, starts nothing.
//
// ⛔ WO-2026-08-19-03: READ THIS BEFORE TRUSTING ANYTHING IN THE FIRST HALF OF
// THIS FILE. The two files named immediately below belong to the DIRECTUS
// EXTENSION, which is NOT the cockpit Warwick uses - Directus is not running
// and that extension's build is stale against its own source. Those tests are
// true about a decommissioned artefact.
//
// THE LIVE COCKPIT IS services/cockpit/public/app.js, and it is guarded at the
// BOTTOM of this file. If you are adding a UI guard, add it there.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { COMMAND_NAMES, isForbiddenName } = require('./commandSurface');

const UI_DIR = path.join(__dirname, '..', '..', 'control-plane', 'wp-d-proof', 'directus',
  'extensions', 'cockpit-home', 'src');
const WORKSPACE_VUE = path.join(UI_DIR, 'asdairWorkspace.vue');
const MODULE_VUE = path.join(UI_DIR, 'module.vue');

const workspaceSrc = fs.readFileSync(WORKSPACE_VUE, 'utf8');
const moduleSrc = fs.readFileSync(MODULE_VUE, 'utf8');

// ---------------------------------------------------------------------
// WP-B15-48: EQUALITY WAS THE WRONG CONTRACT, AND THIS IS STRICTLY STRONGER
// THAN THE EQUALITY IT REPLACES - NOT A RELAXATION TO GO GREEN.
//
// This asserted `declared` deepEquals COMMAND_NAMES. That held only while every
// command was an operator action. `receiveList` is INTAKE: it is the door a
// list arrives through, and an operator button that "receives a list" is
// meaningless at best and a way to fabricate a shop at worst. Under equality,
// adding it to the backend would have FORCED it into the operator UI's list -
// the test would have demanded the exact thing that must never happen.
//
// So the contract is now two assertions instead of one:
//   (a) SUBSET  - the UI may not name a command the shared surface does not have
//                 (the original protection: a cockpit button that silently
//                 stops matching the Telegram button);
//   (b) EXCLUSION - `receiveList` is NOT in the UI's list, by name.
//
// (a) alone would merely PERMIT the drift. (b) is what makes the test state the
// true rule. Together they forbid both directions; equality forbade one and
// mandated the wrong thing in the other.
// ---------------------------------------------------------------------
function declaredUiCommands() {
  const block = workspaceSrc.match(/const COMMANDS = \[([\s\S]*?)\];/);
  assert.ok(block, 'asdairWorkspace.vue must declare a COMMANDS list');
  return block[1].match(/'([A-Za-z]+)'/g).map((s) => s.replace(/'/g, ''));
}

test('the workspace declares a SUBSET of the shared command surface - it may invent nothing', () => {
  const declared = declaredUiCommands();
  assert.ok(declared.length > 0, 'the UI should declare at least one command');
  declared.forEach((c) => {
    assert.ok(COMMAND_NAMES.includes(c),
      'the operator UI declares "' + c + '", which is not in the shared command surface');
  });
});

test('the operator UI does NOT offer receiveList - intake is never an operator button', () => {
  const declared = declaredUiCommands();
  assert.equal(declared.includes('receiveList'), false,
    'receiveList is how a list ARRIVES from a channel. An operator button that receives a list would '
    + 'fabricate a shop from the console; it must never appear in the operator UI.');
  // And it must not be reachable from the UI by any other route either.
  assert.doesNotMatch(workspaceSrc, /\b(?:run|post)\(\s*'receiveList'/);
});

test('every command the UI actually calls exists in the shared surface', () => {
  const called = new Set();
  const re = /\b(?:run|post)\(\s*'([A-Za-z_]+)'/g;
  let m;
  while ((m = re.exec(workspaceSrc)) !== null) called.add(m[1]);
  assert.ok(called.size > 0, 'the workspace should call at least one command');
  called.forEach((c) => {
    assert.ok(COMMAND_NAMES.includes(c), 'the UI calls "' + c + '", which is not in the shared surface');
    assert.equal(isForbiddenName(c), false);
  });
});

test('the UI never offers checkout, payment, a slot or a password', () => {
  // Look at what the user can TAP: button/label text and command names.
  const forbidden = /\b(check ?out|pay now|make payment|book (a )?slot|delivery slot|enter password|card number)\b/i;
  assert.doesNotMatch(workspaceSrc, forbidden);
  // And no direct write to the database or a browser driver from the UI.
  assert.doesNotMatch(workspaceSrc, /require\(['"]pg['"]\)|playwright|puppeteer/i);
});

test('"request basket build" is described as writing a request, nothing more', () => {
  assert.match(workspaceSrc, /Request basket build/);
  assert.match(workspaceSrc, /never checks out, never pays/i);
});

test('the workspace renders unknown values from the API, never its own zeros', () => {
  // Every figure on screen is a *_display string produced by present.js.
  ['basket_lines_display', 'estimated_total.display', 'lines_summary.total_display',
    'transcript_confidence_display', 'matched_regular_id_display'].forEach((f) => {
    assert.ok(workspaceSrc.includes(f), 'the workspace should render ' + f);
  });
  // A hand-rolled "|| 0" would defeat the whole unknown rule.
  assert.doesNotMatch(workspaceSrc, /_display\s*\|\|\s*0\b/);
});

test('a matched line always shows its regular id and canonical name', () => {
  assert.match(workspaceSrc, /regular #\{\{ l\.matched_regular_id_display \}\}/);
  assert.match(workspaceSrc, /\{\{ l\.canonical_product_name_display \}\}/);
});

test('a derived price is visibly labelled wherever a price is shown', () => {
  assert.match(workspaceSrc, /l\.price\.is_asda_quoted/);
  assert.match(workspaceSrc, /estimated_total\.basis_label/);
  assert.match(workspaceSrc, /price_basis_note/);
});

// ---------------------------------------------------------------------
// The existing cockpit must still be the existing cockpit.
// ---------------------------------------------------------------------
test('every pre-existing cockpit area survives, and Apps is added alongside', () => {
  ['home', 'attention', 'outputs', 'brain', 'system', 'apps'].forEach((k) => {
    assert.ok(moduleSrc.includes("key: '" + k + "'"), 'missing nav area: ' + k);
  });
  ["area === 'attention'", "area === 'outputs'", "area === 'brain'", "area === 'apps'"].forEach((s) => {
    assert.ok(moduleSrc.includes(s), 'missing pane: ' + s);
  });
});

test('Apps is a first-class area with Asdair beneath it, opening its own workspace', () => {
  assert.match(moduleSrc, /key: 'asdair', label: 'Asdair'/);
  assert.match(moduleSrc, /<asdair-workspace \/>/);
  assert.match(moduleSrc, /label: 'Apps'/);
});

test('a crash in an app workspace cannot blank the whole cockpit', () => {
  assert.match(moduleSrc, /onErrorCaptured/);
  assert.match(moduleSrc, /return false;/);
});

// =====================================================================
// WO-2026-08-19-03 (addition B) - THE GUARD WAS WATCHING A CORPSE.
//
// EVERYTHING ABOVE READS THE DIRECTUS EXTENSION at
// services/control-plane/wp-d-proof/directus/extensions/cockpit-home/src/.
// THAT IS NOT THE COCKPIT WARWICK USES. Directus is not running (nothing
// listens on 127.0.0.1:8055) and that extension's `dist` is stale against its
// own source. The LIVE cockpit is services/cockpit/public/app.js, served
// straight off disk on :8090.
//
// So the estate's only automated statement that "the Cockpit UI may name no
// command the shared surface lacks" has been true, green, and about a file
// nobody loads - while the live UI was covered by nothing at all. That is how
// `app.js` came to render "Change this answer" wired to `answerQuestion`, which
// is a compare-and-set on status='open' and therefore a silent no-op on a
// settled row, for weeks, with the UI reporting "Saved."
//
// A control that reports on ground it did not examine is worse than no control:
// an absent one invites caution, a lying one invites confidence.
//
// ⚠️ SCOPE. services/cockpit/** is Felix's and is NOT written here - this block
// only READS it. What is asserted is the seam this Work Order owns: the live UI
// may not name a command the shared surface lacks, and may not name a forbidden
// one at all.
// =====================================================================

const LIVE_APP_JS = path.join(__dirname, '..', '..', 'cockpit', 'public', 'app.js');

function liveAppSrc() {
  return fs.readFileSync(LIVE_APP_JS, 'utf8');
}

// Every LITERAL command name handed to the live UI's one write function.
// `asdairCommand(cmd, ...)` call sites pass a variable resolved from a
// capability probe against the surface the API itself published, so they cannot
// name anything the backend does not already offer; the literals are the ones
// that can drift.
function liveCalledCommands() {
  const src = liveAppSrc();
  const called = new Set();
  const re = /asdairCommand\(\s*'([A-Za-z_]+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) called.add(m[1]);
  return called;
}

test('LIVE UI: the file this guard reads is the one that is actually served', () => {
  assert.ok(fs.existsSync(LIVE_APP_JS),
    'services/cockpit/public/app.js is the live cockpit - if this path moves, this guard must move '
    + 'with it rather than silently reverting to watching the Directus extension');
  const src = liveAppSrc();
  assert.ok(src.length > 0);
  // It really is the AsdAIr-bearing app, not some other bundle at that path.
  assert.match(src, /\/api\/asdair\/command/,
    'the live app must still write through the ONE command route');
});

test('LIVE UI: every command it names by literal exists in the shared surface', () => {
  const called = liveCalledCommands();
  assert.ok(called.size > 0,
    'found no literal asdairCommand() call - the extraction has broken, and a guard that matches '
    + 'nothing passes over anything');
  called.forEach((c) => {
    assert.ok(COMMAND_NAMES.includes(c),
      'the LIVE cockpit calls "' + c + '", which is not in the shared command surface');
    assert.equal(isForbiddenName(c), false, 'the LIVE cockpit calls the forbidden command "' + c + '"');
  });
});

test('LIVE UI: it does not offer receiveList - intake is never an operator button', () => {
  assert.equal(liveCalledCommands().has('receiveList'), false,
    'receiveList is how a list ARRIVES from a channel. An operator button that receives a list would '
    + 'fabricate a shop from the console.');
});

test('LIVE UI: it offers no checkout, payment, slot or credential ACTION', () => {
  const src = liveAppSrc();

  // ⚠️ ASSERTED OVER WHAT THE USER CAN TAP, NOT OVER THE FILE'S PROSE, and the
  // difference is not pedantry. The Directus version of this test banned the
  // words anywhere in the source. Applied to the live app that is a FALSE
  // POSITIVE GENERATOR: its reconciliation panel legitimately reads "No
  // checkout, no payment, no slot booked - all three confirmed", which is
  // AsdAIr REPORTING that none of them happened - the opposite of offering
  // them. A gate that fires on the honest case gets reclassified as noise, and
  // a noisy gate gets ignored, so this one reads button labels instead.
  const forbidden = /\b(check ?out|pay now|make payment|book (a )?slot|delivery slot|enter password|card number)\b/i;
  const labels = [];
  const buttonRe = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  let m;
  while ((m = buttonRe.exec(src)) !== null) labels.push(m[1].replace(/<[^>]*>/g, ' '));
  assert.ok(labels.length > 0,
    'no <button> found - the extraction has broken, and a guard that matches nothing passes over '
    + 'anything');
  labels.forEach((label) => {
    assert.doesNotMatch(label, forbidden,
      'a tappable control reads "' + label.trim().slice(0, 60) + '" - AsdAIr never checks out, pays, '
      + 'books a slot or types a credential');
  });

  // And nothing forbidden can be SENT, whatever a control is labelled.
  liveCalledCommands().forEach((c) => {
    assert.equal(isForbiddenName(c), false);
  });
  // Nor a direct write path around the command surface.
  assert.doesNotMatch(src, /require\(['"]pg['"]\)|playwright|puppeteer/i);
});
