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
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
  for (const h of CLI_HOMES) rmSync(h, { recursive: true, force: true });
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

function packet({ seq, ts, backfill = false, focus = `focus-${seq}`, id = `cont-${seq}`, map_path = 'Deliverables/2026-08-02-wayfinder-operating-reset-plan.md' }) {
  return { schema: 1, kind: 'continuity', id, ts, seq, backfill, focus, map_path, next_action: `next-${seq}` };
}

// WP-2B(2). `readContinuityBrief` now checks the recorded map path against the READER's own
// repository before rendering it as the active map, so every brief test is implicitly a
// presence test unless it says otherwise. This seam reports the recorded path PRESENT.
//
// The tests that use it are about pagination and focus recency, and they asserted those
// properties before this check existed; injecting presence keeps them asserting exactly what
// they always asserted instead of silently becoming presence tests too. They would in fact
// pass against the real seam today — the fixture's default `map_path` is a map that really
// is on disk here — and that is precisely the reason NOT to leave it implicit: the day that
// map is renamed, two pagination tests would fail for a reason that has nothing to do with
// pagination. Presence itself is proven separately below, negative case and real-seam
// control included.
const MAP_PRESENT_IO = {
  run: (args) => (args[0] === 'rev-parse' ? '/fake/reader/root\n' : ''),
  statSync: () => ({ isFile: () => true }),
};

// A server that behaves like the DOCUMENTED one (WO-OR-21): it honours the `size` it is
// asked for, honours `page`, honours `reverse`, and returns the real five-field envelope
// {items, total, page, size, pages}.
//
// BEFORE WO-OR-21 this fixture served a fixed 50 per page and returned {items} alone — it
// modelled a server nobody had established. It now models the contract in
// Deliverables/2026-08-02-pax-honcho-messages-list-contract.md. That is why several call
// counts below moved: the client asks for 100 now, so fewer round trips are needed for the
// same fixture. Every such change is listed in the handback with its before, after and reason.
function pagingServer(packets, { pageSize = null } = {}) {
  const calls = [];
  const fetchPage = async ({ page, cursor, size, reverse }) => {
    calls.push({ page, cursor, size, reverse });
    const eff = pageSize ?? size ?? 50;
    const ordered = reverse ? [...packets].slice().reverse() : packets;
    const start = (page - 1) * eff;
    return {
      items: ordered.slice(start, start + eff).map((p) => msg(p)),
      total: packets.length,
      page,
      size: eff,
      pages: Math.ceil(packets.length / eff),
    };
  };
  return { fetchPage, calls };
}

// A transport spy standing where `hf()` stands. It records the exact (path, options) pair
// `fetchMessagePage` produces and answers with an empty documented envelope. Nothing here
// reaches the network and nothing enters loadHonchoEnv().
function transportSpy(response = { items: [], total: 0, page: 1, size: 100, pages: 0 }) {
  const sent = [];
  const request = async (path, opts) => { sent.push({ path, opts }); return response; };
  return { request, sent };
}

// ---------------------------------------------------------------------------
// THE REQUEST SHAPE — the entire defect, asserted directly (WO-OR-21)
// ---------------------------------------------------------------------------
// `page`, `size` and `reverse` are QUERY-STRING parameters. The request body model accepts
// exactly one property, `filters`. Sending them in the body made the server discard them in
// silence and apply its own defaults (page=1, size=50, reverse=false, oldest-first) — no 400,
// no warning, just plausible default-shaped data.
//
// THIS IS WHY THESE TESTS ASSERT THE REQUEST AND NOT THE RESPONSE. A parameter in the wrong
// LOCATION is indistinguishable from a server that ignores you, so a test that only checked
// the returned packet would have passed against the broken code. These are the assertions
// that must go red when the mutation moves the fields back into the body.

test('REQUEST SHAPE: the default request is byte-for-byte the documented call', async () => {
  const { request, sent } = transportSpy();
  await continuity.fetchMessagePage({ request });

  assert.equal(sent.length, 1, 'exactly one request was built');
  // The literal is held HERE, in the test, not derived from the module it checks — a
  // constant compared against itself proves nothing.
  assert.equal(
    sent[0].path,
    '/workspaces/{ws}/sessions/larry-continuity/messages/list?reverse=true&size=100&page=1',
    'this string is what Pax documented; compare it to the brief character by character'
  );
  assert.equal(continuity.CONTINUITY_SESSION, 'larry-continuity', 'and the session in that path is the real one');
  assert.equal(sent[0].opts.method, 'POST');
});

test('REQUEST SHAPE: page/size/reverse are in the QUERY STRING, parsed rather than string-matched', async () => {
  const { request, sent } = transportSpy();
  await continuity.fetchMessagePage({ page: 3, request });

  const [route, qs] = sent[0].path.split('?');
  assert.equal(route, '/workspaces/{ws}/sessions/larry-continuity/messages/list');
  assert.ok(qs, 'THE DEFECT: there was no query string at all — every field was in the body');

  const q = new URLSearchParams(qs);
  assert.equal(q.get('reverse'), 'true', 'newest-first, or readLatest is handed the oldest window');
  assert.equal(q.get('size'), '100', 'the documented MAXIMUM; 50 was only ever the default');
  assert.equal(q.get('page'), '3', 'and `page` is honoured rather than silently dropped');
});

test('REQUEST SHAPE: the BODY carries no pagination field — the model accepts only `filters`', async () => {
  const { request, sent } = transportSpy();
  await continuity.fetchMessagePage({ page: 2, request });

  const body = sent[0].opts.body;
  assert.ok(body && typeof body === 'object', 'a body is still sent');
  for (const forbidden of ['page', 'size', 'reverse', 'cursor', 'offset', 'limit', 'order', 'sort']) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(body, forbidden), false,
      `THE DEFECT: \`${forbidden}\` in the body is discarded in silence — the server never says so`
    );
  }
  assert.deepEqual(
    Object.keys(body).filter((k) => k !== 'filters'), [],
    'the body model has exactly one property, `filters`; anything else is dropped'
  );
});

test('REQUEST SHAPE: the walker drives the same builder — size and reverse reach the transport', async () => {
  // Proves the query string is not merely computed correctly in isolation but is what an
  // actual readLatest() call produces. "The right value computed somewhere it is never used"
  // is the shape of the bug being fixed, so the two halves are joined here.
  const { request, sent } = transportSpy({
    items: [msg(packet({ seq: 1, ts: '2026-08-01T00:00:01.000Z' }))], total: 1, page: 1, size: 100, pages: 1,
  });
  const r = await continuity.readLatest({ fetchPage: (args) => continuity.fetchMessagePage({ ...args, request }) });

  assert.equal(r.latest.seq, 1);
  assert.equal(sent.length, 1);
  const q = new URLSearchParams(sent[0].path.split('?')[1]);
  assert.equal(q.get('reverse'), 'true');
  assert.equal(q.get('size'), '100');
  assert.equal(q.get('page'), '1');
});

test('SIZE GUARD: over 100 is REFUSED before anything is sent — 422, not a clamp', async () => {
  // The old code read `size: 500 -> 50` as a server-side clamp. It was not: the body was
  // being discarded and the default applied. Sent as a query parameter, 500 is an HTTP 422.
  // Code written on the "it clamps" assumption fails differently than expected.
  const { request, sent } = transportSpy();
  await assert.rejects(
    () => continuity.fetchMessagePage({ size: 500, request }),
    /size must be an integer 1\.\.100/,
  );
  assert.equal(sent.length, 0, 'and nothing was put on the wire');
});

test('SIZE GUARD: the boundary is swept, not spot-checked — 1 and 100 pass, 0 and 101 do not', async () => {
  // A guard tested only at 500 would also pass if it were written `> 400`. The interesting
  // values are the ones either side of the limit.
  for (const ok of [1, 100]) {
    const { request, sent } = transportSpy();
    await continuity.fetchMessagePage({ size: ok, request });
    assert.equal(new URLSearchParams(sent[0].path.split('?')[1]).get('size'), String(ok), `size=${ok} must be allowed`);
  }
  for (const bad of [0, 101, -1, 1.5, '100', NaN]) {
    const { request, sent } = transportSpy();
    await assert.rejects(() => continuity.fetchMessagePage({ size: bad, request }), /size must be an integer/, `size=${String(bad)} must be refused`);
    assert.equal(sent.length, 0);
  }
});

test('PAGE GUARD: page is 1-based — page 0 is refused rather than sent as a 422', async () => {
  const { request, sent } = transportSpy();
  await assert.rejects(() => continuity.fetchMessagePage({ page: 0, request }), /page must be an integer >= 1/);
  assert.equal(sent.length, 0);
});

// ---------------------------------------------------------------------------
// THE DEFECT — the newest packet is returned, not an early window
// ---------------------------------------------------------------------------

test('readLatest returns the genuinely newest packet — 86 packets, ONE request at size 100', async () => {
  // The live shape when this was found: 86 packets, and the old path could reach no further
  // than seq 51 — roughly fifteen hours stale.
  //
  // WO-OR-21 CHANGED THE ARITHMETIC, NOT THE GUARANTEE. Under the documented contract the
  // client asks for size=100, so all 86 arrive in ONE response and `pages` is 1. Previously
  // this fixture served 50 a page and the walk took two requests.
  //   calls.length   2 -> 1
  //   calls[].page   [1, 2] -> [1]
  // The guarantee under test — the NEWEST packet is returned and every packet is read — is
  // unchanged, and the multi-page walk keeps its own dedicated proof in the next test.
  const packets = [];
  for (let seq = 1; seq <= 86; seq++) {
    packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 0, 0, seq)).toISOString() }));
  }
  const { fetchPage, calls } = pagingServer(packets);

  const r = await continuity.readLatest({ fetchPage });

  assert.equal(r.latest.seq, 86, 'THE DEFECT: this returned seq 51, an early window presented as the newest');
  assert.equal(r.count, 86, 'every packet was read');
  assert.equal(r.complete, true);
  assert.equal(calls.length, 1, '86 fits inside one size=100 page, so one request is the whole read');
  assert.deepEqual(calls.map((c) => c.page), [1]);
  assert.equal(calls[0].size, 100, 'and it asked for 100, which is what makes one request enough');
  assert.equal(calls[0].reverse, true);
});

test('MULTI-PAGE: a session PAST 100 is walked to `pages` and the newest is still returned', async () => {
  // ADDED at WO-OR-21. Today's 86 packets fit in a single request, so without this the
  // walker becomes untested at the exact moment it becomes correct. 250 packets at size 100
  // is 3 pages, and termination is `page >= pages` from the envelope.
  const packets = [];
  for (let seq = 1; seq <= 250; seq++) {
    packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 0, 0, 0, seq)).toISOString() }));
  }
  const { fetchPage, calls } = pagingServer(packets);

  const r = await continuity.readLatest({ fetchPage });

  assert.equal(r.latest.seq, 250, 'the newest packet in the store, not the newest of page 1');
  assert.equal(r.count, 250, 'all three pages were read');
  assert.equal(r.complete, true, 'and the walk finished for a POSITIVE reason: page >= pages');
  assert.equal(calls.length, 3, 'ceil(250/100) — no more, and crucially no fewer');
  assert.deepEqual(calls.map((c) => c.page), [1, 2, 3], 'page is incremented and honoured');
  assert.equal(r.pages, 3);
});

test('TERMINATION: `page >= pages` ends the walk with no wasted probe, even on an EXACT page multiple', async () => {
  // This is the test that pins the documented termination rule specifically, and it exists
  // because mutation M5 (deleting the `pages` branch) left the MULTI-PAGE test green: at 250
  // packets the final page is short, so the fallback rescued it and the rule under test was
  // never the thing being measured.
  //
  // 200 packets at size 100 is exactly 2 full pages. Nothing is short, no cursor is offered,
  // and the repeat guard cannot fire. `pages` is the ONLY signal that page 2 is the last one.
  // Without it the walker must ask for a page 3 that does not exist — so the third call is
  // the tell, and asserting there are only two is what makes the rule load-bearing.
  const packets = [];
  for (let seq = 1; seq <= 200; seq++) {
    packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 6, 0, 0, 0, seq)).toISOString() }));
  }
  const { fetchPage, calls } = pagingServer(packets);

  const r = await continuity.readLatest({ fetchPage });

  assert.equal(r.latest.seq, 200);
  assert.equal(r.count, 200);
  assert.equal(r.complete, true);
  assert.equal(calls.length, 2, 'ceil(200/100) = 2, and `pages` is the only thing that says so');
  assert.deepEqual(calls.map((c) => c.page), [1, 2], 'no speculative page 3');
});

test('MULTI-PAGE MUTATION: against a server that IGNORES `reverse`, only the full walk finds the newest', async () => {
  // Without this, "the newest is returned" would also pass trivially, because reverse=true
  // puts the newest on page 1 by design. So the mutation removes that comfort: this server
  // hands back oldest-first whatever it is asked, which is exactly the hedge the defensive
  // sort and the full walk exist for. Page 1 then tops out at seq 100 and the answer is only
  // correct if pages 2 and 3 were genuinely fetched.
  const packets = [];
  for (let seq = 1; seq <= 250; seq++) {
    packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 0, 0, 0, seq)).toISOString() }));
  }
  const oldestFirstAlways = async ({ page, size }) => ({
    items: packets.slice((page - 1) * size, page * size).map((p) => msg(p)),
    total: packets.length, page, size, pages: Math.ceil(packets.length / size),
  });

  const truncated = await continuity.readLatest({ fetchPage: oldestFirstAlways, maxPages: 1 });
  assert.equal(truncated.latest.seq, 100, 'page 1 alone tops out at seq 100 — the stale answer');
  assert.equal(truncated.complete, false, 'and a truncated read must say so rather than look finished');

  const full = await continuity.readLatest({ fetchPage: oldestFirstAlways });
  assert.equal(full.latest.seq, 250, 'the full walk plus the defensive sort recover the genuinely newest');
  assert.equal(full.complete, true);
});

test('MUTATION: a single-page read of the same store returns the STALE packet — the defect, reproduced', async () => {
  // Makes the tests above fail-able by reproducing the OLD behaviour against the same
  // fixture. If pagination silently stopped working, those would go red and this one would
  // still pass, so the pair distinguishes "fixed" from "fixture is too easy".
  //
  // WO-OR-21: the fixture now returns the documented envelope declaring `pages: 2`, so the
  // truncation is visible to the walker and `complete: false` became assertable. That
  // assertion is ADDED, not relaxed.
  const packets = [];
  for (let seq = 1; seq <= 86; seq++) {
    packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 0, 0, seq)).toISOString() }));
  }
  const onePageOnly = async ({ page }) => ({
    items: page === 1 ? packets.slice(0, 50).map((p) => msg(p)) : [],
    total: 86, page, size: 50, pages: 2,
  });
  const stale = await continuity.readLatest({ fetchPage: onePageOnly, maxPages: 1 });
  assert.equal(stale.latest.seq, 50, 'the old path could not see past its first window');
  assert.notEqual(stale.latest.seq, 86, 'and that is exactly why a live session read a fifteen-hour-old focus');
  assert.equal(stale.complete, false, 'a read that stopped short of `pages` is not complete');
});

test('readLatest walks a session that fits in ONE page without a wasted second request', async () => {
  const packets = [packet({ seq: 1, ts: '2026-08-01T00:00:01.000Z' }), packet({ seq: 2, ts: '2026-08-01T00:00:02.000Z' })];
  const { fetchPage, calls } = pagingServer(packets);
  const r = await continuity.readLatest({ fetchPage });
  assert.equal(r.latest.seq, 2);
  assert.equal(r.complete, true);
  assert.equal(calls.length, 1, 'page >= pages on the first response; asking again would be noise');
});

// ---------------------------------------------------------------------------
// THE DEFENSIVE BRANCHES — kept, because two things are still NOT established
// ---------------------------------------------------------------------------
// The pagination contract is now documented and cross-confirmed. Two things are not: the
// API's rate limits (NOT FOUND in any official source — unknown, not unlimited), and whether
// the deployed server matches the `main` branch that was read. So each branch the code still
// carries gets a server that behaves that way, and each must land somewhere SAFE.
//
// These servers return no `pages` field, which is what puts the code on its fallback path.
// A "full window" is 100 here rather than 50 because the client now ASKS for 100; a 50-item
// response to a size=100 request is a legitimately short final page, not a stuck server.
// (fixture size 50 -> 100, and the count assertions with it: 50 -> 100.)

test('a server that IGNORES `page` and re-serves one window terminates, and reports incomplete', async () => {
  // Without the repeat-detection guard this loops to the page cap on every call, turning
  // one request into forty against a live API. The answer must also not claim to be whole.
  const packets = [];
  for (let seq = 1; seq <= 100; seq++) packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 0, 0, seq)).toISOString() }));
  let calls = 0;
  const stuck = async () => { calls++; return { items: packets.map((p) => msg(p)) }; };

  const r = await continuity.readLatest({ fetchPage: stuck });
  assert.equal(calls, 2, 'one request, one confirmation that nothing new is coming — then stop');
  assert.equal(r.complete, false, 'and it must NOT present a truncated read as the last word');
  assert.equal(r.count, 100);
});

test('a server that REJECTS the follow-up request keeps page 1 rather than losing everything', async () => {
  const packets = [];
  for (let seq = 1; seq <= 100; seq++) packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 1, 1, 0, seq)).toISOString() }));
  const rejectsPage2 = async ({ page }) => {
    if (page > 1) throw new Error('honcho POST /messages/list -> 422: unexpected field "page"');
    return { items: packets.map((p) => msg(p)) };
  };
  const r = await continuity.readLatest({ fetchPage: rejectsPage2 });
  assert.equal(r.count, 100, 'degrades to exactly the old behaviour, never to nothing');
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
  const endless = async ({ page, size }) => {
    calls++;
    // A FULL page of fresh packets every time, so neither the repeat guard nor the
    // short-page rule fires. Only the cap stops it. (fixture 50 -> `size`, i.e. 100: a
    // 50-item answer to a size=100 request would now legitimately read as a short final page.)
    return { items: Array.from({ length: size }, (_, i) => msg(packet({ seq: page * 1000 + i, ts: new Date(Date.UTC(2026, 7, 2, 0, 0, i)).toISOString() }), `m-${page}-${i}`)) };
  };
  const r = await continuity.listAllMessages({ fetchPage: endless });
  assert.equal(calls, 40, 'MAX_LIST_PAGES is the backstop');
  assert.equal(r.complete, false, 'hitting the cap is not completion');
});

test('INCOMPLETENESS SIGNAL: a session that outgrows the page cap is reported incomplete, not truncated in silence', async () => {
  // The documented-contract version of the cap case, and the reason `complete` still earns
  // its keep now that the contract is known: a server can honestly declare more pages than
  // the walk is willing to make. 4,100 messages at size 100 is 41 pages against a cap of 40.
  const big = async ({ page, size }) => ({
    items: Array.from({ length: size }, (_, i) => msg(packet({ seq: page * 1000 + i, ts: new Date(Date.UTC(2026, 7, 3, 0, 0, i)).toISOString() }), `b-${page}-${i}`)),
    total: 4100, page, size, pages: 41,
  });
  const r = await continuity.listAllMessages({ fetchPage: big });
  assert.equal(r.pages, 40, 'it walked to its own bound');
  assert.equal(r.complete, false, 'and 40 of a declared 41 is NOT complete');
});

test('INCOMPLETENESS SIGNAL: it does NOT fire on the normal path — a warning that always fires is one nobody reads', async () => {
  const packets = [];
  for (let seq = 1; seq <= 86; seq++) packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 4, 0, 0, seq)).toISOString() }));
  const { fetchPage } = pagingServer(packets);
  const r = await continuity.readLatest({ fetchPage });
  assert.equal(r.complete, true, 'the ordinary case must be silent, or the signal is worthless');
});

test('THE BRIEF: the ⚠️ PAGINATION INCOMPLETE warning reaches the session that reads it', async () => {
  // The user-visible half of the signal. `complete: false` inside readLatest is only useful
  // if it survives into the text a fresh session actually sees, and that text is the whole
  // reason this module exists.
  const packets = [];
  for (let seq = 1; seq <= 86; seq++) packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 5, 0, 0, seq)).toISOString() }));
  const truncated = async ({ page }) => ({
    items: page === 1 ? packets.slice(0, 50).map((p) => msg(p)) : [],
    total: 86, page, size: 50, pages: 2,
  });
  const brief = await continuity.readContinuityBrief({ fetchPage: truncated, maxPages: 1, git: MAP_PRESENT_IO });
  assert.match(brief, /PAGINATION INCOMPLETE/, 'a truncated read must announce itself in the brief');
  assert.match(brief, /prefer the git map/);
});

test('THE BRIEF MUTATION: on a complete read the warning is ABSENT and the newest focus is presented', async () => {
  // Makes the test above fail-able: a brief that always carried the warning would pass it
  // while telling every session to distrust a perfectly good packet.
  const packets = [];
  for (let seq = 1; seq <= 86; seq++) packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 5, 1, 0, seq)).toISOString() }));
  const { fetchPage } = pagingServer(packets);
  const brief = await continuity.readContinuityBrief({ fetchPage, git: MAP_PRESENT_IO });
  assert.doesNotMatch(brief, /PAGINATION INCOMPLETE/, 'the ordinary case must be clean');
  assert.match(brief, /focus-86/, 'and it must carry the NEWEST focus, not an earlier one');
  assert.doesNotMatch(brief, /focus-51\b/, 'seq 51 was the stale answer the old path returned');
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

// ---------------------------------------------------------------------------
// WO-OR-23 — `write` must honour its arguments, or stop
// ---------------------------------------------------------------------------
//
// THE DEFECT. `write --focus NEW` returned {"ok":true} with a fresh packet id and exit 0
// while delivering the OLD stored focus: `--focus` was a FALLBACK applied only to an empty
// stored focus, and --next/--objective/--request/--decision/--completed/--blocker/--notes
// were not consulted by `write` at all. Same class as the pagination bug above — a parameter
// accepted and silently discarded, producing plausible, correctly-shaped output.
//
// WHY THESE TESTS DRIVE THE REAL CLI IN A CHILD PROCESS RATHER THAN A HELPER.
// The defect was never in a computation; it was that a correctly-computed value never reached
// the wire. "The right value computed somewhere it is never used" is the precise shape of the
// bug, so every assertion below is made on the BYTES HANDED TO `deliver()` and on the process
// EXIT CODE — never on a helper's return value. A unit test of the argument planner would
// have proved the planner correct and the product still broken.
//
// AND WHY IT IS SAFE. Two boundaries are respected, both by construction:
//   * NO NETWORK. `globalThis.fetch` is replaced in the child before the module loads, via a
//     data: URL passed to `--import`. Nothing reaches api.honcho.dev. If the stub ever failed
//     to install, the import would abort the child and every test here would fail loudly
//     rather than quietly dial out.
//   * NO CREDENTIAL READ. `loadHonchoEnv()` returns at its first line when HONCHO_API_KEY is
//     already set, so a DUMMY key stops it opening C:/.fusion247/honcho.env — credential
//     material in a deny-by-default store (GL-012). A test that opened it would be a boundary
//     violation wearing a test's clothes.
// Each child also gets its own throwaway HOME, so no CLI test touches the real continuity
// store, this suite's own sandbox, or another test's state.

const CLI_HOMES = [];
const CLI_MODULE = join(import.meta.dirname, 'continuity.mjs');
const FETCH_STUB = 'data:text/javascript,' + encodeURIComponent(`
  import { appendFileSync } from 'node:fs';
  const capture = process.env.CONTINUITY_TEST_CAPTURE;
  globalThis.fetch = async (url, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : null;
    if (capture && body && Array.isArray(body.messages)) {
      appendFileSync(capture, body.messages[0].content + '\\n@@PACKET@@\\n', 'utf8');
    }
    return new Response(JSON.stringify([{ id: 'stub-message-id' }]), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
`);

function cliHome() {
  const home = mkdtempSync(join(tmpdir(), 'governor-continuity-cli-'));
  CLI_HOMES.push(home);
  return home;
}

// Run the real CLI. Returns the exit code, both streams, EVERY packet the transport was
// handed (parsed out of the fenced JSON block `renderContent` emits), and the on-disk state
// file — which is how "did this persist?" is answered by looking, not by believing.
function runCli(home, args, { stdin = '' } = {}) {
  const capture = join(home, 'delivered.log');
  const res = spawnSync(process.execPath, ['--import', FETCH_STUB, CLI_MODULE, ...args], {
    encoding: 'utf8',
    input: stdin,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      HONCHO_API_KEY: 'dummy-key-this-is-not-a-credential',
      HONCHO_WORKSPACE: 'wo-or-23-test-workspace',
      CONTINUITY_TEST_CAPTURE: capture,
    },
  });
  const raw = existsSync(capture) ? readFileSync(capture, 'utf8') : '';
  const delivered = [...raw.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => JSON.parse(m[1].trim()));
  const stateFile = join(home, '.mypka', 'governor', 'continuity.json');
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    delivered,
    packet: delivered.length ? delivered[delivered.length - 1] : null,
    state: existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null,
    report: (() => { try { return JSON.parse(res.stdout); } catch { return null; } })(),
  };
}

// The stored state every override test starts from: NON-EMPTY in every field, because the
// defect only bit when there was something to be beaten. A fixture with an empty focus is
// precisely the fixture that made the old `--focus` fallback look like it worked.
function seedState(home) {
  const r = runCli(home, [
    'set',
    '--focus', 'OLD-STORED-FOCUS',
    '--immediate_objective', 'OLD-OBJECTIVE',
    '--warwick_last_request', 'OLD-REQUEST',
    '--next_action', 'OLD-NEXT-ACTION',
    '--notes', 'OLD-NOTES',
    '--accepted_decisions', 'OLD-DECISION',
    '--completed', 'OLD-COMPLETED',
    '--blockers', 'OLD-BLOCKER',
  ]);
  assert.equal(r.status, 0, 'CONTROL: the seed itself must succeed, or nothing below means anything');
  assert.equal(r.state.focus, 'OLD-STORED-FOCUS', 'CONTROL: stored focus is NON-EMPTY, which is the condition the defect needed');
  return r;
}

test('WO-OR-23 OVERRIDE: a supplied --focus BEATS a non-empty stored focus — the regression that bit', async () => {
  // THE ONE THAT WENT RED UNDER THE FALLBACK-ONLY MUTATION. With a stored focus present the
  // old code kept it and discarded the flag, returning ok:true over a stale packet.
  const home = cliHome();
  seedState(home);

  const r = runCli(home, ['write', '--focus', 'NEW-MARKER-OVERRIDE']);

  assert.equal(r.status, 0, `write must succeed: ${r.stderr}`);
  assert.equal(r.delivered.length, 1, 'CONTROL: exactly one packet reached the transport — an undelivered write proves nothing');
  assert.equal(r.packet.focus, 'NEW-MARKER-OVERRIDE', 'THE DEFECT: this delivered OLD-STORED-FOCUS while reporting ok:true');
  assert.notEqual(r.packet.focus, 'OLD-STORED-FOCUS');
});

test('WO-OR-23 ENUMERATION: every argument `write` accepts reaches the delivered packet', async () => {
  // ENUMERATED, NOT SPOT-CHECKED, and that is the whole discipline here: the defect survived
  // because --focus LOOKED like it worked (it did, on empty state), so one happy-path test
  // would have passed. All ten accepted arguments are supplied at once over a fully populated
  // OLD state, which also proves no field clobbers another on the way through.
  const home = cliHome();
  seedState(home);

  const r = runCli(home, [
    'write',
    '--focus', 'NEW-FOCUS',
    '--immediate_objective', 'NEW-OBJECTIVE',
    '--warwick_last_request', 'NEW-REQUEST',
    '--next_action', 'NEW-NEXT-ACTION',
    '--notes', 'NEW-NOTES',
    '--accepted_decisions', 'NEW-DECISION-1',
    '--accepted_decisions', 'NEW-DECISION-2',
    '--completed', 'NEW-COMPLETED',
    '--blockers', 'NEW-BLOCKER',
    '--session', 'NEW-SESSION-ID',
    '--backfill', 'true',
  ]);

  assert.equal(r.status, 0, `write must succeed: ${r.stderr}`);
  const p = r.packet;
  assert.ok(p, 'CONTROL: a packet was delivered');

  // 8 state fields...
  assert.equal(p.focus, 'NEW-FOCUS');
  assert.equal(p.immediate_objective, 'NEW-OBJECTIVE');
  assert.equal(p.warwick_last_request, 'NEW-REQUEST');
  assert.equal(p.next_action, 'NEW-NEXT-ACTION');
  assert.equal(p.notes, 'NEW-NOTES');
  assert.deepEqual(p.accepted_decisions, ['NEW-DECISION-1', 'NEW-DECISION-2'], 'a repeatable field accumulates rather than overwriting itself');
  assert.deepEqual(p.completed, ['NEW-COMPLETED']);
  assert.deepEqual(p.blockers, ['NEW-BLOCKER']);
  // ...and the 2 control flags, which are arguments too and must not be forgotten.
  assert.equal(p.session_id, 'NEW-SESSION-ID');
  assert.equal(p.backfill, true);

  // Nothing from the seed may survive anywhere in the packet. This catches a field that was
  // merged into state but read from the wrong place on the way out.
  assert.doesNotMatch(JSON.stringify(p), /OLD-/, 'no stored value may leak into a fully-overridden packet');

  // And the output enumerates the same eight back to the operator.
  assert.deepEqual(
    r.report.overrode,
    ['accepted_decisions', 'blockers', 'completed', 'focus', 'immediate_objective', 'next_action', 'notes', 'warwick_last_request'],
  );
});

test('WO-OR-23 PERSIST: an override reaches STATE_FILE, so the next turn-end cannot bury it', async () => {
  // Warwick's requirement is that supplied arguments override stored VALUES. Packet-only
  // would not have met it: `stop` fires per turn, reloads STATE_FILE and delivers the OLD
  // focus with a NEWER timestamp, and latest-wins would bury the override within a turn.
  // So the durable half is asserted on disk, and then re-read through a second, argument-free
  // write — the same path a hook takes.
  const home = cliHome();
  seedState(home);

  const first = runCli(home, ['write', '--focus', 'PERSISTED-MARKER', '--next_action', 'PERSISTED-NEXT']);
  assert.equal(first.status, 0);
  assert.equal(first.state.focus, 'PERSISTED-MARKER', 'the durable store was updated, not just the packet');
  assert.equal(first.state.next_action, 'PERSISTED-NEXT');
  assert.equal(first.report.state_persisted, true, 'and the operator is TOLD the durable effect happened');

  const later = runCli(home, ['write']);
  assert.equal(later.status, 0);
  assert.equal(later.packet.focus, 'PERSISTED-MARKER', 'a later argument-free write — as a hook makes — delivers the override, not the old value');
  assert.deepEqual(later.report.overrode, [], 'and it correctly reports overriding nothing');
  assert.equal(later.report.state_persisted, false);
});

test('WO-OR-23 FALLBACK PRESERVED: unsupplied arguments still come from stored state', async () => {
  // The existing behaviour that must NOT break. Overriding one field must not blank the rest.
  const home = cliHome();
  seedState(home);

  const r = runCli(home, ['write', '--focus', 'ONLY-FOCUS-CHANGED']);

  assert.equal(r.status, 0);
  assert.equal(r.packet.focus, 'ONLY-FOCUS-CHANGED');
  assert.equal(r.packet.next_action, 'OLD-NEXT-ACTION', 'an unsupplied field still falls back to stored state');
  assert.equal(r.packet.immediate_objective, 'OLD-OBJECTIVE');
  assert.deepEqual(r.packet.blockers, ['OLD-BLOCKER']);
  assert.equal(r.state.next_action, 'OLD-NEXT-ACTION', 'and an unsupplied field is not disturbed on disk either');
});

test('WO-OR-23 REJECT: a `backfill`-style flag exits NON-ZERO, names itself, and points at the canonical name', async () => {
  // These five are exactly the flags that were discarded in silence. `backfill` keeps them;
  // `write` refuses them rather than aliasing them, because merging the two vocabularies
  // would change `backfill`'s contract and give one field two names inside one command.
  const cases = [
    ['next', 'next_action'],
    ['objective', 'immediate_objective'],
    ['request', 'warwick_last_request'],
    ['decision', 'accepted_decisions'],
    ['blocker', 'blockers'],
  ];
  for (const [bad, canonical] of cases) {
    const home = cliHome();
    seedState(home);
    const r = runCli(home, ['write', `--${bad}`, 'SOME-VALUE']);

    assert.equal(r.status, 2, `--${bad} must exit non-zero (2 = bad usage), got ${r.status}`);
    assert.ok(r.stderr.includes(`--${bad}:`), `the message must NAME the offending flag; got: ${r.stderr}`);
    assert.ok(r.stderr.includes(`--${canonical}`), `and point at the canonical name --${canonical}; got: ${r.stderr}`);
    assert.equal(r.delivered.length, 0, 'NOTHING may be delivered on a refusal');
    assert.equal(r.state.focus, 'OLD-STORED-FOCUS', 'and stored state must be untouched');
  }
});

test('WO-OR-23 REJECT: an unknown flag exits NON-ZERO and lists what `write` does accept', async () => {
  const home = cliHome();
  seedState(home);

  const r = runCli(home, ['write', '--focsu', 'typo-value']);

  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes('--focsu: not a `write` flag'), `got: ${r.stderr}`);
  assert.ok(r.stderr.includes('accepted by `write`:'), 'the refusal tells the operator what IS accepted');
  assert.equal(r.delivered.length, 0);
  assert.equal(r.state.focus, 'OLD-STORED-FOCUS');
});

test('WO-OR-23 REJECT: a flag supplied WITHOUT A VALUE is refused — the defect this fix would otherwise have CREATED', async () => {
  // `parseArgs` gives a valueless flag the literal string 'true'. Before this change a bare
  // `--focus` was harmlessly ignored; now that supplied arguments WIN, it would have quietly
  // overridden the focus with the word "true" — a fresh instance of the very defect being
  // repaired. The two shapes that produce it are both covered: a trailing flag, and a flag
  // immediately followed by another flag.
  for (const args of [['write', '--focus'], ['write', '--focus', '--next_action', 'X']]) {
    const home = cliHome();
    seedState(home);
    const r = runCli(home, args);

    assert.equal(r.status, 2, `${args.join(' ')} must exit non-zero`);
    assert.ok(r.stderr.includes('--focus: supplied without a value'), `got: ${r.stderr}`);
    assert.equal(r.delivered.length, 0);
    assert.equal(r.state.focus, 'OLD-STORED-FOCUS', 'the word "true" must never reach the durable focus');
  }
});

test('WO-OR-23 REJECT: a repeated single-value flag is refused, while the LIST fields stay repeatable', async () => {
  // Both halves in one test on purpose: refusing repetition everywhere would silently break
  // the three fields that are meant to accumulate, and that would be a worse defect than the
  // one being fixed.
  const home = cliHome();
  seedState(home);
  const bad = runCli(home, ['write', '--focus', 'A', '--focus', 'B']);
  assert.equal(bad.status, 2);
  assert.ok(bad.stderr.includes('--focus: supplied 2 times'), `got: ${bad.stderr}`);
  assert.equal(bad.delivered.length, 0);
  assert.equal(bad.state.focus, 'OLD-STORED-FOCUS');

  const good = runCli(home, ['write', '--completed', 'A', '--completed', 'B', '--blockers', 'C']);
  assert.equal(good.status, 0, `a repeated LIST field must still be accepted: ${good.stderr}`);
  assert.deepEqual(good.packet.completed, ['A', 'B']);
  assert.deepEqual(good.packet.blockers, ['C']);
});

test('WO-OR-23 ATOMIC REFUSAL: one bad flag stops the whole command — no partial write, no partial persist', async () => {
  // A refusal that had already applied the good half would leave the operator reasoning about
  // a state nobody described. Nothing is applied unless everything can be.
  const home = cliHome();
  seedState(home);

  const r = runCli(home, ['write', '--focus', 'WOULD-HAVE-APPLIED', '--next', 'THE-BAD-ONE']);

  assert.equal(r.status, 2);
  assert.equal(r.delivered.length, 0, 'nothing delivered');
  assert.equal(r.state.focus, 'OLD-STORED-FOCUS', 'and the acceptable flag was NOT applied either');
  assert.ok(r.stderr.includes('local state was NOT changed'), 'and the output says so plainly');
});

test('WO-OR-23 REPORT: a supplied value WITHHELD by the privacy scrub is named in the output', async () => {
  // The scrub is not weakened — a supplied field goes through RESTRICTED exactly as stored
  // state does. But a value that was accepted, persisted, and then withheld on the way to the
  // wire must not look identical to one that was delivered, or this is the same silence again.
  const home = cliHome();
  seedState(home);

  const r = runCli(home, ['write', '--focus', 'discussing a medical appointment', '--notes', 'ordinary text']);

  assert.equal(r.status, 0);
  assert.equal(r.packet.focus, '[withheld: restricted per privacy rules]', 'the scrub still fires');
  assert.equal(r.packet.sensitivity, 'restricted');
  assert.equal(r.packet.notes, 'ordinary text', 'and only the offending field is withheld');
  assert.deepEqual(r.report.withheld, ['focus'], 'the operator is TOLD which supplied field was withheld');
  assert.ok(r.report.overrode.includes('focus'), 'it was still an override — withheld is not the same as ignored');
});

test('WO-OR-23 REPORT: a supplied value cut by FIELD_CAP or LIST_CAP is named as truncated', async () => {
  // Caps are not weakened either. Same reasoning as withholding: silently shortening what was
  // handed in is a quieter version of discarding it.
  const home = cliHome();
  seedState(home);

  const r = runCli(home, [
    'write',
    '--notes', 'x'.repeat(5000),
    ...Array.from({ length: 12 }, (_, i) => ['--completed', `item-${i}`]).flat(),
    '--focus', 'short and fine',
  ]);

  assert.equal(r.status, 0);
  assert.equal(r.packet.notes.length, 600, 'FIELD_CAP still applies');
  assert.equal(r.packet.completed.length, 8, 'LIST_CAP still applies');
  assert.deepEqual(r.report.truncated.sort(), ['completed', 'notes'], 'and both truncations are reported');
  assert.equal(r.report.withheld.length, 0, 'truncation is not withholding — the two are reported separately');
});

test('WO-OR-23 SCOPE: the new validation cannot break the Stop hook — `stop` with a stray flag still exits 0', async () => {
  // `stop` fires at every turn-end. A hook that exits non-zero ends Warwick's turn with an
  // error, so the strict argument contract is deliberately scoped to `write` alone. This test
  // is what stops a later tidy-up "harmonising" the two and taking the session down with it.
  const home = cliHome();
  seedState(home);

  const r = runCli(home, ['stop', '--next', 'a flag stop does not know'], { stdin: '{"session_id":"sess-scope-test"}' });

  assert.equal(r.status, 0, 'a boundary hook must never signal failure via exit code');
  assert.equal(r.delivered.length, 1, 'and it still delivers the stored state');
  assert.equal(r.packet.focus, 'OLD-STORED-FOCUS');
  assert.equal(r.packet.reason, 'stop');
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

// ---------------------------------------------------------------------------
// WP-2B(1) — the active Wayfinder map pointer
// ---------------------------------------------------------------------------
//
// THE DEFECT. `readContinuityBrief` renders `p.map_path` as "likely active map", and no
// writer ever set it — so the field was null by construction and the pointer pointed at
// nothing.
//
// THE PROPERTY UNDER TEST, AND WHY THE NEGATIVE CASES CARRY THE WEIGHT. The render prints
// whatever string it is handed and does not check it, so A WRONG PATH RENDERS IDENTICALLY
// TO A RIGHT ONE. That makes "no path could be established, so none was emitted" the
// load-bearing behaviour rather than a nicety: a confident wrong orientation is worse than a
// blank one (W-1, named by Warwick). Every honest-absent test below is therefore an
// acceptance test, not a robustness nicety.
//
// TWO SEAMS, AND EACH INJECTED TEST IS PAIRED WITH A CONTROL. The git/filesystem seam is
// injectable so the absent cases can be induced deterministically — a proof that cannot be
// made to fail is not a proof, and none of these failures can be conjured on demand from a
// real repository. The controls below assert that the DEFAULT seam reads real git and the
// real disk, so the injected tests can never end up testing a fiction.

const REPO_ROOT = join(import.meta.dirname, '..', '..');

// Held HERE, in the test, not imported from the module it checks — a constant compared
// against itself proves nothing. This is the orientation sentence `CLAUDE.md` requires be
// copied verbatim into every Wayfinder map.
const ORIENTATION_MARKER = 'On a fresh resume, BEFORE using any tool or doing any work, visibly state';

// A programmable stand-in for the module's git seam. `handlers` is keyed by the git
// subcommand; a handler returning null means "git failed", which is how a missing repo, a
// `grep` that matched nothing (exit 1) and an absent git all present themselves.
function gitStub(handlers, { files = null } = {}) {
  const calls = [];
  const run = (args, cwd) => {
    calls.push({ args, cwd });
    const h = handlers[args[0]];
    const out = typeof h === 'function' ? h(args, cwd) : h;
    if (out == null) throw new Error(`stub: git ${args.join(' ')} failed`);
    return out;
  };
  const statSync = (p) => {
    const norm = String(p).replace(/\\/g, '/');
    if (files && !files.some((f) => norm.endsWith(f))) {
      const e = new Error(`ENOENT: ${norm}`);
      e.code = 'ENOENT';
      throw e;
    }
    return { isFile: () => true };
  };
  return { io: { run, statSync }, calls };
}

// `git log --format=@%ct --name-only` output: a timestamp line, a blank line, then the
// paths that commit touched. Mirrors the real shape rather than restating a second format.
function gitLogOutput(commits) {
  return commits.map(([ts, paths]) => `@${ts}\n\n${paths.join('\n')}`).join('\n') + '\n';
}

test('MAP POINTER CONTROL: the DEFAULT seam reads REAL git — a packet built in this repo carries a resolved map path', async () => {
  // The control for every injected test below, and the acceptance property's positive half.
  // Nothing is stubbed: this goes through real `git grep`, real `git log`, real `statSync`.
  const p = continuity.buildPacket({ focus: 'ordinary engineering work' }, { cwd: import.meta.dirname });

  assert.equal(typeof p.map_path, 'string', 'CONTROL: the real repository must yield a real pointer, or the stubs prove nothing');
  assert.match(p.map_path, /^Deliverables\/.+\.md$/, 'repo-root-relative POSIX');
  assert.doesNotMatch(p.map_path, /^[A-Za-z]:/, 'an absolute path would re-import the hardcoding defect this removes');
  assert.doesNotMatch(p.map_path, /\\/, 'POSIX separators only');

  // VERIFIED TO EXIST, and verified to be a Wayfinder map rather than merely a file that
  // exists. This is the assertion that would go red if selection ever drifted onto some
  // other document under Deliverables/.
  const abs = join(REPO_ROOT, p.map_path);
  assert.equal(existsSync(abs), true, `the emitted path must resolve to a real file — got ${abs}`);
  assert.ok(
    readFileSync(abs, 'utf8').includes(ORIENTATION_MARKER),
    'and the file it points at must carry the verbatim orientation block every Wayfinder map copies'
  );
});

test('MAP POINTER CONTROL: "started anywhere" includes a SUBDIRECTORY — same answer from the root and from tools/governor', async () => {
  // A real defect found by running this, not by reasoning about it. `git grep` and `git log`
  // resolve their pathspecs against the CURRENT DIRECTORY, so asking about `Deliverables`
  // from `tools/governor` matched nothing and the pointer went silently blind — the exact
  // honest-looking absence that is indistinguishable from "there is genuinely no map".
  const fromRoot = continuity.resolveActiveMapPath({ cwd: REPO_ROOT });
  const fromSub = continuity.resolveActiveMapPath({ cwd: import.meta.dirname });
  assert.equal(typeof fromRoot, 'string', 'CONTROL: the root case must resolve, or this proves nothing');
  assert.equal(fromSub, fromRoot, 'the cwd a session happens to start in must not change the answer');
});

test('MAP POINTER CONTROL: the default IO really is node:fs, not a stand-in', async () => {
  assert.equal(continuity.DEFAULT_MAP_GIT_IO.statSync, statSync, 'the default existence check must read the real disk');
  assert.equal(typeof continuity.DEFAULT_MAP_GIT_IO.run, 'function');
});

test('MAP POINTER: the path is RESOLVED from the repository, never relayed from stored state', async () => {
  // A stale value in `~/.mypka/governor/continuity.json` must have no route into a packet.
  // This is the difference between a pointer and a carry-forward, and it is the failure that
  // would be invisible: last week's map is a real file, so every existence check passes.
  const stale = 'Deliverables/2026-01-01-STALE-AND-WRONG-map.md';
  const p = continuity.buildPacket({ focus: 'f', map_path: stale }, { cwd: import.meta.dirname });
  assert.notEqual(p.map_path, stale, 'a `map_path` in state must not become the packet pointer');

  // And with git giving no answer at all, the stale value must not fill the gap either.
  const { io } = gitStub({ 'rev-parse': null });
  const q = continuity.buildPacket({ focus: 'f', map_path: stale }, { cwd: 'C:/nowhere', git: io });
  assert.equal(Object.prototype.hasOwnProperty.call(q, 'map_path'), false, 'absent means ABSENT, not "fall back to whatever we had"');
});

test('HONEST ABSENT: outside a git repository the field is OMITTED ENTIRELY — not null, not a guess', async () => {
  const { io, calls } = gitStub({ 'rev-parse': null });
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/not-a-repo', git: io });
  assert.equal(Object.prototype.hasOwnProperty.call(p, 'map_path'), false, 'the key must not exist at all');
  assert.equal(calls.length, 1, 'and it stopped at the first probe rather than guessing onward');
});

test('HONEST ABSENT: no file carries the orientation marker — nothing is emitted', async () => {
  // `git grep -l` exits 1 when nothing matches, which surfaces as a throw.
  const { io } = gitStub({ 'rev-parse': 'C:/repo\n', grep: null });
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: io });
  assert.equal(Object.prototype.hasOwnProperty.call(p, 'map_path'), false);
});

test('HONEST ABSENT: a selected map that does NOT EXIST on disk is refused — the acceptance property', async () => {
  // THE ONE THAT MATTERS MOST. A deleted or renamed map still has commit history, so
  // selection succeeds and the existence check is the only thing standing between Warwick
  // and a brief confidently naming a file that is not there.
  const { io } = gitStub(
    {
      'rev-parse': 'C:/repo\n',
      grep: 'Deliverables/deleted-map.md\n',
      'merge-base': 'abc123\n',
      log: gitLogOutput([[200, ['Deliverables/deleted-map.md']]]),
    },
    { files: [] } // statSync throws ENOENT for everything
  );
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: io });
  assert.equal(Object.prototype.hasOwnProperty.call(p, 'map_path'), false, 'a path that resolves to nothing must never be emitted');
});

test('MUTATION: the existence check is REACHED — the same fixture with the file PRESENT does emit', async () => {
  // Makes the test above fail-able. Without this, "absent" could be coming from anywhere in
  // the chain and the existence check could be dead code.
  const { io } = gitStub(
    {
      'rev-parse': 'C:/repo\n',
      grep: 'Deliverables/present-map.md\n',
      'merge-base': 'abc123\n',
      log: gitLogOutput([[200, ['Deliverables/present-map.md']]]),
    },
    { files: ['Deliverables/present-map.md'] }
  );
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: io });
  assert.equal(p.map_path, 'Deliverables/present-map.md');
});

test('HONEST ABSENT: two equally-recent maps are AMBIGUOUS — neither is picked', async () => {
  // One commit touching two maps. There is no honest way to choose, and choosing is exactly
  // the confident-wrong-orientation failure. Nothing is emitted.
  const { io } = gitStub(
    {
      'rev-parse': 'C:/repo\n',
      grep: 'Deliverables/map-a.md\nDeliverables/map-b.md\n',
      'merge-base': 'abc123\n',
      log: gitLogOutput([[500, ['Deliverables/map-a.md', 'Deliverables/map-b.md']]]),
    },
    { files: ['Deliverables/map-a.md', 'Deliverables/map-b.md'] }
  );
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: io });
  assert.equal(Object.prototype.hasOwnProperty.call(p, 'map_path'), false, 'ambiguity resolves to silence, never to a coin toss');
});

test('SELECTION: the BRANCH-SCOPED map wins over a repo-wide-newer one', async () => {
  // Several maps are live in this estate at once. The map this branch is WORKING ON is the
  // one it has touched since diverging from origin/main — not whichever map some other
  // branch committed to most recently. A repo-wide-only rule would point a BUILD-020 session
  // at the BUILD-015 map, which is the exact misdirection Phase 2 exists to close.
  const { io } = gitStub(
    {
      'rev-parse': 'C:/repo\n',
      grep: 'Deliverables/mine.md\nDeliverables/someone-elses.md\n',
      'merge-base': 'base1\n',
      log: (args) => {
        const scoped = args.some((x) => typeof x === 'string' && x.includes('..'));
        return scoped
          ? gitLogOutput([[100, ['Deliverables/mine.md']]])
          : gitLogOutput([[900, ['Deliverables/someone-elses.md']], [100, ['Deliverables/mine.md']]]);
      },
    },
    { files: ['Deliverables/mine.md', 'Deliverables/someone-elses.md'] }
  );
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: io });
  assert.equal(p.map_path, 'Deliverables/mine.md', 'branch scope decides, even though the other map is newer overall');
  assert.notEqual(p.map_path, 'Deliverables/someone-elses.md');
});

test('SELECTION: a branch that has touched NO map falls back to repo-wide recency', async () => {
  // The fallback that makes the rule above safe rather than brittle: a fresh branch off main
  // has touched nothing, and "no pointer at all" would be a worse answer than the estate's
  // most recently worked map.
  const { io, calls } = gitStub(
    {
      'rev-parse': 'C:/repo\n',
      grep: 'Deliverables/map-a.md\nDeliverables/map-b.md\n',
      'merge-base': 'base1\n',
      log: (args) => {
        const scoped = args.some((x) => typeof x === 'string' && x.includes('..'));
        return scoped ? '' : gitLogOutput([[900, ['Deliverables/map-b.md']], [100, ['Deliverables/map-a.md']]]);
      },
    },
    { files: ['Deliverables/map-a.md', 'Deliverables/map-b.md'] }
  );
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: io });
  assert.equal(p.map_path, 'Deliverables/map-b.md');
  assert.equal(calls.filter((c) => c.args[0] === 'log').length, 2, 'branch-scoped first, then repo-wide — in that order');
});

test('SELECTION: with no origin/main the repo-wide rule still answers', async () => {
  // A clone with no `origin/main` makes `merge-base` fail. That is not a reason to go blind.
  const { io } = gitStub(
    {
      'rev-parse': 'C:/repo\n',
      grep: 'Deliverables/only-map.md\n',
      'merge-base': null,
      log: gitLogOutput([[300, ['Deliverables/only-map.md']]]),
    },
    { files: ['Deliverables/only-map.md'] }
  );
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: io });
  assert.equal(p.map_path, 'Deliverables/only-map.md');
});

test('MUTATION: an ABSOLUTE or escaping path is refused rather than emitted', async () => {
  // An absolute path in the brief would be exactly the build-tied hardcoding this change
  // exists to remove, and `../` would point outside the repository entirely.
  for (const bad of ['C:/repo/Deliverables/map.md', '/Deliverables/map.md', 'Deliverables/../../secrets/map.md']) {
    const { io } = gitStub(
      {
        'rev-parse': 'C:/repo\n',
        grep: `${bad}\n`,
        'merge-base': 'abc\n',
        log: gitLogOutput([[400, [bad]]]),
      },
      { files: null } // every stat succeeds, so ONLY the path rule can refuse these
    );
    const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: io });
    assert.equal(Object.prototype.hasOwnProperty.call(p, 'map_path'), false, `${bad} must never reach a packet`);
  }
});

test('PRIVACY: the map path goes through the SAME scrub — a restricted hit is withheld by OMISSION, not by marker', async () => {
  // No bypass: a new field obeys the existing privacy discipline. But a withheld value is
  // not a path — emitting the withholding notice would have the brief render
  // "likely active map: [withheld: ...]", which is the confident-wrong-orientation failure
  // wearing a compliance badge. So the packet is marked restricted and the field is dropped.
  const bad = 'Deliverables/2026-08-05-api_key-rotation-plan.md';
  const { io } = gitStub(
    {
      'rev-parse': 'C:/repo\n',
      grep: `${bad}\n`,
      'merge-base': 'abc\n',
      log: gitLogOutput([[400, [bad]]]),
    },
    { files: [bad] }
  );
  const p = continuity.buildPacket({ focus: 'ordinary work' }, { cwd: 'C:/repo', git: io });
  assert.equal(Object.prototype.hasOwnProperty.call(p, 'map_path'), false, 'the field is dropped, not marker-substituted');
  assert.equal(p.sensitivity, 'restricted', 'and the scrub still fires — the discipline is not bypassed');
  assert.equal(p.focus, 'ordinary work', 'only the offending field is affected');
});

test('MAP POINTER: a resolver failure cannot break the Stop hook — it degrades to absent', async () => {
  // `stop` runs at every turn-end, and a throw there ends Warwick's turn with an error.
  const exploding = { run: () => { throw new Error('boom'); }, statSync: () => { throw new Error('boom'); } };
  const p = continuity.buildPacket({ focus: 'f' }, { cwd: 'C:/repo', git: exploding });
  assert.equal(Object.prototype.hasOwnProperty.call(p, 'map_path'), false);
  assert.equal(p.focus, 'f', 'and the rest of the packet is unaffected');
});

test('MAP POINTER: the field is part of the CONTENT HASH, so a map change is a content change', async () => {
  // The brief reports content age off `packetContentHash`. A pointer that changed without
  // moving the hash would render as stale-but-unchanged, which is the wrong signal.
  const base = { schema: 1, kind: 'continuity', id: 'a', ts: 't', seq: 1, focus: 'f' };
  const h1 = continuity.packetContentHash({ ...base, map_path: 'Deliverables/one.md' });
  const h2 = continuity.packetContentHash({ ...base, map_path: 'Deliverables/two.md' });
  assert.notEqual(h1, h2);
});

test('PRODUCT PATH: a `stop` packet delivered by the REAL CLI carries the resolved map path', async () => {
  // "The right value computed somewhere it is never used" is the defect class this module has
  // already been bitten by twice. So the pointer is asserted on the BYTES HANDED TO THE
  // TRANSPORT by the real CLI, not on a helper's return value.
  const home = cliHome();
  seedState(home);

  const r = runCli(home, ['stop'], { stdin: JSON.stringify({ session_id: 'sess-map-live', cwd: REPO_ROOT }) });

  assert.equal(r.status, 0, `stop must succeed: ${r.stderr}`);
  assert.equal(r.delivered.length, 1, 'CONTROL: a packet actually reached the transport');
  assert.match(r.packet.map_path, /^Deliverables\/.+\.md$/, 'the delivered packet carries the pointer');
  assert.equal(existsSync(join(REPO_ROOT, r.packet.map_path)), true, 'and it names a file that exists');
});

test('PRODUCT PATH MUTATION: the SESSION cwd steers it — a stop from outside the repo carries NO pointer', async () => {
  // Makes the test above fail-able, and proves the hook reads the session's cwd rather than
  // its own process cwd: the child inherits the repository as its cwd, so if the stdin `cwd`
  // were ignored a pointer would still appear here.
  const outside = cliHome(); // a throwaway temp directory, not a git repository
  seedState(outside);

  const r = runCli(outside, ['stop'], { stdin: JSON.stringify({ session_id: 'sess-map-outside', cwd: outside }) });

  assert.equal(r.status, 0, 'a boundary hook never signals failure via exit code');
  assert.equal(r.delivered.length, 1, 'CONTROL: it still delivered a packet');
  assert.equal(
    Object.prototype.hasOwnProperty.call(r.packet, 'map_path'), false,
    'outside a repository there is no honest pointer, so the field must be absent'
  );
});

// ---------------------------------------------------------------------------
// WP-2B(2) — the READER-SIDE existence check (instruction D)
// ---------------------------------------------------------------------------
//
// THE DEFECT THIS CLOSES. WP-2B(1) made the WRITER verify the map exists before emitting a
// pointer. The reader was never asked. Writer and reader are different checkouts by design —
// that is what cross-session continuity IS — so a path that was true where it was written can
// be absent where it is read. Executed on this estate: the BUILD-020 map is real on
// `build-020/live-trial` and absent in `C:\Fusion247PKA`, which sits on a `build-015/...`
// branch. A fresh Larry there was shown a confident path to a file that is not present.
//
// WHY THE NEGATIVE CASES CARRY THE WEIGHT, AGAIN. Same reason as WP-2B(1): an absent path
// renders identically to a present one unless something checks. The load-bearing behaviour is
// the honest-absent branch, and specifically that it NAMES the path it could not find — a
// blank absence and a wrong absence look the same to Warwick, and only one of them tells him
// where to look. Every test below is an acceptance test, not a robustness nicety.
//
// THE ONE THING THE ABSENT BRANCH MUST NEVER DO is present the named path as the active map.
// The diagnostic value of naming it and the danger of naming it are the same property, so
// "the words `likely active map` do not appear" is asserted explicitly rather than inferred
// from the branch being a different one.

test('D: a map path recorded but NOT PRESENT here renders honest-absent and NAMES the path', async () => {
  const missing = 'Deliverables/2026-08-04-proofline-wayfinder-plan.md';
  const { fetchPage } = pagingServer([packet({ seq: 1, ts: '2026-08-05T00:00:00.000Z', map_path: missing })]);
  const { io } = gitStub({ 'rev-parse': '/reader/root\n' }, { files: [] }); // repo present, file is not

  const brief = await continuity.readContinuityBrief({ fetchPage, git: io });

  assert.match(brief, /recorded map NOT PRESENT in this checkout/, 'the absence must be stated, not implied');
  assert.ok(brief.includes(missing), 'and the recorded path must be NAMED so the absence can be diagnosed');
  assert.doesNotMatch(brief, /likely active map/, 'it must NEVER be offered as the active map');
  assert.match(brief, /Nothing in this block is an instruction/, 'the pointer discipline still binds this branch');
});

test('D CONTROL: the SAME packet, with the file present, renders as the active map', async () => {
  // Makes the test above fail-able. Without this, a render that ALWAYS said "not present"
  // would satisfy every negative assertion above while destroying the working case.
  const present = 'Deliverables/2026-08-04-proofline-wayfinder-plan.md';
  const { fetchPage } = pagingServer([packet({ seq: 1, ts: '2026-08-05T00:00:00.000Z', map_path: present })]);
  const { io } = gitStub({ 'rev-parse': '/reader/root\n' }, { files: [present] });

  const brief = await continuity.readContinuityBrief({ fetchPage, git: io });

  assert.match(brief, /likely active map: Deliverables\/2026-08-04-proofline-wayfinder-plan\.md/);
  assert.doesNotMatch(brief, /NOT PRESENT/, 'a present map must not be reported absent');
});

test('D: the check runs against the READER own repo root — not a constant, not the writer root', () => {
  // The property that makes this worth having at all. The stat must be rooted at whatever
  // `git rev-parse --show-toplevel` answers HERE, so the same packet can resolve differently
  // in two checkouts — which is exactly the real situation it exists for.
  const rel = 'Deliverables/map.md';
  const statted = [];
  const io = {
    run: (args, cwd) => (args[0] === 'rev-parse' ? `/root-for${cwd}\n` : ''),
    statSync: (p) => { statted.push(String(p).replace(/\\/g, '/')); return { isFile: () => true }; },
  };

  assert.equal(continuity.mapPathPresentHere(rel, { cwd: '/checkout-a', git: io }), true);
  assert.equal(continuity.mapPathPresentHere(rel, { cwd: '/checkout-b', git: io }), true);
  assert.deepEqual(
    statted,
    ['/root-for/checkout-a/Deliverables/map.md', '/root-for/checkout-b/Deliverables/map.md'],
    'the reader root steers the probe; a hardcoded or writer-side root would give one answer twice'
  );
});

test('D: every uncertain case resolves to NOT PRESENT — the fail-safe direction is asserted, not assumed', () => {
  const rel = 'Deliverables/map.md';
  const ok = { run: () => '/reader/root\n', statSync: () => ({ isFile: () => true }) };

  // not a repository / git absent — `rev-parse` throws
  assert.equal(continuity.mapPathPresentHere(rel, { cwd: '/x', git: { ...ok, run: () => { throw new Error('no git'); } } }), false);
  // a repository probe that answers empty
  assert.equal(continuity.mapPathPresentHere(rel, { cwd: '/x', git: { ...ok, run: () => '   \n' } }), false);
  // the path exists but is a DIRECTORY, not a file
  assert.equal(continuity.mapPathPresentHere(rel, { cwd: '/x', git: { ...ok, statSync: () => ({ isFile: () => false }) } }), false);
  // stat throws — ENOENT, permissions, a broken junction
  assert.equal(continuity.mapPathPresentHere(rel, { cwd: '/x', git: { ...ok, statSync: () => { throw new Error('ENOENT'); } } }), false);
  // CONTROL: with everything working it says true, so the four above are not passing vacuously
  assert.equal(continuity.mapPathPresentHere(rel, { cwd: '/x', git: ok }), true);
});

test('D: an untrusted stored path is REFUSED before any filesystem call, never normalised', () => {
  // The path arrives from a REMOTE store and is about to be joined onto a real root. An
  // absolute path or a `..` segment would probe outside the repository on the strength of a
  // string nobody in this process wrote. Refused ahead of the stat — and the stat is asserted
  // never to have run, because "it returned false" would not distinguish a refusal from a
  // probe that happened and failed.
  const probed = [];
  const io = {
    run: () => '/reader/root\n',
    statSync: (p) => { probed.push(String(p)); return { isFile: () => true }; },
  };
  const hostile = ['/etc/passwd', 'C:/Windows/system32/x.md', '../../outside.md', 'Deliverables/../../up.md', '', '   ', null, undefined, 42];
  for (const h of hostile) {
    assert.equal(continuity.mapPathPresentHere(h, { cwd: '/x', git: io }), false, JSON.stringify(h));
  }
  assert.deepEqual(probed, [], 'no hostile path may reach the filesystem at all');
  // CONTROL: an ordinary repo-relative path DOES reach it, so the emptiness above is a refusal
  assert.equal(continuity.mapPathPresentHere('Deliverables/map.md', { cwd: '/x', git: io }), true);
  assert.equal(probed.length, 1, 'and exactly one probe was made for the legitimate path');
});

test('D CONTROL: the DEFAULT seam reads REAL git and the REAL filesystem', () => {
  // Pairs with every injected test above. Without it the whole D suite could be testing a
  // fiction: a `mapPathPresentHere` that ignored its io and returned a constant would satisfy
  // the stubs. Run against this repository, with no injection at all.
  const realMap = 'Deliverables/2026-08-02-wayfinder-operating-reset-plan.md';
  assert.equal(existsSync(join(REPO_ROOT, realMap)), true, 'CONTROL PRECONDITION: the fixture map is really on disk');

  assert.equal(continuity.mapPathPresentHere(realMap, { cwd: REPO_ROOT }), true,
    'the default seam must find a file that genuinely exists');
  assert.equal(continuity.mapPathPresentHere('Deliverables/no-such-map-2026-08-05.md', { cwd: REPO_ROOT }), false,
    'and must not find one that does not');
  assert.equal(continuity.mapPathPresentHere(realMap, { cwd: SANDBOX_HOME }), false,
    'outside any repository there is no root to check against, so the answer is NOT PRESENT');
});

test('D: the DEFAULTS are real — a bare call and an explicitly null seam both fall back to the real one', () => {
  // These two guards were SURVIVING mutants: dropping `cwd = process.cwd()` and dropping the
  // `git || DEFAULT_MAP_GIT_IO` fallback both left the suite green, which meant neither was
  // proven. They are not dead code — both are reachable from a legitimate call — so the
  // answer is to prove them rather than to delete them. (The third survivor, a duplicate pair
  // of defaults on `readContinuityBrief`, WAS equivalent and was removed instead.)
  const realMap = 'Deliverables/2026-08-02-wayfinder-operating-reset-plan.md';
  const cwdBefore = process.cwd();
  process.chdir(REPO_ROOT);
  try {
    assert.equal(continuity.mapPathPresentHere(realMap), true,
      'called bare, it must default cwd to the process cwd and find the map');
    assert.equal(continuity.mapPathPresentHere(realMap, { cwd: REPO_ROOT, git: null }), true,
      'an explicitly null seam must fall back to the real one, not throw and not report absent');
    assert.equal(continuity.mapPathPresentHere('Deliverables/no-such-map-2026-08-05.md'), false,
      'CONTROL: the bare call is not simply returning true for everything');
  } finally {
    process.chdir(cwdBefore);
  }
});

test('D: `cwd` and `git` never leak into the message walk', async () => {
  // `readContinuityBrief` forwards its options to `readLatest`. The two new keys belong to
  // the existence check, and handing `listAllMessages` a key it does not own is how an option
  // bag quietly becomes an interface. Asserted on what the page fetcher actually received.
  const seen = [];
  const fetchPage = async (args) => {
    seen.push(args);
    return { items: [msg(packet({ seq: 1, ts: '2026-08-05T00:00:00.000Z' }))], total: 1, page: 1, size: 100, pages: 1 };
  };
  await continuity.readContinuityBrief({ fetchPage, git: MAP_PRESENT_IO, cwd: '/somewhere' });
  assert.ok(seen.length > 0, 'CONTROL: the walk actually ran');
  for (const a of seen) {
    assert.deepEqual(Object.keys(a).sort(), ['cursor', 'page', 'reverse', 'size'],
      'the fetcher sees its own four arguments and nothing this change added');
  }
});

// ---------------------------------------------------------------------------
// WRITE-SIDE POINTER PROTECTION — session-start-time vs. stored-packet write-time
// ---------------------------------------------------------------------------
//
// THE RACE THIS CLOSES. `continuity.json`/the Honcho session is ONE shared store written by
// every session's Stop hook across every worktree and build on this machine. Without this
// check, an honestly-resolved but STALE `map_path` — from a session left open in an old
// worktree, closed AFTER a more current session already posted the pointer that should stand
// — silently becomes "the current map" on nothing more than post-time ordering (W-1, the
// exact failure WP-2B(1)/(2) above closed on the READ side; this closes it on the WRITE side).
//
// THE SIGNAL, AND WHY IT IS NOT MAP COMMIT-RECENCY. An earlier design compared the candidate
// map's own git-commit timestamp against whatever was already stored. Warwick caught the
// flaw before it shipped: commit-recency answers "when did this FILE last change", not "when
// did this SESSION decide to point at it" — so it would have WRONGLY rejected a deliberate
// switch to an older, dormant build, which is exactly the case this mechanism must allow. The
// corrected signal is SESSION START TIME vs. the stored pointer's last WRITE time (`ts` — an
// existing field, nothing new): the one fact a stale session cannot fake. The
// 'DIFFERENTIATING PROOF' test below is built specifically to demonstrate this: it uses a
// candidate whose map has an OLD commit timestamp and proves it is STILL accepted, because
// commit age is no longer part of the comparison at all.
//
// THE SEAM. `deliver()` (and therefore `writeContinuity()`) now accepts an injectable
// `request` — the SAME `request = hf` idiom `fetchMessagePage` already uses for reads in this
// file, extended to the one write call site that lacked it (see the comment above `deliver`
// in the source). Combined with the EXISTING `fetchPage` injection on `readLatest`
// (`writeContinuity` forwards it internally for its own pre-write comparison read), both
// halves of "the store" a test needs to control are covered by seams this file already had,
// or by the identical shape of one it already had — nothing new is invented.

// A minimal in-memory fake Honcho session, shared between the WRITE path (`request`, used by
// `deliver`/`ensureStore`) and the READ path (`fetchPage`, used by `readLatest` — including
// the comparison `writeContinuity` performs internally before allowing a candidate
// `map_path` out). Built from `pagingServer` and the fenced-JSON content shape `msg()`
// mirrors, both already defined above, rather than a new fixture shape: a write appends a raw
// packet to `store`; a read re-wraps whatever is CURRENTLY in `store` through the SAME
// `pagingServer` the read-path tests already use. That is what makes "a subsequent
// `readLatest` observes what a prior write delivered" a genuine round trip rather than an
// assumption about two independently-programmed stubs agreeing by construction.
function fakeHoncho(initialPackets = []) {
  const store = [...initialPackets];
  const request = async (path, opts) => {
    const body = opts && opts.body;
    if (body && Array.isArray(body.messages)) {
      const m = String(body.messages[0].content).match(/```json\s*([\s\S]*?)```/);
      if (m) store.push(JSON.parse(m[1].trim()));
      return [{ id: `m-${store.length}` }];
    }
    return { id: 'ok' }; // ensureStore's three /workspaces,/peers,/sessions calls
  };
  const fetchPage = (args) => pagingServer(store).fetchPage(args);
  return { store, request, fetchPage };
}

test('WRITE-AUTHORITY CONTROL: no prior stored packet — the candidate is written unconditionally', async () => {
  // "A first-ever write is definitionally not a regression" — the design's own stated
  // baseline case. Uses a session start time that is, on its face, ancient, to prove
  // acceptance here is not an accident of a generous sessionStartedAt.
  const fake = fakeHoncho([]);
  const { io } = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map-A.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[1754000000, ['Deliverables/map-A.md']]]) },
    { files: ['Deliverables/map-A.md'] }
  );
  const r = await continuity.writeContinuity(
    { focus: 'session A' },
    { cwd: 'C:/repo', git: io, fetchPage: fake.fetchPage, request: fake.request, sessionStartedAt: '2020-01-01T00:00:00.000Z' }
  );
  assert.equal(r.ok, true);
  assert.equal(r.packet.map_path, 'Deliverables/map-A.md');
});

test("WRITE-AUTHORITY: a session that STARTED BEFORE the stored pointer's last write does NOT replace it", async () => {
  // Warwick's own acceptance script, steps 1-3: session A posts a current map; session B — an
  // old/unrelated worktree session whose OWN start time predates A's write — has its Stop
  // fire AFTER A (a later wall-clock close, but a genuinely older start). B's write must not
  // move the pointer A just set.
  const fake = fakeHoncho([]);
  const gitA = gitStub(
    { 'rev-parse': 'C:/repo-A\n', grep: 'Deliverables/map-A.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[5000, ['Deliverables/map-A.md']]]) },
    { files: ['Deliverables/map-A.md'] }
  ).io;
  const gitB = gitStub(
    { 'rev-parse': 'C:/repo-B\n', grep: 'Deliverables/map-B-stale.md\n', 'merge-base': 'base2\n', log: gitLogOutput([[5000, ['Deliverables/map-B-stale.md']]]) },
    { files: ['Deliverables/map-B-stale.md'] }
  ).io;

  const a = await continuity.writeContinuity(
    // sessionStartedAt is irrelevant here — A is the first write, nothing to compare against
    // yet — so A's own start time is left unset, deliberately, to avoid implying otherwise.
    //
    // AMENDMENT 2 FIXTURE CORRECTION — `sessionId` added, no assertion changed. A models a
    // Stop-hook session, and in production EVERY stop packet carries a session id because the
    // hook supplies it. Without one, A's packet looked like a MANUAL write, which the D-1 fix
    // deliberately treats as unattributable and therefore not a rival. This test's own name
    // says "session A"; the fixture simply never said so to the code.
    { focus: 'session A, current build' },
    { cwd: 'C:/repo-A', git: gitA, fetchPage: fake.fetchPage, request: fake.request, sessionId: 'sess-A' }
  );
  assert.equal(a.ok, true);
  assert.equal(a.packet.map_path, 'Deliverables/map-A.md', 'CONTROL: A really did post a map pointer, or B has nothing to fail to displace');

  // BEFORE A's REAL write ts — computed relative to what `buildPacket` actually stamped
  // (`a.packet.ts`, the real wall clock at the moment A ran), never a fixed literal date.
  // A fixed literal would make this test's pass/fail depend on WHEN it happens to run.
  const beforeA = new Date(Date.parse(a.packet.ts) - 60 * 60 * 1000).toISOString();

  const b = await continuity.writeContinuity(
    { focus: 'session B, an old worktree finally closing' },
    // B genuinely started earlier, even though its Stop fires after A's in this call sequence.
    { cwd: 'C:/repo-B', git: gitB, fetchPage: fake.fetchPage, request: fake.request, sessionId: 'sess-B', sessionStartedAt: beforeA }
  );
  assert.equal(b.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(b.packet, 'map_path'), false, "B's stale write must not carry the pointer");
  assert.equal(b.packet.focus, 'session B, an old worktree finally closing', 'every OTHER field still writes normally — only the pointer is protected');

  // THE OBSERVABLE OUTCOME (step 3 of the acceptance script) — not B's return value alone,
  // but what a SUBSEQUENT `readLatest` genuinely sees. B is the chronologically newest
  // packet (posted after A in this store), so under this store's own latest-wins rule it IS
  // what a fresh read reports as newest — and it must not carry B's stale path.
  const after = await continuity.readLatest({ fetchPage: fake.fetchPage });
  assert.equal(after.latest.focus, 'session B, an old worktree finally closing', 'CONTROL: B really is the newest packet by post time, so this is a real test of the render');
  assert.equal(Object.prototype.hasOwnProperty.call(after.latest, 'map_path'), false, 'the stale path never became the visible pointer');

  // WP-3A(b) STRENGTHENED, AND THE ASSERTION CHANGED WITH THE REQUIREMENT — read this before
  // treating it as a relaxed test. It previously asserted `/map path missing or invalid/`,
  // i.e. that a WITHHELD pointer rendered identically to a packet that never had one. That
  // indistinguishability is precisely the silence WP-3A(c) was commissioned to remove, so the
  // old assertion now encodes the defect rather than the requirement. What must hold is
  // STRICTLY MORE than before: the stale path still never renders, AND the reader is told the
  // pointer was withheld rather than absent, AND is still sent to the map.
  assert.equal(b.packet.map_path_withheld, 'stale-session', 'the withholding is RECORDED on the packet, not left as a silent absence');

  const brief = await continuity.readContinuityBrief({ fetchPage: fake.fetchPage });
  assert.doesNotMatch(brief, /map-B-stale\.md/, "B's stale path must never render as active");
  assert.match(brief, /MAP POINTER WITHHELD BY THE WRITER/, 'a withheld pointer must not masquerade as a missing one');
  assert.doesNotMatch(brief, /map path missing or invalid/, 'and must not take the never-had-one branch');
  assert.match(brief, /started BEFORE the last stored write/, 'the reader is told WHY, not merely that');
  assert.match(brief, /Deliverables\/` per `CLAUDE\.md` Step 2/, 'and is still oriented to the map — half an honest answer is a failure');
});

test('DIFFERENTIATING PROOF: a session that STARTED AFTER the stored write DOES replace it — even though its own map is OLDER by commit-recency', async () => {
  // THE CASE THE SUPERSEDED DESIGN GOT WRONG. An earlier design compared the candidate map's
  // OWN commit timestamp against what was stored, and would have REJECTED this exact write:
  // the map this session resolves to was committed long before the currently-stored
  // pointer's map. Under session-start-time comparison it is ACCEPTED, because a deliberate
  // switch to an older, dormant build is exactly the case the corrected design exists to
  // allow. This is Warwick's acceptance script step 3, and the reason the design changed.
  const fake = fakeHoncho([]);
  const gitCurrent = gitStub(
    { 'rev-parse': 'C:/repo-current\n', grep: 'Deliverables/map-current.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[1754000000, ['Deliverables/map-current.md']]]) }, // a RECENT commit
    { files: ['Deliverables/map-current.md'] }
  ).io;
  const gitDormant = gitStub(
    { 'rev-parse': 'C:/repo-dormant\n', grep: 'Deliverables/map-dormant-build.md\n', 'merge-base': 'base2\n', log: gitLogOutput([[1000, ['Deliverables/map-dormant-build.md']]]) }, // an ANCIENT commit
    { files: ['Deliverables/map-dormant-build.md'] }
  ).io;

  const current = await continuity.writeContinuity(
    // First write — nothing to compare against, sessionStartedAt is irrelevant to it.
    { focus: 'currently active build' },
    { cwd: 'C:/repo-current', git: gitCurrent, fetchPage: fake.fetchPage, request: fake.request }
  );
  assert.equal(current.packet.map_path, 'Deliverables/map-current.md', 'CONTROL: the currently-stored pointer really is set');

  // CONTROL: prove the dormant build's map really IS older by commit, so this test could not
  // pass by accident under a commit-recency rule — a commit ts of 1000 versus 1754000000 is
  // about as far apart as two real timestamps get.
  const dormantAlone = continuity.buildPacket({ focus: 'x' }, { cwd: 'C:/repo-dormant', git: gitDormant });
  assert.equal(dormantAlone.map_path, 'Deliverables/map-dormant-build.md');

  // AFTER the current pointer's REAL write ts — computed relative to what `buildPacket`
  // actually stamped (`current.packet.ts`), never a fixed literal date that could drift
  // against whenever this suite happens to run.
  const afterCurrent = new Date(Date.parse(current.packet.ts) + 60 * 60 * 1000).toISOString();

  const switchToDormant = await continuity.writeContinuity(
    { focus: 'deliberately switching to the dormant build' },
    // A genuinely fresh session, choosing on purpose to point somewhere old.
    { cwd: 'C:/repo-dormant', git: gitDormant, fetchPage: fake.fetchPage, request: fake.request, sessionStartedAt: afterCurrent }
  );
  assert.equal(switchToDormant.ok, true);
  assert.equal(switchToDormant.packet.map_path, 'Deliverables/map-dormant-build.md', 'a genuinely fresh session switching to an older build DOES replace the pointer');

  const after = await continuity.readLatest({ fetchPage: fake.fetchPage });
  assert.equal(after.latest.map_path, 'Deliverables/map-dormant-build.md', 'the observable outcome: the dormant map IS now the active pointer, commit age notwithstanding');
});

test('MUTATION: the session-start comparison is REAL — force OLDER (reject) and NEWER (accept) against the SAME seeded prior', async () => {
  // The control that makes the two tests above fail-able: a guard that always writes, or
  // always blocks, would pass a test that only exercises one direction. Both directions are
  // proven here against an IDENTICAL candidate and an IDENTICAL prior — only the session
  // start time changes between the two runs.
  //
  // AMENDMENT 2 FIXTURE CORRECTION — `session_id` added to the prior and `sessionId` to both
  // writers; no assertion changed and neither direction relaxed. The time comparison this test
  // exists to prove only APPLIES between two different sessions, so the prior has to belong to
  // one. Previously it belonged to nobody, which after the D-1 fix reads as a manual write and
  // is deliberately not a rival. Both writers share one id so that the ONLY difference between
  // the two runs remains the session start time — which is exactly what this test claims.
  const priorPacket = {
    schema: 1, kind: 'continuity', id: 'cont-prior', ts: '2026-08-05T09:00:00.000Z', seq: 1,
    backfill: false, session_id: 'sess-other', focus: 'prior', map_path: 'Deliverables/map-prior.md', next_action: 'n',
  };
  const gitCandidate = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map-candidate.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[4242, ['Deliverables/map-candidate.md']]]) },
    { files: ['Deliverables/map-candidate.md'] }
  ).io;

  const older = fakeHoncho([priorPacket]);
  const rejected = await continuity.writeContinuity(
    { focus: 'older session' },
    { cwd: 'C:/repo', git: gitCandidate, fetchPage: older.fetchPage, request: older.request, sessionId: 'sess-mine', sessionStartedAt: '2026-08-05T08:59:59.000Z' } // BEFORE
  );
  assert.equal(Object.prototype.hasOwnProperty.call(rejected.packet, 'map_path'), false, 'OLDER must be REJECTED — the pointer must not move');

  const newer = fakeHoncho([priorPacket]);
  const accepted = await continuity.writeContinuity(
    { focus: 'newer session' },
    { cwd: 'C:/repo', git: gitCandidate, fetchPage: newer.fetchPage, request: newer.request, sessionId: 'sess-mine', sessionStartedAt: '2026-08-05T09:00:01.000Z' } // AFTER
  );
  assert.equal(accepted.packet.map_path, 'Deliverables/map-candidate.md', 'NEWER must be ACCEPTED — proves the guard is not vacuously always-reject');
});

test('WP-3A(c) NO FAIL-OPEN: a readLatest failure WITHHOLDS the pointer and still delivers the packet', async () => {
  // THIS TEST REPLACES ONE THAT ASSERTED THE DEFECT, and the substitution is the whole point
  // of WP-3A(c) — flagged here rather than buried, because "a test changed" and "a test was
  // weakened" look identical in a diff.
  //
  // It previously read: 'FALLBACK: a readLatest failure degrades to the unconditional write,
  // not a block', and asserted `r.packet.map_path === 'Deliverables/map.md'`. That is the
  // fail-open guard stated as a requirement. E-I is the mechanism (`readLatest` inside the
  // write path, in a `catch` that writes unconditionally) and E-F is the cost: when Honcho is
  // slow the read times out, the guard falls open, and the stale pointer is KEPT — so the
  // slow read SUPPRESSES the stripping defect and each fault hides the other.
  //
  // The half of the old test that was always right is KEPT and still asserted: the Stop hook
  // must not throw and the packet must not be lost. What changed is that an unreachable
  // comparison read is no longer treated as permission to publish an unchecked pointer.
  const throwingFetchPage = async () => { throw new Error('Honcho unreachable'); };
  const fake = fakeHoncho([]);
  const gitOk = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[100, ['Deliverables/map.md']]]) },
    { files: ['Deliverables/map.md'] }
  ).io;
  const r = await continuity.writeContinuity(
    { focus: 'f' },
    { cwd: 'C:/repo', git: gitOk, fetchPage: throwingFetchPage, request: fake.request, sessionStartedAt: '2020-01-01T00:00:00.000Z' }
  );

  // CONSTRAINT 1 — the packet is NOT lost, and the hook does not throw.
  assert.equal(r.ok, true, 'an unreachable comparison read must never cost the packet');
  assert.equal(r.packet.focus, 'f', 'every other field still writes normally — only the pointer is affected');
  assert.equal(r.packet.id, fake.store[fake.store.length - 1].id, 'and it genuinely reached the store, not merely the return value');

  // CONSTRAINT 2 — the guard does NOT fall open.
  assert.equal(Object.prototype.hasOwnProperty.call(r.packet, 'map_path'), false, 'THE DEFECT: an unestablished authority must not publish the pointer anyway');
  assert.equal(r.packet.map_path_withheld, 'authority-unestablished', 'and the reason is recorded rather than left as a silent absence');
});

test('WP-3A(c) COMBINED CASE (E-F): a SLOW read and a stale pointer, exercised TOGETHER', async () => {
  // E-F is the phase's central test-design lesson: "the two defects PARTIALLY MASK EACH
  // OTHER... a test that exercises them one at a time will pass while both are broken." Every
  // other guard test above holds one variable still. This one does not.
  //
  // THE SCENARIO, WHICH IS THE REAL ONE: an old worktree's session is finally closing (its
  // start time predates the stored write, so its pointer IS stale and MUST be withheld), and
  // Honcho is slow enough that the comparison read aborts — which under the old code was
  // exactly the condition that made the guard fall open and KEEP that stale pointer. Both
  // faults are live in the same call; the pointer must still not be published.
  const priorPacket = {
    schema: 1, kind: 'continuity', id: 'cont-prior', ts: '2026-08-05T09:00:00.000Z', seq: 1,
    backfill: false, focus: 'the pointer that should stand', map_path: 'Deliverables/map-current.md',
  };
  const fake = fakeHoncho([priorPacket]);
  // The read path aborts the way the real one does — an AbortController timeout surfaces as a
  // thrown error out of `fetchPage`, which is the same shape `hf()` produces on abort.
  const slowThenAbort = async () => { throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }); };
  const gitStale = gitStub(
    { 'rev-parse': 'C:/old-worktree\n', grep: 'Deliverables/map-stale.md\n', 'merge-base': 'base9\n', log: gitLogOutput([[100, ['Deliverables/map-stale.md']]]) },
    { files: ['Deliverables/map-stale.md'] }
  ).io;

  const r = await continuity.writeContinuity(
    { focus: 'an old worktree finally closing' },
    {
      cwd: 'C:/old-worktree', git: gitStale,
      fetchPage: slowThenAbort,          // FAULT 1: the comparison read cannot complete
      request: fake.request,
      sessionStartedAt: '2026-08-05T08:00:00.000Z', // FAULT 2: an hour BEFORE the stored write
    }
  );

  assert.equal(r.ok, true, 'the packet survives both faults');
  assert.equal(
    Object.prototype.hasOwnProperty.call(r.packet, 'map_path'), false,
    'THE MASKED DEFECT: under the old code the timeout made the guard fall open and this stale path was KEPT'
  );
  assert.equal(r.packet.map_path_withheld, 'authority-unestablished');

  // AND THE OBSERVABLE OUTCOME — what a fresh session actually reads afterwards. The store now
  // holds the stale session's packet as the newest, so this is the render that would have
  // misdirected the next Larry.
  const brief = await continuity.readContinuityBrief({ fetchPage: fake.fetchPage });
  assert.doesNotMatch(brief, /map-stale\.md/, 'the stale path never becomes the visible pointer');
  assert.match(brief, /MAP POINTER WITHHELD BY THE WRITER/);
  assert.match(brief, /Deliverables\/` per `CLAUDE\.md` Step 2/, 'and the reader is still oriented');
});

test('WP-3A(c) MUTATION CONTROL: the combined case is not vacuously always-withhold', async () => {
  // Makes the test above fail-able. Same stale-session timing, same store — but a comparison
  // read that WORKS. The guard must then withhold for the OTHER reason, and the two codes must
  // be distinguishable, or "it withheld" proves nothing about which fault was detected.
  //
  // AMENDMENT 2 FIXTURE CORRECTION — `session_id` on the prior, `sessionId` on the writers; no
  // assertion changed. The stale-session case is by definition a case about ANOTHER session's
  // packet, and the fixture had left the prior unattributed. Same correction, same reason, as
  // the two above.
  const priorPacket = {
    schema: 1, kind: 'continuity', id: 'cont-prior', ts: '2026-08-05T09:00:00.000Z', seq: 1,
    backfill: false, session_id: 'sess-current', focus: 'the pointer that should stand', map_path: 'Deliverables/map-current.md',
  };
  const fake = fakeHoncho([priorPacket]);
  const gitStale = gitStub(
    { 'rev-parse': 'C:/old-worktree\n', grep: 'Deliverables/map-stale.md\n', 'merge-base': 'base9\n', log: gitLogOutput([[100, ['Deliverables/map-stale.md']]]) },
    { files: ['Deliverables/map-stale.md'] }
  ).io;

  const stale = await continuity.writeContinuity(
    { focus: 'old worktree, healthy read' },
    { cwd: 'C:/old-worktree', git: gitStale, fetchPage: fake.fetchPage, request: fake.request, sessionId: 'sess-old', sessionStartedAt: '2026-08-05T08:00:00.000Z' }
  );
  assert.equal(stale.packet.map_path_withheld, 'stale-session', 'a WORKING read attributes the withholding to the timing, not to the transport');

  // And the third direction: a healthy read AND a genuinely fresh session publishes normally.
  const fresh = fakeHoncho([priorPacket]);
  const published = await continuity.writeContinuity(
    { focus: 'a genuinely fresh session' },
    { cwd: 'C:/old-worktree', git: gitStale, fetchPage: fresh.fetchPage, request: fresh.request, sessionId: 'sess-fresh', sessionStartedAt: '2026-08-05T09:00:01.000Z' }
  );
  assert.equal(published.packet.map_path, 'Deliverables/map-stale.md', 'NOT always-withhold — the guard still publishes when authority IS established');
  assert.equal(Object.prototype.hasOwnProperty.call(published.packet, 'map_path_withheld'), false, 'and a published pointer carries no withhold marker');
});

test('WP-3A(c) COST: the guard reads ONE page, not a whole walk (E-I)', async () => {
  // E-I: the old guard ran a FULL `readLatest` inside the write path, "doubling network work
  // per session end". The guard only ever needed the newest packet's `ts`. Asserted as a call
  // count against a store big enough that a full walk would be visibly more than one request.
  const packets = [];
  for (let seq = 1; seq <= 250; seq++) {
    packets.push({
      schema: 1, kind: 'continuity', id: `cont-${seq}`, seq, backfill: false, focus: `f${seq}`,
      ts: new Date(Date.UTC(2026, 7, 5, 0, 0, 0, seq)).toISOString(),
    });
  }
  const fake = fakeHoncho(packets);
  let pageCalls = 0;
  const counting = (args) => { pageCalls++; return fake.fetchPage(args); };
  const gitOk = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[100, ['Deliverables/map.md']]]) },
    { files: ['Deliverables/map.md'] }
  ).io;

  await continuity.writeContinuity(
    { focus: 'f' },
    { cwd: 'C:/repo', git: gitOk, fetchPage: counting, request: fake.request, sessionStartedAt: '2026-08-06T00:00:00.000Z' }
  );
  assert.equal(pageCalls, 1, 'one page — a 250-message store would be three requests under a full walk');

  // CONTROL: prove the fixture really would take three pages if walked, so the assertion above
  // is measuring restraint rather than a small store.
  let walkCalls = 0;
  await continuity.readLatest({ fetchPage: (args) => { walkCalls++; return fake.fetchPage(args); } });
  assert.equal(walkCalls, 3, 'CONTROL: the same store costs three requests when genuinely walked');
});

test("FALLBACK: no sessionStartedAt (a manual `write`/`backfill` has no session to time) — nothing to compare, writes unconditionally", async () => {
  const priorPacket = {
    schema: 1, kind: 'continuity', id: 'cont-prior', ts: '2026-08-05T09:00:00.000Z', seq: 1,
    backfill: false, focus: 'prior', map_path: 'Deliverables/map-prior.md',
  };
  const fake = fakeHoncho([priorPacket]);
  const gitCandidate = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map-candidate.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[100, ['Deliverables/map-candidate.md']]]) },
    { files: ['Deliverables/map-candidate.md'] }
  ).io;
  const r = await continuity.writeContinuity(
    { focus: 'manual write, no session' },
    { cwd: 'C:/repo', git: gitCandidate, fetchPage: fake.fetchPage, request: fake.request } // sessionStartedAt omitted
  );
  assert.equal(r.packet.map_path, 'Deliverables/map-candidate.md', 'with nothing to compare, the write proceeds — an accepted limitation, named in the evidence file');
});

test('SEAM CONTROL: `deliver` routes EVERY Honcho call through the injected `request`, including `ensureStore`', async () => {
  // Justifies the seam added to `deliver`/`ensureStore`: without this, the claim "the write
  // path can be proven with no network" would rest on an untested assumption about
  // `ensureStore`'s three calls specifically.
  const seen = [];
  const request = async (path) => {
    seen.push(path);
    return path.includes('/messages') && !path.includes('/list') ? [{ id: 'm-1' }] : { id: 'ok' };
  };
  // No map candidate here (git throws) — isolates this test to the deliver/ensureStore path,
  // with no dependency on the comparison read this test is not about.
  const r = await continuity.writeContinuity(
    { focus: 'f' },
    { request, cwd: 'C:/not-a-repo', git: { run: () => { throw new Error('no git'); } } }
  );
  assert.equal(r.ok, true);
  assert.ok(seen.includes('/workspaces'), 'ensureStore/workspaces routed through the injected request');
  assert.ok(seen.includes('/workspaces/{ws}/peers'), 'ensureStore/peers routed through the injected request');
  assert.ok(seen.includes('/workspaces/{ws}/sessions'), 'ensureStore/sessions routed through the injected request');
  assert.ok(
    seen.some((p) => p.includes(`/sessions/${continuity.CONTINUITY_SESSION}/messages`) && !p.includes('/list')),
    'the final deliver POST routed through the injected request too'
  );
});

// ---------------------------------------------------------------------------
// sessionStartFromTranscript — the write-side protection's ONLY signal source
// ---------------------------------------------------------------------------
//
// Real transcripts on this machine are JSONL where the first one or two lines (`mode`,
// `file-history-snapshot`) commonly carry NO top-level `timestamp`, and the first line that
// does is a few lines in — this suite's fixtures mirror that shape rather than a simplified
// one, per a direct read of a real transcript file during this Work Order's reconnaissance.

function transcriptFixture(home, lines) {
  const path = join(home, `fixture-transcript-${Math.random().toString(36).slice(2)}.jsonl`);
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  return path;
}

test('TRANSCRIPT: the FIRST line carrying a top-level timestamp is the session start', () => {
  const home = cliHome();
  const path = transcriptFixture(home, [
    { type: 'mode', mode: 'normal' }, // real transcripts start this way — no timestamp
    { type: 'file-history-snapshot', snapshot: { timestamp: '2099-01-01T00:00:00.000Z' } }, // NESTED — must be ignored
    { type: 'attachment', timestamp: '2026-08-05T12:11:08.798Z' }, // the real session start
    { type: 'user', timestamp: '2026-08-05T12:11:08.900Z' },
  ]);
  assert.equal(continuity.sessionStartFromTranscript(path), '2026-08-05T12:11:08.798Z');
});

test('TRANSCRIPT: an unparseable, missing or timestamp-less transcript resolves to null, never a guess', () => {
  const home = cliHome();
  assert.equal(continuity.sessionStartFromTranscript(join(home, 'does-not-exist.jsonl')), null, 'missing file');
  assert.equal(continuity.sessionStartFromTranscript(transcriptFixture(home, [])), null, 'empty file');
  assert.equal(continuity.sessionStartFromTranscript(transcriptFixture(home, [{ type: 'mode' }])), null, 'no line carries a timestamp');
  const gibberish = join(home, 'gibberish.jsonl');
  writeFileSync(gibberish, 'not json at all\n{"broken\n', 'utf8');
  assert.equal(continuity.sessionStartFromTranscript(gibberish), null, 'unparseable lines are skipped, not guessed at');
  assert.equal(continuity.sessionStartFromTranscript(null), null, 'a non-string path never reaches the filesystem');
  assert.equal(continuity.sessionStartFromTranscript(42), null);
});

test('TRANSCRIPT: an invalid timestamp value is skipped in favour of the next valid line', () => {
  const home = cliHome();
  const path = transcriptFixture(home, [
    { type: 'a', timestamp: 'not-a-real-date' },
    { type: 'b', timestamp: '2026-08-05T12:00:00.000Z' },
  ]);
  assert.equal(continuity.sessionStartFromTranscript(path), '2026-08-05T12:00:00.000Z');
});

test('TRANSCRIPT MUTATION: the bounded head-read is REAL — a valid line beyond it is never found', () => {
  // Proves the bound documented in the source is enforced, not merely a comment. Padding well
  // past the bound, followed by the ONLY valid timestamped line, must not be found.
  const home = cliHome();
  const path = join(home, 'huge-transcript.jsonl');
  const padding = JSON.stringify({ type: 'padding', big: 'x'.repeat(2 * 1024 * 1024) }); // > the head-read bound alone
  writeFileSync(path, padding + '\n' + JSON.stringify({ type: 'real', timestamp: '2026-08-05T12:00:00.000Z' }) + '\n', 'utf8');
  assert.equal(continuity.sessionStartFromTranscript(path), null, 'the only valid line lives past the bounded read');
});

test('TRANSCRIPT MUTATION CONTROL: the SAME valid line, with no oversized padding ahead of it, IS found', () => {
  // Makes the test above fail-able: without this, "returns null" could mean the function is
  // simply broken, not that the bound genuinely excluded the line.
  const home = cliHome();
  const path = join(home, 'small-transcript.jsonl');
  writeFileSync(path, JSON.stringify({ type: 'real', timestamp: '2026-08-05T12:00:00.000Z' }) + '\n', 'utf8');
  assert.equal(continuity.sessionStartFromTranscript(path), '2026-08-05T12:00:00.000Z');
});

test('PRODUCT PATH: `stop` derives sessionStartedAt from the REAL transcript_path in its stdin payload, without breaking the existing map pointer', async () => {
  // This fixture's FETCH_STUB (see FETCH_STUB above) answers every call generically and
  // carries no real prior packet for `writeContinuity`'s comparison to find, so the write
  // falls back to unconditional (proven directly, with the store under full test control, in
  // the WRITE-AUTHORITY suite above). What THIS test proves is narrower and just as real: the
  // stdin -> transcript_path -> sessionStartFromTranscript -> writeContinuity wiring runs
  // end-to-end through the ACTUAL CLI without crashing or silently dropping the pointer.
  const home = cliHome();
  seedState(home);
  const transcriptPath = join(home, 'real-transcript.jsonl');
  writeFileSync(transcriptPath, [
    JSON.stringify({ type: 'mode', mode: 'normal' }),
    JSON.stringify({ type: 'user', timestamp: '2020-01-01T00:00:00.000Z' }),
  ].join('\n') + '\n', 'utf8');

  const r = runCli(home, ['stop'], {
    stdin: JSON.stringify({ session_id: 'sess-transcript', cwd: REPO_ROOT, transcript_path: transcriptPath }),
  });

  assert.equal(r.status, 0, `stop must succeed: ${r.stderr}`);
  assert.equal(r.delivered.length, 1, 'CONTROL: a packet actually reached the transport');
  assert.match(r.packet.map_path, /^Deliverables\/.+\.md$/, 'the transcript_path plumbing did not break the existing map pointer path');
});

// ---------------------------------------------------------------------------
// WP-3A(a) — THE FRONTIER READ AT PRESENT AND EXPECTED STORE SIZE
// ---------------------------------------------------------------------------
//
// WHAT THE MEASUREMENT SAYS, AND WHAT IT RULES OUT. E-B: ten of ten page-1 reads succeeded,
// worst case 9.8% of the 9,000 ms budget — so the 2026-08-05 abort was a TRANSIENT and "the
// store grew past the timeout" is NOT established and is NOT what these tests are built
// against. E-C: page 1 is ALREADY at the size:100 cap (items:100, total:149, pages:2), so
// growth adds PAGES, and a later-page failure was swallowed rather than raised.
//
// THE HAZARD THESE TESTS ACTUALLY PIN. `reverse=true` is documented; whether the DEPLOYED
// server honours it is unestablished, and this suite cannot establish it — no test here may
// reach the network. If it does not honour it, page 1 is the OLDEST hundred of 149, and
// `readLatest` returns a packet ~50 writes behind the frontier while `pages`, `total`, the
// repeat guard and the short-page rule all look healthy, because every one of those is a
// statement about the WALK and none is a statement about the ORDER. So the proofs below are
// about the CODE's behaviour under a server that ignores `reverse`, and they claim nothing
// whatever about what the real server does.

function ascendingPackets(n, base = Date.UTC(2026, 7, 5, 0, 0, 0, 0)) {
  const out = [];
  for (let seq = 1; seq <= n; seq++) out.push(packet({ seq, ts: new Date(base + seq).toISOString() }));
  return out;
}

test('WP-3A(a) THE HAZARD: a truncated read from a server that IGNORES `reverse` is NOT authoritative', async () => {
  // The measured store size, exactly: 149 messages, 100 to a page, two pages.
  const packets = ascendingPackets(149);
  const oldestFirstAlways = async ({ page, size }) => ({
    items: packets.slice((page - 1) * size, page * size).map((p) => msg(p)),
    total: packets.length, page, size, pages: Math.ceil(packets.length / size),
  });

  const truncated = await continuity.readLatest({ fetchPage: oldestFirstAlways, maxPages: 1 });
  assert.equal(truncated.latest.seq, 100, 'CONTROL: page 1 really is the OLDEST hundred, so this IS the stale answer');
  assert.equal(truncated.complete, false);
  assert.equal(truncated.incompleteReason, 'page-cap', 'and it says WHY, not merely that');
  assert.equal(truncated.newestFirstConfirmed, false, 'the server never demonstrated newest-first ordering');
  assert.equal(truncated.latestIsAuthoritative, false, 'so seq 100 must NOT be handed over as the frontier');

  // THE OTHER HALF, and the reason this is a pair: a walk that reaches the end is
  // authoritative whatever order the server used, because the module then holds everything
  // and its own sort settles it.
  const full = await continuity.readLatest({ fetchPage: oldestFirstAlways });
  assert.equal(full.latest.seq, 149, 'the full walk plus the defensive sort recover the genuinely newest');
  assert.equal(full.complete, true);
  assert.equal(full.latestIsAuthoritative, true);
});

test('WP-3A(a) MUTATION CONTROL: truncated is not automatically unauthoritative — newest-first, positively shown, is enough', async () => {
  // Makes the test above fail-able. Same truncation, same store size; the only difference is
  // that this server DID demonstrate newest-first ordering in what it returned. A rule of
  // "incomplete means untrustworthy" would pass the test above and fail here, and would also
  // fire the loud warning on every normal page-2 store — a warning that always fires is one
  // nobody reads, which is the failure WO-OR-18 already paid for once.
  const packets = ascendingPackets(149);
  const newestFirstTruncated = async ({ page, size }) => {
    const desc = [...packets].reverse();
    return {
      items: desc.slice((page - 1) * size, page * size).map((p) => msg(p)),
      total: packets.length, page, size, pages: Math.ceil(packets.length / size),
    };
  };
  const r = await continuity.readLatest({ fetchPage: newestFirstTruncated, maxPages: 1 });
  assert.equal(r.latest.seq, 149, 'the newest packet genuinely was on page 1');
  assert.equal(r.complete, false, 'the walk was still short — the count and history are partial');
  assert.equal(r.newestFirstConfirmed, true);
  assert.equal(r.latestIsAuthoritative, true, 'and that is enough to trust the FRONTIER, which is the question being asked');
});

test('WP-3A(a) A SINGLE PACKET CONFIRMS NOTHING — "no evidence against" is not confirmation', async () => {
  // The strictness rule inside `ordersNewestFirst`. One packet, or a run of identical
  // timestamps, cannot demonstrate an ordering. The honest answer is `false`, and `complete`
  // then has to carry the weight instead.
  const only = packet({ seq: 1, ts: '2026-08-05T09:00:00.000Z' });
  const oneOfFive = async ({ page }) => ({
    items: page === 1 ? [msg(only)] : [], total: 5, page, size: 100, pages: 2,
  });
  const r = await continuity.readLatest({ fetchPage: oneOfFive });
  assert.equal(r.count, 1);
  assert.equal(r.newestFirstConfirmed, false, 'one packet is not an ordering');
  assert.equal(r.complete, false, 'and the declared total says four more exist');
  assert.equal(r.incompleteReason, 'short-of-total');
  assert.equal(r.latestIsAuthoritative, false);
});

test('WP-3A(a) POSITIVE PAGE CHECK: a server answering a page we did not ask for is caught by the ECHO, not by inference', async () => {
  // Until now the ONLY detection of an ignored `page` was the repeat guard — an inference from
  // seeing nothing new. This server defeats that inference deliberately: it always answers
  // `page: 1` while handing back FRESH items every time, so nothing repeats and the old guard
  // never fires. Only reading the echoed page catches it.
  const ignoresPage = async ({ page, size }) => ({
    items: Array.from({ length: size }, (_, i) => msg(packet({ seq: page * 1000 + i, ts: new Date(Date.UTC(2026, 7, 6, 0, 0, i)).toISOString() }), `ip-${page}-${i}`)),
    total: 10000, page: 1, size, pages: 100,
  });
  const r = await continuity.listAllMessages({ fetchPage: ignoresPage });
  assert.equal(r.complete, false);
  assert.equal(r.incompleteReason, 'page-mismatch', 'the echoed page disagreed with the page requested');
  assert.equal(r.pages, 2, 'and it stopped on the SECOND request rather than walking to the cap');
  assert.equal(r.items.length, 100, 'keeping page 1, discarding the window it did not ask for');
});

test('WP-3A(a) POSITIVE PAGE CHECK MUTATION: the same server ECHOING correctly is not stopped', async () => {
  // Makes the test above fail-able: if the check fired on something other than the mismatch,
  // this identical server would also stop at two pages. It must walk to its own bound instead.
  const echoesPage = async ({ page, size }) => ({
    items: Array.from({ length: size }, (_, i) => msg(packet({ seq: page * 1000 + i, ts: new Date(Date.UTC(2026, 7, 6, 0, 0, i)).toISOString() }), `ep-${page}-${i}`)),
    total: 10000, page, size, pages: 100,
  });
  const r = await continuity.listAllMessages({ fetchPage: echoesPage });
  assert.equal(r.pages, 40, 'it walked to MAX_LIST_PAGES');
  assert.equal(r.incompleteReason, 'page-cap', 'and stopped for its OWN bound, not for a mismatch');
});

test('WP-3A(a) COUNT RECONCILIATION: a walk that terminated NORMALLY but holds 100 of a declared 149 is not complete', async () => {
  // THE SILENT CASE E-C NAMES, in its purest form. Every procedural termination is satisfied
  // here — the server declares `pages: 1`, so `page >= pages` fires on the first response and
  // the walk stops for the documented, correct reason. Nothing repeated, nothing failed,
  // nothing was capped. The ONLY thing that says a third of the store is missing is that the
  // envelope's own `total` and the items in hand disagree.
  const packets = ascendingPackets(149);
  const shortOfItsOwnTotal = async ({ page, size }) => ({
    items: packets.slice(0, 100).map((p) => msg(p)),
    total: 149, page, size, pages: 1,
  });
  const r = await continuity.listAllMessages({ fetchPage: shortOfItsOwnTotal });
  assert.equal(r.total, 149);
  assert.equal(r.items.length, 100);
  assert.equal(r.complete, false, 'terminating for a good reason is not the same as holding everything');
  assert.equal(r.incompleteReason, 'short-of-total');
});

test('WP-3A(a) COUNT RECONCILIATION MUTATION: when the count DOES add up, the walk stays complete', async () => {
  // Fail-ability for the check above, and protection against the arithmetic being inverted:
  // an off-by-one here would mark every healthy read incomplete and make the loud signal
  // worthless within a day.
  const packets = ascendingPackets(100);
  const honest = async ({ page, size }) => ({
    items: packets.map((p) => msg(p)), total: 100, page, size, pages: 1,
  });
  const r = await continuity.listAllMessages({ fetchPage: honest });
  assert.equal(r.complete, true);
  assert.equal(r.incompleteReason, null, 'a complete walk carries NO reason — a stale reason beside a green result is its own lie');
});

test('WP-3A(a) EVERY INCOMPLETE WALK NAMES ITS CAUSE — the five reasons, each from a server that produces it', async () => {
  // `incompleteReason` replaces a boolean that could not tell a reader whether one page was
  // rejected or the whole ordering was wrong. Enumerated rather than spot-checked: a field
  // with five producers and one asserted producer is four untested paths.
  const some = ascendingPackets(100);

  const rejectsPage2 = async ({ page, size }) => {
    if (page > 1) throw new Error('honcho POST /messages/list -> 422');
    return { items: some.map((p) => msg(p)), total: 500, page, size, pages: 5 };
  };
  assert.equal((await continuity.listAllMessages({ fetchPage: rejectsPage2 })).incompleteReason, 'page-failure');

  const stuck = async ({ page, size }) => ({ items: some.map((p) => msg(p)), total: 500, page, size, pages: 5 });
  assert.equal((await continuity.listAllMessages({ fetchPage: stuck })).incompleteReason, 'repeat-window');

  const endless = async ({ page, size }) => ({
    items: Array.from({ length: size }, (_, i) => msg(packet({ seq: page * 1000 + i, ts: new Date(Date.UTC(2026, 7, 7, 0, 0, i)).toISOString() }), `e-${page}-${i}`)),
    total: 999999, page, size, pages: 9999,
  });
  assert.equal((await continuity.listAllMessages({ fetchPage: endless })).incompleteReason, 'page-cap');

  const wrongPage = async ({ page, size }) => ({ items: some.map((p) => msg(p, `w-${page}-${p.seq}`)), total: 500, page: 1, size, pages: 5 });
  assert.equal((await continuity.listAllMessages({ fetchPage: wrongPage })).incompleteReason, 'page-mismatch');

  const short = async ({ page, size }) => ({ items: some.map((p) => msg(p)), total: 149, page, size, pages: 1 });
  assert.equal((await continuity.listAllMessages({ fetchPage: short })).incompleteReason, 'short-of-total');
});

test('WP-3A(a) THE BRIEF: an unestablished frontier is LOUD, and says so differently from a merely short walk', async () => {
  // The user-visible half. `latestIsAuthoritative` inside readLatest is worth nothing unless
  // it survives into the text a fresh session actually reads — that text being the entire
  // reason this module exists.
  const packets = ascendingPackets(149);

  const oldestFirstAlways = async ({ page, size }) => ({
    items: packets.slice((page - 1) * size, page * size).map((p) => msg(p)),
    total: packets.length, page, size, pages: 2,
  });
  const loud = await continuity.readContinuityBrief({ fetchPage: oldestFirstAlways, maxPages: 1, git: MAP_PRESENT_IO });
  assert.match(loud, /PAGINATION INCOMPLETE/, "WO-OR-18's floor is kept, not replaced");
  assert.match(loud, /prefer the git map/, 'and so is its instruction');
  assert.match(loud, /THE NEWEST PACKET IS NOT ESTABLISHED/, 'the escalated case must be distinguishable from the mild one');
  assert.match(loud, /may be far behind the real frontier/);
  assert.match(loud, /\(page-cap\)/, 'and it names the cause');

  const newestFirstTruncated = async ({ page, size }) => {
    const desc = [...packets].reverse();
    return { items: desc.slice((page - 1) * size, page * size).map((p) => msg(p)), total: packets.length, page, size, pages: 2 };
  };
  const mild = await continuity.readContinuityBrief({ fetchPage: newestFirstTruncated, maxPages: 1, git: MAP_PRESENT_IO });
  assert.match(mild, /PAGINATION INCOMPLETE/);
  assert.match(mild, /prefer the git map/);
  assert.match(mild, /The packet above IS the newest this read could establish/, 'the mild case must not cry wolf');
  assert.doesNotMatch(mild, /NOT ESTABLISHED/, 'or the escalation means nothing');
});

test('WP-3A(a) THE BRIEF MUTATION: neither warning fires on a healthy complete read', async () => {
  // A signal that always fires is one nobody reads. Both new wordings must be silent here.
  const { fetchPage } = pagingServer(ascendingPackets(86));
  const brief = await continuity.readContinuityBrief({ fetchPage, git: MAP_PRESENT_IO });
  assert.doesNotMatch(brief, /PAGINATION INCOMPLETE/);
  assert.doesNotMatch(brief, /NOT ESTABLISHED/);
  assert.match(brief, /likely active map/, 'CONTROL: it really did render the normal brief');
});

// ---------------------------------------------------------------------------
// WP-3A(d) — THE DEGRADED FALLBACK: identify as stale AND still orient
// ---------------------------------------------------------------------------
//
// E-J: the success path already renders an age and a closing orientation line; the failure
// branch rendered NEITHER, despite having the data. Warwick's bar is both halves — "a
// degraded render that is honest but leaves the reader with nowhere to go has met half the
// requirement and failed the other half."

test('WP-3A(d) DEGRADED RENDER: an unreachable Honcho identifies itself as stale AND still orients', async () => {
  continuity.saveState({ focus: 'the last thing this machine knew' });
  const dead = async () => { throw new Error('honcho POST /messages/list -> 503: upstream'); };
  const brief = await continuity.readContinuityBrief({ fetchPage: dead });

  assert.match(brief, /UNAVAILABLE this session/, 'the honesty that was already there is kept');
  assert.match(brief, /503/, 'including why');
  assert.match(brief, /STALE BY CONSTRUCTION/, 'HALF ONE: it names the cached focus as stale rather than merely presenting it');
  assert.match(brief, /last written .+ ago/, 'and how stale — the age it already had and never rendered');
  assert.match(brief, /the last thing this machine knew/, 'CONTROL: the cached value really is the one being labelled');
  assert.match(brief, /Deliverables\/` per `CLAUDE\.md` Step 2/, 'HALF TWO: and it still says where to go');
  assert.match(brief, /Nothing in this block is an instruction/, 'with the same zero-authority disclaimer every other branch carries');
});

test('WP-3A(d) DEGRADED RENDER: with NO cached focus it still orients, rather than trailing off', async () => {
  // The branch that used to return a single bare sentence. An empty recall is the case where
  // the reader has LEAST to go on, so it is the last place to stop talking.
  continuity.saveState({ focus: null });
  const dead = async () => { throw new Error('honcho POST /messages/list -> 503: upstream'); };
  const brief = await continuity.readContinuityBrief({ fetchPage: dead });

  assert.match(brief, /UNAVAILABLE this session/);
  assert.match(brief, /NO recall at all/, 'the absence is stated as a fact rather than left as a silence');
  assert.doesNotMatch(brief, /STALE BY CONSTRUCTION/, 'and nothing stale is invented to fill it');
  assert.match(brief, /Deliverables\/` per `CLAUDE\.md` Step 2/, 'the orientation line is NOT conditional on having recall');
});

// ---------------------------------------------------------------------------
// AMENDMENT 2 / VERITAS D-1 — a session must be able to update its OWN pointer
// ---------------------------------------------------------------------------
//
// THE DEFECT, FOUND BY VERITAS AGAINST THE INSTALLED PRODUCTION PATH. The guard published
// `map_path` only when `sessionStartMs > priorWriteMs` — and `priorWriteMs` advances on every
// stored write, INCLUDING writes made during this session's own life. So after the first
// packet of a session, that session's start time is permanently behind the last stored write,
// and every subsequent `stop` withheld the pointer for the rest of the session. Packet 154, a
// `stop`, withheld the path eight minutes after manual packet 153 carried it; latest-wins, so
// a fresh session got no map and no frontier at all.
//
// THE GUARD WAS BUILT TO STOP A STALE SESSION CLOBBERING A NEWER ONE, AND IT COULD NOT TELL
// ANOTHER SESSION'S WRITE FROM ITS OWN. Time alone cannot make that distinction — a timestamp
// says WHEN a packet was written, never WHO wrote it. The identity was on the packet the whole
// time (`session_id`, set by `buildPacket` and supplied by the Stop hook), and was not consulted.
//
// The two tests below reproduce the live sequence and the general case. Both were run RED
// against the pre-fix code before the fix was written.

test('AMD2 D-1 REGRESSION (the live sequence): a `stop` after a MANUAL write republishes the pointer', async () => {
  // Exactly what Veritas executed: packet 153 was a manual `write` that carried the map path
  // (guard bypassed — a manual write has no session to time), and packet 154 was a `stop`
  // eight minutes later from a session that had ALREADY been running. Under the old rule the
  // stop's session start was behind 153's write time, so 154 withheld and the good pointer
  // became unreachable.
  //
  // A manual write is a person at a keyboard, not a session. It carries no `session_id`, so it
  // can never be the "newer rival session" this guard exists to protect — and treating it as
  // one is what made AC-1 unreachable by the default route.
  const manualPacket = {
    schema: 1, kind: 'continuity', id: 'cont-153', ts: '2026-08-05T22:57:00.000Z', seq: 153,
    backfill: false, session_id: null, reason: 'manual',
    focus: 'Phase 3', map_path: 'Deliverables/2026-08-04-proofline-wayfinder-plan.md',
  };
  const fake = fakeHoncho([manualPacket]);
  const gitOk = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/2026-08-04-proofline-wayfinder-plan.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[1754000000, ['Deliverables/2026-08-04-proofline-wayfinder-plan.md']]]) },
    { files: ['Deliverables/2026-08-04-proofline-wayfinder-plan.md'] }
  ).io;

  const stop = await continuity.writeContinuity(
    { focus: 'Phase 3, later in the same working session' },
    {
      cwd: 'C:/repo', git: gitOk, fetchPage: fake.fetchPage, request: fake.request,
      reason: 'stop', sessionId: 'sess-live',
      // The session was already running when the manual write landed — the whole point.
      sessionStartedAt: '2026-08-05T21:30:00.000Z',
    }
  );

  assert.equal(stop.ok, true);
  assert.equal(
    stop.packet.map_path, 'Deliverables/2026-08-04-proofline-wayfinder-plan.md',
    'THE DEFECT: the Stop after a manual write withheld the pointer and left the store with none'
  );
  assert.equal(Object.prototype.hasOwnProperty.call(stop.packet, 'map_path_withheld'), false);

  // THE OBSERVABLE OUTCOME — what a fresh session actually reads. This is the assertion that
  // matches what Veritas ran: the primary AC-1 journey, end to end.
  const brief = await continuity.readContinuityBrief({ fetchPage: fake.fetchPage, git: MAP_PRESENT_IO });
  assert.match(brief, /likely active map: Deliverables\/2026-08-04-proofline-wayfinder-plan\.md/, 'a fresh session must get the map');
  assert.doesNotMatch(brief, /MAP POINTER WITHHELD/, 'which is precisely what it did NOT get at the reviewed head');
});

test('AMD2 D-1 REGRESSION (the general case): a session publishes on EVERY stop, not just its first', async () => {
  // "After a session's first packet, its own start time is permanently behind the last stored
  // write, and every subsequent stop withholds for the rest of its life." Three turns of one
  // ordinary session — the normal case, and the one that was broken.
  const fake = fakeHoncho([]);
  const gitOk = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map-A.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[1754000000, ['Deliverables/map-A.md']]]) },
    { files: ['Deliverables/map-A.md'] }
  ).io;
  const session = {
    cwd: 'C:/repo', git: gitOk, fetchPage: fake.fetchPage, request: fake.request,
    reason: 'stop', sessionId: 'sess-long', sessionStartedAt: '2026-08-05T20:00:00.000Z',
  };

  const first = await continuity.writeContinuity({ focus: 'turn 1' }, session);
  assert.equal(first.packet.map_path, 'Deliverables/map-A.md', 'CONTROL: the first write always published, even before the fix');

  const second = await continuity.writeContinuity({ focus: 'turn 2' }, session);
  assert.equal(second.packet.map_path, 'Deliverables/map-A.md', 'THE DEFECT: the second turn onward withheld — a session treated its own earlier packet as a rival');

  const third = await continuity.writeContinuity({ focus: 'turn 3' }, session);
  assert.equal(third.packet.map_path, 'Deliverables/map-A.md', 'and it never recovered for the life of the session');

  const brief = await continuity.readContinuityBrief({ fetchPage: fake.fetchPage, git: MAP_PRESENT_IO });
  assert.match(brief, /likely active map: Deliverables\/map-A\.md/);
  assert.match(brief, /turn 3/, 'CONTROL: the newest packet really is the third one');
});

test('AMD2 CROSS-SESSION PROTECTION UNCHANGED: an older session still cannot clobber a newer one', async () => {
  // Requirement 3. The fix must not reopen what this guard exists for. Two REAL sessions, each
  // with its own identity, exactly as the Stop hook supplies them in production: A is current,
  // B is an old worktree whose Stop fires later but which genuinely started earlier.
  const fake = fakeHoncho([]);
  const gitA = gitStub(
    { 'rev-parse': 'C:/repo-A\n', grep: 'Deliverables/map-A.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[5000, ['Deliverables/map-A.md']]]) },
    { files: ['Deliverables/map-A.md'] }
  ).io;
  const gitB = gitStub(
    { 'rev-parse': 'C:/repo-B\n', grep: 'Deliverables/map-B-stale.md\n', 'merge-base': 'base2\n', log: gitLogOutput([[5000, ['Deliverables/map-B-stale.md']]]) },
    { files: ['Deliverables/map-B-stale.md'] }
  ).io;

  const a = await continuity.writeContinuity(
    { focus: 'session A, current build' },
    { cwd: 'C:/repo-A', git: gitA, fetchPage: fake.fetchPage, request: fake.request, reason: 'stop', sessionId: 'sess-A', sessionStartedAt: '2026-08-05T10:00:00.000Z' }
  );
  assert.equal(a.packet.map_path, 'Deliverables/map-A.md', 'CONTROL: A really did post a pointer, or B has nothing to fail to displace');

  const beforeA = new Date(Date.parse(a.packet.ts) - 60 * 60 * 1000).toISOString();
  const b = await continuity.writeContinuity(
    { focus: 'session B, an old worktree finally closing' },
    { cwd: 'C:/repo-B', git: gitB, fetchPage: fake.fetchPage, request: fake.request, reason: 'stop', sessionId: 'sess-B', sessionStartedAt: beforeA }
  );
  assert.equal(Object.prototype.hasOwnProperty.call(b.packet, 'map_path'), false, "B's stale write must STILL not carry the pointer");
  assert.equal(b.packet.map_path_withheld, 'stale-session');
  assert.equal(b.packet.focus, 'session B, an old worktree finally closing', 'and every other field still writes normally');

  const after = await continuity.readLatest({ fetchPage: fake.fetchPage });
  assert.equal(Object.prototype.hasOwnProperty.call(after.latest, 'map_path'), false, 'the stale path never became the visible pointer');
});

test('AMD2 THE DISCRIMINATOR IS IDENTITY, NOT TIME: same timings, different session ids, opposite outcomes', async () => {
  // The control that makes the two above fail-able in BOTH directions at once. An identical
  // prior packet and an identical session start time; the ONLY thing that changes between the
  // two runs is whether the stored packet came from this session or another one. A fix that
  // always publishes would fail the second half; the shipped defect fails the first.
  const priorFrom = (sessionId) => ({
    schema: 1, kind: 'continuity', id: 'cont-prior', ts: '2026-08-05T09:00:00.000Z', seq: 1,
    backfill: false, session_id: sessionId, focus: 'prior', map_path: 'Deliverables/map-prior.md',
  });
  const gitCandidate = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map-candidate.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[4242, ['Deliverables/map-candidate.md']]]) },
    { files: ['Deliverables/map-candidate.md'] }
  ).io;
  const startedBeforeThePrior = '2026-08-05T08:00:00.000Z';

  const mine = fakeHoncho([priorFrom('sess-me')]);
  const own = await continuity.writeContinuity(
    { focus: 'my own later turn' },
    { cwd: 'C:/repo', git: gitCandidate, fetchPage: mine.fetchPage, request: mine.request, reason: 'stop', sessionId: 'sess-me', sessionStartedAt: startedBeforeThePrior }
  );
  assert.equal(own.packet.map_path, 'Deliverables/map-candidate.md', 'MY OWN earlier write must never block me');

  const theirs = fakeHoncho([priorFrom('sess-someone-else')]);
  const rival = await continuity.writeContinuity(
    { focus: 'an older session closing late' },
    { cwd: 'C:/repo', git: gitCandidate, fetchPage: theirs.fetchPage, request: theirs.request, reason: 'stop', sessionId: 'sess-me', sessionStartedAt: startedBeforeThePrior }
  );
  assert.equal(Object.prototype.hasOwnProperty.call(rival.packet, 'map_path'), false, 'ANOTHER session\'s newer write still blocks me');
  assert.equal(rival.packet.map_path_withheld, 'stale-session');
});

test('AMD2 THE FAIL-OPEN PATH STAYS CLOSED: identity does not rescue an unestablished authority', async () => {
  // Requirement 3, the half that matters most: "a fix that opens the fail-open path this WP
  // closed is worse than the defect". The same-session rule must sit BEHIND the authority
  // check, never in front of it — if the comparison read cannot be made at all, there is no
  // stored packet, no `session_id`, and therefore nothing that could establish sameness.
  const throwingFetchPage = async () => { throw new Error('Honcho unreachable'); };
  const fake = fakeHoncho([]);
  const gitOk = gitStub(
    { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[100, ['Deliverables/map.md']]]) },
    { files: ['Deliverables/map.md'] }
  ).io;
  const r = await continuity.writeContinuity(
    { focus: 'f' },
    { cwd: 'C:/repo', git: gitOk, fetchPage: throwingFetchPage, request: fake.request, reason: 'stop', sessionId: 'sess-me', sessionStartedAt: '2026-08-05T20:00:00.000Z' }
  );
  assert.equal(r.ok, true, 'the packet is still delivered');
  assert.equal(Object.prototype.hasOwnProperty.call(r.packet, 'map_path'), false, 'and an unreachable read still WITHHOLDS — a session id is not a substitute for authority');
  assert.equal(r.packet.map_path_withheld, 'authority-unestablished');

  // And the same for a read that succeeds but cannot establish the newest packet: a truncated
  // walk from a server that never demonstrated newest-first. The `session_id` visible on such
  // a read may not be the newest session's at all, so it must not unlock publication.
  const packets = [];
  for (let seq = 1; seq <= 149; seq++) {
    packets.push({
      schema: 1, kind: 'continuity', id: `cont-${seq}`, seq, backfill: false, session_id: 'sess-me',
      ts: new Date(Date.UTC(2026, 7, 5, 0, 0, 0, seq)).toISOString(), focus: `f${seq}`,
    });
  }
  const oldestFirstAlways = async ({ page, size }) => ({
    items: packets.slice((page - 1) * size, page * size).map((p) => msg(p)),
    total: packets.length, page, size, pages: 2,
  });
  const unestablished = await continuity.writeContinuity(
    { focus: 'f' },
    { cwd: 'C:/repo', git: gitOk, fetchPage: oldestFirstAlways, request: fake.request, reason: 'stop', sessionId: 'sess-me', sessionStartedAt: '2026-08-05T20:00:00.000Z' }
  );
  assert.equal(
    unestablished.packet.map_path_withheld, 'authority-unestablished',
    'a non-authoritative read withholds even when the packets it DID see carry my own session id'
  );
});

// ---------------------------------------------------------------------------
// OUTCOME A — CLOSE-SESSION vs ROTATE, and the third kind of map absence.
//
// BUILD-020 Sub-phase 4D, 2026-08-08. Every test below FAILS without the source change it
// covers; each was run against the unmodified module first. A test that cannot fail is not a
// check, and this file already says so about its own affordances.
// ---------------------------------------------------------------------------

const CLOSE_GIT_OK = gitStub(
  { 'rev-parse': 'C:/repo\n', grep: 'Deliverables/map-A.md\n', 'merge-base': 'base1\n', log: gitLogOutput([[1754000000, ['Deliverables/map-A.md']]]) },
  { files: ['Deliverables/map-A.md'] }
).io;

test('OUTCOME A: a CLOSED session renders positively — it never renders as an empty or failed one', async () => {
  const fake = fakeHoncho([]);
  const w = await continuity.writeContinuity(
    { focus: 'work banked' },
    { cwd: 'C:/repo', git: CLOSE_GIT_OK, fetchPage: fake.fetchPage, request: fake.request, reason: 'close-session', sessionClose: true, sessionId: 'sess-close' }
  );
  assert.equal(w.packet.session_close, true, 'the close must be recorded ON the packet — `reason` is volatile and excluded from the content hash');

  const brief = await continuity.readContinuityBrief({ fetchPage: fakeHoncho([w.packet]).fetchPage, git: MAP_PRESENT_IO });
  assert.match(brief, /DELIBERATELY CLOSED/, 'a closed session must say so');
  assert.match(brief, /NOT a lost or failed rotation/, 'it must distinguish itself from a broken rotation');
  assert.match(brief, /CLOSED SESSION IS NOT A CLOSED BUILD/, 'closing a session must never read as closing a Build');
  assert.match(brief, /BACKLOG\.md/, 'it must say planned work was not erased, and where it still lives');
  assert.doesNotMatch(brief, /map path missing or invalid/, 'the generic absence branch would report a correct close as a defect');
});

test('OUTCOME A: a close packet carries NO resume pointer, so the next Larry cannot inherit one', async () => {
  const fake = fakeHoncho([]);
  const w = await continuity.writeContinuity(
    { focus: 'work banked' },
    { cwd: 'C:/repo', git: CLOSE_GIT_OK, fetchPage: fake.fetchPage, request: fake.request, reason: 'close-session', sessionClose: true, sessionId: 'sess-close' }
  );
  assert.equal(w.packet.map_path, undefined, 'a resolvable map must still be OMITTED on a close — what is not written cannot be auto-resumed');
  assert.equal(
    w.packet.map_path_withheld, undefined,
    'a close carries no pointer BY DESIGN; labelling it withheld would re-merge the two states this separates'
  );
});

test('OUTCOME A: an ordinary ROTATE packet is unchanged — it still carries its pointer and no close marker', async () => {
  const fake = fakeHoncho([]);
  const w = await continuity.writeContinuity(
    { focus: 'still mid-mission' },
    { cwd: 'C:/repo', git: CLOSE_GIT_OK, fetchPage: fake.fetchPage, request: fake.request, reason: 'stop', sessionId: 'sess-rotate' }
  );
  assert.equal(w.packet.map_path, 'Deliverables/map-A.md', 'rotate must still hand the Wayfinder forward');
  assert.ok(!('session_close' in w.packet), 'the field must be OMITTED, never written false — no stored packet changes meaning');
});

test('RCA 1.2: a map that cannot be RESOLVED is diagnosed, not left as a bare absence', async () => {
  const fake = fakeHoncho([]);
  // The 2026-08-08 condition exactly: the writer stood outside a git repository, so
  // `resolveActiveMapPath` returned null and the packet was stored carrying nothing at all.
  const notARepo = gitStub({ 'rev-parse': '\n' }).io;
  const w = await continuity.writeContinuity(
    { focus: 'written from a dead directory' },
    { cwd: 'C:/not-a-repo', git: notARepo, fetchPage: fake.fetchPage, request: fake.request, reason: 'stop', sessionId: 'sess-x' }
  );
  assert.equal(w.packet.map_path, undefined, 'no pointer could be resolved');
  assert.equal(
    w.packet.map_path_withheld, 'map-unresolvable',
    'the REASON must be on the packet — before this, "writer stood in the wrong place" and "estate has no map" were indistinguishable'
  );

  const brief = await continuity.readContinuityBrief({ fetchPage: fakeHoncho([w.packet]).fetchPage, git: MAP_PRESENT_IO });
  assert.match(brief, /WORKING DIRECTORY/, 'the render must point at the writer\'s location as the cause');
  assert.match(brief, /says nothing about whether a map EXISTS/, 'it must refuse to imply the estate is map-less');
});
