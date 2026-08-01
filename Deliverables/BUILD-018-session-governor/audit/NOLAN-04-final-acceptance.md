---
name: nolan-04-final-acceptance
type: audit
build: BUILD-018
author: Nolan (fresh instance, independent)
created: 2026-08-01
head_reviewed: 1d508f2b99b78fd801a7948b1310d6de661d35d5
branch: build-018/session-governor
private_surface: none
status: executed
---

# NOLAN-04 — FINAL INDEPENDENT ACCEPTANCE REVIEW OF OUTCOME A

Fresh instance. I did not inherit NOLAN-01/02/03 and I did not defer to Larry. Everything
below that says "verified" was executed by me at HEAD `1d508f2`, read-only.

## 0. READ-BACK

**(a) OUTCOME.** Decide, on executed evidence, whether Outcome A of BUILD-018 is complete
enough for Larry to hand back to Warwick — by ruling on Warwick's seven acceptance items,
testing Larry's acceptance-evidence file against the machine rather than reading it
approvingly, and settling INV-2 (can the governor trap Warwick) against the code.

**(b) PLAN.** Verify the test count myself; read the goal contract's invariants as the
outranking authority; inspect both live settings files read-only; read `stop-controller.mjs`,
`footer.mjs`, `install-hooks.mjs` and the constitution; independently drive the controller
across its whole decision ladder including corrupt-state and re-entrancy paths; check the
footer grammar against the bytes actually produced and actually consumed; test
reinstallability; then rule.

**(c) WHAT THE ORDER DID NOT SETTLE.** Whether "complete enough to hand back" means *the
Goal Contract's M4 is met* or *the work has reached an honest, well-documented stopping
point*. These give different answers, so I rule on both and say which is which. Also
unsettled: whether an evidence file that is internally stale (sections written at different
heads, never reconciled) is a defect in its own right. I treat material staleness as a
finding, cosmetic staleness as noise.

**(d) WHAT LOOKS WRONG, going in.** The order asserts 767/767 and asks me not to take it
from Larry — right instinct, and I found the same instinct needs applying to the phrase
"PROVEN END-TO-END".

No material ambiguity. Proceeding.

---

## 1. Baseline, verified

| Check | Result |
|---|---|
| HEAD | `1d508f2b99b78fd801a7948b1310d6de661d35d5` — matches the order |
| Branch | `build-018/session-governor`, clean, 0 unpushed |
| Tests | `node --test "tools/governor/*.test.mjs"` → **tests 767, pass 767, fail 0**, 13 suites, 0 skipped, 0 todo. Independently reproduced. |
| `install-hooks.mjs --check` | "already correct — the live settings match this installer's managed set" |

The bare-directory form `node --test tools/governor/` fails with MODULE_NOT_FOUND and
reports `pass 0 / fail 1`. The glob is required. This is documented in programme state, and
it matters: a casual re-run of the "obvious" command produces a red that is not a red.

## 2. Live settings — read-only inspection

**`C:/Fusion247PKA/.claude/settings.local.json`** (the one Warwick's sessions load) matches
the installer's `--check` output exactly. Five governor hooks plus the status line.

**Tower's `Stop` hook is genuinely intact** — command, matcher and position all verified:
it is the **first** entry in the `Stop` array, retains `matcher: ""`, and its `--env-file`
argument still points at its private control-plane env (classified, not quoted). The
governor's `stop-controller.mjs` is the **second** `Stop` entry with no matcher. The probe
established `Stop` groups are additive, so ordering is not load-bearing, but the pre-existing
hook was preserved byte-for-byte, which is what was promised. `ensure-capture-gateway.mjs`
likewise survives as the first `SessionStart` entry. `--check` reports `kept: 2`.

**The WP-6 defect is genuinely fixed in the live file.** The `SessionStart` reorientation
entry carries **no `matcher` key at all**. This was the blocking defect Larry recorded; it
is closed on the surface that counts.

**Nothing is present that should not be. One thing is present that is inert:**
`stop-controller.mjs --estate <path>`. `stop-controller.mjs` parses **no argv whatsoever** —
the flag is decorative and the controller takes its location from the payload's `cwd`. The
installer documents this deliberately at `install-hooks.mjs:114-123`, so it is a known
cosmetic, not a defect. `reorient.mjs` also parses no `--estate`, and correctly is not given
one. `worktree-guard.mjs` and `delegation-gate.mjs` do parse it.

**Hygiene finding (minor).** The installer wrote
`.claude/settings.local.json.bak-2026-08-01T04-27-58-487Z` into the governor worktree. It is
**untracked and not gitignored** — `git check-ignore` returns non-zero. A `git add -A` on
this branch would commit a full snapshot of live settings, including the classified env path
above, into a public repo. Add `.claude/settings.local.json*` (or at least `*.bak-*`) to
`.gitignore`, or delete the backup before any wide add.

**Governor worktree settings** (`C:/Fusion247PKA-governor/.claude/settings.local.json`) are a
self-referential copy with `--estate C:/Fusion247PKA-governor`. Consistent, no surprises.

---

## 3. Ruling on Warwick's seven

### 1. An ordinary response shows the Governor footer where he works (web/Android) — **NOT PROVEN**

Larry marks this PENDING, which is honest. My finding is stronger than PENDING: **the gap is
structural, not remaining work, and Larry has not named it.**

- `tools/governor/footer.mjs` has **no CLI entrypoint** — no `main()`, no
  `import.meta.url === pathToFileURL(process.argv[1])` block. Verified.
- Its only two production consumers are `statusline-live.mjs` (the **renderer**, whose output
  goes to the **terminal status line** — precisely the surface Warwick cannot see, and which
  is the stated reason the footer exists) and `stop-controller.mjs` (the **parser**).
- Larry, the model composing the reply, sits between the renderer and the parser **with no
  read path to either.**
- Root `CLAUDE.md:111` states: *"a hand-composed footer is a defect."*

So the two available implementations are **impossible** (invoke a CLI that does not exist)
and **declared a defect** (hand-compose it). Until a channel exists — the smallest being a
CLI on `footer.mjs` that Larry invokes, or the statusLine process persisting its rendered
line where Larry can read it — acceptance item 1 has no production path at all.

### 2. Larry continues automatically rather than stopping at an internal boundary — **PARTIAL**

The mechanism is real and I verified it independently rather than accepting Larry's table.
I drove `stop-controller.mjs` across **17 payloads** (his 7 plus 10 of my own). Every
outcome matched the claim. Detail in §4.

Two limits keep it off PROVEN, and only the first is Larry's:

- **It engages only where a programme resolves** — i.e. inside the governor worktree.
  Larry states this. That live path has **never been exercised in a real Claude process**;
  the fresh-session run was in the primary checkout, where the controller is designed to do
  nothing. So the one configuration in which continuation actually fires is script-seam only.
- **Unnamed, and it defeats the whole control:** a footer without the control token → ALLOW.
  My probe row 5. This is not hypothetical — it is the shape in Larry's own A3 evidence
  block (`⟦GOV⟧ ctx 31% · GREEN · KEEP GOING · next: Opus`, four fields) and the shape
  recorded in Warwick's standing memory note. I ran it through `parseFooter`: **REJECTED,
  `does-not-match-grammar`**, and the controller therefore returns `allow:no-footer`.
  Combined with item 1 — no wired way for Larry to produce the byte-exact five-field form —
  the realistic production outcome is a controller that is installed, correct, and **never
  fires**.

`statusline-live.mjs` at HEAD does emit the correct five-field form; I rendered it. But it
emits it to the terminal.

### 3. `/clear` reorients and continues correctly — **NOT PROVEN (code done)**

Larry's "CODE DONE / LIVE PENDING" is the right verdict. One correction to the reasoning:
his justification is *"Same hook, same code path, same matcher — `clear` was verified at the
script seam and `startup` is now proven live."* That is a **sameness argument, not
evidence**. `claude -p` has no `/clear`, so the `clear` source has only ever been driven by a
synthetic payload. The inference is reasonable and I would expect it to hold; it is still
inference presented inside a file whose stated purpose is executed evidence.

### 4. A genuinely fresh session recovers identity, team, build and route — **PARTIAL. The claim "PROVEN END-TO-END, LIVE" is the review's clearest overstatement.**

What was actually established, and it is genuinely valuable: a real fresh `claude` process,
started in a directory containing **no BUILD-018 files**, received an injected brief carrying
the live build, the live ticket and the live next action, and answered from it. `SessionStart`
on `source: startup` fired for the first time in this build's history. That is real.

Three corrections:

1. **It is not M4.** Larry writes: *"That is the outcome the Goal Contract calls M4 and names
   as the real acceptance test."* The Goal Contract's M4 reads: *"**Live dogfood**: an actual
   rotation, then a fresh session **completes a ticket unaided**."* No rotation was performed.
   No ticket was completed — the session **answered two questions about the build with tools
   disabled**. That is capability 5 (Reorientation) demonstrated once. M4 is a different and
   much higher bar, and the Goal Contract says of it: *"M4 is the real acceptance test. The
   others are necessary; only M4 proves the product."* The Goal Contract outranks the
   evidence file.
2. **Larry's own ledger contradicts him.** `programme-state.json` still carries
   **`T-08 — Live dogfood rotation (M4) — frontier`**. The evidence file claims the outcome
   T-08 exists to produce, while T-08 remains open.
3. **One headless run in one directory** does not catch: the interactive TUI or Remote
   Control client (Larry names this, but in a standing caveat at the bottom of the file, not
   under the "PROVEN END-TO-END" heading where a reader forms the impression); a fresh
   session started **in the governor worktree**, which is the only place the controller
   engages; the `clear` and `resume` sources; and the footer path entirely, because a
   no-tools Q&A produces no footer.

Also still `frontier`: **T-06** (RED preflight block — capability **7, "Protection"**, one of
the commission's seven) and **T-12** (portability — measure **M6**).

### 5. Wrong-worktree protection still operates — **PARTIAL, and one supporting claim is wrong**

I reproduced the deny myself from `cwd: C:/Users/Buggly`: correct `permissionDecision: deny`,
exit 0, reading **live** banked state (it named `T-23`, the currently banked ticket, not a
compiled-in constant), naming the canonical worktree, the branch, the mismatch set and the
recovery. The script works.

**The overstatement:** A5 point 3 says *"The location gate fired and correctly refused
implementation from the wrong worktree… That is **A6 proven live**, not just at the script
seam."* It is not. What fired in the fresh-session run was **`reorient.mjs`'s location line
inside the reorientation brief** — a `SessionStart` hook rendering text. `worktree-guard.mjs`
is a **`PreToolUse` deny gate** and is a different control on a different event. NOLAN-01
established `PreToolUse` has fired zero times across every governor transcript, and nothing
since has changed that. **`worktree-guard.mjs` has still never denied a real tool call.**
Two controls with similar output text were conflated into one proof.

Also confirmed, and Larry records it: `worktree-guard.mjs:392` still hard-codes *"Larry owns
the git lifecycle"*, which `CLAUDE.md:99` declares a defect in that script. Visible in my
deny output. Named, not fixed. Cosmetic in addition: the guard emits two
`fatal: not a git repository` lines on **stderr** when run from a non-repo cwd. Harmless —
stdout stays well-formed — but it will look like a failure in any log.

### 6. The footer uses live telemetry — **PARTIAL**

The telemetry is genuinely live. I read a real health sample for a real session:
`used_percentage: 58`, `schema_version: 1`, model `Opus 5`, sampled minutes earlier. The
evaluator maps the state space correctly and `BLIND` never renders as `GREEN` (INV-1) — I
confirmed the BLIND path by invoking the renderer with empty stdin.

Two limits:

- **The percentage reaches exactly one process.** The host supplies
  `context_window.used_percentage` only to the `statusLine` command. When I invoked the
  renderer with a payload lacking it, the output was `⟦GOV⟧ ctx -- · BLIND · …`. So "live
  telemetry" is true of the terminal line and of nothing Warwick can see. This is item 1's
  gap wearing a different hat. (The raw material *is* reachable — samples persist under the
  health store and carry the percentage — which is why the fix is small. It is just not wired.)
- **`bankedStateStale` cannot fire, and the state is stale right now.** Larry records the
  first half (the `RECOVERY` state is unreachable from the status-line payload). He does not
  record the second: banked `head_sha` is `1e3a1b31`, HEAD is `1d508f2` — verified ancestor,
  **2 commits behind** — and the footer renders `GREEN · next: Opus` regardless. The one
  signal designed to catch exactly this is structurally unable to.

### 7. Model advice is meaningful or honestly UNSET — **PROVEN (and Larry undersells it)**

Larry's A3 says: *"It does **not** prove the `UNSET` predicate: `statusline-live.mjs` still
reads `model_recommendation.model` directly and applies no predicate."* **That is stale.** At
HEAD, `statusline-live.mjs:119` calls `nextModelFor`, and `statusline-live.mjs:57` records
that the superseded `recommendedModel()` was **deleted** rather than left unused. I confirmed
the predicate is live behaviourally: with worktree path + branch supplied it returned
`next: Opus`; with empty stdin it returned `next: UNSET` (`LOCATION_UNKNOWN`). All six D-4
conditions are implemented in `footer.mjs:577-659`, driven by absence rather than text.

This is an accuracy defect in the evidence file in the opposite direction from the others,
and it is the tell for the file's real problem: **sections were written at different heads
and never reconciled**, so a reader cannot tell which statements describe HEAD.

---

## 4. INV-2 — the verdict, and it is the good news

**INV-2 holds. I could not construct a path where the controller blocks and keeps blocking.**
Verified against the code and against the machine, not accepted from the table.

Seventeen payloads, stores redirected to scratch via `MYPKA_GOVERNOR_DISABLE_DIR` /
`MYPKA_GOVERNOR_HANDBACK_DIR` so nothing live was touched. Every one exit 0.

| Payload | Result |
|---|---|
| Governed reply ending `· CONTINUE`, programme resolves | **BLOCK** (the only blocking path) |
| `stop_hook_active: true` | ALLOW |
| `stop_hook_active` **absent** | ALLOW |
| No footer | ALLOW |
| **Four-field footer (no control token)** | **ALLOW** |
| Malformed stdin (`not json at all`) | ALLOW |
| Empty stdin | ALLOW |
| `HANDBACK:merge-decision` | ALLOW |
| `HANDBACK:banana` (unrecognised code) | BLOCK — correct; a typo must not grant an escape |
| `permission_mode: plan` | ALLOW |
| `cwd` = primary checkout (no programme) | ALLOW |
| `cwd` = nonexistent directory | ALLOW |
| **Corrupt state file — invalid JSON** | ALLOW |
| **Corrupt state file — binary garbage** | ALLOW |
| **Corrupt state file — `{}`** | ALLOW |
| **Corrupt state file — zero bytes** | ALLOW |
| **Two state files (ambiguous)** | ALLOW |
| `GOVERNOR OFF` in transcript | ALLOW (Larry's row 7) |

**Why it cannot keep blocking.** The block requires `p.stop_hook_active === false` by strict
identity (`stop-controller.mjs:290`). The host sets that flag `true` on every stop following a
block. The probe established this empirically on Claude Code 2.1.220 (`LARRY-hook-contract-probe.md`
§2: a recorded run showing `false → true → true`). So **at most one block per user turn**, and
the guarantee is structural rather than counted — it survives a corrupted, unwritable or stale
durable store because there is no durable store on that path. That is a better design than a
counter, and I want to say so plainly: this is the strongest part of the build.

The escape line is printed verbatim inside every block reason, so the way out is on the screen
at the moment it is needed rather than in a file Warwick cannot reach from a phone. Correct.

**The one residual, and it is a host dependency rather than a defect.** The entire anti-loop
guarantee rests on the host setting `stop_hook_active: true` on the re-fire. If a future Claude
Code version sent `false` on a re-fire, an unbounded block loop becomes reachable and there is
no counter backstop, by deliberate design. It is probed on **one version** (2.1.220) and
**headless only**. The failure would be loud and Warwick's `GOVERNOR OFF` still works, so I do
not rate it blocking — but it should be re-probed after any Claude Code upgrade, and that is
not written down anywhere.

**Net INV-2 verdict: PASS.** No error, timeout, malformed input, re-entrancy, corrupt state
file or missing transcript path can trap Warwick. This is not the finding of the review.

---

## 5. Reinstallability — **NO, and this is the finding of the review**

Could someone reproduce this wiring after a merge, or on another machine, from committed code
alone? **No.** Three reasons, and the first is a live time-bomb.

**(a) Every live hook points into the worktree, which the merge is meant to delete.**
All six controls in `C:/Fusion247PKA/.claude/settings.local.json` — reorient, worktree-guard,
delegation-gate ×2, stop-controller, statusLine — resolve to
`C:/Fusion247PKA-governor/tools/governor/*`. `install-hooks.mjs:890` derives script paths from
`resolve(here, '..', '..')`, i.e. wherever the installer itself lives; it was run from the
governor worktree, so the worktree path is what got written.

When `build-018/session-governor` merges to main and the worktree is removed — the ordinary
end of a build — **all six controls point at a deleted directory simultaneously.** They fail
open (node exits non-zero, no stdout, so no block; INV-2 survives), but the governor dies
silently and completely. That is precisely the "a governor that silently stops measuring"
class INV-1 exists to forbid, arriving through a door INV-1 does not watch.

The remedy is one command — re-run the installer from the primary checkout after merge — and
**it is written down nowhere.** T-23's integration sequence ends at the restart. Nothing in the
Goal Contract, the constitution, the decision doc or the ticket ledger names a required
post-merge re-install. This should be recorded before the merge, not discovered after it.

**(b) The primary checkout is hard-coded.** `install-hooks.mjs:894`:
`const checkout = args.checkout || 'C:/Fusion247PKA';`. Overridable, but the default is one
machine's layout. `CLAUDE.md:115` requires the control set be *"reproducibly installable after
a merge or on another machine from committed code"* — the constitution's own standard, unmet.

**(c) The constitution says so itself, and that is to its credit.** `CLAUDE.md:121` records the
honest limit: settings live outside every repository, are not hot-reloaded, and *"written is
not loaded"*. `CLAUDE.md:123` states the whole "Mechanical enforcement" section describes a
**declared target, not the current state of the estate**. Read literally, the constitution
already declines to claim this control set is reinstallable. Larry's evidence file does not
carry that qualification forward.

**Still hand-made:** running the installer at all; the full quit-and-relaunch; the post-merge
re-install (unrecorded); and — per item 1 — the footer itself.

---

## 6. Gaps Larry has not named

T-24, T-25, T-26 are registered and therefore named. These are not:

1. **The footer has no producer.** §3 item 1. The single largest gap, and it sits underneath
   acceptance items 1, 2 and 6 at once. `footer.mjs` renders and parses; nothing hands the
   bytes to Larry.
2. **Post-merge, the whole control set breaks.** §5(a). Nothing records the remedy.
3. **A four-field footer silently disables the execution controller.** §3 item 2. Documented
   as "no footer means allow", which is right; not documented is that the shape Larry has been
   emitting in practice *is* the no-footer case.
4. **The banked state is stale right now** (`1e3a1b31` vs HEAD `1d508f2`, 2 commits) and the
   signal designed to catch that cannot fire on Warwick's surface. Larry named the mechanism;
   he did not check whether it was currently firing-worthy.
5. **Capability 7 of the commission's seven is unbuilt.** T-06 (Protection / RED preflight)
   is `frontier`. So is T-12 (M6, portability). The evidence file discusses neither.
6. **T-08 is still `frontier` while the file claims its outcome.** §3 item 4.
7. **The anti-loop guarantee is a single-version host dependency** with no re-probe trigger
   recorded against a Claude Code upgrade. §4.
8. **The installer's settings backup is untracked and un-gitignored**, and contains a
   classified env path in a public repo. §2.
9. **The evidence file is internally stale.** A1 and A3 describe a pre-WP-3 estate; A3's
   central negative claim is false at HEAD. Anyone reading it as a description of `1d508f2`
   will be wrong in both directions.

---

## 7. Verdict

| # | Acceptance item | Verdict |
|---|---|---|
| 1 | Footer visible where Warwick works | **NOT PROVEN** — no producer exists; structurally blocked |
| 2 | Larry continues at internal boundaries | **PARTIAL** — script-proven; never live where it engages; defeated by a 4-field footer |
| 3 | `/clear` reorients and continues | **NOT PROVEN** — code done, live pending; the argument for it is inference |
| 4 | Fresh session recovers | **PARTIAL** — reorientation proven once, headless, one directory. **Not M4.** |
| 5 | Wrong-worktree protection | **PARTIAL** — script verified by me; the "proven live" claim conflates two controls |
| 6 | Live telemetry | **PARTIAL** — genuinely live, reaches only the terminal; staleness signal cannot fire |
| 7 | Model advice meaningful or UNSET | **PROVEN** — predicate wired at HEAD; Larry's file understates it |

**Overstated claims, with corrections:**

- *"A5 — PROVEN END-TO-END, LIVE"* and *"That is the outcome the Goal Contract calls M4"* →
  **reorientation was proven once, headless, in one directory.** M4 requires an actual rotation
  followed by a fresh session **completing a ticket unaided**. Neither happened. T-08 is still
  `frontier`.
- *"That is A6 proven live"* → **it is not.** `reorient.mjs`'s banner text fired.
  `worktree-guard.mjs`, the `PreToolUse` deny gate, has still never denied a real tool call.
- *"statusline-live.mjs still reads `model_recommendation.model` directly and applies no
  predicate"* → **false at HEAD.** The predicate is wired; the old function is deleted.

**Is Outcome A complete enough for Larry to hand back to Warwick?**

**Not as "Outcome A is complete" — but yes as an honest handback, provided three things are
said plainly and one is fixed first.** The engineering underneath is genuinely good: INV-2 is
sound and I could not break it, 767 tests pass, the installer's output matches live reality,
Tower's hook survived untouched, and the constitution binds without a hook. But the headline
acceptance item — the footer where Warwick actually works — has **no production path at all**,
and the item Warwick will judge everything by, M4, is not met and is still open in Larry's own
ledger. Handing back on the current wording would tell Warwick the fresh-session journey is
proven end-to-end when what is proven is one headless reorientation. Fix the wording, record
the post-merge re-install before the merge can strand six controls, and hand back the honest
version — which is still a substantial result.
