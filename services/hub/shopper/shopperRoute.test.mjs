// BUILD-002 WP5 — Shopper route: fixtures proof.
//
// Proves ShopperBot typed/photo/voice payloads flow through the hub (reusing the AsdAIr normaliser) to
// AsdAIr list-item intents: context defaults to shopping, weekly-list data targets AsdAIr not the Brain,
// ambiguous lines are preserved as needs_decision (never dropped/guessed), the route can ONLY emit the
// add-only command (no checkout/payment/substitution), and photo/voice fail closed without a transcriber.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shopperRoute, ALLOWED_SHOPPER_COMMANDS, SHOPPER_CONTEXT } from './shopperRoute.mjs';

test('typed list → add_list_item intents in the shopping context, targeting AsdAIr not the Brain', async () => {
  const r = await shopperRoute({ kind: 'text', text: '2 milk\nbread\neggs x6' }, { listDate: '2026-07-27', sourceId: 'msg-k' });
  assert.equal(r.context, SHOPPER_CONTEXT);
  assert.equal(r.targetsAsdair, true);
  assert.equal(r.targetsBrain, false);
  assert.equal(r.itemCount, 3);
  const milk = r.intents.find((i) => i.args.item_name.toLowerCase().includes('milk'));
  assert.equal(milk.command, 'add_list_item');
  assert.equal(milk.args.requested_qty, 2);
  assert.equal(milk.args.list_date, '2026-07-27');
  assert.ok(r.intents.every((i) => i.args.status === 'requested'));
});

test('photo payload uses the injected OCR transcriber (the parked B half)', async () => {
  const r = await shopperRoute(
    { kind: 'photo', imageRef: 'tg:file:PHOTO1' },
    { transcribers: { transcribeImage: async () => 'apples\n3 bananas' }, sourceId: 'msg-p' },
  );
  assert.equal(r.provenance.kind, 'photo');
  assert.equal(r.provenance.source, 'tg:file:PHOTO1');
  assert.equal(r.itemCount, 2);
  assert.equal(r.intents.find((i) => i.args.item_name.toLowerCase().includes('banana')).args.requested_qty, 3);
});

test('voice payload uses the injected transcriber', async () => {
  const r = await shopperRoute(
    { kind: 'voice', voiceRef: 'tg:file:VOICE1' },
    { transcribers: { transcribeVoice: async () => 'butter\njam' }, sourceId: 'msg-v' },
  );
  assert.equal(r.provenance.kind, 'voice');
  assert.equal(r.itemCount, 2);
});

test('ambiguous line preserved as needs_decision — never dropped, never guessed', async () => {
  // A conflicting/ambiguous quantity goes to needs_review in the normaliser.
  const r = await shopperRoute({ kind: 'text', text: 'milk\n1.5 flour' }, { sourceId: 'msg-a' });
  const nd = r.intents.filter((i) => i.args.status === 'needs_decision');
  assert.ok(nd.length >= 1, 'the ambiguous line is preserved as a needs_decision intent');
  assert.match(nd[0].args.note, /needs review/);
  // Total intents == items + needs_review (nothing dropped).
  assert.equal(r.intents.length, r.itemCount + r.needsReviewCount);
});

test('the route can ONLY emit add-only commands (no checkout/payment/substitution)', async () => {
  assert.deepEqual(ALLOWED_SHOPPER_COMMANDS, ['add_list_item']);
  const r = await shopperRoute({ kind: 'text', text: 'a\nb\nc' }, { sourceId: 'msg-x' });
  assert.ok(r.intents.every((i) => ALLOWED_SHOPPER_COMMANDS.includes(i.command)));
  assert.ok(!r.intents.some((i) => /checkout|pay|substitut/i.test(i.command)));
});

test('idempotency keys are source-scoped — two different messages never collide', async () => {
  const a = await shopperRoute({ kind: 'text', text: 'milk\neggs' }, { sourceId: 'tg:msg:1001' });
  const b = await shopperRoute({ kind: 'text', text: 'bread\njam' }, { sourceId: 'tg:msg:1002' });
  const keysA = new Set(a.intents.map((i) => i.idempotency_key));
  const keysB = b.intents.map((i) => i.idempotency_key);
  assert.ok(keysB.every((k) => !keysA.has(k)), 'no key from message 1002 collides with message 1001');
  assert.ok(a.intents[0].idempotency_key.startsWith('shop:tg:msg:1001'), 'keys carry the source id');
});

test('a missing sourceId fails closed (keys would otherwise collide)', async () => {
  await assert.rejects(() => shopperRoute({ kind: 'text', text: 'milk' }, {}), /sourceId/);
});

test('photo/voice without a transcriber FAILS CLOSED (no guessing)', async () => {
  await assert.rejects(() => shopperRoute({ kind: 'photo', imageRef: 'x' }, { sourceId: 's1' }), /fail closed/);
  await assert.rejects(() => shopperRoute({ kind: 'voice', voiceRef: 'x' }, { sourceId: 's2' }), /fail closed/);
  await assert.rejects(() => shopperRoute({ kind: 'nonsense' }, { sourceId: 's3' }), /unsupported/);
});
