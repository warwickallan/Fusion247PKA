// AC6 — the status line's model recommendation must come from the ACTIVE
// build's banked state, not from whichever `Deliverables/*` directory the
// filesystem happens to enumerate first (WO-2026-08-01-01).
//
// The defect was latent while only one build existed: the first entry found WAS
// the active build, so the bug was invisible and would have stayed invisible
// until the moment a second build made it wrong. Every fixture here therefore
// contains at least two state files, with the alphabetically-first one
// deliberately NOT the active build — the exact arrangement under which the old
// code returned a confident wrong answer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { recommendedModel } from './statusline-live.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUSLINE_SRC = join(__dirname, 'statusline-live.mjs');

// A scratch checkout carrying N `Deliverables/<id>/programme-state.json` files.
// Only the fields AC6 selects on are written; the full schema is validated
// elsewhere and is not what this criterion is about.
function makeDeliverables(builds) {
  const root = mkdtempSync(join(tmpdir(), 'governor-statusline-'));
  for (const b of builds) {
    const home = join(root, 'Deliverables', b.id);
    mkdirSync(home, { recursive: true });
    if (b.raw !== undefined) {
      writeFileSync(join(home, 'programme-state.json'), b.raw);
      continue;
    }
    writeFileSync(
      join(home, 'programme-state.json'),
      JSON.stringify(
        {
          programme: { id: b.id, title: b.id, home: `Deliverables/${b.id}`, status: b.status },
          model_recommendation: { model: b.model, effort: null, rationale: 'fixture' },
        },
        null,
        2
      ) + '\n'
    );
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------
// The criterion itself
// ---------------------------------------------------------------------------

test('AC6: the ACTIVE build is selected even when it sorts LAST alphabetically', () => {
  // BUILD-001 sorts first and is COMPLETE; BUILD-999 sorts last and is ACTIVE.
  // The old implementation returned the first file it found — "Haiku" — which
  // is another programme's recommendation presented as this session's.
  const d = makeDeliverables([
    { id: 'BUILD-001-finished', status: 'complete', model: 'Haiku' },
    { id: 'BUILD-999-running', status: 'active', model: 'Opus' },
  ]);
  try {
    assert.equal(recommendedModel(d.root), 'Opus');
  } finally {
    d.cleanup();
  }
});

test('AC6 MUTATION: the first-found rule would give a DIFFERENT, wrong answer here', () => {
  // Makes the control above fail-able by reproducing the OLD algorithm exactly
  // and asserting it disagrees. If these two ever agree, the fixture has
  // stopped exercising the defect and the test above proves nothing.
  const d = makeDeliverables([
    { id: 'BUILD-001-finished', status: 'complete', model: 'Haiku' },
    { id: 'BUILD-999-running', status: 'active', model: 'Opus' },
  ]);
  try {
    // The superseded implementation: first state file wins, status ignored.
    const firstFound = (() => {
      const deliverables = join(d.root, 'Deliverables');
      for (const entry of readdirSync(deliverables)) {
        const p = join(deliverables, entry, 'programme-state.json');
        if (!existsSync(p)) continue;
        const doc = JSON.parse(readFileSync(p, 'utf8'));
        const m = doc?.model_recommendation?.model;
        if (typeof m === 'string' && m.length) return m;
      }
      return null;
    })();
    assert.equal(firstFound, 'Haiku', 'the old rule picks the alphabetically-first build');
    assert.equal(recommendedModel(d.root), 'Opus', 'the new rule picks the ACTIVE build');
    assert.notEqual(firstFound, recommendedModel(d.root), 'the fixture must exercise the defect');
  } finally {
    d.cleanup();
  }
});

test('AC6: a PARKED build is never treated as the active one', () => {
  const d = makeDeliverables([
    { id: 'BUILD-002-parked', status: 'parked', model: 'Haiku' },
    { id: 'BUILD-018-governor', status: 'active', model: 'Sonnet' },
  ]);
  try {
    assert.equal(recommendedModel(d.root), 'Sonnet');
  } finally {
    d.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Render nothing rather than a wrong value
// ---------------------------------------------------------------------------

test('AC6: MORE THAN ONE active build renders NOTHING — the governor never guesses', () => {
  const d = makeDeliverables([
    { id: 'BUILD-A', status: 'active', model: 'Opus' },
    { id: 'BUILD-B', status: 'active', model: 'Haiku' },
  ]);
  try {
    assert.equal(recommendedModel(d.root), null, 'ambiguity must not be resolved by sort order');
  } finally {
    d.cleanup();
  }
});

test('AC6: ZERO active builds renders NOTHING, even when state files exist', () => {
  const d = makeDeliverables([
    { id: 'BUILD-001', status: 'complete', model: 'Haiku' },
    { id: 'BUILD-002', status: 'parked', model: 'Opus' },
  ]);
  try {
    assert.equal(recommendedModel(d.root), null);
  } finally {
    d.cleanup();
  }
});

test('AC6: an unparseable state file cannot suppress a readable ACTIVE sibling', () => {
  const d = makeDeliverables([
    { id: 'BUILD-000-corrupt', raw: '{ this is not json' },
    { id: 'BUILD-018-governor', status: 'active', model: 'Sonnet' },
  ]);
  try {
    assert.equal(recommendedModel(d.root), 'Sonnet');
  } finally {
    d.cleanup();
  }
});

test('AC6: an active build with no model recommendation renders NOTHING, not a guess', () => {
  const d = makeDeliverables([
    { id: 'BUILD-001', status: 'complete', model: 'Haiku' },
    { id: 'BUILD-018', status: 'active', model: '' },
  ]);
  try {
    assert.equal(recommendedModel(d.root), null, 'absent is "not established", never a fallback');
  } finally {
    d.cleanup();
  }
});

test('AC6: no Deliverables directory at all is not an error', () => {
  const root = mkdtempSync(join(tmpdir(), 'governor-statusline-bare-'));
  try {
    assert.equal(recommendedModel(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC6: recommendedModel never throws, whatever the filesystem does', () => {
  // INV-2 in spirit: this feeds a status line that must always print one line.
  const throwing = () => {
    throw new Error('EIO');
  };
  assert.doesNotThrow(() => recommendedModel('C:/nowhere', { readdir: throwing }));
  assert.equal(recommendedModel('C:/nowhere', { readdir: throwing, exists: () => true }), null);
});

// ---------------------------------------------------------------------------
// The line itself — end to end, as a real process
// ---------------------------------------------------------------------------

test('REAL PROCESS: the status line prints exactly one line and exits 0', () => {
  const out = execFileSync('node', [STATUSLINE_SRC], {
    input: JSON.stringify({ context_window: { used_percentage: 42 }, cwd: 'C:/nowhere-at-all' }),
    encoding: 'utf8',
  });
  const lines = out.split('\n').filter((l) => l.length > 0);
  assert.equal(lines.length, 1, 'a status line command must print exactly one line');
  assert.match(lines[0], /^⟦GOV⟧ /);
  assert.match(lines[0], /ctx 42%/);
});

test('REAL PROCESS: no active build means no "next:" is rendered at all', () => {
  const d = makeDeliverables([{ id: 'BUILD-001', status: 'complete', model: 'Haiku' }]);
  try {
    const out = execFileSync('node', [STATUSLINE_SRC], {
      input: JSON.stringify({ context_window: { used_percentage: 10 }, cwd: d.root }),
      encoding: 'utf8',
    });
    assert.doesNotMatch(out, /next:/, 'a wrong model is worse than an absent one');
    assert.doesNotMatch(out, /Haiku/, 'a non-active build must never reach the line');
  } finally {
    d.cleanup();
  }
});

test('REAL PROCESS: the ACTIVE build reaches the line even when it sorts last', () => {
  const d = makeDeliverables([
    { id: 'BUILD-001-finished', status: 'complete', model: 'Haiku' },
    { id: 'BUILD-999-running', status: 'active', model: 'Opus' },
  ]);
  try {
    const out = execFileSync('node', [STATUSLINE_SRC], {
      input: JSON.stringify({ context_window: { used_percentage: 10 }, cwd: d.root }),
      encoding: 'utf8',
    });
    assert.match(out, /next: Opus/);
    assert.doesNotMatch(out, /Haiku/);
  } finally {
    d.cleanup();
  }
});

test('REAL PROCESS: importing the module does NOT execute it', () => {
  // The module used to run main() and call process.exit(0) at import time,
  // which made it untestable — importing it killed the test runner. This test
  // exists because that guard is the reason every test above can run at all.
  const out = execFileSync(
    'node',
    ['-e', `import(${JSON.stringify(pathToFileURL(STATUSLINE_SRC).href)}).then(() => console.log('IMPORTED-CLEANLY'))`],
    { encoding: 'utf8' }
  );
  assert.match(out, /IMPORTED-CLEANLY/);
  assert.doesNotMatch(out, /⟦GOV⟧/, 'importing must not print a status line');
});
