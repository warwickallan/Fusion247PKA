---
ticket: T-11
build: BUILD-018
kind: evidence
date: 2026-07-31
private_surface: none
---

# T-11 evidence — reorientation, location verification, deny gate

All proofs below were **executed**, not reasoned about. Where a control claims to
refuse something, it was **made to fail** and observed refusing (the 2026-07-29
lesson: a control that has never been made to fail is an assumption).

## 1. Full Governor suite

```
node --test tools/governor/*.test.mjs
# tests 223
# pass 223
# fail 0
```

Run twice (before and after the "current pushed head" addition); 223/223 both
times. T-11's own three files contribute 84: `reorient.test.mjs` 34,
`worktree-guard.test.mjs` 27, `install-hooks.test.mjs` 23.

## 2. The array-payload regression — fixed earlier, NOW re-tested

Warwick's specific call-out. `typeof [] === 'object'`, so a naive object check
lets an array through, the fields read as `undefined`, and a malformed payload
becomes a silent skip indistinguishable from a healthy one. Re-run and green in
all three places it exists:

```
ok 39 - parseStdinPayload: non-object JSON (array) -> null          (sampler)
ok 40 - parseStdinPayload: non-object JSON (primitive) -> null      (sampler)
ok 47 - extractHealthSample: non-object payload -> null             (sampler)
ok 78 - MUTATION: an ARRAY payload is refused as malformed,
        not read as an object with undefined fields                 (worktree-guard)
```
`reorient.test.mjs` covers `'[]'` in its malformed-input sweep. The guard's test
additionally asserts the *reason* is reported, so a deferral can never be mistaken
for a healthy no-op.

## 3. Correct canonical worktree reorients successfully — REAL ESTATE

```
$ node -e "…{source:'clear',cwd:'C:/Fusion247PKA-governor'}" | node tools/governor/reorient.mjs
event : SessionStart
length: 6928 | under 10000 cap: true
```
First section of the emitted brief:
```
==== LOCATION VERIFIED =================================================
  ✅ cwd, repository root and branch all match the canonical programme location.
     worktree : C:/Fusion247PKA-governor
     branch   : build-018/session-governor
     HEAD     : bd682064f8333d48ca44257eaa0494fc862450a1
  Implementation is permitted. 3 location check(s) ran.
```
The brief carried, as required: programme BUILD-018 · phase · **ticket T-11** ·
**model Opus** · canonical worktree · canonical branch · **pushed head
`origin/build-018/session-governor @ bd68206`** · banked head `8cfe7d1` · 8 open
blockers · frontier · 8 do-nots · 5 read-firsts · resumption instruction.

It also correctly reported `STATE HEALTH: the programme worktree is DIRTY` — true
at the time, because T-11's own work was uncommitted. The control was live.

## 4. Wrong worktree returns WRONG WORKTREE before any mutation — REAL ESTATE

Run against the real primary checkout, which is genuinely on another branch:
```
$ node -e "…{source:'clear',cwd:'C:/Fusion247PKA'}" | node tools/governor/reorient.mjs
length: 8214 | under cap: true
WRONG WORKTREE banner appears BEFORE the next action: true
```
```
🚨🚨🚨 WRONG WORKTREE — STOP. DO NOT IMPLEMENT ANYTHING. 🚨🚨🚨
CANONICAL: worktree C:/Fusion247PKA-governor  branch build-018/session-governor
THIS SESSION: cwd C:/Fusion247PKA  repo root C:/Fusion247PKA
              branch recovery/2026-07-31-governor-abort-handoff
              HEAD   95c265de729e26114b1e1eb7dc7d8630502aca1d
MISMATCH: cwd, repository root, branch
NO IMPLEMENTATION IS PERMITTED FROM HERE.
RECOVERY — Larry performs this, Warwick does not:
  1. Larry calls EnterWorktree with path: C:/Fusion247PKA-governor
  2. …Larry must IMMEDIATELY tell Warwick, in these words:
     "Approve the pending EnterWorktree request in the local Claude terminal"
  3. Larry waits for the approval.
     Larry must NOT spin silently, must NOT continue via absolute paths, and
     must NOT ask Warwick to run git commands. Larry owns the git lifecycle.
```
Ordering is asserted by test, not left to chance: a reader who meets the next
action first starts working before learning they may not.

## 5. Write / Edit / mutating Bash are DENIED under mismatch — REAL ESTATE

```
DENY  Write (file_path aimed INTO the canonical worktree) from C:/Fusion247PKA  → deny
DENY  Bash "git commit -m …"                              from C:/Fusion247PKA  → deny
ALLOW Bash "git status --porcelain"                       from C:/Fusion247PKA  → (no output)
ALLOW Write                                    from C:/Fusion247PKA-governor    → (no output)
```
The first line is the important one: **the write was aimed at the correct
absolute path and was still denied.** The gate keys on the session, never on the
target path. Unit tests cover `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, 14
mutating git forms, redirections, `sed -i`, `node script.mjs`, `npm install`, and
command substitution; and prove read-only tools (`Read`, `Grep`, `Glob`, `Task`,
`EnterWorktree`) stay available so the session can diagnose and recover.

## 6. Missing / corrupt / stale become BLIND-or-RECOVERY, never guessed through

| Condition | Verdict | Proven by |
|---|---|---|
| No state anywhere | `MISSING`, loud brief, "do NOT assume nothing is in flight" | reorient.test.mjs |
| State exists but is unparseable | `CORRUPT`, named, never re-read as "no programme" | reorient.test.mjs |
| Valid JSON, fails schema | `CORRUPT`, not `MISSING` | reorient.test.mjs |
| `git worktree list` fails | `FAILED`, never a false "missing" | reorient.test.mjs |
| Two active programmes | `AMBIGUOUS`, both named, neither guessed | reorient.test.mjs |
| HEAD moved past banking commit | `STALE`, warning names both SHAs | REAL GIT |
| `banked.head_sha` unknown / HEAD unreadable | `STALE` — unknown is never fresh | reorient.test.mjs |
| Dirty tree / unknown dirtiness | warned; "unknown is not clean" | REAL GIT |
| Location unreadable while canonical known | `UNESTABLISHED` → **deny** | worktree-guard.test.mjs |
| Corrupt state, guard's view | defer — reorient shouts, guard does not brick the estate | worktree-guard.test.mjs |

A corrupt *sibling* is surfaced even on the happy path.

## 7. Oversized context is bounded below 10,000 and says so

`assembleBrief` drops optional sections lowest-priority-first, names every drop in
a loud notice, and never drops a `required` section. A `next_action` longer than
its allowance is truncated **with a pointer to the full text**, never dropped.

Proven: a state with 200 do-nots, 200 read-firsts and a 40,000-character focus
still produces a brief `<= 10000`, containing `TRUNCATED`, the next-action
sentinel, **and** — in the wrong-worktree variant — the full refusal banner and
the verbatim EnterWorktree sentence. `location` never appears in `dropped`.

## 8. ensure-watcher reconciled idempotently — REAL settings file

`--check` first (INV-7, recommend-then-act), then applied, then re-checked:

```
run 1  PRUNED 1: node --env-file=… C:/Fusion247PKA/services/control-plane/tower-loop/ensure-watcher.mjs
              missing: …/ensure-watcher.mjs
       kept 1 (ensure-capture-gateway.mjs — exists, untouched)
       SessionStart ADDED · PreToolUse ADDED
       RESULT: written. Backup: settings.local.json.bak-2026-07-31T17-05-08-981Z
run 2  RESULT: already correct. Nothing written.
run 3  RESULT: settings are already correct. Nothing to do.
```

Live file after (`Stop` untouched, as required):
```
SessionStart: [ ensure-capture-gateway.mjs ]                     ← kept
              [ matcher "clear" → reorient.mjs ]                 ← added
PreToolUse:   [ matcher "Write|Edit|MultiEdit|NotebookEdit|Bash"
                → worktree-guard.mjs --estate C:/Fusion247PKA ]  ← added
Stop:         [ bridge-ingest.mjs ]                              ← untouched
```

The dangling hook is **recoverable** from the backup above; it was reported, not
silently destroyed. The prune rule is generic ("SessionStart hooks whose target
script does not exist"), so it fixes the class; a mutation test proves it does
**not** over-reach when every target exists.

## 9. Two real defects the tests caught

1. **`--abbrev-ref` is sticky.** `rev-parse --show-toplevel --abbrev-ref HEAD
   HEAD` prints the branch twice, never the SHA — the live HEAD would have been
   silently wrong in every brief and every refusal. Verified directly against
   real git, then fixed by ordering the SHA first.
2. **One programme, many copies.** The state file is tracked, so every worktree
   on that branch (and main, post-merge) holds a copy. Counting files reported
   one build as 2–3 "active programmes" and the guard disarmed itself. Fixed by
   keying identity on programme ID and preferring the self-consistent copy;
   pinned by a mutation test that plants a duplicate and asserts the gate still
   denies.

Neither was visible by reading. Both were caught by tests written to fail.
