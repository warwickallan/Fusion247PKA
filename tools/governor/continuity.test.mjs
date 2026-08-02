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
  const brief = await continuity.readContinuityBrief({ fetchPage: truncated, maxPages: 1 });
  assert.match(brief, /PAGINATION INCOMPLETE/, 'a truncated read must announce itself in the brief');
  assert.match(brief, /prefer the git map/);
});

test('THE BRIEF MUTATION: on a complete read the warning is ABSENT and the newest focus is presented', async () => {
  // Makes the test above fail-able: a brief that always carried the warning would pass it
  // while telling every session to distrust a perfectly good packet.
  const packets = [];
  for (let seq = 1; seq <= 86; seq++) packets.push(packet({ seq, ts: new Date(Date.UTC(2026, 7, 5, 1, 0, seq)).toISOString() }));
  const { fetchPage } = pagingServer(packets);
  const brief = await continuity.readContinuityBrief({ fetchPage });
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

test('CONTAINMENT MUTATION: the redirect is what steers it — the module resolves its store under the sandbox', async () => {
  // Makes the containment test fail-able. If USERPROFILE were being ignored, STATE_FILE
  // would point at the real home and the assertion above could still pass on a stale
  // sandbox directory left by an earlier run.
  assert.ok(
    continuity.STATE_FILE.startsWith(SANDBOX_HOME),
    `the module's own state path must be inside the sandbox — got ${continuity.STATE_FILE}`
  );
});
