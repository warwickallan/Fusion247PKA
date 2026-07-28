// =====================================================================
// BUILD-015 AsdAIr Stage 1 - shopState.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY. Every household id, chat id, item and question
// below is invented. There is ZERO real household data here - this file runs
// in CI on the PUBLIC repo.
//
// NO DATABASE. shopState is pure, so every branch is proven with plain objects
// and no connection of any kind.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const state = require('./shopState');

const HH = 1;

// ---------------------------------------------------------------------
// The transition map itself
// ---------------------------------------------------------------------

test('every status has an entry in ALLOWED_TRANSITIONS, and every target is a known status', function () {
  state.SHOP_STATUSES.forEach(function (s) {
    assert.ok(Array.isArray(state.ALLOWED_TRANSITIONS[s]),
      s + ' has no entry in ALLOWED_TRANSITIONS - an unmapped status is an unreachable bug');
    state.ALLOWED_TRANSITIONS[s].forEach(function (t) {
      assert.ok(state.SHOP_STATUSES.indexOf(t) !== -1, s + ' -> ' + t + ' names an unknown status');
    });
  });
});

test('the happy path walks end to end for a text list', function () {
  const path = ['RECEIVED', 'PROCESSING', 'READY_TO_SHOP', 'WAITING_FOR_BROWSER', 'SHOPPING',
    'BASKET_READY', 'ORDER_CONFIRMATION_RECEIVED', 'RECONCILED'];
  for (let i = 0; i < path.length - 1; i++) {
    const v = state.isTransitionAllowed(path[i], path[i + 1], {});
    assert.equal(v.ok, true, path[i] + ' -> ' + path[i + 1] + ' should be legal: ' + v.reason);
    assert.equal(v.kind, 'advance');
  }
});

test('a photo list transcribes first', function () {
  assert.equal(state.isTransitionAllowed('RECEIVED', 'TRANSCRIBING', {}).ok, true);
  assert.equal(state.isTransitionAllowed('TRANSCRIBING', 'PROCESSING', {}).ok, true);
  // ...and never skips straight to shopping.
  assert.equal(state.isTransitionAllowed('TRANSCRIBING', 'SHOPPING', {}).ok, false);
});

test('RECONCILED is terminal - the move the brief names explicitly is refused', function () {
  const v = state.isTransitionAllowed('RECONCILED', 'SHOPPING', {});
  assert.equal(v.ok, false);
  assert.match(v.reason, /RECONCILED is terminal/);
  assert.throws(function () { state.assertTransition('RECONCILED', 'SHOPPING', {}); },
    /RECONCILED is terminal/);
});

test('CANCELLED is terminal too, in every direction', function () {
  state.SHOP_STATUSES.forEach(function (to) {
    if (to === 'CANCELLED') return;
    assert.equal(state.isTransitionAllowed('CANCELLED', to, {}).ok, false,
      'CANCELLED -> ' + to + ' must be refused');
  });
});

test('FAILED and CANCELLED are reachable from every live state', function () {
  state.LIVE_STATUSES.forEach(function (from) {
    assert.equal(state.isTransitionAllowed(from, 'FAILED', {}).ok, true, from + ' -> FAILED');
    assert.equal(state.isTransitionAllowed(from, 'CANCELLED', {}).ok, true, from + ' -> CANCELLED');
    assert.equal(state.isTransitionAllowed(from, 'FAILED', {}).kind, 'abort');
  });
});

test('a FAILED shop resumes to exactly the state it failed from, and to nothing else', function () {
  const ok = state.isTransitionAllowed('FAILED', 'SHOPPING', { resume_from: 'SHOPPING' });
  assert.equal(ok.ok, true);
  assert.equal(ok.kind, 'resume');

  const wrong = state.isTransitionAllowed('FAILED', 'BASKET_READY', { resume_from: 'SHOPPING' });
  assert.equal(wrong.ok, false);
  assert.match(wrong.reason, /may only resume to the state it failed from \(SHOPPING\)/);
});

test('a FAILED shop with no recorded resume point is refused rather than guessed at', function () {
  const v = state.isTransitionAllowed('FAILED', 'SHOPPING', {});
  assert.equal(v.ok, false);
  assert.match(v.reason, /resume_from/);
});

test('a FAILED shop may still be abandoned', function () {
  const v = state.isTransitionAllowed('FAILED', 'CANCELLED', {});
  assert.equal(v.ok, true);
  assert.equal(v.kind, 'abort');
});

test('a resume can never land on a terminal or non-live state', function () {
  const v = state.isTransitionAllowed('FAILED', 'RECONCILED', { resume_from: 'RECONCILED' });
  assert.equal(v.ok, false);
});

test('same-status is a NOOP, not an error - a redelivered tap must not blow up', function () {
  const v = state.isTransitionAllowed('PROCESSING', 'PROCESSING', {});
  assert.equal(v.ok, true);
  assert.equal(v.kind, 'noop');
  const built = state.buildTransition({ from_status: 'PROCESSING', to_status: 'PROCESSING' });
  assert.equal(built.kind, 'noop');
  assert.equal(built.event, null, 'a no-op must not manufacture an audit event');
});

test('unknown statuses are refused by name at both ends', function () {
  assert.equal(state.isTransitionAllowed('MADE_UP', 'PROCESSING', {}).ok, false);
  assert.equal(state.isTransitionAllowed('PROCESSING', 'MADE_UP', {}).ok, false);
  assert.throws(function () { state.assertTransition('PROCESSING', 'shopping', {}); }, /unknown target status/);
});

test('a mid-shop question returns to SHOPPING, and planning questions return to PROCESSING', function () {
  assert.equal(state.isTransitionAllowed('SHOPPING', 'NEEDS_DECISION', {}).ok, true);
  assert.equal(state.isTransitionAllowed('NEEDS_DECISION', 'SHOPPING', {}).ok, true);
  assert.equal(state.isTransitionAllowed('PROCESSING', 'NEEDS_DECISION', {}).ok, true);
  assert.equal(state.isTransitionAllowed('NEEDS_DECISION', 'PROCESSING', {}).ok, true);
});

test('an illegal move names the legal ones, so the error is actionable', function () {
  const v = state.isTransitionAllowed('READY_TO_SHOP', 'BASKET_READY', {});
  assert.equal(v.ok, false);
  assert.match(v.reason, /WAITING_FOR_BROWSER/);
  assert.match(v.reason, /FAILED or CANCELLED/);
});

test('buildTransition carries the audit event and its from/to', function () {
  const built = state.buildTransition({
    from_status: 'PROCESSING', to_status: 'READY_TO_SHOP', description: 'plan approved'
  });
  assert.equal(built.kind, 'advance');
  assert.deepEqual(built.event, {
    event_type: 'transition',
    from_status: 'PROCESSING',
    to_status: 'READY_TO_SHOP',
    description: 'plan approved'
  });
});

// ---------------------------------------------------------------------
// nextShopRef
// ---------------------------------------------------------------------

test('nextShopRef formats SHOP-YYYY-MM-DD and accepts an ISO timestamp', function () {
  assert.equal(state.nextShopRef('2026-07-27'), 'SHOP-2026-07-27');
  assert.equal(state.nextShopRef('2026-07-27T09:30:00.000Z'), 'SHOP-2026-07-27');
  assert.equal(state.nextShopRef('2026-01-01'), 'SHOP-2026-01-01');
});

test('nextShopRef is deterministic - the same input always gives the same ref', function () {
  // No clock anywhere: a retry that crossed midnight must not silently produce
  // a different shop_ref, because a different ref is a duplicated week.
  const first = state.nextShopRef('2026-07-27T23:59:59.999Z');
  const second = state.nextShopRef('2026-07-27T23:59:59.999Z');
  assert.equal(first, second);
  assert.equal(first, 'SHOP-2026-07-27');
});

test('nextShopRef refuses dates that are not real', function () {
  assert.throws(function () { state.nextShopRef('2026-02-29'); }, /not a real day/);
  assert.throws(function () { state.nextShopRef('2026-13-01'); }, /not a real month/);
  assert.throws(function () { state.nextShopRef('2026-04-31'); }, /not a real day/);
  assert.throws(function () { state.nextShopRef('27/07/2026'); }, /YYYY-MM-DD/);
  assert.throws(function () { state.nextShopRef(''); }, /required|empty/);
  assert.throws(function () { state.nextShopRef(null); }, /required/);
  // A leap year IS accepted, so the check is a calendar and not a blanket ban.
  assert.equal(state.nextShopRef('2028-02-29'), 'SHOP-2028-02-29');
});

test('isShopRef recognises the convention and rejects near-misses', function () {
  assert.equal(state.isShopRef('SHOP-2026-07-27'), true);
  assert.equal(state.isShopRef('shop-2026-07-27'), false);
  assert.equal(state.isShopRef('SHOP-2026-7-27'), false);
  assert.equal(state.isShopRef('2026-07-27'), false);
});

// ---------------------------------------------------------------------
// buildShopCreate
// ---------------------------------------------------------------------

function createIntent(overrides) {
  const base = {
    household_id: HH,
    shop_ref: 'SHOP-2026-07-27',
    source_kind: 'text',
    raw_text: 'milk\nbread\nfries',
    telegram_chat_id: '10001',
    telegram_message_id: '55'
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

test('buildShopCreate produces exactly the migration-006 column list', function () {
  const built = state.buildShopCreate(createIntent());
  assert.deepEqual(built.columns, state.SHOP_INSERT_COLUMNS);
  assert.equal(built.row.status, 'RECEIVED');
  assert.equal(built.row.needs_review, false);
  assert.equal(built.row.list_id, null);
  assert.deepEqual(built.resume_keys, ['telegram_message', 'shop_ref']);
});

test('buildShopCreate refuses HALF an inbound key - the idempotency index is partial', function () {
  assert.throws(function () {
    state.buildShopCreate(createIntent({ telegram_message_id: null }));
  }, /together or not at all/);
  assert.throws(function () {
    state.buildShopCreate(createIntent({ telegram_chat_id: null }));
  }, /together or not at all/);
  // Neither is fine: a cockpit-originated shop has no Telegram identity, and
  // then only the shop_ref key applies.
  const built = state.buildShopCreate(createIntent({ telegram_chat_id: null, telegram_message_id: null }));
  assert.deepEqual(built.resume_keys, ['shop_ref']);
});

test('buildShopCreate insists the raw evidence is actually present', function () {
  assert.throws(function () {
    state.buildShopCreate(createIntent({ raw_text: null }));
  }, /must carry raw_text/);
  assert.throws(function () {
    state.buildShopCreate(createIntent({ source_kind: 'photo', raw_text: 'x' }));
  }, /must carry raw_media_path/);
  const photo = state.buildShopCreate(createIntent({
    source_kind: 'photo', raw_text: null, raw_media_path: '/tmp/synthetic-list.jpg'
  }));
  assert.equal(photo.row.source_kind, 'photo');
});

test('buildShopCreate validates the vocabulary, the ref and the ids', function () {
  assert.throws(function () { state.buildShopCreate(createIntent({ source_kind: 'voice' })); },
    /source_kind "voice" is not one of/);
  assert.throws(function () { state.buildShopCreate(createIntent({ shop_ref: 'week 30' })); },
    /SHOP-YYYY-MM-DD/);
  assert.throws(function () { state.buildShopCreate(createIntent({ shop_ref: '' })); }, /must not be empty/);
  assert.throws(function () { state.buildShopCreate(createIntent({ household_id: null })); },
    /household_id is required/);
  assert.throws(function () { state.buildShopCreate(createIntent({ household_id: 0 })); },
    /positive integer/);
  assert.throws(function () { state.buildShopCreate(createIntent({ household_id: 'one' })); },
    /positive integer/);
});

test('buildShopCreate refuses to create a shop already part-way through', function () {
  assert.throws(function () { state.buildShopCreate(createIntent({ status: 'SHOPPING' })); },
    /always created at RECEIVED/);
});

test('buildShopCreate bounds transcript_confidence', function () {
  assert.throws(function () { state.buildShopCreate(createIntent({ transcript_confidence: 1.5 })); },
    /between 0 and 1/);
  assert.equal(state.buildShopCreate(createIntent({ transcript_confidence: 0.82 })).row.transcript_confidence, 0.82);
});

test('buildShopCreate accepts a bigint id as a numeric string without mangling it', function () {
  const big = '90071992547409911';
  const built = state.buildShopCreate(createIntent({ household_id: big }));
  assert.equal(built.row.household_id, big, 'a bigint beyond Number.MAX_SAFE_INTEGER must stay a string');
});

// ---------------------------------------------------------------------
// buildQuestion / buildAnswer
// ---------------------------------------------------------------------

test('buildQuestion requires a stable key and validates candidates', function () {
  const built = state.buildQuestion({
    shop_id: 3, question_key: 'line-7-brand', question_text: 'Which milk?',
    candidates: ['Arla 4pt', { name: 'Store 4pt', id: 'p-2' }]
  });
  assert.equal(built.row.question_key, 'line-7-brand');
  assert.equal(built.row.candidates.length, 2);

  assert.throws(function () {
    state.buildQuestion({ shop_id: 3, question_key: 'k', question_text: 't', candidates: 'Arla' });
  }, /candidates must be an array/);
  assert.throws(function () {
    state.buildQuestion({ shop_id: 3, question_key: '   ', question_text: 't' });
  }, /question_key must not be empty/);
  assert.throws(function () {
    state.buildQuestion({ shop_id: 3, question_text: 't', question_key: 'k' , candidates: [null] });
  }, /must not be null/);
  // No candidates is legitimate: an open question can be free text.
  assert.deepEqual(state.buildQuestion({ shop_id: 3, question_key: 'k', question_text: 't' }).row.candidates, []);
});

test('buildAnswer needs a way to find the question, and an answer to record', function () {
  assert.throws(function () { state.buildAnswer({ answer_text: 'Arla' }); },
    /question_id, or by shop_id \+ question_key/);
  assert.throws(function () { state.buildAnswer({ shop_id: 1, question_key: 'k' }); },
    /answer_text is required/);
  // 'skipped' is a real answer and needs no text.
  const skipped = state.buildAnswer({ shop_id: 1, question_key: 'k', status: 'skipped' });
  assert.equal(skipped.set.status, 'skipped');
  assert.equal(skipped.event.event_type, 'decision');
  assert.throws(function () {
    state.buildAnswer({ shop_id: 1, question_key: 'k', answer_text: 'x', answer_source: 'telepathy' });
  }, /answer_source "telepathy"/);
  assert.throws(function () {
    state.buildAnswer({ shop_id: 1, question_key: 'k', answer_text: 'x', status: 'open' });
  }, /"answered" or "skipped"/);
});

// ---------------------------------------------------------------------
// buildBrowserRequest / buildPendingAction
// ---------------------------------------------------------------------

test('a browser request is always created queued - claiming is never an INSERT', function () {
  assert.equal(state.buildBrowserRequest(9).row.status, 'queued');
  assert.equal(state.buildBrowserRequest({ shop_id: 9 }).row.status, 'queued');
  assert.throws(function () { state.buildBrowserRequest({ shop_id: 9, status: 'claimed' }); },
    /always created "queued"/);
  assert.throws(function () { state.buildBrowserRequest({}); }, /shop_id is required/);
});

test('buildPendingAction requires the natural key and a jsonb-shaped payload', function () {
  const built = state.buildPendingAction({
    household_id: HH, action_type: 'add_favourite', action_key: 'synthetic-item-1'
  });
  assert.deepEqual(built.row.payload, {});
  assert.equal(built.row.shop_id, null);
  assert.throws(function () {
    state.buildPendingAction({ household_id: HH, action_type: 'add_favourite' });
  }, /action_key is required/);
  assert.throws(function () {
    state.buildPendingAction({ household_id: HH, action_type: 'x', action_key: 'y', payload: ['a'] });
  }, /payload must be an object/);
});

// ---------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------

test('shopState is pure: no clock, no randomness, no io, and it never mutates its input', function () {
  const src = require('node:fs').readFileSync(__filename.replace('.test.js', '.js'), 'utf8');
  const code = src.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
  [/Date\.now/, /new Date/, /Math\.random/, /require\(['"]pg['"]\)/, /require\(['"]node:fs['"]\)/].forEach(function (re) {
    assert.equal(re.test(code), false, 'shopState must not contain ' + re);
  });

  const intent = createIntent();
  const snapshot = JSON.stringify(intent);
  state.buildShopCreate(intent);
  assert.equal(JSON.stringify(intent), snapshot, 'buildShopCreate must not mutate its argument');
});
