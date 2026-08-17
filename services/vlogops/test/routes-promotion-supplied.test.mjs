// AC5 — Route 2, promotion: five fields or a rejection.
// AC6 — Route 3, supplied: the angle is required input and is never inferred.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshSchema, newPool, testConfig } from './helpers/harness.mjs';
import { intake, readSeed, validateSeedRequest } from '../src/intake.mjs';
import { promotionBundle } from '../src/routes/promotion.mjs';
import { suppliedBundle } from '../src/routes/supplied.mjs';

let pool;
let config;

before(async () => {
  pool = newPool();
  config = testConfig();
  await freshSchema(pool);
});
after(async () => { await pool.end(); });

const PROMOTION = {
  origin: 'asdair weekly shop 2026-08-10 — the photograph that falsified the assurance',
  angle: 'what a real photograph did to a green test suite',
  text: 'The shop reconciled 23 of 23. The photograph said otherwise.',
  privacyState: 'internal',
};

test('AC5 — a complete promotion lands a seed carrying all five contract fields', async () => {
  const bundle = promotionBundle({ config, ...PROMOTION });
  const result = await intake({
    pool,
    route: 'promotion',
    selector: bundle.selector,
    angle: bundle.angle,
    origin: bundle.origin,
    privacyState: PROMOTION.privacyState,
    members: bundle.members,
  });

  const read = await readSeed(pool, result.seedId);
  assert.ok(read, 'the promotion did not land');

  // 1 source snapshot, 2 provenance, 3 privacy state, 4 origin, 5 proposed angle.
  assert.equal(read.snapshots.length, 1, 'no source snapshot');
  assert.ok(read.snapshots[0].provenance.origin, 'no provenance');
  assert.equal(read.seed.privacy_state, 'internal', 'no privacy state');
  assert.equal(read.seed.origin, PROMOTION.origin, 'no origin');
  assert.equal(read.seed.angle, PROMOTION.angle, 'no proposed angle');
  assert.equal(read.seed.route, 'promotion');
});

test('AC5 — a promotion missing ANY ONE field is REJECTED, and nothing partial is written', async () => {
  const before = (await pool.query("select count(*)::int n from vlogops.content_seed where route = 'promotion'")).rows[0].n;

  const cases = [
    ['origin', { ...PROMOTION, origin: '' }, /origin is required/],
    ['angle', { ...PROMOTION, angle: '' }, /angle is required/],
    ['source snapshot', { ...PROMOTION, text: '', filePath: null }, /source snapshot is required/],
  ];

  for (const [field, args, expected] of cases) {
    assert.throws(
      () => promotionBundle({ config, ...args }),
      expected,
      `a promotion missing its ${field} was accepted`,
    );
  }

  const after = (await pool.query("select count(*)::int n from vlogops.content_seed where route = 'promotion'")).rows[0].n;
  assert.equal(after, before, 'a rejected promotion still wrote something');
});

test('AC5 — the SCHEMA refuses a partial promotion even when the application is bypassed', async () => {
  // Defence in depth that is not theatre: the application checks give a good message, and
  // this is what still holds when a future caller writes to the table directly.
  await assert.rejects(
    pool.query(
      `insert into vlogops.content_seed
         (seed_id, selection_key, route, angle, origin, privacy_state, manifest, status, sealed_at)
       values ($1, $2, 'promotion', null, null, 'internal', '{}'::jsonb, 'sealed', now())`,
      ['a'.repeat(64), 'b'.repeat(64)],
    ),
    /content_seed_promotion_contract/,
    'the schema accepted a promotion with no angle and no origin',
  );
});

test('AC6 — a supplied seed WITHOUT an angle is refused, and the angle is never inferred', async () => {
  const text = 'Today I thought X was a good idea. GPT and Pax told me it was shite. This is what I missed.';

  assert.throws(
    () => suppliedBundle({ config, angle: null, text }),
    /never inferred from the text/,
    'a supplied seed with no angle was accepted',
  );
  assert.throws(
    () => suppliedBundle({ config, angle: '   ', text }),
    /never inferred from the text/,
    'whitespace passed as an angle',
  );

  // And the refusal survives the layer below, so bypassing the route module does not help.
  assert.throws(
    () => validateSeedRequest({
      route: 'supplied', angle: null, origin: null, privacyState: 'internal',
      members: [{ source_ref: 'supplied:1', content_sha256: 'a'.repeat(64) }],
    }),
    /required input and is never inferred/,
  );

  await assert.rejects(
    pool.query(
      `insert into vlogops.content_seed
         (seed_id, selection_key, route, angle, origin, privacy_state, manifest, status, sealed_at)
       values ($1, $2, 'supplied', null, null, 'internal', '{}'::jsonb, 'sealed', now())`,
      ['c'.repeat(64), 'd'.repeat(64)],
    ),
    /content_seed_supplied_requires_angle/,
    'the schema accepted a supplied seed with no angle',
  );
});

test('AC6 — a supplied seed WITH an angle lands, and the angle is part of its identity', async () => {
  const text = 'Today I thought X was a good idea. GPT and Pax told me it was shite. This is what I missed.';

  const a = suppliedBundle({ config, angle: 'what did I actually miss?', text, privacyState: 'private' });
  const b = suppliedBundle({ config, angle: 'why was I so certain?', text, privacyState: 'private' });

  const ra = await intake({
    pool, route: 'supplied', selector: a.selector, angle: a.angle, privacyState: 'private', members: a.members,
  });
  const rb = await intake({
    pool, route: 'supplied', selector: b.selector, angle: b.angle, privacyState: 'private', members: b.members,
  });

  assert.notEqual(ra.seedId, rb.seedId, 'the same text under two different angles collapsed into one seed');

  const read = await readSeed(pool, ra.seedId);
  assert.equal(read.seed.angle, 'what did I actually miss?');
  assert.equal(read.seed.privacy_state, 'private');
  assert.equal(read.snapshots[0].provenance.source_system, 'warwick-supplied');
  assert.equal(read.snapshots[0].content.toString('utf8'), text);
});

test('AC6 — a supplied seed with nothing to say is refused rather than sealed empty', () => {
  assert.throws(
    () => suppliedBundle({ config, angle: 'an angle', text: '   \n  ' }),
    /needs something to say/,
  );
});

test('AC5/AC6 — taking the same promotion in twice yields ONE seed', async () => {
  const bundle = promotionBundle({ config, ...PROMOTION, origin: 'a second, distinct output' });
  const args = {
    pool,
    route: 'promotion',
    selector: bundle.selector,
    angle: bundle.angle,
    origin: bundle.origin,
    privacyState: PROMOTION.privacyState,
    members: bundle.members,
  };

  const first = await intake(args);
  const second = await intake(args);

  assert.equal(second.seedId, first.seedId);
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);

  const n = (await pool.query('select count(*)::int n from vlogops.content_seed where seed_id = $1', [first.seedId])).rows[0].n;
  assert.equal(n, 1);
});
