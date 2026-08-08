// CAPAE sync — the transitions Warwick named, proven through the REAL sync path.
//
// BUILD-020 Sub-phase 4D, Buzz defect 3. Every assertion below drives `syncCapae` itself through
// its injected transport, NOT the pure mappers. That is deliberate and it is the point of the
// defect: `dispositionFor` was always easy to test and always looked right in isolation. What was
// wrong was the SEQUENCING around it — the default that turned a typo into a recurrence, the `+1`
// that double-counted a replay, and the clean exposure that advanced nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  syncCapae,
  dispositionFor,
  deriveFamily,
  EXPOSURE_DISPOSITION,
} from './capae-sync.mjs';

// A fake PostgREST that behaves like the real one for the four calls the sync makes: read families,
// insert an occurrence (honouring ignore-duplicates on (family_id, rotation_id)), read a family's
// occurrences, patch a family. Keeping the rows in memory is what lets a REPLAY be a real replay.
function fakeDb(families) {
  const db = {
    families: families.map((f) => ({ ...f })),
    occurrences: [],
    patches: [],
    inserted: 0,
  };
  let clock = 0;

  db.call = async (path, init = {}) => {
    const method = init.method || 'GET';

    if (path.startsWith('session_report.capae_family?select=')) return db.families.map((f) => ({ ...f }));

    if (method === 'POST' && path.startsWith('session_report.capae_occurrence')) {
      const row = JSON.parse(init.body);
      const dedupe = String((init.headers || {}).Prefer || '').includes('ignore-duplicates');
      const clash = row.rotation_id !== null && row.rotation_id !== undefined && row.dedupe_key &&
        db.occurrences.some((o) => o.family_id === row.family_id && o.rotation_id === row.rotation_id
          && o.dedupe_key === row.dedupe_key);
      if (clash && dedupe) return null; // the partial unique index absorbs it, as in Postgres
      db.occurrences.push({ ...row, occurred_at: new Date(++clock * 1000).toISOString() });
      db.inserted += 1;
      return null;
    }

    if (method === 'GET' && path.startsWith('session_report.capae_occurrence?select=')) {
      const id = decodeURIComponent(path.split('family_id=eq.')[1]);
      return db.occurrences.filter((o) => o.family_id === id)
        .map((o) => ({ disposition: o.disposition, occurred_at: o.occurred_at }));
    }

    if (method === 'PATCH' && path.startsWith('session_report.capae_family?slug=eq.')) {
      const slug = decodeURIComponent(path.split('slug=eq.')[1]);
      const patch = JSON.parse(init.body);
      const fam = db.families.find((f) => f.slug === slug);
      Object.assign(fam, patch);
      db.patches.push({ slug, patch });
      return null;
    }

    throw new Error(`fakeDb: unexpected ${method} ${path}`);
  };
  return db;
}

const FAMILY = (over = {}) => ({
  id: 'fam-1', slug: 'ff-01', title: 'Pilot family', occurrences: 0,
  unmeasurable: false, exposures_required: 2, state: 'MONITORING', ...over,
});

// writeBrief writes to the real BRIEF_PATH; redirect HOME so the suite never touches the live brief.
function isolatedHome(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'capae-brief-'));
  const prevHome = process.env.HOME;
  const prevProfile = process.env.USERPROFILE;
  process.env.HOME = dir;
  process.env.USERPROFILE = dir;
  try { return fn(dir); } finally {
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
    if (prevProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prevProfile;
    rmSync(dir, { recursive: true, force: true });
  }
}

const finding = (over = {}) => ({ family: 'ff-01', exposure: 'clean', summary: 's', ...over });
const payload = (...findings) => ({ findings });

// ---------------------------------------------------------------------------
// Vocabulary — strict, closed, no default
// ---------------------------------------------------------------------------

test('CAPAE vocabulary: exactly Warwick\'s four words are accepted', () => {
  assert.deepEqual(Object.keys(EXPOSURE_DISPOSITION),
    ['clean', 'recurrence', 'none-this-session', 'unmeasurable-at-this-frequency']);
  assert.equal(dispositionFor('clean'), 'CLEAN-EXPOSURE');
  assert.equal(dispositionFor('recurrence'), 'RECURRENCE');
  assert.equal(dispositionFor('none-this-session'), 'NONE-THIS-SESSION');
  assert.equal(dispositionFor('unmeasurable-at-this-frequency'), 'UNMEASURABLE');
});

test('CAPAE vocabulary (MUTATION): NOTHING unreadable becomes RECURRENCE', () => {
  // The exact defect: this list used to return RECURRENCE for every one of these.
  for (const bad of ['', '  ', 'CLEAN-ish', 'reccurence', 'unmeasurable', 'new', 'true', null, undefined, 5, {}]) {
    assert.equal(dispositionFor(bad), null, `must reject: ${JSON.stringify(bad)}`);
  }
});

test('REAL SYNC: a malformed exposure is REJECTED, writes nothing, and fails visibly', async () => {
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY()]);
    const r = await syncCapae(payload(finding({ exposure: 'reccurence' })), { rotationId: 'rot-1', transport: db.call });
    assert.equal(r.ok, false, 'a rejected exposure must make the sync unsuccessful');
    assert.deepEqual(r.rejected, [{ slug: 'ff-01', exposure: 'reccurence' }]);
    assert.equal(db.inserted, 0, 'nothing may be written for a rejected exposure');
    assert.equal(db.families[0].occurrences, 0);
    assert.equal(db.families[0].state, 'MONITORING');
  });
});

// ---------------------------------------------------------------------------
// The transitions
// ---------------------------------------------------------------------------

test('REAL SYNC: a CLEAN exposure advances effectiveness evidence, and reaching the threshold makes the family EFFECTIVE', async () => {
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY({ exposures_required: 2 })]);

    const one = await syncCapae(payload(finding()), { rotationId: 'rot-1', transport: db.call });
    assert.equal(one.ok, true);
    assert.equal(db.families[0].exposures_clean, 1, 'clean must ADVANCE the evidence');
    assert.equal(db.families[0].state, 'MONITORING', 'one of two is not yet proven');
    assert.equal(db.families[0].occurrences, 0, 'a clean exposure is not a failure');

    await syncCapae(payload(finding()), { rotationId: 'rot-2', transport: db.call });
    assert.equal(db.families[0].exposures_clean, 2);
    assert.equal(db.families[0].state, 'EFFECTIVE', 'the threshold is met, so the prevention is proven');
  });
});

test('REAL SYNC: NONE-THIS-SESSION is recorded but is NOT a failure and NOT a clean exposure', async () => {
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY()]);
    const r = await syncCapae(payload(finding({ exposure: 'none-this-session' })), { rotationId: 'rot-1', transport: db.call });
    assert.equal(r.ok, true);
    assert.equal(db.inserted, 1, 'it IS recorded — absence of opportunity is evidence');
    assert.equal(db.families[0].occurrences, 0, 'must not masquerade as an occurrence of the failure');
    assert.equal(db.families[0].exposures_clean, 0, 'and must not advance effectiveness either');
    assert.equal(db.families[0].state, 'MONITORING');
  });
});

test('REAL SYNC: UNMEASURABLE-AT-THIS-FREQUENCY does not become a recurrence', async () => {
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY()]);
    const r = await syncCapae(payload(finding({ exposure: 'unmeasurable-at-this-frequency' })), { rotationId: 'rot-1', transport: db.call });
    assert.equal(r.ok, true);
    assert.equal(db.occurrences[0].disposition, 'UNMEASURABLE');
    assert.equal(db.families[0].occurrences, 0, 'rarity is not a fault');
    assert.equal(db.families[0].exposures_clean, 0);
  });
});

test('REAL SYNC: a RECURRENCE after EFFECTIVE reopens the family and returns it to Larry\'s attention', async () => {
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY({ exposures_required: 2 })]);
    await syncCapae(payload(finding()), { rotationId: 'r1', transport: db.call });
    await syncCapae(payload(finding()), { rotationId: 'r2', transport: db.call });
    assert.equal(db.families[0].state, 'EFFECTIVE');

    await syncCapae(payload(finding({ exposure: 'recurrence' })), { rotationId: 'r3', transport: db.call });
    assert.equal(db.families[0].state, 'CHALLENGED', 'a proven prevention that fails is CHALLENGED, not quietly still EFFECTIVE');
    assert.equal(db.families[0].occurrences, 1);
    assert.equal(db.families[0].exposures_clean, 0, 'the clean streak is broken, so the evidence resets');

    // And it is eligible for the brief again — which is what "active attention" actually means.
    const { selectActive } = await import('../governor/capae-brief.mjs');
    assert.equal(selectActive(db.families).length, 1);
  });
});

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

test('REAL SYNC: replaying the SAME rotation does not double-count anything', async () => {
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY({ exposures_required: 5 })]);
    const p = payload(finding({ exposure: 'recurrence' }));

    await syncCapae(p, { rotationId: 'rot-1', transport: db.call });
    const afterFirst = { ...db.families[0] };
    assert.equal(afterFirst.occurrences, 1);

    for (let i = 0; i < 3; i++) await syncCapae(p, { rotationId: 'rot-1', transport: db.call });

    assert.equal(db.inserted, 1, 'the same (family, rotation) may only ever produce ONE occurrence row');
    assert.equal(db.families[0].occurrences, 1, 'and the count must not move on replay');
    assert.equal(db.families[0].state, afterFirst.state);
    assert.equal(db.families[0].exposures_clean, afterFirst.exposures_clean);
  });
});

test('REAL SYNC: a DIFFERENT rotation reporting the same family does count again', async () => {
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY({ exposures_required: 5 })]);
    await syncCapae(payload(finding({ exposure: 'recurrence' })), { rotationId: 'rot-1', transport: db.call });
    await syncCapae(payload(finding({ exposure: 'recurrence' })), { rotationId: 'rot-2', transport: db.call });
    assert.equal(db.families[0].occurrences, 2, 'replay safety must not become "never counts twice"');
  });
});

test('REAL SYNC: a null rotation_id cannot be deduplicated, and the result SAYS so', async () => {
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY()]);
    const r = await syncCapae(payload(finding()), { rotationId: null, transport: db.call });
    assert.equal(r.unDedupable, 1, 'the caller must be told which writes had no replay protection');
  });
});

// ---------------------------------------------------------------------------
// Internal consistency
// ---------------------------------------------------------------------------

test('deriveFamily: counters are DERIVED, so history and effectiveness cannot disagree', () => {
  const rows = [
    { disposition: 'RECURRENCE', occurred_at: '2026-01-01T00:00:00Z' },
    { disposition: 'CLEAN-EXPOSURE', occurred_at: '2026-01-02T00:00:00Z' },
    { disposition: 'NONE-THIS-SESSION', occurred_at: '2026-01-03T00:00:00Z' },
    { disposition: 'CLEAN-EXPOSURE', occurred_at: '2026-01-04T00:00:00Z' },
  ];
  const d = deriveFamily({ exposuresRequired: 2, rows });
  assert.deepEqual(d, {
    occurrences: 1,
    exposures_clean: 2,
    state: 'EFFECTIVE',
    last_occurrence_at: '2026-01-04T00:00:00Z',
  });

  // Order of arrival must not change the answer.
  const shuffled = deriveFamily({ exposuresRequired: 2, rows: rows.slice().reverse() });
  assert.deepEqual(shuffled, d);
});

test('deriveFamily: an unmeasurable family reports UNMEASURABLE regardless of its rows', () => {
  const d = deriveFamily({ unmeasurable: true, exposuresRequired: 1, rows: [{ disposition: 'CLEAN-EXPOSURE', occurred_at: '2026-01-01T00:00:00Z' }] });
  assert.equal(d.state, 'UNMEASURABLE');
});

test('deriveFamily: with no threshold set, clean exposures accumulate but never self-declare EFFECTIVE', () => {
  const rows = [1, 2, 3, 4, 5].map((i) => ({ disposition: 'CLEAN-EXPOSURE', occurred_at: `2026-01-0${i}T00:00:00Z` }));
  const d = deriveFamily({ exposuresRequired: null, rows });
  assert.equal(d.exposures_clean, 5);
  assert.equal(d.state, 'MONITORING', 'how many exposures prove a prevention is a human judgement, not a default');
});

test('REAL SYNC: two DIFFERENT findings for the same family in ONE rotation both record', async () => {
  // Taught by the live data, not imagined: rotation a3e1982e carries a NEW and a RECURRENCE for
  // `authority-inferred-from-desired-outcome`, with different summaries. A per-rotation replay key
  // would have destroyed one of them — evidence loss dressed up as deduplication.
  await isolatedHome(async () => {
    const db = fakeDb([FAMILY({ exposures_required: 5 })]);
    await syncCapae(payload(
      finding({ exposure: 'recurrence', summary: 'PR merged without authority' }),
      finding({ exposure: 'recurrence', summary: 'Amendment heading asserted a decision' }),
    ), { rotationId: 'rot-1', transport: db.call });

    assert.equal(db.inserted, 2, 'two distinct findings are two distinct occurrences');
    assert.equal(db.families[0].occurrences, 2);

    // …and replaying that exact same pair still changes nothing.
    await syncCapae(payload(
      finding({ exposure: 'recurrence', summary: 'PR merged without authority' }),
      finding({ exposure: 'recurrence', summary: 'Amendment heading asserted a decision' }),
    ), { rotationId: 'rot-1', transport: db.call });
    assert.equal(db.inserted, 2, 'replay of the same findings must remain a no-op');
    assert.equal(db.families[0].occurrences, 2);
  });
});
