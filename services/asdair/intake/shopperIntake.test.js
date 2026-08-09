// =====================================================================
// IDEA-012 AsdAIr — intake: shopperIntake.test.js
//
// OFFLINE ONLY. No network, no real bot, no real token, no database. The HTTP
// layer is an injected fake `fetchImpl`; every token here is an obvious fake
// ('000000:FAKE-TEST-TOKEN-NOT-REAL'), never a credential.
//
// Proves: text message, photo message (highest resolution, downloaded, path
// emitted), unauthorised sender IGNORED, offset NOT advanced on failure,
// sourceId uniqueness across two messages, --dry-run writes no state — plus the
// load-bearing one: the emitted payload is accepted by the REAL downstream
// services/hub/shopper/shopperRoute.mjs.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  SHOPPER_INTAKE_ENV,
  IGNORE_REASONS,
  MAX_POLL_TIMEOUT_SECONDS,
  loadIntakeConfig,
  parseAllowedSenderIds,
  classifyUpdate,
  pickLargestPhoto,
  buildSourceId,
  safeMediaFilename,
  clampPollTimeout,
  maskToken,
  createShopperTelegramClient,
  createFileStateStore,
  createFileMediaStore,
  createMemoryStateStore,
  runIntake,
  defaultStateFile,
  defaultMediaDir,
} from './shopperIntake.js';

// The REAL downstream consumer — the proof that this receiver's output fits.
import { shopperRoute } from '../../hub/shopper/shopperRoute.mjs';

import { parseArgs, summarise } from './fetch-shopper-list.js';

// An obviously fake token. NEVER a real credential.
const FAKE_TOKEN = '000000:FAKE-TEST-TOKEN-NOT-REAL';
const ALLOWED = '111222333';
const STRANGER = '999888777';

// ── fixtures ────────────────────────────────────────────────────────────────

function textUpdate({ updateId, messageId, senderId = ALLOWED, text = '2 milk\nbread\neggs x6' }) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: { id: Number(senderId), is_bot: false, first_name: 'Test' },
      chat: { id: Number(senderId), type: 'private' },
      date: 1_800_000_000,
      text,
    },
  };
}

function photoUpdate({ updateId, messageId, senderId = ALLOWED, caption = null }) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: { id: Number(senderId), is_bot: false, first_name: 'Test' },
      chat: { id: Number(senderId), type: 'private' },
      date: 1_800_000_000,
      ...(caption ? { caption } : {}),
      photo: [
        { file_id: 'SMALL', file_unique_id: 'u-small', width: 90, height: 120, file_size: 900 },
        { file_id: 'BIG', file_unique_id: 'u-big', width: 1280, height: 1706, file_size: 240000 },
        { file_id: 'MEDIUM', file_unique_id: 'u-med', width: 320, height: 426, file_size: 12000 },
      ],
    },
  };
}

function testConfig(overrides = {}) {
  return loadIntakeConfig({
    [SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN]: FAKE_TOKEN,
    [SHOPPER_INTAKE_ENV.SHOPPER_ALLOWED_SENDER_IDS]: ALLOWED,
    [SHOPPER_INTAKE_ENV.SHOPPER_INTAKE_STATE_FILE]: '/nowhere/state.json',
    [SHOPPER_INTAKE_ENV.SHOPPER_INTAKE_MEDIA_DIR]: '/nowhere/media',
    ...overrides,
  });
}

/** A fake Telegram client. Records every call; no network anywhere. */
function fakeTelegram({ updates = [], filePath = 'photos/file_7.jpg', bytes = Buffer.from('FAKEJPEGBYTES'), failDownload = false } = {}) {
  const calls = { getUpdates: [], getFile: [], downloadFile: [] };
  return {
    calls,
    async getUpdates(opts) { calls.getUpdates.push(opts); return updates; },
    async getFile(fileId) {
      calls.getFile.push(fileId);
      return { file_id: fileId, file_path: filePath, file_size: bytes.length };
    },
    async downloadFile(p) {
      calls.downloadFile.push(p);
      if (failDownload) throw new Error('simulated transient download failure');
      return bytes;
    },
  };
}

function fakeMedia() {
  const saved = [];
  return {
    saved,
    async save(filename, bytes) {
      saved.push({ filename, bytes });
      return `/fake-media/${filename}`;
    },
  };
}

async function tmpDir(label) {
  return fsp.mkdtemp(path.join(os.tmpdir(), `asdair-intake-${label}-`));
}

// ── pure core ───────────────────────────────────────────────────────────────

test('allowlist parsing is numeric-only and default-deny (no allow-all)', () => {
  assert.deepEqual(parseAllowedSenderIds('111222333'), ['111222333']);
  assert.deepEqual(parseAllowedSenderIds(' 111222333, 444 555 '), ['111222333', '444', '555']);
  assert.deepEqual(parseAllowedSenderIds('111,111'), ['111'], 'de-duplicated');
  assert.throws(() => parseAllowedSenderIds(''), /required/);
  assert.throws(() => parseAllowedSenderIds(undefined), /required/);
  assert.throws(() => parseAllowedSenderIds('@warwick'), /numeric/, 'usernames are spoofable — refused');
});

test('the highest-resolution photo is chosen (a handwritten list must stay legible)', () => {
  const chosen = pickLargestPhoto(photoUpdate({ updateId: 1, messageId: 1 }).message.photo);
  assert.equal(chosen.file_id, 'BIG');
  assert.equal(pickLargestPhoto([]), null);
  assert.equal(pickLargestPhoto(undefined), null);
  assert.equal(pickLargestPhoto([{ nope: true }]), null, 'entries without a file_id are unusable');
});

test('long-poll wait is capped under the ~45s home-NAT kill window', () => {
  assert.equal(clampPollTimeout(0), 0);
  assert.equal(clampPollTimeout(10), 10);
  assert.equal(clampPollTimeout(600), MAX_POLL_TIMEOUT_SECONDS);
  assert.equal(clampPollTimeout('not-a-number'), 0);
  assert.equal(clampPollTimeout(-5), 0);
});

test('a downloaded photo filename can never carry a path from Telegram', () => {
  const name = safeMediaFilename({
    sourceId: 'tg:shopper:chat:1:msg:2',
    fileUniqueId: 'u-big',
    remoteFilePath: '../../../etc/passwd.jpg',
  });
  assert.ok(!name.includes('/') && !name.includes('\\') && !name.includes('..'), `traversal-free: ${name}`);
  assert.match(name, /\.jpg$/);
  // An extension outside the allowlist collapses to the safe fallback.
  assert.match(safeMediaFilename({ sourceId: 's', fileUniqueId: 'u', remoteFilePath: 'x/y.exe' }), /\.jpg$/);
});

test('the state and media defaults live OUTSIDE this repo', () => {
  const repoRoot = path.resolve(process.cwd(), '..', '..', '..');
  for (const p of [defaultStateFile(), defaultMediaDir()]) {
    const rel = path.relative(repoRoot, path.resolve(p));
    assert.ok(rel.startsWith('..') || path.isAbsolute(rel), `${p} must not resolve inside the repo (rel=${rel})`);
  }
});

// ── allowlist / classification ──────────────────────────────────────────────

test('a message from an unauthorised sender is IGNORED, never processed', () => {
  const v = classifyUpdate(textUpdate({ updateId: 5, messageId: 5, senderId: STRANGER }), { allowedSenderIds: [ALLOWED] });
  assert.equal(v.ok, false);
  assert.equal(v.reason, IGNORE_REASONS.UNAUTHORISED_SENDER);
  assert.equal(v.senderId, STRANGER);
  assert.ok(!('text' in v), 'a stranger\'s content is never carried forward');
});

test('non-private chats and unsupported content types are refused, in the proven order', () => {
  const inGroup = textUpdate({ updateId: 1, messageId: 1 });
  inGroup.message.chat = { id: -100123, type: 'supergroup' };
  assert.equal(classifyUpdate(inGroup, { allowedSenderIds: [ALLOWED] }).reason, IGNORE_REASONS.NON_PRIVATE_CHAT);

  const voice = textUpdate({ updateId: 2, messageId: 2, text: '' });
  voice.message.voice = { file_id: 'V1' };
  assert.equal(classifyUpdate(voice, { allowedSenderIds: [ALLOWED] }).reason, IGNORE_REASONS.UNSUPPORTED_CONTENT_TYPE);

  assert.equal(classifyUpdate({ update_id: 3, edited_message: {} }, { allowedSenderIds: [ALLOWED] }).reason, IGNORE_REASONS.NO_MESSAGE);

  // A stranger posting in a group is reported as unauthorised — never a
  // content/context oracle for someone outside the allowlist.
  const strangerInGroup = textUpdate({ updateId: 4, messageId: 4, senderId: STRANGER });
  strangerInGroup.message.chat = { id: -100123, type: 'supergroup' };
  assert.equal(classifyUpdate(strangerInGroup, { allowedSenderIds: [ALLOWED] }).reason, IGNORE_REASONS.UNAUTHORISED_SENDER);
});

// ── the receiver ────────────────────────────────────────────────────────────

test('TEXT message → a resolvePayload-shaped text payload + a sourceId, offset advanced', async () => {
  const telegram = fakeTelegram({ updates: [textUpdate({ updateId: 4001, messageId: 77 })] });
  const state = createMemoryStateStore(null);
  const r = await runIntake({ config: testConfig(), telegram, state, media: fakeMedia(), now: () => 1_700_000_000_000 });

  assert.equal(r.emitted.length, 1);
  const rec = r.emitted[0];
  assert.deepEqual(rec.payload, { kind: 'text', text: '2 milk\nbread\neggs x6' });
  assert.equal(rec.sourceId, `tg:shopper:chat:${ALLOWED}:msg:77`);
  assert.equal(rec.meta.transcribed, false, 'this receiver never transcribes');
  assert.equal(r.offsetAfter, 4001);
  assert.deepEqual((await state.read()), { lastUpdateId: 4001 });
  // First run has no offset — Telegram is asked for everything pending.
  assert.equal(telegram.calls.getUpdates[0].offset, undefined);
  assert.equal(telegram.calls.downloadFile.length, 0);
});

test('PHOTO message → highest-res file resolved + downloaded, payload carries the local path (NOT a transcript)', async () => {
  const telegram = fakeTelegram({ updates: [photoUpdate({ updateId: 4002, messageId: 78, caption: 'this week' })] });
  const media = fakeMedia();
  const r = await runIntake({ config: testConfig(), telegram, state: createMemoryStateStore(null), media, now: () => 1_700_000_000_000 });

  assert.equal(r.emitted.length, 1);
  const rec = r.emitted[0];
  assert.equal(rec.payload.kind, 'photo');
  assert.equal(rec.payload.imageRef, '/fake-media/tg-shopper-chat-111222333-msg-78-u-big.jpg');
  assert.deepEqual(Object.keys(rec.payload).sort(), ['imageRef', 'kind'], 'exactly the resolvePayload photo shape');
  assert.equal(telegram.calls.getFile[0], 'BIG', 'the highest-resolution file_id is the one resolved');
  assert.equal(media.saved.length, 1);
  assert.equal(media.saved[0].bytes.toString(), 'FAKEJPEGBYTES');
  assert.equal(rec.meta.caption, 'this week');
  assert.equal(rec.meta.transcribed, false);
  assert.ok(!('text' in rec.payload), 'no transcript is produced here — that is a separate vision step');
});

test('an unauthorised sender is ignored and logged, and nothing is downloaded for them', async () => {
  const telegram = fakeTelegram({
    updates: [
      photoUpdate({ updateId: 4010, messageId: 90, senderId: STRANGER }),
      textUpdate({ updateId: 4011, messageId: 91 }),
    ],
  });
  const media = fakeMedia();
  const events = [];
  const r = await runIntake({
    config: testConfig(), telegram, state: createMemoryStateStore(null), media,
    now: () => 1, log: (event, detail) => events.push({ event, ...detail }),
  });

  assert.equal(r.ignored.length, 1);
  assert.equal(r.ignored[0].reason, IGNORE_REASONS.UNAUTHORISED_SENDER);
  assert.equal(r.ignored[0].senderId, STRANGER);
  assert.ok(events.some((e) => e.event === 'ignored' && e.senderId === STRANGER), 'logged as ignored');
  assert.equal(telegram.calls.getFile.length, 0, 'a stranger\'s photo is never even resolved');
  assert.equal(media.saved.length, 0);
  // The authorised message behind it still gets through.
  assert.equal(r.emitted.length, 1);
  assert.equal(r.emitted[0].meta.senderId, ALLOWED);
});

test('the offset is NOT advanced for a message that failed to process, and the batch stops there', async () => {
  const telegram = fakeTelegram({
    updates: [
      textUpdate({ updateId: 5001, messageId: 10 }),
      photoUpdate({ updateId: 5002, messageId: 11 }),   // download blows up here
      textUpdate({ updateId: 5003, messageId: 12 }),
    ],
    failDownload: true,
  });
  const state = createMemoryStateStore(null);
  const r = await runIntake({ config: testConfig(), telegram, state, media: fakeMedia(), now: () => 1 });

  assert.equal(r.emitted.length, 1, 'only the message BEFORE the failure was emitted');
  assert.equal(r.failed.length, 1);
  assert.equal(r.failed[0].updateId, 5002);
  assert.equal(r.offsetAfter, 5001, 'the offset is held at the last SUCCESS');
  assert.deepEqual(await state.read(), { lastUpdateId: 5001 });
  assert.ok(!r.emitted.some((e) => e.meta.updateId === 5003), 'later updates are not skipped past — they redeliver');

  // Re-running asks Telegram for 5002 onward: nothing was lost.
  const telegram2 = fakeTelegram({ updates: [] });
  await runIntake({ config: testConfig(), telegram: telegram2, state, media: fakeMedia(), now: () => 1 });
  assert.equal(telegram2.calls.getUpdates[0].offset, 5002);
});

test('a token never leaks into a failure message', async () => {
  const telegram = fakeTelegram({ updates: [photoUpdate({ updateId: 6001, messageId: 20 })] });
  telegram.downloadFile = async () => { throw new Error(`boom while fetching https://api.telegram.org/file/bot${FAKE_TOKEN}/x.jpg`); };
  const r = await runIntake({ config: testConfig(), telegram, state: createMemoryStateStore(null), media: fakeMedia(), now: () => 1 });
  assert.equal(r.failed.length, 1);
  assert.ok(!r.failed[0].error.includes(FAKE_TOKEN), 'the token is masked out of the reported error');
  assert.ok(r.failed[0].error.includes(maskToken(FAKE_TOKEN)));
});

test('sourceId is unique across two different messages (shopperRoute keys never collide)', async () => {
  const telegram = fakeTelegram({
    updates: [
      textUpdate({ updateId: 7001, messageId: 31, text: 'milk\neggs' }),
      textUpdate({ updateId: 7002, messageId: 32, text: 'bread\njam' }),
    ],
  });
  const r = await runIntake({ config: testConfig(), telegram, state: createMemoryStateStore(null), media: fakeMedia(), now: () => 1 });
  assert.equal(r.emitted.length, 2);
  const [a, b] = r.emitted;
  assert.notEqual(a.sourceId, b.sourceId);
  assert.equal(new Set(r.emitted.map((x) => x.sourceId)).size, 2);
  // And it is STABLE: the same message always derives the same id (a redelivery
  // must dedup downstream, not double-add the week's shopping).
  assert.equal(a.sourceId, buildSourceId({ chatId: ALLOWED, messageId: 31 }));

  // The load-bearing proof: two different messages produce non-colliding
  // idempotency keys in the REAL downstream route.
  const ra = await shopperRoute(a.payload, { sourceId: a.sourceId });
  const rb = await shopperRoute(b.payload, { sourceId: b.sourceId });
  const keysA = new Set(ra.intents.map((i) => i.idempotency_key));
  assert.ok(rb.intents.every((i) => !keysA.has(i.idempotency_key)));
});

test('PROOF: the emitted payloads are accepted by the REAL services/hub/shopper/shopperRoute.mjs', async () => {
  const telegram = fakeTelegram({
    updates: [
      textUpdate({ updateId: 8001, messageId: 41, text: '2 milk\nbread\neggs x6' }),
      photoUpdate({ updateId: 8002, messageId: 42 }),
    ],
  });
  const r = await runIntake({ config: testConfig(), telegram, state: createMemoryStateStore(null), media: fakeMedia(), now: () => 1 });
  const [textRec, photoRec] = r.emitted;

  // TEXT — straight through, no transcriber needed.
  const routedText = await shopperRoute(textRec.payload, { sourceId: textRec.sourceId, listDate: '2026-08-03' });
  assert.equal(routedText.context, 'shopping');
  assert.equal(routedText.itemCount, 3);
  assert.ok(routedText.intents.every((i) => i.command === 'add_list_item'));
  assert.ok(routedText.intents.every((i) => i.idempotency_key.startsWith(`shop:${textRec.sourceId}`)));

  // PHOTO — the route asks for the transcript via the INJECTED vision step. The
  // receiver supplied only the image path; the transcriber is someone else's job.
  let handedTo = null;
  const routedPhoto = await shopperRoute(photoRec.payload, {
    sourceId: photoRec.sourceId,
    transcribers: { transcribeImage: async (ref) => { handedTo = ref; return 'apples\n3 bananas'; } },
  });
  assert.equal(handedTo, photoRec.payload.imageRef, 'the downloaded image path is exactly what the transcriber receives');
  assert.equal(routedPhoto.provenance.kind, 'photo');
  assert.equal(routedPhoto.provenance.source, photoRec.payload.imageRef);
  assert.equal(routedPhoto.itemCount, 2);

  // And without a transcriber the photo path fails closed — never guessed at.
  await assert.rejects(() => shopperRoute(photoRec.payload, { sourceId: photoRec.sourceId }), /fail closed/);
});

// ── dry run + real file state store ─────────────────────────────────────────

test('--dry-run downloads nothing and writes NO state file', async () => {
  const dir = await tmpDir('dryrun');
  const stateFile = path.join(dir, 'nested', 'shopper-intake-state.json');
  const telegram = fakeTelegram({
    updates: [textUpdate({ updateId: 9001, messageId: 51 }), photoUpdate({ updateId: 9002, messageId: 52 })],
  });

  const r = await runIntake({
    config: testConfig({ [SHOPPER_INTAKE_ENV.SHOPPER_INTAKE_STATE_FILE]: stateFile }),
    telegram,
    state: createFileStateStore(stateFile),
    dryRun: true,
    now: () => 1,
  });

  assert.equal(r.dryRun, true);
  assert.equal(r.emitted.length, 2, 'it still reports what WOULD be emitted');
  assert.equal(r.emitted[1].payload.kind, 'photo');
  assert.equal(r.emitted[1].payload.imageRef, null, 'nothing was downloaded, so there is no path');
  assert.equal(r.emitted[1].meta.wouldDownload, true);
  assert.equal(telegram.calls.getFile.length, 0, 'no getFile');
  assert.equal(telegram.calls.downloadFile.length, 0, 'no bytes fetched');
  assert.equal(fs.existsSync(stateFile), false, 'NO state file written');
  assert.equal(fs.existsSync(path.dirname(stateFile)), false, 'not even the directory');

  assert.equal(parseArgs(['--dry-run']).dryRun, true);
  assert.equal(parseArgs([]).dryRun, false);
  assert.throws(() => parseArgs(['--send-order']), /unknown argument/);
  assert.ok(summarise(r).emitted.length === 2 && summarise(r).dry_run === true);

  await fsp.rm(dir, { recursive: true, force: true });
});

test('the file state store persists the offset atomically and survives a restart', async () => {
  const dir = await tmpDir('state');
  const stateFile = path.join(dir, 'sub', 'shopper-intake-state.json');
  const store = createFileStateStore(stateFile);
  assert.deepEqual(await store.read(), { lastUpdateId: null }, 'missing file = nothing processed yet');

  const telegram = fakeTelegram({ updates: [textUpdate({ updateId: 12345, messageId: 60 })] });
  await runIntake({ config: testConfig(), telegram, state: store, media: fakeMedia(), now: () => 1_700_000_000_000 });

  assert.deepEqual(await createFileStateStore(stateFile).read(), { lastUpdateId: 12345 }, 'a fresh process reads it back');
  assert.equal(fs.existsSync(`${stateFile}.tmp`), false, 'the atomic temp file is renamed away');
  const onDisk = JSON.parse(await fsp.readFile(stateFile, 'utf8'));
  assert.equal(onDisk.last_update_id, 12345);
  assert.ok(!JSON.stringify(onDisk).includes(FAKE_TOKEN), 'no credential is ever persisted');

  // Re-running does NOT reprocess the same message.
  const telegram2 = fakeTelegram({ updates: [] });
  const again = await runIntake({ config: testConfig(), telegram: telegram2, state: createFileStateStore(stateFile), media: fakeMedia(), now: () => 1 });
  assert.equal(telegram2.calls.getUpdates[0].offset, 12346);
  assert.equal(again.emitted.length, 0);

  await fsp.rm(dir, { recursive: true, force: true });
});

test('the media store writes the bytes inside its directory and returns the path', async () => {
  const dir = await tmpDir('media');
  const store = createFileMediaStore(path.join(dir, 'shopper-media'));
  const saved = await store.save('tg-shopper-chat-1-msg-2-u-big.jpg', Buffer.from('BYTES'));
  assert.equal(path.dirname(saved), path.resolve(dir, 'shopper-media'));
  assert.equal(await fsp.readFile(saved, 'utf8'), 'BYTES');
  await fsp.rm(dir, { recursive: true, force: true });
});

// ── config + client hygiene ─────────────────────────────────────────────────

test('config fails closed without a token or an allowlist, and describe() masks the token', () => {
  assert.throws(() => loadIntakeConfig({}), new RegExp(SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN));
  assert.throws(
    () => loadIntakeConfig({ [SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN]: FAKE_TOKEN }),
    new RegExp(SHOPPER_INTAKE_ENV.SHOPPER_ALLOWED_SENDER_IDS),
  );
  const described = testConfig().describe();
  assert.equal(described.SHOPPER_BOT_TOKEN, '000000:***masked***');
  assert.ok(!JSON.stringify(described).includes('FAKE-TEST-TOKEN-NOT-REAL'));
});

test('SHOPPER_ALLOWED_USER_IDS is accepted as an alias for the allowlist, and is still default-deny', () => {
  // The machine credentials file for this bot predates this module and uses
  // SHOPPER_ALLOWED_USER_IDS. Proven live 2026-07-28: without this alias the
  // receiver fails closed against the real config and next week's list never lands.
  const cfg = loadIntakeConfig({
    [SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN]: FAKE_TOKEN,
    SHOPPER_ALLOWED_USER_IDS: '8601328832',
  });
  assert.deepEqual(cfg.allowedSenderIds, ['8601328832']);

  // The canonical name still wins when both are present.
  const both = loadIntakeConfig({
    [SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN]: FAKE_TOKEN,
    [SHOPPER_INTAKE_ENV.SHOPPER_ALLOWED_SENDER_IDS]: '111',
    SHOPPER_ALLOWED_USER_IDS: '222',
  });
  assert.deepEqual(both.allowedSenderIds, ['111']);

  // An alias that is present but empty must NOT become allow-all.
  assert.throws(
    () => loadIntakeConfig({ [SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN]: FAKE_TOKEN, SHOPPER_ALLOWED_USER_IDS: '   ' }),
    new RegExp(SHOPPER_INTAKE_ENV.SHOPPER_ALLOWED_SENDER_IDS),
  );
});

test('the Telegram client is fully injectable — the fake sees the calls, nothing hits the network', async () => {
  const seen = [];
  const client = createShopperTelegramClient({
    botToken: FAKE_TOKEN,
    apiBase: 'https://example.invalid',
    fetchImpl: async (url, init) => {
      seen.push({ url, init });
      if (url.endsWith('/getUpdates')) return { ok: true, status: 200, json: async () => ({ ok: true, result: [{ update_id: 1 }] }) };
      if (url.endsWith('/getFile')) return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: 'photos/a.png' } }) };
      return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('IMG').buffer };
    },
  });

  assert.deepEqual(await client.getUpdates({ offset: 7 }), [{ update_id: 1 }]);
  assert.deepEqual(JSON.parse(seen[0].init.body), { offset: 7, timeout: 0, limit: 100 });
  assert.equal((await client.getFile('BIG')).file_path, 'photos/a.png');
  assert.equal((await client.downloadFile('photos/a.png')).toString(), 'IMG');
  assert.equal(seen[2].url, 'https://example.invalid/file/bot000000:FAKE-TEST-TOKEN-NOT-REAL/photos/a.png');
  assert.equal(client.describe().bot_token, '000000:***masked***');
});

test('a Bot API rejection is surfaced with the token masked out', async () => {
  const client = createShopperTelegramClient({
    botToken: FAKE_TOKEN,
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ ok: false, description: `Unauthorized for bot${FAKE_TOKEN}` }) }),
  });
  await assert.rejects(() => client.getUpdates({}), (err) => {
    assert.ok(!err.message.includes('FAKE-TEST-TOKEN-NOT-REAL'), 'never echoes the token');
    assert.match(err.message, /getUpdates rejected/);
    return true;
  });
});

test('this module can never order, check out, or pay — no such path exists in the source', async () => {
  const src = await fsp.readFile(new URL('./shopperIntake.js', import.meta.url), 'utf8');
  const runtime = await fsp.readFile(new URL('./fetch-shopper-list.js', import.meta.url), 'utf8');
  for (const [name, code] of [['shopperIntake.js', src], ['fetch-shopper-list.js', runtime]]) {
    // Only ever mentioned in the prose that forbids them.
    for (const banned of [/\bcheckout\(/i, /\bplaceOrder\b/i, /\bpay\(/i, /require\(['"]pg['"]\)/, /from ['"]pg['"]/]) {
      assert.ok(!banned.test(code), `${name} must contain no ${banned}`);
    }
  }
});

// ── the crash window that used to lose a list silently ──────────────────────
// Codex flagged this as merge-blocking, and rightly: advancing the offset is an
// ACKNOWLEDGEMENT, after which Telegram forgets the update forever. Acknowledging
// before the shop exists durably means a crash in that window loses a shopping
// list with no error and nothing to recover from.

test('THE OFFSET IS NOT ACKNOWLEDGED until the record is durably persisted', async () => {
  const state = createMemoryStateStore();
  const out = await runIntake({
    config: testConfig(),
    telegram: fakeTelegram({ updates: [textUpdate({ updateId: 900, messageId: 90 })] }),
    state,
    media: fakeMedia(),
    onRecord: async () => { throw new Error('database unavailable'); },
  });
  assert.equal(out.emitted.length, 0, 'nothing may be emitted when persistence failed');
  assert.equal(out.failed.length, 1);
  assert.equal((await state.read()).lastUpdateId, null,
    'THE POINT: the offset must NOT advance, so Telegram redelivers and the list survives');
});

test('the offset IS acknowledged once persistence succeeds', async () => {
  const state = createMemoryStateStore();
  const seen = [];
  const out = await runIntake({
    config: testConfig(),
    telegram: fakeTelegram({ updates: [textUpdate({ updateId: 901, messageId: 91 })] }),
    state,
    media: fakeMedia(),
    onRecord: async (r) => { seen.push(r.sourceId); },
  });
  assert.equal(out.emitted.length, 1);
  assert.equal(seen.length, 1, 'the persistence hook ran BEFORE acknowledgement');
  assert.equal((await state.read()).lastUpdateId, 901);
});

// ── WP-B15-1: the exact-source image fingerprint (invariant C) ───────────────

test('FINGERPRINT: a downloaded photo carries the sha256 of the EXACT saved bytes on its meta', async () => {
  const bytes = Buffer.from('FAKEJPEGBYTES');
  const telegram = fakeTelegram({ updates: [photoUpdate({ updateId: 9001, messageId: 200 })], bytes });
  const media = fakeMedia();
  const r = await runIntake({ config: testConfig(), telegram, state: createMemoryStateStore(null), media, now: () => 1_700_000_000_000 });

  assert.equal(r.emitted.length, 1);
  const rec = r.emitted[0];
  // The independent expectation: computed here, from the same fixture bytes,
  // with node:crypto directly - not by calling the function under test.
  const { createHash } = await import('node:crypto');
  const expected = createHash('sha256').update(bytes).digest('hex');
  assert.equal(rec.meta.imageSha256, expected, 'the fingerprint is not the sha256 of the downloaded bytes');
  assert.equal(rec.meta.bytes, bytes.length);
  // The bytes the media store SAVED are the bytes that were hashed.
  assert.equal(media.saved[0].bytes.toString(), bytes.toString());
  // The payload contract is untouched: still exactly the resolvePayload shape.
  assert.deepEqual(Object.keys(rec.payload).sort(), ['imageRef', 'kind'], 'the fingerprint must ride meta, never the payload');
});

test('FINGERPRINT: same bytes same fingerprint, different bytes different fingerprint - it is content identity', async () => {
  const a = await runIntake({
    config: testConfig(),
    telegram: fakeTelegram({ updates: [photoUpdate({ updateId: 9101, messageId: 201 })], bytes: Buffer.from('WEEK-A-PHOTO') }),
    state: createMemoryStateStore(null), media: fakeMedia(), now: () => 1_700_000_000_000,
  });
  const aAgain = await runIntake({
    config: testConfig(),
    telegram: fakeTelegram({ updates: [photoUpdate({ updateId: 9102, messageId: 202 })], bytes: Buffer.from('WEEK-A-PHOTO') }),
    state: createMemoryStateStore(null), media: fakeMedia(), now: () => 1_700_000_000_000,
  });
  const b = await runIntake({
    config: testConfig(),
    telegram: fakeTelegram({ updates: [photoUpdate({ updateId: 9103, messageId: 203 })], bytes: Buffer.from('WEEK-B-PHOTO') }),
    state: createMemoryStateStore(null), media: fakeMedia(), now: () => 1_700_000_000_000,
  });
  assert.equal(a.emitted[0].meta.imageSha256, aAgain.emitted[0].meta.imageSha256,
    'a re-sent identical photograph must fingerprint identically - that is the wrong-week detector');
  assert.notEqual(a.emitted[0].meta.imageSha256, b.emitted[0].meta.imageSha256,
    'two different photographs must never share a fingerprint');
});

test('FINGERPRINT: a dry run downloads nothing, so it honestly carries no fingerprint', async () => {
  const telegram = fakeTelegram({ updates: [photoUpdate({ updateId: 9201, messageId: 204 })] });
  const r = await runIntake({ config: testConfig(), telegram, state: createMemoryStateStore(null), dryRun: true, now: () => 1_700_000_000_000 });
  assert.equal(r.emitted.length, 1);
  assert.ok(!('imageSha256' in r.emitted[0].meta), 'a fingerprint of bytes never fetched would be fabricated evidence');
  assert.equal(telegram.calls.downloadFile.length, 0);
});

test('FINGERPRINT: a text message carries none - there is no image to bind', async () => {
  const r = await runIntake({
    config: testConfig(),
    telegram: fakeTelegram({ updates: [textUpdate({ updateId: 9301, messageId: 205 })] }),
    state: createMemoryStateStore(null), media: fakeMedia(), now: () => 1_700_000_000_000,
  });
  assert.equal(r.emitted.length, 1);
  assert.ok(!('imageSha256' in r.emitted[0].meta));
});

// =====================================================================
// WP-B15-A1 - ROUTE FIRST, INTAKE SECOND
//
// The claim is asked BEFORE a message is treated as a shopping list, and BEFORE
// its Telegram offset advances. Both halves matter: the first stops an answer
// also becoming a shop, the second stops a crash losing the answer in the window
// between the acknowledgement and the write.
//
// classifyUpdate is NOT involved and stays pure - the tests above still pass it
// no state at all. Classification says WHAT a message is; the claim says WHO it
// belongs to.
// =====================================================================

test('A1 CLAIMED: a claimed message is never built, never downloaded, never emitted', async () => {
  const telegram = fakeTelegram({ updates: [textUpdate({ updateId: 5001, messageId: 91 })] });
  const state = createMemoryStateStore(null);

  const seen = [];
  const r = await runIntake({
    config: testConfig(),
    telegram,
    state,
    media: fakeMedia(),
    now: () => 1_700_000_000_000,
    claim: async (verdict, update) => { seen.push({ verdict, update }); return true; },
  });

  assert.equal(r.claimed.length, 1, 'the claim was not honoured');
  assert.equal(r.emitted.length, 0, 'a claimed message was ALSO emitted as a shopping list');
  assert.equal(r.ignored.length, 0, 'a claimed message is handled, not ignored - the report must say so');
  // THE ACK STILL MOVES. The claimant wrote the answer durably before returning
  // true, so redelivering it would answer the same question twice.
  assert.equal(r.offsetAfter, 5001);
  assert.deepEqual(await state.read(), { lastUpdateId: 5001 });
});

test('A1 THE CLAIM SEES THE CLASSIFIED VERDICT AND THE RAW UPDATE', async () => {
  const update = textUpdate({ updateId: 5002, messageId: 92 });
  const telegram = fakeTelegram({ updates: [update] });

  let got = null;
  await runIntake({
    config: testConfig(),
    telegram,
    state: createMemoryStateStore(null),
    media: fakeMedia(),
    now: () => 1,
    claim: async (verdict, raw) => { got = { verdict, raw }; return false; },
  });

  assert.equal(got.verdict.kind, 'text', 'the claim needs to know what kind of message this is');
  assert.equal(got.verdict.updateId, 5002);
  // The RAW update is needed because correlating an answer needs the message
  // itself - reply_to_message, sender, chat - not just the classification.
  assert.equal(got.raw, update);
});

test('A1 NOT CLAIMED: the message goes to intake exactly as it always has', async () => {
  const telegram = fakeTelegram({ updates: [textUpdate({ updateId: 5003, messageId: 93 })] });
  const r = await runIntake({
    config: testConfig(),
    telegram,
    state: createMemoryStateStore(null),
    media: fakeMedia(),
    now: () => 1,
    claim: async () => false,
  });

  assert.equal(r.claimed.length, 0);
  assert.equal(r.emitted.length, 1, 'declining the claim lost the shopping list');
  assert.deepEqual(r.emitted[0].payload, { kind: 'text', text: '2 milk\nbread\neggs x6' });
});

test('A1 A CLAIM THAT THROWS NEVER EATS THE MESSAGE', async () => {
  const telegram = fakeTelegram({ updates: [textUpdate({ updateId: 5004, messageId: 94 })] });
  const events = [];
  const r = await runIntake({
    config: testConfig(),
    telegram,
    state: createMemoryStateStore(null),
    media: fakeMedia(),
    now: () => 1,
    log: (event, detail) => events.push({ event, detail }),
    claim: async () => { throw new Error('the correlator is down'); },
  });

  // Routing failing is not a reason to lose a shopping list. Failing towards
  // "not claimed" means the worst case is the pre-existing behaviour.
  assert.equal(r.claimed.length, 0);
  assert.equal(r.emitted.length, 1, 'a throwing claim discarded the message');
  assert.equal(events.filter((e) => e.event === 'claim_failed').length, 1,
    'a failed claim must leave a trace, not fail silently');
});

test('A1 NO CLAIM HOOK AT ALL: behaviour is byte-for-byte what it was', async () => {
  const telegram = fakeTelegram({ updates: [textUpdate({ updateId: 5005, messageId: 95 })] });
  const r = await runIntake({
    config: testConfig(), telegram, state: createMemoryStateStore(null), media: fakeMedia(), now: () => 1,
  });

  assert.equal(r.emitted.length, 1);
  assert.deepEqual(r.claimed, [], 'the new field must exist and be empty, never absent');
  assert.equal(r.offsetAfter, 5005);
});

test('A1 AN UNAUTHORISED SENDER IS NEVER OFFERED TO THE CLAIM', async () => {
  const stranger = textUpdate({ updateId: 5006, messageId: 96, senderId: STRANGER });
  const telegram = fakeTelegram({ updates: [stranger] });

  let offered = 0;
  const r = await runIntake({
    config: testConfig(),
    telegram,
    state: createMemoryStateStore(null),
    media: fakeMedia(),
    now: () => 1,
    claim: async () => { offered += 1; return true; },
  });

  // The allowlist is default-deny and runs FIRST. Routing must never become a
  // way around it - a stranger must not be able to answer Warwick's questions.
  assert.equal(offered, 0, 'an unauthorised message reached the claim hook');
  assert.equal(r.claimed.length, 0);
  assert.equal(r.ignored.length, 1);
  assert.equal(r.ignored[0].reason, IGNORE_REASONS.UNAUTHORISED_SENDER);
});
