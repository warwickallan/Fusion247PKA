// Tests for continuity.mjs — the Honcho read/write path and the Stop hook.
//
// WO-OR-18. This module had NO tests at all, and the CI job said so in its own output.
// It is also the module a fresh session's reorientation depends on, so an untested read
// path here means the first thing a new session believes is unverified.
//
// TWO RULES SHAPE EVERY TEST BELOW.
//
// 1. NO NETWORK, EVER. Nothing here may reach api.honcho.dev, and nothing here may cause
//    `loadHonchoEnv()` to read `C:/.fusion247/honcho.env` — that is credential material in
//    a deny-by-default store, and a test that touches it would be a boundary violation
//    wearing a test's clothes. Every read-path test drives the INJECTED `fetchPage` seam,
//    which sits above `hf()`, so the credential path is never entered.
//
// 2. NO WRITES INTO THE LIVE STORE. `buildPacket()` calls `nextSeq()`, which WRITES
//    ~/.mypka/governor/continuity-seq.json — Warwick's real continuity sequence. The
//    module resolves that path from `homedir()` at IMPORT time, so the suite redirects
//    USERPROFILE/HOME to a throwaway directory and then dynamically imports the module.
//    No seam was added to the source to make this possible: a seam introduced purely to
//    make a test convenient is a new mechanism, and the regrowth cap applies to test
//    affordances exactly as it applies to product code.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const SANDBOX_HOME = mkdtempSync(join(tmpdir(), 'governor-continuity-home-'));
const REAL_USERPROFILE = process.env.USERPROFILE;
const REAL_HOME = process.env.HOME;

let continuity;

before(async () => {
  // Redirect BEFORE the module is imported: STORE_DIR/STATE_FILE/SEQ_FILE are module
  // constants evaluated at load time off `homedir()`, and on Windows `os.homedir()` reads
  // USERPROFILE at call time. Setting it afterwards would be too late and the suite would
  // quietly write into the live store — the exact defect WO-OR-18 outcome 3 closes.
  process.env.USERPROFILE = SANDBOX_HOME;
  process.env.HOME = SANDBOX_HOME;
  continuity = await import(pathToFileURL(join(import.meta.dirname, 'continuity.mjs')).href);
});

after(() => {
  if (REAL_USERPROFILE === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = REAL_USERPROFILE;
  if (REAL_HOME === undefined) delete process.env.HOME;
  else process.env.HOME = REAL_HOME;
  rmSync(SANDBOX_HOME, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers — build the message shapes Honcho returns
// ---------------------------------------------------------------------------

// A message as `listMessages` sees it: the packet lives inside a fenced JSON block in the
// content. Mirrors `renderContent()` rather than restating a second format, because the
// parse under test is the inverse of that renderer.
function msg(packet, id = `m-${packet.id}`) {
  return { id, content: `⟦CONTINUITY⟧ header line\n\`\`\`json\n${JSON.stringify(packet)}\n\`\`\`` };
}

function packet({ seq, ts, backfill = false, focus = `focus-${seq}`, id = `cont-${seq}` }) {
  return { schema: 1, kind: 'continuity', id, ts, seq, backfill, focus, next_action: `next-${seq}` };
}

// A server that pages properly: `page` is honoured, 50 per page.
function pagingServer(packets, { pageSize = 50 } = {}) {
  const calls = [];
  const fetchPage = async ({ page, cursor }) => {
    calls.push({ page, cursor });
    const start = (page - 1) * pageSize;
    return { items: packets.slice(start, start + pageSize).map((p) => msg(p)) };
  };
  return { fetchPage, calls };
}

// ---------------------------------------------------------------------------
// THE DEFECT — a session holding more than one page
// ---------------------------------------------------------------------------

test('readLatest returns the genuinely newest packet when the session holds MORE than one page', async () => {
  // The live shape at the time this was found: 86 packets, 50 per page, and the old
  // single-request path could reach no further than seq 51 — roughly fifteen hours stale.
  const packets = [];
  for (let seq = 1; seq <= 86; seq++) {
    packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 0, 0, seq)).toISOString() }));
  }
  const { fetchPage, calls } = pagingServer(packets);

  const r = await continuity.readLatest({ fetchPage });

  assert.equal(r.latest.seq, 86, 'THE DEFECT: this returned seq 51, an early window presented as the newest');
  assert.equal(r.count, 86, 'every packet was read, not just the first page');
  assert.equal(r.complete, true);
  // 86 packets at 50 a page is one FULL page then a SHORT one, and a short page is the
  // end of the list — so two requests, not three. (This assertion originally said three:
  // the author's arithmetic was wrong, not the code's. Recorded because a test quietly
  // adjusted to match the code is indistinguishable from one that was always right.)
  assert.equal(calls.length, 2, 'one full page, then the short page that ends the walk');
  assert.deepEqual(calls.map((c) => c.page), [1, 2]);
});

test('MUTATION: a single-page read of the same store returns the STALE packet — the defect, reproduced', async () => {
  // Makes the test above fail-able by reproducing the OLD behaviour against the identical
  // fixture. If pagination silently stopped working, the test above would go red and this
  // one would still pass, so the pair distinguishes "fixed" from "fixture is too easy".
  const packets = [];
  for (let seq = 1; seq <= 86; seq++) {
    packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 0, 0, seq)).toISOString() }));
  }
  const onePageOnly = async ({ page }) => ({ items: page === 1 ? packets.slice(0, 50).map((p) => msg(p)) : [] });
  const stale = await continuity.readLatest({ fetchPage: onePageOnly, maxPages: 1 });
  assert.equal(stale.latest.seq, 50, 'the old path could not see past its first window');
  assert.notEqual(stale.latest.seq, 86, 'and that is exactly why a live session read a fifteen-hour-old focus');
});

test('readLatest walks a session that fits in ONE page without a wasted second request', async () => {
  const packets = [packet({ seq: 1, ts: '2026-08-01T00:00:01.000Z' }), packet({ seq: 2, ts: '2026-08-01T00:00:02.000Z' })];
  const { fetchPage, calls } = pagingServer(packets);
  const r = await continuity.readLatest({ fetchPage });
  assert.equal(r.latest.seq, 2);
  assert.equal(r.complete, true);
  assert.equal(calls.length, 1, 'a short page is the end of the list; asking again would be noise');
});

// ---------------------------------------------------------------------------
// CORRECT UNDER AN UNESTABLISHED CONTRACT — every plausible server behaviour
// ---------------------------------------------------------------------------
// Nobody has established this API's pagination contract. So each branch the code
// enumerates gets a server that behaves that way, and each must land somewhere SAFE.

test('a server that IGNORES `page` and re-serves one window terminates, and reports incomplete', async () => {
  // Without the repeat-detection guard this loops to the page cap on every call, turning
  // one request into forty against a live API. The answer must also not claim to be whole.
  const packets = [];
  for (let seq = 1; seq <= 50; seq++) packets.push(packet({ seq, ts: `2026-08-01T00:00:${String(seq % 60).padStart(2, '0')}.000Z` }));
  let calls = 0;
  const stuck = async () => { calls++; return { items: packets.map((p) => msg(p)) }; };

  const r = await continuity.readLatest({ fetchPage: stuck });
  assert.equal(calls, 2, 'one request, one confirmation that nothing new is coming — then stop');
  assert.equal(r.complete, false, 'and it must NOT present a truncated read as the last word');
  assert.equal(r.count, 50);
});

test('a server that REJECTS the follow-up request keeps page 1 rather than losing everything', async () => {
  const packets = [];
  for (let seq = 1; seq <= 50; seq++) packets.push(packet({ seq, ts: `2026-08-01T01:00:${String(seq % 60).padStart(2, '0')}.000Z` }));
  const rejectsPage2 = async ({ page }) => {
    if (page > 1) throw new Error('honcho POST /messages/list -> 422: unexpected field "page"');
    return { items: packets.map((p) => msg(p)) };
  };
  const r = await continuity.readLatest({ fetchPage: rejectsPage2 });
  assert.equal(r.count, 50, 'degrades to exactly the old behaviour, never to nothing');
  assert.equal(r.complete, false);
});

test('a FIRST-page failure still propagates — a broken Honcho must not read as an empty one', async () => {
  // The one failure that must NOT be swallowed. An unreachable Honcho reported as "no
  // packets" would tell a fresh session its focus is genuinely unknown, which is a lie
  // with the same shape as the truth.
  const dead = async () => { throw new Error('honcho POST /messages/list -> 503: upstream'); };
  await assert.rejects(() => continuity.readLatest({ fetchPage: dead }), /503/);
});

test('a CURSOR-based server is followed, and the cursor is echoed back', async () => {
  const packets = [];
  for (let seq = 1; seq <= 60; seq++) packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 2, 0, seq)).toISOString() }));
  const seen = [];
  const cursorServer = async ({ cursor }) => {
    seen.push(cursor);
    const start = cursor == null ? 0 : Number(cursor);
    const slice = packets.slice(start, start + 50);
    const next = start + 50 < packets.length ? String(start + 50) : null;
    return { items: slice.map((p) => msg(p)), next_cursor: next };
  };
  const r = await continuity.readLatest({ fetchPage: cursorServer });
  assert.equal(r.latest.seq, 60);
  assert.deepEqual(seen, [null, '50'], 'the cursor the server offered was sent back');
});

test('a NEWEST-FIRST server is handled without special-casing — the sort does the work', async () => {
  const packets = [];
  for (let seq = 1; seq <= 60; seq++) packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 3, 0, seq)).toISOString() }));
  const newestFirst = [...packets].reverse();
  const { fetchPage } = pagingServer(newestFirst);
  const r = await continuity.readLatest({ fetchPage });
  assert.equal(r.latest.seq, 60);
});

test('a server returning a BARE ARRAY rather than {items} is still read', async () => {
  const packets = [packet({ seq: 7, ts: '2026-08-01T04:00:00.000Z' })];
  const bare = async ({ page }) => (page === 1 ? packets.map((p) => msg(p)) : []);
  const r = await continuity.readLatest({ fetchPage: bare });
  assert.equal(r.latest.seq, 7);
});

test('the page walk is BOUNDED — a server that never repeats and never ends cannot spin forever', async () => {
  let calls = 0;
  const endless = async ({ page }) => {
    calls++;
    // 50 fresh packets every time, so the repeat guard never fires. Only the cap stops it.
    return { items: Array.from({ length: 50 }, (_, i) => msg(packet({ seq: page * 1000 + i, ts: new Date(Date.UTC(2026, 7, 2, 0, 0, i)).toISOString() }), `m-${page}-${i}`)) };
  };
  const r = await continuity.listAllMessages({ fetchPage: endless });
  assert.equal(calls, 40, 'MAX_LIST_PAGES is the backstop');
  assert.equal(r.complete, false, 'hitting the cap is not completion');
});

test('an empty session returns null rather than throwing', async () => {
  assert.equal(await continuity.readLatest({ fetchPage: async () => ({ items: [] }) }), null);
});

// ---------------------------------------------------------------------------
// PARSING — what counts as a continuity packet
// ---------------------------------------------------------------------------

test('non-continuity and unparseable messages are skipped, not crashed on', async () => {
  const good = packet({ seq: 5, ts: '2026-08-01T05:00:00.000Z' });
  const items = [
    { id: 'a', content: 'a plain chat message with no fenced block' },
    { id: 'b', content: '```json\n{ this is not json\n```' },
    { id: 'c', content: '```json\n{"kind":"something-else","ts":"2026-08-02T00:00:00.000Z","seq":99}\n```' },
    { id: 'd', content: null },
    msg(good),
  ];
  const r = await continuity.readLatest({ fetchPage: async ({ page }) => ({ items: page === 1 ? items : [] }) });
  assert.equal(r.count, 1, 'exactly one message was a continuity packet');
  assert.equal(r.latest.seq, 5);
});

test('MUTATION: a foreign packet with a NEWER timestamp must not win — `kind` is the filter', async () => {
  // Proves the filter above is load-bearing rather than incidentally satisfied. Drop the
  // `kind` check and this newer foreign record becomes the session's declared focus.
  const items = [
    msg(packet({ seq: 5, ts: '2026-08-01T05:00:00.000Z' })),
    { id: 'x', content: '```json\n{"kind":"telemetry","ts":"2026-09-01T00:00:00.000Z","seq":999,"focus":"WRONG"}\n```' },
  ];
  const r = await continuity.readLatest({ fetchPage: async ({ page }) => ({ items: page === 1 ? items : [] }) });
  assert.equal(r.latest.focus, 'focus-5');
  assert.notEqual(r.latest.focus, 'WRONG');
});

// ---------------------------------------------------------------------------
// SORT AND TIE-BREAK
// ---------------------------------------------------------------------------

test('packets are ordered by timestamp, newest first, regardless of arrival order', async () => {
  const items = [
    msg(packet({ seq: 2, ts: '2026-08-01T06:00:02.000Z' })),
    msg(packet({ seq: 9, ts: '2026-08-01T06:00:09.000Z' })),
    msg(packet({ seq: 4, ts: '2026-08-01T06:00:04.000Z' })),
  ];
  const r = await continuity.readLatest({ fetchPage: async ({ page }) => ({ items: page === 1 ? items : [] }) });
  assert.equal(r.latest.seq, 9);
});

test('TIE-BREAK 1: identical timestamps fall through to the higher seq', async () => {
  const ts = '2026-08-01T07:00:00.000Z';
  const items = [msg(packet({ seq: 3, ts })), msg(packet({ seq: 11, ts })), msg(packet({ seq: 7, ts }))];
  const r = await continuity.readLatest({ fetchPage: async ({ page }) => ({ items: page === 1 ? items : [] }) });
  assert.equal(r.latest.seq, 11, 'seq is the monotonic writer, so it settles a timestamp tie');
});

test('TIE-BREAK 2: same timestamp AND same seq — a LIVE packet beats a BACKFILL', async () => {
  // Backfill is reconstructed from durable evidence after the fact; a live packet with the
  // same coordinates was actually captured at the time and is the better answer.
  const ts = '2026-08-01T08:00:00.000Z';
  const live = packet({ seq: 4, ts, backfill: false, id: 'cont-live' });
  const back = packet({ seq: 4, ts, backfill: true, id: 'cont-backfill' });

  for (const order of [[back, live], [live, back]]) {
    const r = await continuity.readLatest({
      fetchPage: async ({ page }) => ({ items: page === 1 ? order.map((p) => msg(p)) : [] }),
    });
    assert.equal(r.latest.id, 'cont-live', `live must win regardless of arrival order (${order.map((p) => p.id)})`);
  }
});

test('MUTATION: the tie-break is REACHED — with the live packet removed, the backfill is returned', async () => {
  // Without this, "live wins" would also pass if the backfill were being dropped entirely
  // by some other filter, which would be a different and much worse behaviour.
  const ts = '2026-08-01T08:00:00.000Z';
  const back = packet({ seq: 4, ts, backfill: true, id: 'cont-backfill' });
  const r = await continuity.readLatest({ fetchPage: async ({ page }) => ({ items: page === 1 ? [msg(back)] : [] }) });
  assert.equal(r.latest.id, 'cont-backfill', 'a backfill is still a packet');
});

test('a packet with an unparseable ts sorts below a real one rather than throwing', async () => {
  const items = [
    msg(packet({ seq: 1, ts: 'whenever', id: 'cont-bad' })),
    msg(packet({ seq: 2, ts: '2026-08-01T09:00:00.000Z', id: 'cont-good' })),
  ];
  const r = await continuity.readLatest({ fetchPage: async ({ page }) => ({ items: page === 1 ? items : [] }) });
  assert.equal(r.latest.id, 'cont-good');
});

// ---------------------------------------------------------------------------
// buildPacket — privacy rules and shape
// ---------------------------------------------------------------------------

test('buildPacket carries the state fields through and stamps identity', async () => {
  const p = continuity.buildPacket(
    { focus: 'Phase 7 closeout', next_action: 'hand back', accepted_decisions: ['a', 'b'], completed: [], blockers: [], notes: null },
    { reason: 'stop', sessionId: 'sess-1' }
  );
  assert.equal(p.kind, 'continuity');
  assert.equal(p.schema, 1);
  assert.equal(p.focus, 'Phase 7 closeout');
  assert.equal(p.session_id, 'sess-1');
  assert.equal(p.reason, 'stop');
  assert.equal(p.backfill, false);
  assert.equal(p.sensitivity, 'ordinary');
  assert.match(p.ts, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof p.seq, 'number');
});

test('seq is MONOTONIC across calls — it is what settles a timestamp tie', async () => {
  const a = continuity.buildPacket({ focus: 'a' }, {});
  const b = continuity.buildPacket({ focus: 'b' }, {});
  assert.equal(b.seq, a.seq + 1);
});

test('PRIVACY: a restricted field is WITHHELD and the packet is marked restricted', async () => {
  const p = continuity.buildPacket({ focus: 'discussing a medical appointment', next_action: 'ordinary text' }, {});
  assert.equal(p.focus, '[withheld: restricted per privacy rules]');
  assert.equal(p.sensitivity, 'restricted');
  assert.equal(p.next_action, 'ordinary text', 'only the offending field is withheld, not the whole packet');
});

test('PRIVACY MUTATION: the ordinary case is NOT withheld — the pattern is selective', async () => {
  // A rule that withheld everything would pass the test above and destroy the feature.
  const p = continuity.buildPacket({ focus: 'ordinary engineering work', next_action: 'carry on' }, {});
  assert.equal(p.focus, 'ordinary engineering work');
  assert.equal(p.sensitivity, 'ordinary');
});

test('PRIVACY: restricted content inside a LIST is withheld too', async () => {
  const p = continuity.buildPacket({ focus: 'fine', blockers: ['normal blocker', 'the api_key rotated'] }, {});
  assert.equal(p.blockers[1], '[withheld: restricted per privacy rules]');
  assert.equal(p.blockers[0], 'normal blocker');
  assert.equal(p.sensitivity, 'restricted');
});

test('fields are LENGTH-CAPPED and lists are truncated', async () => {
  const p = continuity.buildPacket(
    { focus: 'x'.repeat(5000), completed: Array.from({ length: 40 }, (_, i) => `item ${i}`) },
    {}
  );
  assert.equal(p.focus.length, 600, 'FIELD_CAP');
  assert.ok(p.focus.endsWith('…'), 'and the truncation is visible rather than silent');
  assert.equal(p.completed.length, 8, 'LIST_CAP');
});

// ---------------------------------------------------------------------------
// Local state — and the proof this suite is not touching the real one
// ---------------------------------------------------------------------------

test('saveState/loadState round-trip through the redirected store', async () => {
  continuity.saveState({ focus: 'sandbox focus', next_action: 'sandbox next' });
  const s = continuity.loadState();
  assert.equal(s.focus, 'sandbox focus');
  assert.equal(s.next_action, 'sandbox next');
  assert.match(s.updated_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('CONTAINMENT: every write this suite makes landed in the SANDBOX, not the real store', async () => {
  // The proof for WO-OR-18 outcome 3 as it applies to THIS module. `buildPacket` above
  // called `nextSeq()`, which writes continuity-seq.json; `saveState` wrote
  // continuity.json. Both must be here and not in Warwick's ~/.mypka/governor/.
  const dir = join(SANDBOX_HOME, '.mypka', 'governor');
  assert.equal(existsSync(dir), true, 'CONTROL: the module really did write somewhere — an empty sandbox would prove nothing');
  const files = readdirSync(dir).sort();
  assert.ok(files.includes('continuity-seq.json'), `seq file must be in the sandbox — found: ${files}`);
  assert.ok(files.includes('continuity.json'), `state file must be in the sandbox — found: ${files}`);
});

test('CONTAINMENT MUTATION: the redirect is what steers it — the module resolves its store under the sandbox', async () => {
  // Makes the containment test fail-able. If USERPROFILE were being ignored, STATE_FILE
  // would point at the real home and the assertion above could still pass on a stale
  // sandbox directory left by an earlier run.
  assert.ok(
    continuity.STATE_FILE.startsWith(SANDBOX_HOME),
    `the module's own state path must be inside the sandbox — got ${continuity.STATE_FILE}`
  );
});
