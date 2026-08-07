// Fusion247 Cockpit — CLONE PORTABILITY CHECK for services/cockpit/db.mjs.
//
// THE DEFECT THIS EXISTS TO KEEP OUT (Veritas Gate 1, Defect 6; unparked by Warwick 2026-08-07).
// `db.mjs` used to name ONE checkout twice — an absolute `file:///…` URL for its `pg` import and an
// absolute string for the `COCKPIT_CREDS` default. Two consequences, and the second is the serious
// one:
//   1. the Cockpit could not run from any other checkout once that clone moved or emptied; and
//   2. a Cockpit started from ANY OTHER checkout silently reached into that clone for its dependency
//      tree AND ITS LIVE CREDENTIALS. BUILD-020 row 1 — "survives worktree delete/recreate" — was
//      only ever passing because of that silent borrowing.
// The repair makes both resolve relative to the module's own location, so a stray checkout fails
// loudly at import instead of quietly connecting to production.
//
// ── 🔴 THIS CHECK NEVER IMPORTS OR EXECUTES `db.mjs` ─────────────────────────────────────────────
// `db.mjs` constructs TWO PRODUCTION `pg` POOLS AT MODULE SCOPE. Importing it connects to live
// Postgres — a specialist has already breached `live_authority: none` in this estate by importing a
// module with an unguarded top-level side effect. So this file READS db.mjs AS TEXT, extracts the two
// specifiers it actually declares, and resolves them with URL arithmetic. Nothing is loaded, nothing
// connects, and that is a permanent constraint on this gate, not a preference.
//
// ── WHY RESOLUTION IS PROVEN AS *COMPUTATION*, NOT AS *EXISTENCE* ────────────────────────────────
// Both targets are gitignored: `node_modules/` (.gitignore:59, and `git ls-files` returns 0 for it)
// and `services/control-plane/wp-d-proof/.runtime-live/`. A FRESH `git worktree` therefore contains
// NEITHER, and neither does a CI checkout. Existence is an environment fact about a clone; the
// property under test is a fact about the CODE — that the specifier follows the module wherever the
// module goes. That is asserted here unconditionally and from several different roots. Existence is
// reported separately, and is skipped LOUDLY where the dependency tree is not installed.
//
// USAGE
//   node services/cockpit/clone-portability-check.mjs
//   node services/cockpit/clone-portability-check.mjs --module <path-to-another-clone>/services/cockpit/db.mjs
//
// The `--module` form is how the "prove it from a genuinely different filesystem path" requirement is
// executed against a real `git worktree` — the check reads THAT clone's bytes and resolves against
// THAT clone's location. It is the same battery either way; only the base moves.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = path.resolve(arg('--module', path.join(HERE, 'db.mjs')));
const MODULE_URL = pathToFileURL(MODULE_PATH).href;

if (!fs.existsSync(MODULE_PATH)) {
  console.error('CLONE-PORTABILITY-CHECK FAIL — the module under test does not exist: ' + MODULE_PATH);
  process.exit(1);
}
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');

// ── The two declarations under test ──────────────────────────────────────────────────────────────
// Both patterns are ANCHORED TO THE `import.meta.url` DERIVATION, not merely to a quoted string.
// That is the point: `createRequire('/some/absolute/path')` or a hand-typed credentials constant
// yields NO extraction, every downstream assertion goes red, and the gate reports why. A pattern that
// matched any quoted string would happily extract an absolute one and call the file portable.
const RE_PG = /createRequire\(\s*import\.meta\.url\s*\)[\s\S]{0,600}?\brequire\(\s*(['"])([^'"]+)\1\s*\)/;
const RE_CREDS = /new URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/;
const extract = (src, re) => { const m = re.exec(src); return m ? m[2] : null; };

// Literal absolute roots of any kind — not just the one clone this defect happened to name. A repair
// that swapped `C:/Fusion247PKA` for `D:/somewhere-else` is the same defect wearing a different
// drive letter, and mutation 4 below proves this catches exactly that.
const ABSOLUTE_FORMS = [
  [/file:\/\/\/?[A-Za-z]:/, 'a file:// URL naming a drive'],
  [/\b[A-Za-z]:[\\/]/, 'a drive-letter absolute path'],
  [/Fusion247PKA/, 'a literal clone name'],
];
const isRelative = (spec) => typeof spec === 'string' && /^\.\.?\//.test(spec);

// Foreign roots the module has never been near. Resolution must FOLLOW EACH OF THEM — that is what
// "relative to the clone it lives in" means, and one base can never demonstrate it. A drive that does
// not exist, a deep nesting, a path with encoded spaces, and a POSIX root with no drive letter at all
// (the CI runner's shape).
const SYNTHETIC_BASES = [
  'file:///Z:/some-other-clone/services/cockpit/db.mjs',
  'file:///D:/nested/deeper/still/checkout-42/services/cockpit/db.mjs',
  'file:///C:/Users/somebody/My%20Clones/with%20spaces/services/cockpit/db.mjs',
  'file:///home/ci/workspace/services/cockpit/db.mjs',
];
const cloneRootOf = (moduleUrl) => new URL('../../', moduleUrl).href;

// ── The assertion battery ────────────────────────────────────────────────────────────────────────
// A pure function of (source, module location) so the SAME battery runs over the real module and over
// every in-memory mutant. It executes a FIXED number of assertions regardless of what it finds: where
// a specifier cannot be extracted, the downstream assertions still run and go RED rather than being
// skipped. A mutant that quietly reduced the assertion count would report a small red count and look
// like a near miss instead of a catch.
function assess(src, moduleUrl, ok) {
  const pgSpec = extract(src, RE_PG);
  const credsSpec = extract(src, RE_CREDS);

  ok('the pg dependency is declared through createRequire(import.meta.url)',
    pgSpec !== null, pgSpec === null ? 'no such declaration found' : pgSpec);
  ok('the credentials default is derived from import.meta.url',
    credsSpec !== null, credsSpec === null ? 'no such derivation found' : credsSpec);
  ok('the COCKPIT_CREDS environment override still takes precedence',
    /process\.env\.COCKPIT_CREDS/.test(src), 'Mack owns the value; the code owns the shape');

  for (const [re, what] of ABSOLUTE_FORMS) {
    const m = re.exec(src);
    ok('no absolute clone root survives anywhere in the module — ' + what,
      m === null, m ? 'found: ' + src.slice(Math.max(0, m.index - 20), m.index + 60).replace(/\s+/g, ' ') : 'none');
  }

  for (const [label, spec] of [['pg', pgSpec], ['credentials', credsSpec]]) {
    ok('the ' + label + ' specifier is relative, not absolute',
      isRelative(spec), spec === null ? 'not extracted' : spec);

    // Resolution against the module's OWN location must land inside the module's own clone.
    const root = cloneRootOf(moduleUrl);
    let own = null;
    try { own = spec === null ? null : new URL(spec, moduleUrl).href; } catch { own = null; }
    ok('the ' + label + ' target resolves INSIDE the clone that contains the module',
      own !== null && own.startsWith(root), own === null ? 'not resolvable' : own + '  (root ' + root + ')');
    ok('the ' + label + ' target resolves under services/control-plane, not out of the tree',
      own !== null && own.startsWith(root + 'services/control-plane/'),
      own === null ? 'not resolvable' : own);

    // …and against roots the module has never been near. This is the property that decides the whole
    // repair: the resolution MOVES with the base, and carries no memory of any particular clone.
    const seen = new Set();
    for (const base of SYNTHETIC_BASES) {
      const baseRoot = cloneRootOf(base);
      let got = null;
      try { got = spec === null ? null : new URL(spec, base).href; } catch { got = null; }
      if (got !== null) seen.add(got);
      ok('the ' + label + ' target follows a foreign clone root — ' + baseRoot,
        got !== null && got.startsWith(baseRoot) && !/Fusion247PKA/.test(got),
        got === null ? 'not resolvable' : got);
    }
    ok('the ' + label + ' target resolves DIFFERENTLY from every one of those roots (the resolver is not a constant)',
      seen.size === SYNTHETIC_BASES.length, seen.size + ' distinct of ' + SYNTHETIC_BASES.length);
  }
}

// ── 1. the real module ───────────────────────────────────────────────────────────────────────────
let ran = 0, failed = 0;
const sink = (name, cond, detail) => {
  ran++;
  if (cond) { console.log('  PASS  ' + name + (detail ? ' — ' + detail : '')); return; }
  failed++;
  console.error('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
};

console.log('module under test: ' + MODULE_PATH);
console.log('module URL:        ' + MODULE_URL);
console.log('clone root:        ' + cloneRootOf(MODULE_URL));
assess(SOURCE, MODULE_URL, sink);

// ── 2. existence — an ENVIRONMENT fact, reported separately and skipped LOUDLY ───────────────────
// Asserted only where the clone's dependency tree is actually installed. In CI, and in any fresh
// worktree, `node_modules/` is absent because it is gitignored — failing there would make this gate
// red on a correct repository, and quietly passing there would be a control reporting on ground it
// never examined. So it says which of the two happened, every run.
let existence = 'NOT ESTABLISHED';
{
  const pgSpec = extract(SOURCE, RE_PG);
  const root = cloneRootOf(MODULE_URL);
  const depsRoot = fileURLToPath(new URL('services/control-plane/node_modules/', root));
  if (pgSpec === null) {
    existence = 'NOT ESTABLISHED (no pg specifier could be extracted — see the failures above)';
    console.log('  SKIP  existence of the resolved pg target — ' + existence);
  } else if (!fs.existsSync(depsRoot)) {
    existence = 'SKIPPED — dependencies are not installed in this clone (' + depsRoot + ')';
    console.log('  SKIP  existence of the resolved pg target — ' + existence);
    console.log('        This is expected in CI and in a fresh worktree: node_modules is gitignored.');
    console.log('        It is an environment fact, NOT the code property this gate exists to hold.');
  } else {
    const target = fileURLToPath(new URL(pgSpec, MODULE_URL));
    sink('the resolved pg target EXISTS in this clone, whose dependencies ARE installed',
      fs.existsSync(target), target);
    existence = fs.existsSync(target) ? 'PROVEN in this clone' : 'FAILED in this clone';
  }
}

// ── 3. MUTATION — permanent, in memory, every run ────────────────────────────────────────────────
// Non-vacuity is regenerated by the machine on each run rather than resting on one worker's word in a
// return that gets cleared. Every mutation restores the defect IN MEMORY ONLY — `db.mjs` is never
// written, not even temporarily, because a temporary write is a write.
//
// The absolute literals below are MUTATION FIXTURES. They are the defect being reintroduced on
// purpose; they are not a path this repository uses.
const ORIGINAL_PG_LINE = "import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';";
const ORIGINAL_CREDS = "'C:/Fusion247PKA/services/control-plane/wp-d-proof/.runtime-live/directus-live.env.json'";

const mutations = {
  'the pg import is restored to the absolute file:// URL': (s) =>
    s.replace(/const require = createRequire\(import\.meta\.url\);\n/, '')
      .replace(/const pg = require\((['"])[^'"]+\1\);/, ORIGINAL_PG_LINE),
  'the credentials default is restored to the absolute literal': (s) =>
    s.replace(/fileURLToPath\(new URL\((['"])[^'"]+\1, import\.meta\.url\)\)/, ORIGINAL_CREDS),
  'both are restored — the module as it was before the repair': (s) =>
    s.replace(/const require = createRequire\(import\.meta\.url\);\n/, '')
      .replace(/const pg = require\((['"])[^'"]+\1\);/, ORIGINAL_PG_LINE)
      .replace(/fileURLToPath\(new URL\((['"])[^'"]+\1, import\.meta\.url\)\)/, ORIGINAL_CREDS),
  // A DIFFERENT clone root. This is the case that proves the gate holds the general property rather
  // than string-matching one folder name — "or any other absolute clone root", stated as an executed
  // assertion instead of an intention.
  'the pg import is absolute into a DIFFERENT clone on another drive': (s) =>
    s.replace(/const require = createRequire\(import\.meta\.url\);\n/, '')
      .replace(/const pg = require\((['"])[^'"]+\1\);/,
        "import pg from 'file:///D:/some-other-checkout/services/control-plane/node_modules/pg/lib/index.js';"),
  // The subtler one: the derivation is kept but re-based on a constant, so the file still LOOKS
  // relative while having stopped following its own module.
  'the credentials derivation is re-based on a constant instead of import.meta.url': (s) =>
    s.replace(/new URL\((['"])([^'"]+)\1, import\.meta\.url\)/,
      "new URL('$2', 'file:///C:/Fusion247PKA/services/cockpit/db.mjs')"),
};

console.log('\nMUTATION — the defect restored in memory; every case must turn assertions RED:');
let uncaught = 0, mutationsRun = 0;
for (const [name, mutate] of Object.entries(mutations)) {
  const mutated = mutate(SOURCE);
  mutationsRun++;
  if (mutated === SOURCE) {
    // A mutation that silently stopped mutating produces a green that means nothing and looks exactly
    // like a clean run. Loud abort, deliberately — do NOT relax the pattern to make this go away.
    console.error('  MUTATION INERT — "' + name + '" changed nothing. db.mjs no longer matches the pattern;');
    console.error('  re-derive the mutation from the current source. Do not delete the case.');
    uncaught++;
    continue;
  }
  let red = 0, total = 0;
  assess(mutated, MODULE_URL, (_n, cond) => { total++; if (!cond) red++; });
  if (red > 0) console.log('  caught  ' + red + ' of ' + total + ' assertions RED  <- ' + name);
  else { uncaught++; console.error('  MISSED  0 of ' + total + ' assertions red  <- ' + name); }
}

// ── 4. verdict ───────────────────────────────────────────────────────────────────────────────────
// Zero executed assertions is a FAILURE, never a pass — a check that asserts nothing also exits 0.
if (ran === 0) {
  console.error('\nCLONE-PORTABILITY-CHECK FAIL — zero assertions executed; the gate is vacuous.');
  process.exit(1);
}
if (failed || uncaught) {
  console.error('\nCLONE-PORTABILITY-CHECK FAIL — ' + failed + ' of ' + ran + ' assertions failed, ' +
    uncaught + ' of ' + mutationsRun + ' mutations not caught.');
  process.exit(1);
}
console.log('\nCLONE-PORTABILITY-CHECK PASS — ' + ran + ' assertions executed, 0 failed; ' +
  mutationsRun + ' mutations, all caught. Existence: ' + existence + '.');
console.log('db.mjs resolves its pg dependency and its credentials default relative to its own clone.');
process.exit(0);
