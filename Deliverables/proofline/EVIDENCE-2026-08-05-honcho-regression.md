# EVIDENCE — Honcho continuity regression, 2026-08-05

| Field | Value |
|---|---|
| **work_order** | WO-2026-08-05-10 (+ Amendment 1) |
| **collected_by** | Mack (Automation Specialist) |
| **collected_at** | 2026-08-05, ~22:00–22:10 local (BST, UTC+1) |
| **for** | **Pax** — who holds no `Bash`. Every claim below is carried by pasted real output |
| **worktree** | `C:\Fusion247PKA-build-020-trial` · branch `build-020/honcho-regression-investigation` |
| **HEAD at collection** | `aaf7c46a0455d97e98a4c613c353c6d358a1bfe9` (was `c39825c` at dispatch; `aaf7c46` = Amendment 1 commit) |
| **authority** | `live_authority: none` · READ-ONLY · **no network call made** · **no Honcho API call made** · nothing written, moved, restarted or re-installed |
| **private_surface** | `none` — **nothing under `C:\.fusion247\**` was read.** See §11, which matters: the credential lives there and was deliberately not opened |

> **I am not the investigator.** Findings below are labelled **FACT** (carried by pasted output) or
> **HYPOTHESIS** (my reading, which Pax should treat as a lead to test, not a conclusion).
> Where something is not established I say **UNKNOWN** rather than closing it.

---

## 0. Instrument note — read this before reproducing anything here

Two failure modes are real on this machine and **both** must be handled, or a command returns a
confident wrong answer. Proven by execution during the read-back:

```
$ export MSYS_NO_PATHCONV=1
$ git -C "/c/Fusion247PKA-build-020-trial" rev-parse HEAD
fatal: cannot change to '/c/Fusion247PKA-build-020-trial': No such file or directory
--- exit: 128 ---

$ git -C "C:/Fusion247PKA-build-020-trial" rev-parse HEAD
c39825cc3a48e5e4e137c08fee04e5f2b5d7d16e
--- exit: 0 ---
```

```
$ (unset MSYS_NO_PATHCONV; tasklist /FI "IMAGENAME eq node.exe" /FO CSV)
ERROR: Invalid argument/option - 'C:/Program Files/Git/FI'.
```

**Rule used throughout this file: `MSYS_NO_PATHCONV=1` IS set, AND Windows-form paths (`C:/...`)
are used for every native binary (`git`, `tasklist`, `powershell`).** MSYS binaries (`ls`, `grep`,
`cat`) accept `/c/...` either way. `node -v` → `v22.18.0`.

---

## 1. THE HEADLINE — what the evidence establishes

**The symptom is two separate things with two separate causes, and conflating them will send the
investigation the wrong way.**

| | Symptom | Status from this evidence |
|---|---|---|
| **A** | `HONCHO CONTINUITY: UNAVAILABLE this session (This operation was aborted)` | **FACT: a 9,000 ms client-side timeout on the FIRST page of the message-list read.** Not a missing credential, not an HTTP error, not a code change in the regression window |
| **B** | The fallback was the loose-`Deliverables` sweep, not a map pointer | **FACT: a direct, by-design consequence of A.** The map pointer is only rendered on the success path; when the read throws, the `catch` branch renders cached focus and no pointer |

**And two hypotheses Larry's Work Order carried are DEAD, killed by execution:**

- ❌ **"Stale install"** — the installed governor is **byte-exact** against the git blob at both
  `c21c3f3` and `65757c6`, all 8 files. The apparent size delta was CRLF in the *worktree*. §10.
- ❌ **"L-3 is the sharpest lead — sidecars moving while the store is not"** — this is **BY DESIGN**.
  The `stop` hook *structurally cannot* write `continuity.json`. §3.

**And one fact that reframes the whole thing:** a Honcho **write succeeded at 21:45:44**, in the
same minute as the failing read. Honcho was reachable and the credential was valid. §7.

---

## 2. The store and its sidecars — L-1, L-3, L-5 verified

```
$ export MSYS_NO_PATHCONV=1 && ls -la "/c/Users/Buggly/.mypka/governor/"
total 314
drwxr-xr-x 1 Buggly 197121     0 Aug  5 21:45 .
drwxr-xr-x 1 Buggly 197121     0 Aug  5 16:06 ..
-rw-r--r-- 1 Buggly 197121  2141 Aug  5 21:26 INSTALLED-FROM.txt
-rw-r--r-- 1 Buggly 197121  9652 Aug  5 21:25 atomic-write.mjs
-rw-r--r-- 1 Buggly 197121   103 Aug  5 21:45 continuity-last.json
-rw-r--r-- 1 Buggly 197121    16 Aug  5 21:45 continuity-seq.json
-rw-r--r-- 1 Buggly 197121  3449 Aug  5 10:54 continuity.json
-rw-r--r-- 1 Buggly 197121  2110 Aug  2 01:30 continuity.json.phase3-bak
-rw-r--r-- 1 Buggly 197121 69370 Aug  5 21:25 continuity.mjs
drwxr-xr-x 1 Buggly 197121     0 Aug  1 03:37 delegation
-rw-r--r-- 1 Buggly 197121 10170 Aug  5 21:25 evaluator.mjs
-rw-r--r-- 1 Buggly 197121 82747 Aug  5 21:25 footer.mjs
drwxr-xr-x 1 Buggly 197121     0 Aug  1 15:10 handbacks
drwxr-xr-x 1 Buggly 197121     0 Aug  5 10:50 health
-rw-r--r-- 1 Buggly 197121  9053 Aug  5 21:25 health-store.mjs
-rw-r--r-- 1 Buggly 197121  2027 Aug  1 03:05 registry.json
-rwxr-xr-x 1 Buggly 197121 59092 Aug  5 21:25 reorient.mjs
-rw-r--r-- 1 Buggly 197121 27431 Aug  5 21:25 sampler.mjs
-rwxr-xr-x 1 Buggly 197121  9793 Aug  5 21:25 statusline-live.mjs
```

**L-3 CONFIRMED** — `continuity-last.json` and `continuity-seq.json` at **21:45**;
`continuity.json` at **10:54**. **L-4 CONFIRMED** — all eight `.mjs` at **21:25**.

### `continuity.json` — full contents

```json
{
  "focus": "BUILD-020 Phase 2 - Honcho and Tower as durable shared myPKA infrastructure. Phase 1 (Proofline) CLOSED and PASSED by Warwick 2026-08-04.",
  "immediate_objective": "Finish implementation (WP-2E TowerBot QA exchange, WP-2C event-driven ding), bank in Git, Veritas rotation-readiness check, then rotate. Fresh Larry takes final Veritas, Codex UAT and merge.",
  "warwick_last_request": "Bank everything useful in Git, have Veritas verify nothing material remains only in this session, then consider rotation.",
  "accepted_decisions": [
    "Warwick authorised the six-phase Veritas-gated route on 2026-08-04: \"Yes I authorise and agree that.\" ATTESTED BY LARRY, NOT VERIFIABLE FROM THE REPOSITORY. He has NOT read or accepted the 430-line map as a document.",
    "The Wayfinder map holds the directive role; the four briefs are non-directive under one byte-identical precedence chain.",
    "SHIT-TO-DO.md is reviewed and the review recorded before BUILD-015 is described as complete.",
    "Gate 3 corrections are made by rewriting documents into one current state, never by striking text and layering notes."
  ],
  "completed": [
    "Three commits: d63668f first Gate 3 discharge, c9b04cf the Veritas receipt verbatim, 94f135f the second discharge. All pushed. No code changed in any of them.",
    "D-G3-01 through D-G3-20 all dispositioned. Veritas confirmed D-G3-03, 04, 06, 07 and 11 genuinely discharged.",
    "All fourteen asdair suites: 1609 tests, 1606 pass, 0 fail, 3 SKIPPED. The skips are DB-gated and are NOT passes."
  ],
  "blockers": [
    "No Veritas verdict PASS exists. Three Gate 3 reviews, three HOLDs. Documentation truth is up from FAIL to HOLD. Nothing may be recorded complete without a PASS at an exact head.",
    "Execution packet has no production caller and no persistence. Nothing in this build has ever written a row to Postgres; restart and resume are UNPROVEN.",
    "Packet table contract conflict: the interface doc says integer and one-row-per-shop; Silas ruled bigint, surrogate PK, append-and-retain. node-postgres returns int8 as a STRING and the cockpit read route treats shop_id as a number.",
    "Silas's migration-015 schema decision has no durable record; migrations 013 and 014 have no committed files, so the live DB is ahead of the repo.",
    "RETRACTED CLAIM: the repository scanning script was recorded as failing open. It does not. Executed by Veritas: 128 without a git dir, 0 under --surface, 2 on a bad target. Its invariant holds. The false row is finding D-G3-21 and must be deleted, not acted on.",
    "CONFIRMED BY EXECUTION: receipt_sha256 verifies only against the git blob. A fresh clone renders CRLF and produces a FALSE TAMPER SIGNAL. Every assurance receipt is currently unverifiable by a cloning reviewer, including Codex. A product-decision for Warwick.",
    "Larry asserted facts he had not executed FIVE times tonight, and Veritas did so TWICE in its own receipt. Check every claim before acting on it, including an assurance receipt's evidence rows."
  ],
  "next_action": "Open Deliverables/2026-08-04-proofline-wayfinder-plan.md and read section 14.19 - the SINGLE statement of the live frontier. Section 12 is Phase 1 history.",
  "notes": "Codex contract at services/control-plane/review/prompts/tower-qa-skill.md ships DRAFT and does NOT govern until Warwick ratifies it. No live Codex call before that.",
  "updated_at": "2026-08-05T09:54:14.545Z"
}
```

**L-1 CONFIRMED** — `updated_at` is `2026-08-05T09:54:14.545Z` = **10:54 local**, ~12 h stale at the
21:4x session.
**L-5 CONFIRMED** — `blockers` and `completed` describe **BUILD-015 / AsdAIr Gate 3** work, not
Phase 2. `focus` still names Phase 2 as live.

### The sidecars

```json
// continuity-last.json
{ "key": "-1686797793", "id": "cont-1785962741497-152-dxrlo7", "at": "2026-08-05T20:45:44.278Z" }

// continuity-seq.json
{ "seq": 152 }
```

Decoded packet-id timestamp — `node -e "console.log(new Date(1785962741497).toISOString())"`:

```
2026-08-05T20:45:41.497Z
```

So packet **seq 152** was **built at 20:45:41.497Z** and its success marker written at
**20:45:44.278Z** — a 2.8 s round trip. Both = **21:45 local**.

### L-2 — the rendered focus vs the stored focus

```
stored focus length : 137
stored focus sha256 : b1b2cf6b1401e017782b2cef8619cf28571b33644bfca86d547879a7d0a78e98
stored focus prefix ==  WO-quoted prefix : true
stored focus (verbatim):
"BUILD-020 Phase 2 - Honcho and Tower as durable shared myPKA infrastructure. Phase 1 (Proofline) CLOSED and PASSED by Warwick 2026-08-04."
```

**L-2 CONFIRMED, and it is true by construction, not by coincidence** — see §6: the `catch` branch
renders `readJson(STATE_FILE).focus` verbatim. The injection *had* to match `continuity.json`.

> **One transcription artefact, so nobody chases it.** The Work Order quotes the symptom as
> `could not be read - say so` (hyphen). The code — in **both** the repo and the installed copy —
> uses an em dash. `cat -A` of the installed file, line 931:
> `...could not be read M-bM-^@M-^T say so...` (`M-bM-^@M-^T` = U+2014). The hyphen is in the
> Work Order's transcription, **not** a difference between installed and repo code.

---

## 3. Who writes what on `stop` — L-3 is BY DESIGN, not a fault

**This is the most important correction in the file.** The Work Order calls L-3 "the sharpest lead:
the seq/last sidecars are moving while the store is not." It is by design and cannot be otherwise.

`tools/governor/continuity.mjs:1127` — **`writeArgs` is `null` for every command except `write`**:

```js
const writeArgs = cmd === 'write' ? planWriteArgs(a) : null;
```

`continuity.mjs:1192–1193` — **the ONLY call to `saveState`, i.e. the only writer of
`continuity.json`**:

```js
let state = loadState();
if (writeArgs && writeArgs.supplied.length) state = saveState(writeArgs.patch);
```

`continuity.mjs:48` — `STATE_FILE` *is* `continuity.json`:

```js
const STATE_FILE = join(STORE_DIR, 'continuity.json'); // authoritative semantic state Larry maintains
```

**Therefore, when `cmd === 'stop'`: `writeArgs` is `null` → the guard short-circuits → `saveState`
is never called → `continuity.json` is NEVER written by the Stop hook. Not conditionally. Ever.**

What `stop` *does* write, in order (`continuity.mjs:1198–1211`):

```js
if (cmd === 'stop') {
  const key = String(hashStr(JSON.stringify({
    f: state.focus, n: state.next_action, d: state.accepted_decisions,
    c: state.completed, b: state.blockers, s: sessionId,
  })));
  const last = readJson(LAST_FILE, {});
  if (last.key === key) {
    process.stdout.write(JSON.stringify({ command: 'stop', skipped: 'unchanged for this session' }) + '\n');
    return 0;
  }
  const r = await writeContinuity(state, { reason: 'stop', sessionId, cwd: sessionCwd || process.cwd(), sessionStartedAt });
  if (r.ok) atomicWriteJson(LAST_FILE, { key, id: r.id, at: new Date().toISOString() });
  process.stdout.write(JSON.stringify({ command: 'stop', ...summ(r) }) + '\n');
  return 0; // a boundary hook never signals failure via exit code
}
```

1. **Dedupe first.** If `(focus, next_action, decisions, completed, blockers, sessionId)` hashes to
   the stored key, it returns having written **nothing**.
2. Otherwise `writeContinuity` → `buildPacket` → **`nextSeq()` at line 338**, which writes
   `continuity-seq.json` (`continuity.mjs:81–86`).
3. Delivery to Honcho.
4. **`continuity-last.json` is written ONLY `if (r.ok)`.**

**FACT — the operational consequence, and it is the strongest single datum in this file:**
`continuity-last.json` has mtime **21:45** and `at: 2026-08-05T20:45:44.278Z`. That file is written
**only on `r.ok === true`**. **A Honcho WRITE therefore SUCCEEDED at 21:45:44**, in the same minute
as the failing session-start READ.

> **What that rules out, immediately:** a missing/unreadable credential, a dead API key, a totally
> unreachable host, a DNS failure, a proxy block. All of those would have failed the write too.
> Read and write share `hf()`, the same base URL and the same credential.

**FACT — `continuity.json` is stale simply because nobody ran `continuity.mjs write --<field>`
since 10:54.** It is a hand-maintained file, not a hook-maintained one. Its staleness is an
*operating* gap, not a code fault. **HYPOTHESIS:** this is worth raising on its own merits —
the local fallback that the brief leans on when Honcho is down is only as fresh as the last manual
`write`, and it was 12 h stale exactly when it was needed.

---

## 4. The write-authority race — it CANNOT suppress the write, and it fails OPEN

`tools/governor/continuity.mjs:593–620`, verbatim:

```js
export async function writeContinuity(state, opts = {}) {
  const packet = buildPacket(state, opts);

  if (packet.map_path) {
    try {
      const { cwd, git, request, reason, sessionId, backfill, sessionStartedAt, ...readOpts } = opts;
      const current = await readLatest(readOpts);
      const priorWriteMs = current && current.latest ? Date.parse(current.latest.ts) : NaN;
      const sessionStartMs = typeof sessionStartedAt === 'string' ? Date.parse(sessionStartedAt) : NaN;
      // Reject unless THIS session genuinely started after the last write. Anything
      // uncomparable (NaN on either side) leaves the packet untouched — see "accepted
      // limitations" above.
      if (Number.isFinite(priorWriteMs) && Number.isFinite(sessionStartMs) && !(sessionStartMs > priorWriteMs)) {
        delete packet.map_path;
      }
    } catch {
      // Honcho unreachable / readLatest failed — fall back to the unconditional write. Named
      // explicitly, per the block above: a Stop hook must not throw over this.
    }
  }

  try {
    const ref = await deliver(packet, { request: opts.request });
    return { ok: true, id: packet.id, ref, packet };
  } catch (e) {
    return { ok: false, id: packet.id, error: e.message, packet };
  }
}
```

Answering the Work Order's two questions exactly:

**Q: "Establish whether that guard is what is now suppressing the write."**
**FACT: NO. It structurally cannot.** Its only effect is `delete packet.map_path`. It never skips
`deliver()`, never returns early, and never touches `continuity.json` (which `writeContinuity` does
not write at all). **The guard cannot explain a suppressed write, because no write is suppressed.**

**Q: "Whether a session that never gets a valid start time can ever win."**
**FACT: YES — it ALWAYS wins. The guard fails OPEN.** With no valid start time,
`sessionStartMs` is `NaN`, `Number.isFinite(NaN)` is `false`, the whole condition is `false`, and
`map_path` is **kept**. Same if the read throws — the `catch` falls through to an unconditional
write. `sessionStartedAt` is only ever populated for `stop` (`continuity.mjs:1151`), derived from
the Stop hook's `transcript_path` via `sessionStartFromTranscript`, which "degrades to null on any
failure".

**HYPOTHESIS — but the guard IS a live suspect for symptom B (the missing map pointer), on a
different mechanism than Larry proposed.** `priorWriteMs` is the timestamp of the single newest
stored packet *from any session*. `stop` fires **every turn**. So after a session's first delivered
packet, `priorWriteMs` advances past that session's own start time, and from then on
`sessionStartMs > priorWriteMs` is **false for the rest of that session's life** → `map_path` is
**stripped from every subsequent packet that session writes**. In a multi-session estate any
concurrently-running session has the same effect immediately.

**Net effect if that reading is right: `map_path` survives only on a session's FIRST delivered
packet, and only if no other session wrote in between.** Over time the newest stored packet would
tend to carry **no `map_path`** — and `readContinuityBrief` renders *"map path missing or invalid —
treat continuity as absent and orient from `Deliverables/`"* in exactly that case (§6). **That is
symptom B's wording, reachable without any read failure at all.**

**UNKNOWN and important:** whether the packets actually stored in Honcho right now carry `map_path`.
**Settling this requires reading the Honcho store, which is a network call and is barred by this
Work Order.** I did not do it. It is the single highest-value next measurement and it needs an
explicit network authorisation.

---

## 5. Hook registration — three levels, and the install record is WRONG about one of them

### `C:\Users\Buggly\.claude\settings.json` (user level) — FULL

```json
{
  "model": "opus[1m]",
  "statusLine": {
    "type": "command",
    "command": "node C:/Users/Buggly/.mypka/governor/statusline-live.mjs"
  },
  "extraKnownMarketplaces": {
    "honcho": {
      "source": { "source": "github", "repo": "plastic-labs/claude-honcho" }
    }
  },
  "autoUpdatesChannel": "latest",
  "theme": "dark",
  "remoteControlAtStartup": true,
  "inputNeededNotifEnabled": true,
  "agentPushNotifEnabled": true,
  "effortLevel": "high",
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node C:/Users/Buggly/.mypka/governor/reorient.mjs" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node C:/Users/Buggly/.mypka/governor/continuity.mjs stop" } ] }
    ]
  }
}
```

### `C:\Fusion247PKA-build-020-trial\.claude\settings.local.json` (the session's own project) — FULL

```json
{
  "permissions": {
    "allow": [
      "Bash(git status *)",
      "Bash(npm --version)",
      "Bash(node -e \"try{require\\('node:sqlite'\\);console.log\\('node:sqlite AVAILABLE'\\)}catch\\(e\\){console.log\\('node:sqlite UNAVAILABLE:',e.code||e.message\\)}\")",
      "Bash(git log *)",
      "Bash(export MSYS_NO_PATHCONV=1)",
      "Bash(tasklist /FI \"IMAGENAME eq node.exe\" /FO CSV)",
      "Read(//c/.fusion247/**)"
    ]
  }
}
```

**No `hooks` key.** So a session started in this worktree inherits the user-level hooks unmodified.

### `C:\Fusion247PKA\.claude\settings.local.json` (main clone) — `hooks` block

```json
{
  "Stop": [
    { "matcher": "",
      "hooks": [ { "type": "command",
        "command": "node --env-file=C:/.fusion247/control-plane-dev.env C:/Fusion247PKA/services/control-plane/tower-loop/bridge-ingest.mjs" } ] }
  ],
  "SessionStart": [
    { "hooks": [ { "type": "command",
        "command": "node C:/Fusion247PKA/services/fusion-capture-gateway/ensure-capture-gateway.mjs" } ] }
  ],
  "PreToolUse": [
    { "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash",
      "hooks": [ { "type": "command",
        "command": "node C:/Fusion247PKA/tools/governor/worktree-guard.mjs --estate C:/Fusion247PKA" } ] }
  ],
  "SessionEnd": []
}
```

`top-level keys: permissions, enableAllProjectMcpServers, enabledMcpjsonServers, hooks`

### Answering the Work Order's question

**FACT: YES — `Stop → continuity.mjs stop` and `SessionStart → reorient.mjs` ARE both registered
for a session started in `C:\Fusion247PKA-build-020-trial`**, via the user-level
`~/.claude/settings.json`, and nothing at project level overrides them there. Corroborated by
behaviour: the sidecars advanced at 21:45 and a health sample for this very collection session
exists (§7).

### C-2 — the install record misdescribes the machine. Both readings, with evidence

`INSTALLED-FROM.txt` claims:

> "The project-level duplicate at `C:\Fusion247PKA\.claude\settings.local.json` (which overrode
> this whenever a session opened from that worktree specifically) **was removed 2026-08-05**"

```
$ ls -la "/c/Fusion247PKA/.claude/" | grep -i settings
-rw-r--r-- 1 Buggly 197121 28238 Aug  5 17:39 settings.local.json
[+ 9 dated .bak files]
```

| Reading | Evidence for | Evidence against |
|---|---|---|
| **"the file was removed"** | none | **The file exists**: 28,238 bytes, mtime **Aug 5 17:39**, and it still carries a live `hooks` block with `Stop`, `SessionStart`, `PreToolUse` |
| **"the duplicate governor ENTRIES were removed from within the file"** | **Supported.** Its `Stop` now runs `bridge-ingest.mjs` and its `SessionStart` runs `ensure-capture-gateway.mjs` — **neither is `continuity.mjs` or `reorient.mjs`.** The governor duplicates are indeed gone | The record's own words say "the project-level duplicate … was removed", which reads as the file |

**FACT: the second reading is what the machine shows.** The governor hook duplicates were removed
from inside the file; the file itself was not removed and retains three unrelated hook registrations.
**The install record's wording is inaccurate about the live machine.**

**UNKNOWN — and this is a real gap Pax should not let me close by assertion:** whether Claude Code
**merges** project-level and user-level `hooks` arrays or whether the project-level entry **replaces**
the user-level one for the same event. I have not established this and did not test it. **It does not
affect the failing session** (the trial worktree declares no hooks at all), **but it decides whether
sessions opened in `C:\Fusion247PKA` still run `continuity.mjs stop`** — i.e. whether the main clone
has been silently writing no continuity packets since 17:39. That is worth settling.

---

## 6. The remote-read path — what "aborted" means, PROVEN

### Where the string is rendered

```
$ grep -n "HONCHO CONTINUITY" tools/governor/continuity.mjs tools/governor/reorient.mjs
tools/governor/continuity.mjs:931:    const base = `⟦GOV⟧ HONCHO CONTINUITY: UNAVAILABLE this session (${String(e.message).slice(0, 140)}). Cross-session recall via Honcho could not be read — say so, do not fake it.`;
tools/governor/reorient.mjs:1081:    continuity = `⟦GOV⟧ HONCHO CONTINUITY: brief failed hard (${err.message}).`;
```

The observed text is **`continuity.mjs:931`** — the `catch (e)` of `readContinuityBrief`.
(`reorient.mjs:1081` is a *different*, outer message — "brief failed hard" — and was **not** what
Warwick saw.)

### The catch branch that produced the exact observed output (`continuity.mjs:929–937`)

```js
  } catch (e) {
    const cached = readJson(STATE_FILE, null);
    const base = `⟦GOV⟧ HONCHO CONTINUITY: UNAVAILABLE this session (${String(e.message).slice(0, 140)}). Cross-session recall via Honcho could not be read — say so, do not fake it.`;
    if (cached && cached.focus) {
      return `${base}\n  Local cached focus (last known, NOT confirmed against Honcho): ${cached.focus}.`;
    }
    return base;
  }
```

**This is why symptom B follows from symptom A mechanically:** the map pointer is only ever built on
the *success* path above this `catch`. Once `readLatest` throws, the brief is `base` + cached focus,
**and there is no map pointer to emit**. The loose-`Deliverables` sweep is then the correct
downstream behaviour, not an additional bug.

### The only three errors `hf()` can throw (`continuity.mjs:107–128`)

```js
async function hf(path, { method = 'GET', body, timeoutMs = READ_TIMEOUT_MS } = {}) {
  const { ok, ws, key } = honchoCtx();
  if (!ok) throw new Error(`no HONCHO_API_KEY (looked in ${HONCHO_ENV})`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(HONCHO_BASE + path.replace('{ws}', ws), { ... signal: ctrl.signal });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`honcho ${method} ${path} -> ${r.status}: ${txt.slice(0, 200)}`);
    }
    ...
  } finally { clearTimeout(t); }
}
```

with `const READ_TIMEOUT_MS = 9000;` (`continuity.mjs:45`).

| Candidate | Message it would produce | Matches observed? |
|---|---|---|
| Missing credential | `no HONCHO_API_KEY (looked in C:/.fusion247/honcho.env)` | ❌ — names the env path |
| HTTP error (401/404/5xx) | `honcho POST /... -> 401: ...` | ❌ — names method, path, status |
| **`ctrl.abort()` after `timeoutMs`** | **`This operation was aborted`** | ✅ **exact match** |

### Proven by local execution — NO network call

```
$ node --version
v22.18.0

$ node -e "const c=new AbortController(); c.abort(); console.log(c.signal.reason.name, JSON.stringify(c.signal.reason.message))"
reason.name    : AbortError
reason.message : "This operation was aborted"
fetch reject name   : AbortError
fetch reject message: "This operation was aborted"
```

**FACT: "This operation was aborted" is the Node v22.18.0 `AbortError` message. The only
`AbortController` in this path is the 9,000 ms read timeout at `continuity.mjs:110–111`. The
session-start read therefore exceeded 9 seconds and was aborted client-side.**

### It aborted on PAGE ONE — a further narrowing

`listAllMessages` (`continuity.mjs:768–775`):

```js
    try {
      res = await fetchPage({ page, cursor, size, reverse });
    } catch (e) {
      // A FIRST-page failure is a genuine Honcho failure and the caller must hear it.
      // A LATER-page failure means this server does not accept the follow-up shape; we
      // already hold everything the old single-request path would have returned.
      if (page === 1) throw e;
      break;
    }
```

**FACT: only a page-1 failure propagates.** A later-page timeout is swallowed and yields
`complete: false` — which renders the "⚠️ PAGINATION INCOMPLETE" line, **not** UNAVAILABLE.
Warwick saw UNAVAILABLE, so **the very first request timed out.**

### The read is now a multi-page walk — context for why page 1 might be slow

`readLatest` → `listAllMessages` walks the **entire** session message history (`MAX_LIST_PAGES = 40`,
`LIST_PAGE_SIZE = 100`, `LIST_REVERSE = true`), parses every message and sorts all packets. The store
is at **seq 152**, so the history now spans **2 pages** where it fit in 1 until recently.

**HYPOTHESIS (weak, flagged as such):** growth past 100 packets doubles the round trips and increases
server-side work per `size=100` list query, which could push page 1 past 9 s. **But note this cuts
against itself** — the failure was on page 1, which existed before the growth. Offered as a lead, not
a conclusion. **UNKNOWN: actual Honcho list latency.** Measuring it requires a network call and is barred.

**FACT: no code in the regression window touched any of this.** See §9.

---

## 7. Logs and error artefacts

**FACT: the governor writes NO log.** There is no governor log file anywhere under `~/.mypka/**`.
`continuity.mjs` writes only to stdout, and `stop` is explicitly non-failing
(`return 0; // a boundary hook never signals failure via exit code`). **A failed Stop delivery leaves
no durable trace at all** except the *absence* of a `continuity-last.json` update.

```
$ find "/c/Users/Buggly/.mypka" -type f \( -name "*.log" -o -name "*err*" -o -name "*.txt" \)
/c/Users/Buggly/.mypka/governor/INSTALLED-FROM.txt
/c/Users/Buggly/.mypka/tower/logs/watcher.log
/c/Users/Buggly/.mypka/tower-runtime/INSTALLED-FROM.txt
/c/Users/Buggly/.mypka/tower-runtime/services/control-plane/node_modules/better-sqlite3/lib/sqlite-error.js
/c/Users/Buggly/.mypka/tower-runtime/services/control-plane/node_modules/pg/lib/type-overrides.js
```

> This file was found **only because Amendment 1 widened the surface to `~/.mypka/**`**. Under the
> original `governor/**` surface the honest answer would have been "no log found", which is true and
> misleading.

`~/.mypka/tower/logs/watcher.log` — 1,530,200 bytes, mtime 22:06. **It is Tower's PR watcher and is
irrelevant to continuity**:

```
$ grep -ic "honcho\|continuity\|abort" watcher.log
0
```

Tail (last 6 of 15 captured lines):

```
{"ts":"2026-08-05T21:05:46.781Z","watcher":"WARWICK_YOGA#cp#1785961576415","evt":"pr_poll_discovery","repo":"warwickallan/Fusion247PKA","open":0,"prs":[]}
{"ts":"2026-08-05T21:05:46.781Z","watcher":"WARWICK_YOGA#cp#1785961576415","evt":"pr_poll_targets_dropped","dropped":["warwickallan/Fusion247PKA#94","warwickallan/Fusion247PKA#80","warwickallan/Fusion247PKA#90"]}
{"ts":"2026-08-05T21:05:46.781Z","watcher":"WARWICK_YOGA#cp#1785961576415","evt":"pr_poll_no_targets"}
{"ts":"2026-08-05T21:06:47.659Z","watcher":"WARWICK_YOGA#cp#1785961576415","evt":"pr_poll_discovery","repo":"warwickallan/Fusion247PKA","open":0,"prs":[]}
{"ts":"2026-08-05T21:06:47.659Z","watcher":"WARWICK_YOGA#cp#1785961576415","evt":"pr_poll_targets_dropped","dropped":["warwickallan/Fusion247PKA#94","warwickallan/Fusion247PKA#80","warwickallan/Fusion247PKA#90"]}
{"ts":"2026-08-05T21:06:47.659Z","watcher":"WARWICK_YOGA#cp#1785961576415","evt":"pr_poll_no_targets"}
```

### The health store — the one telemetry that DID land

```
$ ls -la "/c/Users/Buggly/.mypka/governor/health/C--Fusion247PKA-build-020-trial/"
-rw-r--r-- 1 Buggly 197121 847 Aug  5 10:53 2d4f3687-5e41-400f-b1ef-e5db8a7cb53c.json
-rw-r--r-- 1 Buggly 197121 708 Aug  5 22:03 5a984703-5aed-4152-93eb-45dfc74cdae9.json
-rw-r--r-- 1 Buggly 197121 847 Aug  5 10:52 a0101682-4441-449a-acae-bfc11838af2f.json
-rw-r--r-- 1 Buggly 197121 779 Aug  5 21:32 ab98d915-d61f-466d-a3d1-f760c17238a4.json
-rw-r--r-- 1 Buggly 197121 847 Aug  5 10:54 be12d930-96ee-4d12-ae1a-d70abdcd2b9e.json
-rw-r--r-- 1 Buggly 197121 847 Aug  5 10:52 e08c5228-b1ca-4f78-a608-39f15e47878d.json
-rw-r--r-- 1 Buggly 197121 775 Aug  5 11:27 f14be9d5-bddf-49ab-a05c-d6ffc4274be0.json
-rw-r--r-- 1 Buggly 197121 774 Aug  4 22:49 f992c884-6940-4f7f-810d-0f0fa6a11b14.json
```

The 21:32 sample — nearest in time to the incident:

```json
{"schema_version":1,"sampled_at":"2026-08-05T20:32:40.120Z","session_id":"ab98d915-d61f-466d-a3d1-f760c17238a4","source":"statusLine","version":"2.1.221","model":{"id":"claude-sonnet-5","display_name":"Sonnet 5"},"effort":{"level":"high"},"context_window":{"used_percentage":93,"remaining_percentage":7,"context_window_size":1000000,"total_input_tokens":927420,"total_output_tokens":1018,"exceeds_200k_tokens":true},"rate_limits":{"five_hour":{"used_percentage":7.000000000000001,"resets_at":1785969000},"seven_day":{"used_percentage":49,"resets_at":1786291200}},"workspace":{"git_worktree":"Fusion247PKA-build-020-trial"},"pr":{"number":95,"url":"https://github.com/warwickallan/Fusion247PKA/pull/95","review_state":"pending"}}
```

**Note for Pax, offered as context not conclusion:** a session at **93% context used / 927,420 input
tokens** was live in this worktree at 20:32Z. There is also a `governor/health/` sibling directory
keyed `C--Fusion247PKA-build-020-trial-tools-governor` (mtime 10:51) — i.e. **the health store has
been keyed under two different root names for the same worktree**. Whether that root-identity split
touches continuity is **UNKNOWN**; continuity's store is global (`STORE_DIR`), not per-root, so on
the code I read it should not. Recorded because it is anomalous.

---

## 8. Process list

```
$ export MSYS_NO_PATHCONV=1 && tasklist /FI "IMAGENAME eq node.exe" /FO CSV
"Image Name","PID","Session Name","Session#","Mem Usage"
"node.exe","24244","Console","1","8,720 K"
"node.exe","10876","Console","1","40,376 K"
"node.exe","25004","Console","1","42,444 K"
"node.exe","9336","Console","1","10,656 K"
"node.exe","660","Console","1","43,056 K"
"node.exe","15660","Console","1","1,180 K"
"node.exe","22544","Console","1","1,524 K"
"node.exe","40920","Console","1","51,384 K"
"node.exe","21284","Console","1","48,344 K"
"node.exe","30696","Console","1","2,512 K"
"node.exe","31216","Console","1","2,560 K"
"node.exe","30764","Console","1","1,528 K"
"node.exe","26492","Console","1","1,480 K"
"node.exe","12536","Console","1","10,228 K"
"node.exe","25736","Console","1","46,448 K"
```

Command lines via `Get-CimInstance Win32_Process` (read-only):

| PID | Started | Command (abridged) |
|---|---|---|
| 24244 | 22/07 01:51 | `services\control-plane\wp-d-proof\apply-contract-command.mjs --watch=15` |
| 10876 | 23/07 02:28 | `src/bin/fusiongptbot.mjs` — env-files incl. `C:/.fusion247/honcho.env` |
| 25004 | 23/07 02:28 | `src/bin/outbox-worker.mjs --watch` — env-files incl. `C:/.fusion247/honcho.env` |
| 9336 | 25/07 12:01 | `directus/cli.js start` |
| 660 | 29/07 19:54 | `scripts/careerair-telegram-bot.mjs` |
| 15660 | 29/07 20:00 | `scripts/careerair-cockpit-api.mjs --port 8791` |
| 22544 | 03/08 01:34 | `services/obsidiwikai/src/bin/brain-mcp.mjs` |
| 40920 | 03/08 21:31 | `services\asdair\pipeline\runtime.js --watch` |
| 21284 | 03/08 23:45 | `services\fusion-capture-gateway\src\live\liveRunner.js` |
| 30696 | 04/08 02:36 | `server.mjs` |
| 31216 | 04/08 02:37 | `server.js` (asdair) |
| 30764 | 04/08 19:37 | `--test --test-name-pattern T-3b test/crash.test.js` |
| 26492 | 04/08 19:37 | `--test-name-pattern T-3b test\crash.test.js` |
| 12536 | 04/08 19:37 | `C:\Fusion247PKA-build-020-trial\services\proofline\test\helpers\harness.mjs` |
| **25736** | **05/08 21:26:16** | **`C:\Users\Buggly\.mypka\tower-runtime\services\control-plane\tower-loop\watcher.mjs`** |

**FACT: no resident governor process.**

```
$ Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'governor|continuity|reorient' }
(no output)
```

Expected — `continuity.mjs` and `reorient.mjs` are short-lived per-hook invocations, not daemons.

**Two observations offered without conclusion:**
- **PIDs 30764 / 26492 / 12536 are orphaned test processes from 04/08 19:37**, still resident ~27 h
  later, one of them rooted in this very worktree (`proofline\test\helpers\harness.mjs`).
- **PID 25736, the Tower watcher, started 21:26:16** — one minute after the governor install and
  ~20 minutes before the incident. It runs from `~/.mypka/tower-runtime/`, not from a worktree.
- **PIDs 10876 and 25004 both hold `C:/.fusion247/honcho.env`** — long-running Honcho clients from
  23/07. Whether they share a rate limit with the governor is **UNKNOWN**; `continuity.mjs`'s own
  comments record that Honcho rate limits were "NOT FOUND in any official source — unknown, not
  unlimited".

---

## 9. THE REGRESSION WINDOW FROM GIT — the spine

*(Pax cannot run git. This section is the reason this Work Order exists.)*

### Refs

```
$ git -C "C:/Fusion247PKA-build-020-trial" rev-parse HEAD origin/main
aaf7c46a0455d97e98a4c613c353c6d358a1bfe9      # HEAD (Amendment 1 commit)
65757c62e17901641d9bc3d31aaff146f720dcd2      # origin/main
$ git log --oneline -1 c39825c
c39825c WO-10/WO-11: Honcho continuity regression -- evidence + investigation
```

```
$ git diff --stat 65757c6..c39825c -- tools/governor/
(empty)
```

**FACT: `c39825c` changes NOTHING under `tools/governor/`.** Larry's "documentation-only" read is
confirmed by execution.

### Every commit touching the governor continuity path, 2026-08-03 → `c39825c`

```
$ git log --since=2026-08-03 --date=format:'%Y-%m-%d %H:%M' --pretty=format:'%h  %ad  %an  %s' --name-only c39825c \
    -- tools/governor/continuity.mjs tools/governor/reorient.mjs tools/governor/continuity-derive.mjs \
       tools/governor/continuity.test.mjs tools/governor/reorient.test.mjs tools/governor/continuity-derive.test.mjs

744a67a  2026-08-05 19:31  Warwick Allan  Protect continuity's map_path pointer from stale concurrent writes
tools/governor/continuity.mjs
tools/governor/continuity.test.mjs

672817a  2026-08-05 09:46  Warwick Allan  WO-08: the sweep follows the session, not the file
tools/governor/reorient.mjs
tools/governor/reorient.test.mjs

cb54a1c  2026-08-05 09:08  Warwick Allan  WP-2B(2): the reader checks the map is actually here, and Honcho stops claiming authority
tools/governor/continuity.mjs
tools/governor/continuity.test.mjs
tools/governor/reorient.mjs
tools/governor/reorient.test.mjs

e98715a  2026-08-05 00:40  Warwick Allan  WP-2B(1): the Honcho pointer now resolves the map it is pointing at
tools/governor/continuity.mjs
tools/governor/continuity.test.mjs

c9c41ae  2026-08-04 18:09  Warwick Allan  BUILD-020 external source repair: apply approved doc-017 redlines
tools/governor/continuity.mjs
tools/governor/continuity.test.mjs
tools/governor/reorient.mjs
tools/governor/reorient.test.mjs
```

**`continuity-derive.mjs` (added to scope by Amendment 1) appears in NO commit in the window** —
last touched 2026-08-04 18:49 by mtime, no commit since 2026-08-03. It is not a suspect.

### Named candidates, one line each

| Commit | Time | Changed | Could it plausibly cause the observed behaviour? |
|---|---|---|---|
| **`744a67a`** | 08-05 **19:31** | +164/-14 `continuity.mjs`, +354 test | **SYMPTOM B — PRIME SUSPECT.** Introduced the `writeContinuity` guard that `delete`s `packet.map_path`. **Cannot** cause symptom A (never touches the read path, never suppresses a write). See §4 for the mechanism by which it could strip `map_path` from every packet after a session's first |
| **`672817a`** | 08-05 09:46 | +37/-5 `reorient.mjs` | **SYMPTOM B — SECONDARY.** "The sweep follows the session, not the file" — changed the fallback sweep behaviour, which is precisely the fallback Warwick saw. Worth reading for *how* the loose-`Deliverables` list is composed |
| **`cb54a1c`** | 08-05 09:08 | +79 `continuity.mjs`, +24/-14 `reorient.mjs` | **SYMPTOM B — SECONDARY.** "The reader checks the map is actually here, and Honcho stops claiming authority" — added `mapPathPresentHere` and the *"recorded map NOT PRESENT in this checkout"* branch. Adds a **new** way to render a non-directive brief without any read failure |
| **`e98715a`** | 08-05 00:40 | +232 `continuity.mjs`, +322 test | **CONTEXT.** WP-2B(1) made `map_path` be written at all. Cannot itself cause either symptom, but it created the field `744a67a` later learned to delete — read the two together |
| **`c9c41ae`** | 08-04 18:09 | +118/-29 `continuity.mjs` | **UNLIKELY.** Doc-017 redlines applied to the module. Largest single `continuity.mjs` delta on 08-04; not obviously on the failing path, but it is the window's opening commit and I have not read its diff line by line — **flagged as not fully excluded** |

### The decisive negative — the failing code was NOT changed in the window

```
$ git log --pretty=format:'%h %ad %s' --date=format:'%Y-%m-%d %H:%M' -S 'READ_TIMEOUT_MS' -- tools/governor/continuity.mjs
421053b 2026-08-01 21:35 Governor: durable cross-session continuity through Honcho

$ git log --pretty=format:'%h %s' -S 'ctrl.abort()' -- tools/governor/continuity.mjs
421053b Governor: durable cross-session continuity through Honcho

$ git log --pretty=format:'%h %ad %s' --date=format:'%Y-%m-%d %H:%M' -S 'HONCHO CONTINUITY: UNAVAILABLE' -- tools/governor/continuity.mjs
421053b 2026-08-01 21:35 Governor: durable cross-session continuity through Honcho
```

**FACT: the 9,000 ms timeout, the `AbortController`, and the `UNAVAILABLE` render string have not
been modified since `421053b` on 2026-08-01 — four days before the incident and BEFORE the entire
regression window.**

> **Therefore symptom A is NOT a code regression introduced in this window.** The code that aborts is
> the same code that worked. Something about the *environment, the data volume, or Honcho's
> response time* changed — not this source. **This is the single most important line in the file for
> directing the investigation away from a code hunt.**

### Timeline (local, BST = UTC+1)

| Time | Event | Evidence |
|---|---|---|
| 08-01 21:35 | Read path + 9 s timeout + UNAVAILABLE string written. **Unchanged after this.** | `421053b`, `git log -S` |
| 08-04 18:09 | `c9c41ae` doc-017 redlines | git log |
| 08-05 00:40 | `e98715a` WP-2B(1) — `map_path` starts being written | git log |
| 08-05 09:08 | `cb54a1c` WP-2B(2) — reader existence check | git log |
| 08-05 09:46 | `672817a` WO-08 — sweep follows the session | git log |
| **08-05 10:54** | **`continuity.json` last written — the last manual `continuity.mjs write`** | `updated_at 09:54:14.545Z` |
| 08-05 17:39 | `C:\Fusion247PKA\.claude\settings.local.json` last modified (governor hooks removed from it) | mtime |
| **08-05 19:31** | **`744a67a` — the `map_path` write-authority guard** | git log |
| 08-05 21:24 | `c21c3f3` — PR #94 merged to main | git log |
| **08-05 21:25–21:26** | **Governor install resynced from `c21c3f3`; the guard goes LIVE on the machine** | file mtimes + `INSTALLED-FROM.txt` |
| 08-05 21:26:16 | Tower watcher (PID 25736) starts from `~/.mypka/tower-runtime` | `Win32_Process` |
| **08-05 ~21:4x** | **REGRESSION OBSERVED** — UNAVAILABLE + sweep fallback | Warwick's session injection |
| 08-05 21:45:41.497 | Packet seq 152 built | decoded from `cont-1785962741497-152-dxrlo7` |
| **08-05 21:45:44.278** | **A Honcho WRITE SUCCEEDS** (`continuity-last.json` only written on `r.ok`) | `continuity-last.json` |

**The guard went live ~20 minutes before the symptom.** That is a strong temporal correlation for
**symptom B** and none at all for **symptom A**.

**UNKNOWN:** whether the successful 21:45:44 write preceded or followed the failing session-start
read. Both fall in the 21:4x minute and I cannot order them from the artefacts on disk.

---

## 10. Installed vs repo — the stale-install hypothesis is DEAD

Run **both raw and line-ending-normalised**, per Amendment 1 (M-1).

### Line-ending census — this is the whole explanation of the size delta

```
file                   installed CRLF   worktree CRLF
continuity.mjs         0                1353
reorient.mjs           0                1090
footer.mjs             0                1589
sampler.mjs            0                578
statusline-live.mjs    0                208
evaluator.mjs          0                226
health-store.mjs       0                166
atomic-write.mjs       0                192
```

Compare against the byte deltas that prompted the hypothesis: `continuity.mjs` +1353,
`reorient.mjs` +1090, `footer.mjs` +1589, `sampler.mjs` +578, `statusline-live.mjs` +208,
`evaluator.mjs` +226, `health-store.mjs` +166, `atomic-write.mjs` +192.

**Every delta is EXACTLY the CRLF count. Eight for eight.** The working tree is CRLF
(`core.autocrlf`, map defect P-10); the installed copy is LF, matching the git blob.

### Raw sha256 (first 12 hex) — installed vs git blob

```
file                   installed      c21c3f3        65757c6        verdict
continuity.mjs         cb569fc71bc7   cb569fc71bc7   cb569fc71bc7   RAW-MATCH
reorient.mjs           b9e767c0909d   b9e767c0909d   b9e767c0909d   RAW-MATCH
footer.mjs             694417ae5afd   694417ae5afd   694417ae5afd   RAW-MATCH
sampler.mjs            33d53793fdee   33d53793fdee   33d53793fdee   RAW-MATCH
statusline-live.mjs    470bbb22d7e3   470bbb22d7e3   470bbb22d7e3   RAW-MATCH
evaluator.mjs          b26d6aaca55b   b26d6aaca55b   b26d6aaca55b   RAW-MATCH
health-store.mjs       b67c6b49fc47   b67c6b49fc47   b67c6b49fc47   RAW-MATCH
atomic-write.mjs       b822eb5e1a93   b822eb5e1a93   b822eb5e1a93   RAW-MATCH
```

**FACT — item 10 answered on both refs:**

- **vs `c21c3f3` (what `INSTALLED-FROM.txt` claims):** ✅ **byte-identical, all 8 files.**
  The install record is TRUTHFUL about its source.
- **vs `65757c6` (governance head):** ✅ **byte-identical, all 8 files.** The install is **not**
  behind the governance head — `65757c6` (the PR #95 closure-record merge) changed no governor file.
- **Normalised diff:** not needed as a tiebreak — the raw comparison already matches exactly. The
  CRLF census above explains the worktree size difference entirely.

**❌ THE STALE-INSTALL HYPOTHESIS IS DEAD. Pax should not spend a minute on it.**

> **And a warning about the instrument:** comparing the installed file against the **working-tree
> file** (rather than the **git blob**) shows all eight differing. That comparison is worthless here
> and would have produced a confident false "stale install" — the exact cause this build has already
> paid for once.

### Guard presence in the installed copy — confirmed two ways

```
$ git merge-base --is-ancestor 744a67a c21c3f3 && echo "YES ..."
YES: 744a67a IS an ancestor of c21c3f3 -- the guard IS in the installed copy

$ grep -c "sessionStartMs > priorWriteMs" "/c/Users/Buggly/.mypka/governor/continuity.mjs"
1
```

**FACT: the write-authority guard from `744a67a` IS running on the machine.**

---

## 11. Standing observation — subagent READS of `~/.mypka/**` are not refused

*(Recorded at Larry's instruction; it narrows an estate constraint beyond this Work Order.)*

**WO-2026-08-05-07 Amendment 3 recorded that this path is "refused by the host classifier" when the
actor is a subagent, and reassigned the install to Larry on that basis.** That refusal was about
**WRITES**.

**FACT: as a subagent, I read `~/.mypka/governor/**`, `~/.mypka/tower/logs/**`,
`~/.mypka/tower-runtime/**`, `~/.claude/settings.json`, `C:\Fusion247PKA\.claude\settings.local.json`
and `C:\Fusion247PKA-build-020-trial\.claude\**` with no refusal at any point.** Every command in
this file executed.

**The constraint is therefore narrower than recorded: it is "machine WRITES", not "machine paths".**

**I did NOT test a write to establish the other half** — nothing here needed one, `live_authority`
is `none`, and Larry's instruction was explicit. **The write half remains as previously recorded and
is UNVERIFIED by me.**

### And a boundary I did not cross

`continuity.mjs:39`:

```js
const HONCHO_ENV = 'C:/.fusion247/honcho.env';
```

**The Honcho credential lives in the barred private surface.** `private_surface: none`, so **I did
not open it, and no key or token appears anywhere in this file.** I did not need to: §6 proves the
error was an abort, and a missing/unreadable credential produces the visibly different message
`no HONCHO_API_KEY (looked in C:/.fusion247/honcho.env)`. **The credential is not implicated, and
that conclusion required no access to it.**

*(Noted in passing: `C:\Fusion247PKA-build-020-trial\.claude\settings.local.json` carries a
`Read(//c/.fusion247/**)` permission grant. I did not exercise it. Flagged only because a standing
grant to the secrets store in a worktree settings file may itself deserve review under GL-012 —
that is Larry's call, not mine.)*

---

## 12. Summary for Pax — what is settled, what is open

### Settled by execution (do not re-litigate)

1. **Symptom A is a 9,000 ms client-side read timeout.** `AbortError: "This operation was aborted"`
   reproduced locally on Node v22.18.0; it is the only `AbortController` in the path
   (`continuity.mjs:110–111`). Not a credential, not an HTTP error.
2. **It failed on page 1** — only a page-1 failure propagates to the `catch`.
3. **Symptom B follows mechanically from A** — the map pointer only exists on the success path.
4. **Honcho was reachable and the credential valid at 21:45:44** — a write succeeded, and
   `continuity-last.json` is written only on `r.ok`.
5. **The read path has not changed since 2026-08-01** (`421053b`), before the window. **Symptom A is
   not a code regression in the window.**
6. **The install is byte-exact vs both `c21c3f3` and `65757c6`.** Stale install: **dead**.
7. **L-3 is by design.** `stop` cannot write `continuity.json` — `writeArgs` is `null` for `stop`.
   `continuity.json` is stale because nobody ran `continuity.mjs write` since 10:54.
8. **The write-authority guard cannot suppress a write** and **fails open** on a missing start time.
9. **`Stop`/`SessionStart` governor hooks ARE registered** for a session in the trial worktree.
10. **No governor log exists.** A failed Stop delivery leaves no durable trace.
11. **`INSTALLED-FROM.txt` misdescribes the machine** re: the project-level settings file —
    entries were removed from within it; the file itself remains, with three other hooks.

### Open — ranked by value, with what each needs

| # | Question | What it needs | Barred here? |
|---|---|---|---|
| **1** | **Do the packets currently in Honcho carry `map_path`?** Settles §4's prime suspect for symptom B outright | One authenticated read of the Honcho store | **YES — network. Needs explicit authorisation** |
| **2** | **What is the real page-1 list latency at 152 packets?** Settles whether 9 s is marginal or the abort was a one-off | Timed read against Honcho | **YES — network** |
| **3** | Does Claude Code **merge or replace** hooks between project and user settings? Decides whether sessions in `C:\Fusion247PKA` still write continuity at all | Documentation or a controlled probe | No — documentary |
| **4** | Read `744a67a` and `cb54a1c` diffs line by line for the map-pointer render paths | Git diff — **I can supply on request** | No |
| **5** | Was `c9c41ae` (08-04, +118/-29) on the failing path? Not fully excluded | Git diff — **I can supply on request** | No |
| **6** | Is the `governor/health/` root-identity split (`...-build-020-trial` vs `...-build-020-trial-tools-governor`) benign? | Code read of `health-store.mjs` / `sampler.mjs` | No |

### My single labelled hypothesis, offered as a lead and nothing more

> **HYPOTHESIS.** There are two independent faults that happened to surface in the same session, and
> reading them as one event is why it looks like a Phase 2 regression.
>
> **Symptom A** is environmental — a slow or throttled first list request against a store that has
> grown to 152 packets, hitting an unchanged 9 s timeout. **No code in the window is implicated,
> and the git evidence is decisive on that point.**
>
> **Symptom B** is a genuine behavioural change from `744a67a` (19:31, live on the machine at 21:25):
> the guard strips `map_path` from every packet a session writes after its first, so the newest
> stored packet tends to carry no map pointer. **On this reading symptom B would reproduce even with
> Honcho fully healthy** — which is the thing to test first, and open question #1 tests it directly.
>
> Neither half is established. Both are falsifiable with the two measurements above.

---

**§1–§12 collected read-only under WO-2026-08-05-10 + Amendment 1. No network call. No write outside
this file. No secret read, echoed or stored. Nothing repaired.**

---
---

# ADDENDUM — AMENDMENT 2: the two bounded network measurements

| Field | Value |
|---|---|
| **authority** | WO-2026-08-05-10 **Amendment 2** (`8e0a684`) — `network: none` → **`network: BOUNDED`**, Larry's authorisation |
| **measured_at** | **2026-08-05 21:21:04Z → 21:21:10Z** (22:21 local) — **6 seconds of wall clock, 13 requests total** |
| **credential_scope** | **still `none`.** `C:\.fusion247\honcho.env` was **NOT** opened, read, echoed, copied or printed. The measurement imports the **installed** governor module and lets `loadHonchoEnv()` load its own credential internally |
| **live_authority** | **still `none`.** Nothing repaired, reinstalled, restarted or written. No `continuity.mjs write` |
| **write safety** | **Only `fetchMessagePage`, `listAllMessages` and `readContinuityBrief` were called.** `ensureStore`, `deliver`, `writeContinuity` and `saveState` were **never** called — no workspace/peer/session upsert, no packet mutation |
| **instrument** | `C:\Users\Buggly\AppData\Local\Temp\claude\...\scratchpad\measure.mjs`, run with cwd `C:/Fusion247PKA-build-020-trial` |
| **module under test** | `C:/Users/Buggly/.mypka/governor/continuity.mjs` — **the INSTALLED copy, i.e. the code that actually runs live** |

**Pax's two adjudications are carried as settled and are not re-argued below:** (1) two mechanisms
genuinely exist but **only A fired on 2026-08-05**, discriminated by the rendered string; (2) page 1's
**cost** did not stay constant even though page 1 existed before the growth.

---

## 13. M-2 — page-1 latency, REPEATED. Every repetition raw.

The exact request the SessionStart brief makes: `page 1, size 100, reverse true`, under the module's
own `READ_TIMEOUT_MS = 9000`.

```
{"phase":"M-2","rep":1,"cold":true,"ok":true,"ms":884,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":2,"cold":false,"ok":true,"ms":747,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":3,"cold":false,"ok":true,"ms":244,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":4,"cold":false,"ok":true,"ms":237,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":5,"cold":false,"ok":true,"ms":430,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":6,"cold":false,"ok":true,"ms":381,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":7,"cold":false,"ok":true,"ms":216,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":8,"cold":false,"ok":true,"ms":387,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":9,"cold":false,"ok":true,"ms":223,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
{"phase":"M-2","rep":10,"cold":false,"ok":true,"ms":648,"items":100,"total":149,"pages":2,"size":100,"content_bytes":420310}
```

**No mean, no best-of, as instructed.** The distribution: **10/10 succeeded. Every repetition under
one second.** Cold (rep 1) was the slowest at **884 ms**. Range **216–884 ms**.

**FACT: against a 9,000 ms budget, the worst observed repetition used 9.8% of it. Roughly 10×
headroom, and the cold request — the one a SessionStart actually makes — was the worst case.**

**FACT: the response is 420,310 bytes of packet content in a single request.** Pax's cost point is
confirmed by measurement: this *is* a large and growing response, ~420 KB.

**FACT, and it changes the growth model — page 1 has already hit its cap.** `total: 149`,
`size: 100`, `pages: 2`. Page 1 returns **exactly 100 items and can never return more**, because
`LIST_PAGE_SIZE` is the documented maximum. Further store growth therefore adds **pages**, not page-1
items. Page-1 cost can now only grow through *per-packet* content size (each packet embeds the
3,449-byte state), not through item count.

**Per the Amendment's own decision criterion — "marginal … or clear":**

> **The 9 s budget is CLEAR, not marginal, at the current store size and at the time measured.**
> **Therefore the 21:4x abort was a TRANSIENT, not a chronic threshold breach.**

**Stated honestly, with its scope:** this was measured at **21:21Z, roughly 35 minutes after the
incident**, not during it. It establishes that the budget is not *chronically* exceeded and that the
failure is not currently reproducing. **It does NOT establish what Honcho's latency was at 20:4xZ**,
and it cannot — that moment is gone. A ~10× excursion happened; whether from Honcho-side latency, a
network stall, or local contention is **UNKNOWN and not determinable from any artefact on this
machine** (§7: the governor writes no log, so nothing recorded it).

---

## 14. M-1 ⭐ — do the stored packets carry `map_path`?

### The census — whole store, one walk

```
{"phase":"M-1-census","walk_ms":900,"pages_walked":2,"complete":true,"raw_messages":149,
 "continuity_packets":149,"packets_WITH_map_path":9,"packets_WITHOUT_map_path":140}
```

### The 20 newest packets

```
{"seq":152,"ts":"2026-08-05T20:45:41.497Z","reason":"stop","session":"5a984703","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","has_map_path":true}
{"seq":151,"ts":"2026-08-05T12:14:40.413Z","reason":"stop","session":"ab98d915","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","has_map_path":true}
{"seq":150,"ts":"2026-08-05T09:56:01.491Z","reason":"stop","session":"f14be9d5","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","has_map_path":true}
{"seq":149,"ts":"2026-08-05T09:54:36.983Z","reason":"stop","session":"be12d930","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","has_map_path":true}
{"seq":148,"ts":"2026-08-05T09:54:14.548Z","reason":"write","session":null,"map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","has_map_path":true}
{"seq":147,"ts":"2026-08-05T09:53:16.613Z","reason":"stop","session":"1780ca21","map_path":"Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md","has_map_path":true}
{"seq":146,"ts":"2026-08-05T09:53:06.786Z","reason":"stop","session":"2d4f3687","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","has_map_path":true}
{"seq":145,"ts":"2026-08-05T09:52:34.921Z","reason":"stop","session":"e08c5228","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","has_map_path":true}
{"seq":144,"ts":"2026-08-05T09:52:07.637Z","reason":"stop","session":"a0101682","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","has_map_path":true}
{"seq":143,"ts":"2026-08-04T12:20:26.092Z","reason":"stop","session":"d06526cd","map_path":null,"has_map_path":false}
{"seq":142,"ts":"2026-08-04T06:45:21.914Z","reason":"stop","session":"76f29046","map_path":null,"has_map_path":false}
{"seq":141,"ts":"2026-08-04T06:41:59.967Z","reason":"stop","session":"76f29046","map_path":null,"has_map_path":false}
{"seq":140,"ts":"2026-08-04T05:11:00.314Z","reason":"stop","session":"76f29046","map_path":null,"has_map_path":false}
{"seq":139,"ts":"2026-08-04T04:39:05.376Z","reason":"stop","session":"76f29046","map_path":null,"has_map_path":false}
{"seq":138,"ts":"2026-08-04T01:52:49.688Z","reason":"stop","session":"37f8884d","map_path":null,"has_map_path":false}
{"seq":137,"ts":"2026-08-04T01:43:42.625Z","reason":"auto-derive","session":"44438140","map_path":null,"has_map_path":false}
{"seq":136,"ts":"2026-08-04T01:43:39.433Z","reason":"stop","session":"56a8f152","map_path":null,"has_map_path":false}
{"seq":135,"ts":"2026-08-03T22:51:41.806Z","reason":"stop","session":"44438140","map_path":null,"has_map_path":false}
{"seq":134,"ts":"2026-08-03T22:51:07.476Z","reason":"auto-derive","session":"52ba7617","map_path":null,"has_map_path":false}
{"seq":133,"ts":"2026-08-03T22:51:03.139Z","reason":"stop","session":"5f858aa3","map_path":null,"has_map_path":false}
```

### Value distribution and bounds

```
{"phase":"M-1-values","map_path":"(none)","count":140}
{"phase":"M-1-values","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md","count":8}
{"phase":"M-1-values","map_path":"Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md","count":1}
{"phase":"M-1-bounds","newest_with_map":{"seq":152,"ts":"2026-08-05T20:45:41.497Z","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md"}}
{"phase":"M-1-bounds","oldest_with_map":{"seq":144,"ts":"2026-08-05T09:52:07.637Z","map_path":"Deliverables/2026-08-04-proofline-wayfinder-plan.md"}}
```

### Reading the 140 zeros correctly — they are NOT stripping

**FACT: the 140 packets without `map_path` are all `seq ≤ 143`, i.e. everything written before
2026-08-05 09:52.** `map_path` did not exist as a field until WP-2B(1) (`e98715a`, 08-05 00:40)
shipped and reached the machine. Before that, as `continuity.mjs`'s own comment says, *"until this
landed NO writer ever set it, so it was null by construction"*.

**FACT: from `seq 144` onward — every single packet in the `map_path` era — 9 of 9 carry a
`map_path`. Not one has been stripped.**

> ### M-1 VERDICT: the `744a67a` stripping defect is **LATENT in the data, not LIVE**.
> **Zero packets have been stripped. N-2/N-3 are intact in the store, and a fresh Larry is NOT
> being misdirected right now.** §15 confirms this directly on the rendered output.

### But the sample under the guard is **n = 1**, and it is the masked one

**This is where the census stops short of exonerating the guard, and it must be said plainly.**

The guard went live on the machine at **21:25 local = 20:25Z** (§9 timeline). Cross-referencing:

| seq | ts | Written under the guard? |
|---|---|---|
| 144–151 | 09:52:07Z → 12:14:40Z | **No** — all predate 20:25Z |
| **152** | **20:45:41Z** | **YES — the only one** |

**FACT: exactly ONE packet has ever been written with the guard active, and it kept its `map_path`.**

**And that single packet was written inside the timeout window.** Per Pax's masking finding — adopted
here — when the `readLatest` *inside* `writeContinuity` times out, the `catch` falls through and
`map_path` is **kept**. Seq 152 keeping its `map_path` is therefore **exactly what the masked path
predicts**, and is **not** evidence that the guard is harmless.

**The census cannot distinguish "the guard is benign" from "the guard was masked by the same timeout
that caused symptom A". n = 1, and that one is the masked case.**

### A falsifiable prediction, labelled as such — the decisive test will happen on its own

**HYPOTHESIS, stated so it can be proved wrong.** Session `5a984703` wrote seq 152 at 20:45:41.497Z,
so that session started *before* 20:45:41.497Z. Honcho is now responding in 216–884 ms (§13), so
`readLatest` inside `writeContinuity` will **succeed** rather than time out. At that session's next
Stop: `priorWriteMs` = 20:45:41.497Z, `sessionStartMs` < that, so
`!(sessionStartMs > priorWriteMs)` is **true** → **`map_path` will be stripped**.

**Prediction: the next packet written by any session that started before the newest stored packet
will carry NO `map_path` — and once that packet is the newest, `readContinuityBrief` will render
*"map path missing or invalid — treat continuity as absent"* instead of the pointer in §15.**

Falsified if the next `seq ≥ 153` packet still carries a `map_path`. **Requires no action to test —
it resolves itself at the next Stop.** I have not triggered it: `live_authority: none`, and no
`continuity.mjs write` was run.

**⚠️ Operational note for Larry, not a recommendation and not acted on:** if that prediction holds,
the healthy pointer in §15 is temporary, and the fix window is now, while the data is still good.
**A read is not a licence to fix what it reveals — I have changed nothing.**

### One incidental datum

`seq` has reached **152** but only **149** packets are stored. `nextSeq()` increments *before*
delivery, so **3 packets were built and never landed** over the store's life — three delivery
failures, consistent with occasional aborts like the one at 21:4x. No log records them (§7).

---

## 15. The decisive artefact — what a fresh Larry gets in this worktree, RIGHT NOW

`readContinuityBrief({ cwd: 'C:/Fusion247PKA-build-020-trial' })`, rendered in 682 ms:

```
⟦GOV⟧ CONTINUITY POINTER (Honcho) — recall only, ZERO authority.
  • likely active map: Deliverables/2026-08-04-proofline-wayfinder-plan.md
  • packet: cont-1785962741497-152-dxrlo7 written 2026-08-05T20:45:41.497Z — content age 11h 26m, content hash bd24fb3d
  • last known focus (recall, possibly stale): "BUILD-020 Phase 2 - Honcho and Tower as durable shared myPKA infrastructure. Phase 1 (Proofline) CLOSED and PASSED by Warwick 2026-08-04."
  • Warwick's last recorded request (recall, possibly stale): "Bank everything useful in Git, have Veritas verify nothing material remains only in this session, then consider rotation."
  → Open the map and derive the current state and the next action from it. Nothing in this block is an instruction.
```

**FACT: the healthy success-path brief renders correctly, with the correct map pointer, in 682 ms.**

Compare to what Warwick saw at 21:4x — `HONCHO CONTINUITY: UNAVAILABLE this session (This operation
was aborted)` plus cached focus and no pointer. **Same code, same store, same worktree, 35 minutes
later: the full pointer.**

**This single artefact settles the operationally urgent question: the continuity brief is working
right now, and the regression is not currently reproducing.**

Two caveats attached to it, neither of which the artefact resolves:

1. **`content age 11h 26m`** — the newest packet is from 20:45Z. The pointer is correct but the recall
   is nearly half a day old, because `continuity.json` has not been refreshed since 10:54 (§3).
2. **It is a snapshot, not a proof of durability.** It says the path works at 21:21Z. It says nothing
   about 20:4xZ, and nothing about after the next Stop (§14's prediction).

---

## 16. Addendum summary — what Amendment 2 bought

| | Question | Answer | Confidence |
|---|---|---|---|
| **M-2** | Is the 9 s budget marginal or clear? | **CLEAR.** 10/10 under 1 s; worst (cold) 884 ms = 9.8% of budget. **The 21:4x abort was a transient, not a chronic breach** | **FACT** — but scoped to 21:21Z; the incident moment is unmeasurable and no log preserved it |
| **M-2b** | Is page-1 cost still growing? | **Capped in items** — page 1 is at the `size:100` maximum already; growth now adds pages, not page-1 items. Still **420,310 bytes** per request, growable via per-packet content | **FACT** |
| **M-1** | Is the stripping defect live in the data? | **LATENT, not live. 9 of 9 map_path-era packets intact; zero stripped. N-2/N-3 are sound in the store** | **FACT** |
| **M-1b** | Does that exonerate the guard? | **NO.** Only **one** packet was ever written under the guard, and it is the **masked** case — written during the timeout, when the guard fails open and keeps `map_path` | **FACT** (n=1 by enumeration) |
| **—** | Is a fresh Larry misdirected right now? | **NO.** The rendered brief carries the correct map pointer, in 682 ms | **FACT** |
| **—** | Will it stay that way? | **UNKNOWN.** §14 gives a falsifiable prediction that the next Stop of a pre-existing session strips it. Resolves itself; needs no action to test | **HYPOTHESIS** |

### What remains open after Amendment 2

1. **What Honcho's latency actually was at 20:4xZ.** **Permanently unrecoverable** — the governor
   writes no log (§7). This is the strongest argument in the whole investigation for the governor
   emitting a one-line durable record on a failed Stop delivery. *Observation, not a proposal.*
2. **Does Claude Code merge or replace `hooks` between project and user settings?** (§5) — unchanged
   by this addendum, still documentary, still unresolved.
3. **Whether `c9c41ae` (08-04, +118/-29) touched the failing path** (§9) — still not fully excluded.
   I can supply the diff on request.

---

**Addendum §13–§16 collected under Amendment 2's BOUNDED network allowance: 13 read-only requests,
6 seconds of wall clock, against Warwick's own Honcho service. No write, delete, workspace change or
packet mutation. `C:\.fusion247\honcho.env` was never opened — the installed module loaded its own
credential. No key or token appears anywhere in this file. Nothing repaired, restarted or
reinstalled. Nothing sent to Warwick.**
