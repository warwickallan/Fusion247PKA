// WO-TW-02 test double — the `gh` seam as an INJECTABLE MODULE, for a spawned watcher.
//
// `test/doubles/fakeGh.mjs` is a factory an in-process test calls directly. A watcher running in
// its own process cannot be handed a closure, so it takes a module path in TOWER_GH_MODULE and
// imports whatever exports `ghCliReader` — exactly how TOWER_REVIEWER_MODULE and
// TOWER_GIT_EVIDENCE_MODULE already work. This is that module.
//
// THE FIXTURE IS RE-READ ON EVERY CALL, on purpose. A test needs to change what GitHub "has" —
// post a second checkpoint, start failing — while the watcher keeps running, because that is the
// only way to prove a LATER checkpoint is detected by an ALREADY-RUNNING watcher. Caching the
// fixture at import would quietly make that test impossible to write correctly.
//
//   TOWER_FAKE_GH_FIXTURE=/path/to.json   { "headSha": "<40-hex>", "comments": [...],
//                                           "fail": "<message>"|null }
//
// `fail` makes every call throw, which is how the loud-failure escalation is exercised without
// unplugging anything real.

import fs from 'node:fs';
import { makeFakeGh } from './fakeGh.mjs';
import { assertCommentPostArgs } from '../../postVerdict.mjs';

function readFixture() {
  const p = process.env.TOWER_FAKE_GH_FIXTURE;
  if (!p) throw new Error('fakeGhModule: TOWER_FAKE_GH_FIXTURE is not set');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export const ghCliReader = {
  async api(args) {
    const fx = readFixture();
    if (fx.fail) throw new Error(`gh api ${args.join(' ')} failed: ${fx.fail}`);
    // Delegate to the STRICT double, so an endpoint the real seam would never build is refused
    // here too. A permissive double proves things about itself rather than about the code.
    return makeFakeGh({ headSha: fx.headSha, comments: fx.comments ?? [] }).api(args);
  },
};

// ── WO-TW-02: the WRITE seam, and it is a SEPARATE export on purpose ─────────────────────────
// The real modules keep the reader and the writer apart; a double that merged them would let the
// suite pass over a design the code does not have. Every post is appended as a JSON line to
// TOWER_FAKE_GH_POSTS so a test can assert what actually reached "GitHub" — including from a
// spawned watcher, where a closure could never be observed.
let nextFakeCommentId = 900000;

export const ghCliWriter = {
  async postComment({ repo, prNumber, body }) {
    const fx = readFixture();
    // The REAL writer builds this argv and asserts it. Running the same assertion here means the
    // double refuses anything the real guard would refuse, rather than being more permissive
    // than the thing it stands in for.
    assertCommentPostArgs(['--method', 'POST', `repos/${repo}/issues/${prNumber}/comments`, '-f', `body=${body}`]);
    if (fx.postFail) throw new Error(`gh api POST comment failed: ${fx.postFail}`);

    const id = nextFakeCommentId++;
    const url = `https://github.com/${repo}/pull/${prNumber}#issuecomment-${id}`;
    const out = process.env.TOWER_FAKE_GH_POSTS;
    if (out) fs.appendFileSync(out, `${JSON.stringify({ repo, prNumber, body, id, url })}\n`);
    return { commentId: id, url };
  },
};
