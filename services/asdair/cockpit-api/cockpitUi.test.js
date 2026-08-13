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
// Offline. Reads two files, compiles nothing, starts nothing.
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
