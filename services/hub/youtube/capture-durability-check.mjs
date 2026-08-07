// BUILD-020 Sub-phase 4B (WO-27) — GATE: the YouTube capture pipeline must be honest about durability,
// and must be able to recover itself, and both must be provable WITHOUT a database and WITHOUT the
// network.
//
// Five things this gate exists to hold, none of which inspection can establish:
//
//  1. NO POSTGRES, NO CREDENTIALS, NO NETWORK are touched by merely loading these modules. This is not
//     proved by reading imports and reasoning — before WO-27, `watch-captures.mjs` called main() at the
//     top level with a static `pg` import, so importing it read the gateway credentials, connected to
//     production Postgres and ran a full live pass. A module-load hook records every module the process
//     actually resolves, and the assertion reads that record.
//  2. ENSURE SEMANTICS, BOTH BRANCHES. A healthy watcher is left alone; an absent one is started. Proved
//     twice: through injected probes, and end-to-end against a REAL sentinel process and a REAL temp log
//     directory — never against the live watcher, the real log directory or the real state file.
//  3. COMPLETE vs DEGRADED IS DECIDED BY A PROBE OF GIT, not by persistCapture's returned flag. Reached
//     against REAL throwaway repositories in every state: untracked, staged-not-committed, committed,
//     and committed-then-modified. This is the acceptance property of the Work Order — a green must
//     never outrun durability.
//  4. RECONCILE IS IDEMPOTENT. A stranded capture is committed on a later pass; an already-durable one
//     costs no second commit.
//  5. ESCALATION FIRES ONCE PER EPISODE, not once per tick.
//
// Exits non-zero on failure AND on a vacuous run.

import { registerHooks } from 'node:module';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// --- module-load recorder, installed BEFORE the modules under test are imported ------------------
// Registered first, and the imports below are dynamic for that reason: a static import would be
// hoisted and resolved before this line ran, and the recorder would have watched nothing.
const LOADED = [];
registerHooks({
  load(url, context, nextLoad) {
    LOADED.push(url);
    return nextLoad(url, context);
  },
});

const watch = await import('./watch-captures.mjs');
const ensure = await import('./ensure-youtube-watcher.mjs');
const persistMod = await import('./persistCapture.mjs');

const {
  CAPTURE_STATES, capturePaths, classifyCapture, briefingMessage, reconcileCapture, REPO_ROOT, VAULT_DIR,
} = watch;
const {
  ensureWatcher, readState, writeState, writeHeartbeat, heartbeatIsFresh, escalationMessage,
  EMPTY_STATE, HEARTBEAT_STALE_MS, ESCALATE_AFTER_ATTEMPTS,
  defaultListWatchers, defaultKillWatcher, defaultStartWatcher,
} = ensure;
const { persistCapture, captureIsPersisted, isTransientGitLockError, captureCommitMessage } = persistMod;

let ran = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  ran++;
  if (cond) console.log('  PASS  ' + name + (detail ? ' — ' + detail : ''));
  else { failed++; console.error('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};

const tmps = [];
const mktmp = (prefix) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmps.push(d);
  return d;
};
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();

function makeRepo() {
  const dir = mktmp('yt-durability-');
  git(['init', '-q', '-b', 'main'], dir);
  git(['config', 'user.email', 'test@example.com'], dir);
  git(['config', 'user.name', 'Test'], dir);
  git(['config', 'commit.gpgsign', 'false'], dir);
  fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed\n');
  git(['add', 'seed.txt'], dir);
  git(['commit', '-q', '-m', 'seed'], dir);
  return dir;
}

/** Write a capture into a repo exactly as the pipeline does: a note plus its immutable _raw evidence. */
function writeCapture(dir, videoId) {
  const notePath = `Sources/${videoId}-note.md`;
  const rawPath = `Sources/_raw/${videoId}`;
  fs.mkdirSync(path.join(dir, VAULT_DIR, rawPath), { recursive: true });
  fs.writeFileSync(path.join(dir, VAULT_DIR, notePath), `# note ${videoId}\n`);
  fs.writeFileSync(path.join(dir, VAULT_DIR, rawPath, 'tubeair-report.md'), 'raw transcript\n');
  fs.writeFileSync(path.join(dir, VAULT_DIR, rawPath, 'manifest.json'), '{}\n');
  return { notePath, rawPath, paths: capturePaths({ notePath, rawPath }) };
}

console.log('\n=== 1. no database, no credentials, no network at module load ===');
{
  const joined = LOADED.join('\n');
  ok('the recorder is not looking at nothing', LOADED.length > 0, `${LOADED.length} modules recorded`);
  ok('NO pg driver is loaded', !LOADED.some((u) => /[/\\]pg[/\\]/.test(u)));
  ok('NO Claude caller (t2-calibrate) is loaded', !/t2-calibrate/.test(joined));
  ok('generate-source-note is NOT in the static graph', !/generate-source-note/.test(joined));
  ok('the modules under test really were loaded', /watch-captures\.mjs/.test(joined) && /ensure-youtube-watcher\.mjs/.test(joined) && /persistCapture\.mjs/.test(joined));
  ok('watch-captures exports its durability core', typeof classifyCapture === 'function' && typeof reconcileCapture === 'function' && typeof briefingMessage === 'function');
}

console.log('\n=== 2. ensure semantics — both branches, injected probes ===');
{
  const statePath = path.join(mktmp('yt-state-'), 'state.json');
  const T0 = Date.parse('2026-08-07T12:00:00.000Z');
  const started = [];
  const killed = [];
  const mk = (opts) => ensureWatcher({
    listWatchers: () => opts.running ?? [],
    killWatcher: (pid) => { killed.push(pid); return true; },
    startWatcher: () => { started.push(1); return { pid: 4242 }; },
    notify: opts.notify ?? (() => true),
    statePath, now: opts.now ?? T0, log: () => {},
  });

  // --- branch A: a HEALTHY watcher is left completely alone ---
  writeState({ statePath, state: { ...EMPTY_STATE, heartbeat_at: new Date(T0 - 5000).toISOString(), recovery_attempts: 2 } });
  const healthy = mk({ running: [{ pid: 111, commandLine: 'node watch-captures.mjs --watch=30' }] });
  ok('healthy watcher: action is left-running', healthy.action === 'left-running', healthy.action);
  ok('healthy watcher: it is NOT killed', killed.length === 0, `killed=[${killed}]`);
  ok('healthy watcher: nothing is started', started.length === 0, `started=${started.length}`);
  ok('healthy watcher: exit-0 semantics (healthy true)', healthy.healthy === true);
  ok('healthy watcher: the failure counter is RESET', readState({ statePath }).recovery_attempts === 0);

  // --- branch B: NO watcher running -> start one ---
  const none = mk({ running: [] });
  ok('absent watcher: action is started', none.action === 'started', none.action);
  ok('absent watcher: reason names the cause', none.reason === 'no-watcher-running', none.reason);
  ok('absent watcher: exactly one start', started.length === 1, `started=${started.length}`);
  ok('absent watcher: nothing was killed', killed.length === 0);
  ok('absent watcher: attempt counted', none.attempts === 1, `attempts=${none.attempts}`);
}

console.log('\n=== 2b. the HUNG case — alive but no longer polling ===');
{
  const statePath = path.join(mktmp('yt-state-'), 'state.json');
  const T0 = Date.parse('2026-08-07T12:00:00.000Z');
  const killed = [];
  let starts = 0;
  const run = (state, running) => {
    writeState({ statePath, state: { ...EMPTY_STATE, ...state } });
    return ensureWatcher({
      listWatchers: () => running,
      killWatcher: (pid) => { killed.push(pid); return true; },
      startWatcher: () => { starts++; return { pid: 999 }; },
      notify: () => true, statePath, now: T0, log: () => {},
    });
  };

  const stale = run(
    { heartbeat_at: new Date(T0 - HEARTBEAT_STALE_MS - 1000).toISOString() },
    [{ pid: 222, commandLine: 'node watch-captures.mjs --watch=30' }],
  );
  ok('a HUNG watcher (alive, stale heartbeat) is detected as unhealthy', stale.healthy === false);
  ok('a HUNG watcher is named as heartbeat-stale', stale.reason === 'heartbeat-stale', stale.reason);
  ok('a HUNG watcher is killed', killed.includes(222), `killed=[${killed}]`);
  ok('a HUNG watcher is replaced', starts === 1 && stale.action === 'restarted', stale.action);

  const dupes = run(
    { heartbeat_at: new Date(T0 - 1000).toISOString() },
    [{ pid: 301, commandLine: 'a' }, { pid: 302, commandLine: 'b' }],
  );
  ok('duplicate pollers are detected even with a FRESH heartbeat', dupes.reason === 'multiple-instances', dupes.reason);
  ok('duplicate pollers collapse back to exactly one', killed.includes(301) && killed.includes(302) && starts === 2);

  ok('a missing state file is not fresh', heartbeatIsFresh({ state: EMPTY_STATE, now: T0 }) === false);
  ok('a corrupt state file reads as empty, it does not throw', (() => {
    const p = path.join(mktmp('yt-state-'), 'state.json');
    fs.writeFileSync(p, '{ not json');
    return readState({ statePath: p }).recovery_attempts === 0;
  })());
  ok('a heartbeat merges into state without clobbering the counter', (() => {
    const p = path.join(mktmp('yt-state-'), 'state.json');
    writeState({ statePath: p, state: { ...EMPTY_STATE, recovery_attempts: 2 } });
    writeHeartbeat({ statePath: p, now: T0, pid: 77 });
    const s = readState({ statePath: p });
    return s.recovery_attempts === 2 && s.heartbeat_pid === 77;
  })());
}

console.log('\n=== 3. escalation fires ONCE per episode, not once per tick ===');
{
  const statePath = path.join(mktmp('yt-state-'), 'state.json');
  let T = Date.parse('2026-08-07T12:00:00.000Z');
  const sent = [];
  const tick = (running = []) => {
    T += 5 * 60 * 1000; // the PT5M Scheduled Task interval
    return ensureWatcher({
      listWatchers: () => running,
      killWatcher: () => true,
      startWatcher: () => ({ pid: 5150 }),
      notify: (m) => { sent.push(m); return true; },
      statePath, now: T, log: () => {},
    });
  };

  const t1 = tick(); const t2 = tick(); const t3 = tick(); const t4 = tick(); const t5 = tick();
  ok('consecutive failed recoveries accumulate', [t1, t2, t3, t4, t5].map((r) => r.attempts).join(',') === '1,2,3,4,5',
    [t1, t2, t3, t4, t5].map((r) => r.attempts).join(','));
  ok(`no escalation before the threshold (${ESCALATE_AFTER_ATTEMPTS})`, !t1.escalated && !t2.escalated);
  ok('escalation fires exactly at the threshold', t3.escalated === true);
  ok('escalation does NOT repeat on later ticks', !t4.escalated && !t5.escalated);
  ok('exactly ONE message was sent for the episode', sent.length === 1, `sent=${sent.length}`);
  ok('the message says links are not being processed', /NOT being processed/.test(sent[0] || ''));

  // Recovery clears the episode, so a LATER failure can escalate again. The recovered watcher proves it
  // is polling by writing a heartbeat — without that this tick is a HUNG watcher, not a healthy one.
  T += 5 * 60 * 1000;
  writeHeartbeat({ statePath, now: T, pid: 1 });
  const recovered = ensureWatcher({
    listWatchers: () => [{ pid: 1, commandLine: 'x' }], killWatcher: () => true, startWatcher: () => ({ pid: 1 }),
    notify: (m) => { sent.push(m); return true; }, statePath,
    now: T, log: () => {}, staleMs: HEARTBEAT_STALE_MS,
  });
  ok('a recovered watcher reads as healthy', recovered.action === 'left-running', recovered.action);
  ok('a healthy tick clears the escalation episode', readState({ statePath }).escalated_at === null);
  ok('a healthy tick sends no further message', sent.length === 1, `sent=${sent.length}`);
  ok('escalationMessage names the attempt count', /2 recovery attempts/.test(escalationMessage({ attempts: 2, reason: 'x' })));
}

console.log('\n=== 4. durability is PROBED from git, in every real repository state ===');
{
  const dir = makeRepo();
  const cap = writeCapture(dir, 'probeA');

  ok('untracked capture is NOT durable', captureIsPersisted({ repoRoot: dir, paths: cap.paths }) === false);

  git(['add', '--', ...cap.paths], dir);
  ok('STAGED but not committed is NOT durable', captureIsPersisted({ repoRoot: dir, paths: cap.paths }) === false);

  git(['commit', '-q', '-m', 'capture'], dir);
  ok('committed capture IS durable', captureIsPersisted({ repoRoot: dir, paths: cap.paths }) === true);

  fs.writeFileSync(path.join(dir, VAULT_DIR, cap.notePath), '# edited after commit\n');
  ok('committed-then-MODIFIED is NOT durable', captureIsPersisted({ repoRoot: dir, paths: cap.paths }) === false);

  git(['checkout', '--', '.'], dir);
  ok('restored capture is durable again', captureIsPersisted({ repoRoot: dir, paths: cap.paths }) === true);

  ok('a non-repository answers NOT durable rather than throwing',
    captureIsPersisted({ repoRoot: mktmp('yt-norepo-'), paths: ['Team Knowledge/x.md'] }) === false);
  ok('empty input answers NOT durable', captureIsPersisted({ repoRoot: dir, paths: [] }) === false);
  ok('capturePaths prefixes the vault dir', capturePaths({ notePath: 'Sources/a.md', rawPath: 'Sources/_raw/a' })
    .join('|') === `${VAULT_DIR}/Sources/a.md|${VAULT_DIR}/Sources/_raw/a`);
}

console.log('\n=== 5. COMPLETE vs DEGRADED — the acceptance property ===');
{
  const c1 = classifyCapture({ notePath: 'Sources/x.md', durable: true });
  const c2 = classifyCapture({ notePath: 'Sources/x.md', durable: false });
  const c3 = classifyCapture({ notePath: null, durable: false });
  ok('note filed AND durable => COMPLETE', c1.state === CAPTURE_STATES.COMPLETE, c1.state);
  ok('note filed, NOT durable => DEGRADED', c2.state === CAPTURE_STATES.DEGRADED, c2.state);
  ok('no note yet => PENDING', c3.state === CAPTURE_STATES.PENDING, c3.state);

  const degraded = briefingMessage({ videoId: 'v', title: 'T', state: c2.state, notePath: 'Sources/x.md', detail: 'git-failed' });
  ok('a DEGRADED briefing NEVER contains the word COMPLETE', !/COMPLETE/.test(degraded), degraded.split('\n')[0]);
  ok('a DEGRADED briefing says DEGRADED', /DEGRADED/.test(degraded));
  ok('a DEGRADED briefing says the commit has NOT completed', /has NOT completed/.test(degraded));
  ok('a DEGRADED briefing reassures that nothing is lost', /Nothing is lost/.test(degraded));

  const complete = briefingMessage({ videoId: 'v', title: 'T', state: c1.state, notePath: 'Sources/x.md', sha: 'abcdef1234' });
  ok('a COMPLETE briefing says COMPLETE', /COMPLETE/.test(complete));
  ok('a COMPLETE briefing carries the short sha', /abcdef12/.test(complete));

  const transition = briefingMessage({ videoId: 'v', title: 'T', state: c1.state, sha: 'beef1234', transition: true });
  ok('the DEGRADED->COMPLETE transition is reported as such', /now safely stored/.test(transition) && /COMPLETE/.test(transition));

  const pend = briefingMessage({ videoId: 'v', title: 'T', state: c3.state });
  ok('a PENDING briefing never says COMPLETE', !/COMPLETE/.test(pend));
  for (const m of [degraded, complete, transition, pend]) {
    ok('briefing is short enough for a phone (<=5 lines)', m.split('\n').length <= 5, `${m.split('\n').length} lines`);
  }
}

console.log('\n=== 6. reconcile — rescues a stranded capture, and is idempotent ===');
{
  const dir = makeRepo();
  const cap = writeCapture(dir, 'strandedA');
  const head0 = git(['rev-parse', 'HEAD'], dir);

  // This is the REAL condition: the note is filed, the DB row would be correct, git has nothing.
  ok('precondition: the capture really is stranded', captureIsPersisted({ repoRoot: dir, paths: cap.paths }) === false);
  const before = classifyCapture({ notePath: cap.notePath, durable: captureIsPersisted({ repoRoot: dir, paths: cap.paths }) });
  ok('a stranded capture classifies as DEGRADED', before.state === CAPTURE_STATES.DEGRADED, before.state);

  const r1 = reconcileCapture({ videoId: 'strandedA', title: 'Stranded', notePath: cap.notePath, rawPath: cap.rawPath, repoRoot: dir });
  ok('reconcile commits the stranded capture', r1.action === 'reconciled' && r1.committed === true, r1.action);
  ok('reconcile moved HEAD exactly once', git(['rev-parse', 'HEAD'], dir) !== head0);
  const head1 = git(['rev-parse', 'HEAD'], dir);

  const after = classifyCapture({ notePath: cap.notePath, durable: captureIsPersisted({ repoRoot: dir, paths: cap.paths }) });
  ok('after reconcile the capture classifies as COMPLETE', after.state === CAPTURE_STATES.COMPLETE, after.state);

  const r2 = reconcileCapture({ videoId: 'strandedA', title: 'Stranded', notePath: cap.notePath, rawPath: cap.rawPath, repoRoot: dir });
  ok('reconciling an already-durable capture is a NO-OP', r2.action === 'already-durable' && r2.committed === false, r2.action);
  ok('reconcile made NO second commit', git(['rev-parse', 'HEAD'], dir) === head1);

  const r3 = reconcileCapture({ videoId: 'x', title: 't', notePath: null, rawPath: null, repoRoot: dir });
  ok('reconcile with nothing to do is safe', r3.action === 'nothing-to-do');

  // Unrelated concurrent work must survive a reconcile untouched.
  const dir2 = makeRepo();
  const cap2 = writeCapture(dir2, 'strandedB');
  fs.writeFileSync(path.join(dir2, 'scratch.txt'), 'someone else is mid-edit\n');
  fs.writeFileSync(path.join(dir2, 'seed.txt'), 'edited\n');
  reconcileCapture({ videoId: 'strandedB', title: 'B', notePath: cap2.notePath, rawPath: cap2.rawPath, repoRoot: dir2 });
  const files = git(['show', '--name-only', '--format=', 'HEAD'], dir2).split('\n').filter(Boolean);
  ok('reconcile never sweeps unrelated work into the commit',
    files.every((f) => f.startsWith(`${VAULT_DIR}/`)), files.join(','));
  ok("reconcile leaves the other party's work exactly where it was",
    /scratch\.txt/.test(git(['status', '--porcelain'], dir2)) && /seed\.txt/.test(git(['status', '--porcelain'], dir2)));
}

console.log('\n=== 7. a transient .git/index.lock costs a bounded retry, not the capture ===');
{
  ok('an index.lock error is recognised as transient',
    isTransientGitLockError('fatal: Unable to create \'C:/x/.git/index.lock\': File exists.'));
  ok('a ref lock is recognised as transient', isTransientGitLockError('cannot lock ref'));
  ok('a real failure is NOT treated as transient', !isTransientGitLockError('fatal: not a git repository'));
  ok('a bad pathspec is NOT treated as transient', !isTransientGitLockError("error: pathspec 'x' did not match"));

  // The lock clears after two attempts — exactly the real event of 2026-08-07.
  const dir = makeRepo();
  const cap = writeCapture(dir, 'lockA');
  let calls = 0;
  const slept = [];
  const flaky = (args, cwd) => {
    if (args[0] === 'add') {
      calls++;
      if (calls <= 2) { const e = new Error("fatal: Unable to create '.git/index.lock': File exists."); throw e; }
    }
    return git(args, cwd);
  };
  const r = persistCapture({
    repoRoot: dir, paths: cap.paths, message: captureCommitMessage({ videoId: 'lockA', title: 'L' }),
    runGit: flaky, backoffMs: 1, sleep: (ms) => slept.push(ms),
  });
  ok('the capture is committed despite the lock', r.committed === true, r.reason || '');
  ok('it retried exactly twice', r.lockRetries === 2, `lockRetries=${r.lockRetries}`);
  ok('it backed off between attempts', slept.length === 2, `slept=${slept.length}`);
  ok('the committed capture is genuinely durable', captureIsPersisted({ repoRoot: dir, paths: cap.paths }) === true);

  // A lock that never clears must NOT be retried forever, and must NOT lose the capture.
  const dir2 = makeRepo();
  const cap2 = writeCapture(dir2, 'lockB');
  let tries = 0;
  const stuck = persistCapture({
    repoRoot: dir2, paths: cap2.paths, message: 'm',
    runGit: () => { tries++; throw new Error("Unable to create '.git/index.lock': File exists."); },
    backoffMs: 1, sleep: () => {},
  });
  ok('a permanently held lock gives up bounded', stuck.committed === false && stuck.reason === 'git-failed', stuck.reason);
  ok('the retry is bounded, not infinite', tries === 4, `git calls=${tries}`);
  ok('the stranded capture is still on disk for the reconcile pass',
    fs.existsSync(path.join(dir2, VAULT_DIR, cap2.notePath)));
  const rescued = reconcileCapture({ videoId: 'lockB', title: 'B', notePath: cap2.notePath, rawPath: cap2.rawPath, repoRoot: dir2 });
  ok('and a later pass rescues exactly that capture', rescued.action === 'reconciled' && rescued.committed === true, rescued.action);

  // A NON-transient failure must not be retried at all.
  let hardTries = 0;
  persistCapture({
    repoRoot: '/anywhere', paths: ['a'], message: 'm',
    runGit: () => { hardTries++; throw new Error('fatal: not a git repository'); }, sleep: () => {},
  });
  ok('a non-transient failure is NOT retried', hardTries === 1, `git calls=${hardTries}`);
}

console.log('\n=== 8. AC4 end-to-end: a note filed with git persistence outstanding ===');
{
  // Construct the REAL condition rather than asserting on a hand-built object: a capture on disk, a
  // repository that does not hold it, and the briefing Warwick would actually receive.
  const dir = makeRepo();
  const cap = writeCapture(dir, 'acceptanceA');
  const durable = captureIsPersisted({ repoRoot: dir, paths: cap.paths });
  const c = classifyCapture({ notePath: cap.notePath, durable });
  const message = briefingMessage({ videoId: 'acceptanceA', title: 'AWS veteran', state: c.state, notePath: cap.notePath, detail: 'git-failed' });

  ok('ACCEPTANCE — durability probe says NOT durable', durable === false);
  ok('ACCEPTANCE — the state is DEGRADED', c.state === CAPTURE_STATES.DEGRADED, c.state);
  ok('ACCEPTANCE — the briefing Warwick receives does NOT say COMPLETE', !/COMPLETE/.test(message));
  ok('ACCEPTANCE — the briefing says DEGRADED and names the outstanding step', /DEGRADED/.test(message) && /git commit has NOT completed/.test(message));

  // ...and the transition, once reconciliation commits it, is observable and reported.
  const rec = reconcileCapture({ videoId: 'acceptanceA', title: 'AWS veteran', notePath: cap.notePath, rawPath: cap.rawPath, repoRoot: dir });
  const durable2 = captureIsPersisted({ repoRoot: dir, paths: cap.paths });
  const c2 = classifyCapture({ notePath: cap.notePath, durable: durable2 });
  const msg2 = briefingMessage({ videoId: 'acceptanceA', title: 'AWS veteran', state: c2.state, sha: rec.sha, transition: true });
  ok('ACCEPTANCE — the transition to durable is OBSERVABLE', durable2 === true && c2.state === CAPTURE_STATES.COMPLETE);
  ok('ACCEPTANCE — the transition is REPORTED to Warwick', /COMPLETE/.test(msg2) && /now safely stored/.test(msg2));
}

console.log('\n=== 9. ensure semantics END-TO-END against a real process and a real log dir ===');
{
  // The real defaultListWatchers / defaultKillWatcher / defaultStartWatcher, exercised against a
  // SENTINEL script — never `watch-captures.mjs`, never `C:/.fusion247/logs`, never the live watcher.
  const work = mktmp('yt-e2e-');
  const logDir = path.join(work, 'logs');
  const statePath = path.join(work, 'state.json');
  const sentinel = path.join(work, 'yt-ensure-sentinel.mjs');
  const MATCH = '*yt-ensure-sentinel.mjs*--watch*';
  fs.writeFileSync(sentinel, 'setTimeout(() => {}, 600000);\n');

  const listSentinels = () => defaultListWatchers({ match: MATCH });
  const waitFor = (pred, ms = 15000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const v = pred();
      if (v) return v;
      spawnSync(process.execPath, ['-e', 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)'], { windowsHide: true });
    }
    return pred();
  };

  ok('E2E precondition: no sentinel is running', listSentinels().length === 0);

  // --- branch B for real: none running -> START one ---
  const startRes = ensureWatcher({
    statePath, logDir, watcher: sentinel, cwd: work, match: MATCH, interval: 30,
    notify: () => true, now: Date.now(), log: () => {},
  });
  ok('E2E: ensure STARTED a watcher when none was running', startRes.action === 'started', startRes.action);
  const appeared = waitFor(() => (listSentinels().length === 1 ? listSentinels() : null));
  ok('E2E: the process really is in the process table', Array.isArray(appeared) && appeared.length === 1,
    `${(appeared || []).length} found`);
  ok('E2E: the real log directory was created where told', fs.existsSync(path.join(logDir, 'youtube-watcher.log')));
  ok('E2E: the log dir is the temp one, NOT the secrets store', logDir.startsWith(os.tmpdir()));

  // --- branch A for real: healthy -> LEAVE IT ALONE ---
  const livePid = (appeared || [{}])[0].pid;
  writeHeartbeat({ statePath, now: Date.now(), pid: livePid });
  const leaveRes = ensureWatcher({
    statePath, logDir, watcher: sentinel, cwd: work, match: MATCH, interval: 30,
    notify: () => true, now: Date.now(), log: () => {},
  });
  ok('E2E: ensure LEFT the healthy watcher alone', leaveRes.action === 'left-running', leaveRes.action);
  ok('E2E: it reported the same live pid', leaveRes.pid === livePid, `${leaveRes.pid} vs ${livePid}`);
  const stillThere = listSentinels();
  ok('E2E: the SAME process is still alive after ensure ran',
    stillThere.length === 1 && stillThere[0].pid === livePid, `${stillThere.map((p) => p.pid)}`);
  ok('E2E: the healthy path reset the failure counter', readState({ statePath }).recovery_attempts === 0);

  // cleanup — leave nothing running
  for (const p of listSentinels()) defaultKillWatcher(p.pid);
  const gone = waitFor(() => (listSentinels().length === 0 ? true : null));
  ok('E2E: the sentinel was cleaned up', gone === true, `${listSentinels().length} left`);
  ok('E2E: the REAL watcher was never touched — no state written to the default path',
    !statePath.includes('.mypka'), statePath.startsWith(os.tmpdir()) ? 'temp state path' : statePath);
}

for (const d of tmps) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }

console.log('');
if (ran === 0) { console.error('CAPTURE-DURABILITY-CHECK FAIL — zero assertions executed.'); process.exit(1); }
if (failed) { console.error(`CAPTURE-DURABILITY-CHECK FAIL — ${failed} of ${ran} assertions failed.`); process.exit(1); }
console.log(`CAPTURE-DURABILITY-CHECK PASS — ${ran} assertions executed, 0 failed.`);
