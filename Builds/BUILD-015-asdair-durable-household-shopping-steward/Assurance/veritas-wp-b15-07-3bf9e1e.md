---
build: BUILD-015
scope: WP-B15-07
gate: 1
boundary: >
  WP-B15-07, the intake -> shop seam, and the outcome it promised: a shopping-list photograph that
  lands on a date whose shop is TERMINAL becomes a FRESH live shop that can advance to a card,
  instead of being silently absorbed into a dead shop and acknowledged to Telegram as consumed.
  The SHAs below are PROVENANCE, not the identity of this gate.
reviewed_sha: 3bf9e1e2a91deddb4fa998e61014a82e02d2e127
governance_sha: cd62dce88306b3aea96b63908c16cada2660aa8e
governance_contract_blob: 635653add45e741c3c8bf4fa09356f434937dc82
governance_amendment_applied: 65f73756e4a2e5a3740138bed26fe5730cd0955e
branch: main (local)
reviewed_sha_remotely_reachable: false
remote_note: >
  git branch -r --contains 3bf9e1e is EMPTY; origin/main is 6eaf0dc. The PRODUCT bytes are
  remotely durable - git diff aba9a28 3bf9e1e -- services/ is empty and aba9a28 is pushed as
  build-015/b15-07-terminal-shop-collision. Only the integration commit is local.
evidence_method: mixed - primary checkout (read-only) + git archive exports for all mutation testing + live runtime process/scheduled-task metadata
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/a8a4a211-d8c2-42c1-8bb3-d7d87ba2540f/scratchpad/vx
worktree_head_at_start: 3bf9e1e2a91deddb4fa998e61014a82e02d2e127
worktree_head_at_end: 65f73756e4a2e5a3740138bed26fe5730cd0955e
worktree_head_note: >
  HEAD moved mid-review because WARWICK committed the governance amendment 65f7375, not because
  the reviewed work changed. The reviewed PRODUCT head did not move: git diff 3bf9e1e 65f7375
  -- services/ is empty. All product evidence here is evidence about 3bf9e1e and is labelled so.
worktree_status_clean: true
worktree_status_note: >
  Empty at review start; at review end this receipt alone is untracked, which is expected. The
  mid-review dirty state was Warwick's amendment in flight and is now committed. Veritas modified
  nothing and holds no Edit tool.
review_ceiling: 45 minutes elapsed, intake seam and downstream reachability - not extended; exceeded only to correct a recommendation the mid-review amendment falsified
verdict: HOLD
receipt_sha256: ba7af5b9fa70ad36440aed79a27b071ff3783a7cf55f27453e0c6112d62be45c
reviewed_by: veritas
reviewed_date: 2026-08-10
next_review_trigger: >
  The real production event - a Telegram photograph traversing the live runtime onto a terminal
  date and producing a card - preceded by the D-6 current-state read. ONE focused confirmation of
  D-6, D-2/AC2, AC9 and AC8 only. Never "the head moved"; this receipt is not a trigger.
---

## Governance note — an amendment landed mid-review, and it binds

At `17:40:17`, while this review was running, Warwick committed `65f7375` — *"Veritas: current
readiness is NOT capability - Warwick's binding amendment"* — adding a **BINDING** section to this
reviewer's own contract. It postdates the governance head named in my dispatch (`cd62dce`, blob
`635653a`, which is what my PROOF-OF-LOAD is against), but **Warwick's explicit decisions outrank
the contract, so it binds this receipt and I have applied it.** It touches no product code:
`git diff 3bf9e1e 65f7375 -- services/` is empty, so the reviewed boundary is unchanged and a moved
HEAD is not a new scope.

**It did not change my verdict — it reinforces it.** It *did* change my recommendation, and it
caught me about to repeat the exact failure it was written about. See §Verdict.

## Scope reviewed

The intake → shop seam of **WP-B15-07** and the human outcome it promised: *a shopping-list
photograph that lands on a date whose shop is TERMINAL becomes a FRESH live shop that can advance
to a card, instead of being absorbed into a dead row and acknowledged to Telegram as consumed.*

Graded: AC1–AC9 as written in `Deliverables/2026-08-10-WO-B15-07-terminal-shop-collision.md`
(including AMENDMENT 1, whose Settlement 2 governs AC4 and whose AC9 is the outcome-critical row).
Scope was not narrowed. Scope was widened in one place only, within the accepted outcome: the
**active operator instruction** in `SOP-021` §1, because it points a human at the intake path that
the WP's own AC5 audit found unsafe, during the acceptance window.

Deliberately **not** in scope: estate reconciliation; the Wayfinder documentation reconciliation
frozen by Warwick; Codex's PR/release gate; Gate 2's phase journey question (separate receipt).

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | A retried identical inbound Telegram message creates no second shop and resolves truthfully | **PASS** | `runtime.test.js` "AC1: the SAME message redelivered onto a terminal date still yields exactly ONE fresh shop" green in 396/396; source read — the inbound-key branch is checked and returns **before** the terminal branch, so a redelivery never reaches the new code; no migration in the diff, so `(telegram_chat_id, telegram_message_id)` is unweakened; the test goes RED under my mutation 1, so it can genuinely fail | Offline (fakePg), R4 |
| AC2 | A DIFFERENT message on a TERMINAL date creates a FRESH live shop carrying the new message; terminal row unmutated | **HOLD** | `runtime.test.js` AC6/AC2 tests green; fresh row asserted at `status RECEIVED`, `shop_ref SHOP-2026-08-10-M63`, new `telegram_message_id`/`telegram_update_id`/`raw_media_path`; dead row proven unmutated by a whole-row `JSON.stringify` compare | **The load-bearing mechanism has never executed against real PostgreSQL.** The fresh insert is a *second* `INSERT … ON CONFLICT DO NOTHING` issued inside the **same transaction** after the first silently conflicted, plus a re-select. R4 declares this untested against real PG, and the Work Order itself warns "do not let the double certify the fix". My own reading of PG says a conflicting `DO NOTHING` does not abort the transaction, so the second insert should be valid — **but reasoning is not evidence, and this is a mandatory property** |
| AC3 | A LIVE shop on the same date behaves exactly as before | **PASS** | Source-level proof, independent of any database double: the live branch returns the pre-existing tuple plus one new always-`null` field (`superseded_terminal_ref`); no other behaviour on that path changed. `runtime.test.js` "AC3: a LIVE shop on the same date still RESUMES" green | See **D-3** — the live path's *pre-existing* absorb behaviour is unchanged, which is what AC3 required, and is still wrong. **D-6 makes this the live hazard for the very next action** |
| AC4 | Intake never reports success when no list entered a live shop — graded against Settlement 2 (keyed on durable capture / `matched_by`, not liveness) | **PASS** | The guard in `commands.js` keys on `created.matched_by === 'shop_ref'` — the durable-capture test — and only then narrows on terminal status. `commands.test.js` "AC4: a REDELIVERY whose shop was later cancelled still succeeds - it must not wedge the poller" green: the wedge Settlement 2 was written to prevent does not occur, because a captured redelivery matches on the inbound key and never reaches the guard. "AC4: receiveList REFUSES…" green | The guard is defence-in-depth only — the store now prevents the condition, so the branch is unreachable through production. Stated honestly in the source comment |
| AC5 | A terminal collision never silently advances the offset while dropping content; the whole ack/offset ordering audited | **PASS** | Production source read at `shopperIntake.js` ~757–775: `await onRecord(record)` precedes `state.write(updateId)`; a throw logs `persist_failed_offset_held`, pushes to `failed` and `break`s the batch — the offset is not advanced for that update **or any later one**. The audit was performed and produced R1 and R2 | **D-3 below is a sibling silent-absorb path the audit did not report.** It is out of scope to *fix* by AC3's own ruling, so it is reported here rather than held |
| AC6 | The regression reproduces the real failure and was proven RED before the fix | **PASS** | **Independently executed by me, both directions, in an isolated export.** Unmutated: 396/396. Mutated to pre-fix behaviour (terminal branch removed): `not ok 339 - AC6 REGRESSION…` plus 4 other named tests, 391 pass / 5 fail / 396 executed | none |
| AC7 | The guard is mutation-proven with byte-identical restore | **PASS** | **Two mutations executed by me, in the export only.** (1) terminal guard → 5 named tests RED; (2) the widened `listDateOf` pin reverted to strict → `not ok 242` and `not ok 343`, 394/396. Non-zero executed count both runs (396). Restore proven byte-identical by fresh `git archive`: `shopStore.js` sha256 `7236374567142ccb1f26b46ca99c3124065c10645d00e55afad6627c8afb58e7` — **the same digest Larry quoted before and after his own in-repo mutation**, independently confirming his restore | none |
| AC8 | No manufactured state; nothing written to the live database; Warwick's photograph on disk untouched | **HOLD** | Repo half **proven**: HEAD unchanged across the review; the integrated diff is 15 files, all under `services/asdair/**`; no migration; all five suites executed here **with no database credentials present**, so nothing in the evidence path can reach the live store | **The two sub-properties that live in `C:\.fusion247\**` are NOT verifiable by Veritas.** GL-012 §1 denies that root by default, this dispatch declared no `private_surface`, and `credential_scope` is none. Declared unavailable by name; never inferred. Discharge requires Warwick's explicit acceptance or executed evidence from an actor holding the declared surface |
| AC9 | **The outcome-critical one** — the fresh shop can ADVANCE, not merely exist | **HOLD** | Strong and genuinely executed as far as it goes: `runtime.test.js` "AC9: the fresh shop can ADVANCE" takes the ref **the runtime actually created** through `listDateOf` (date part only), `buildExecutionPacket`, `buildHandoff` and `isValidShopRef` — and both `listDateOf` and the packet pin go RED under mutation. Repo-wide grep confirms **no strict date-only `shop_ref` pattern survives anywhere in `services/**`**. The worker also found and covered a **fifth** pin the dispatch did not name: the Telegram callback-button budget | **"Advance" is proven as "every validator accepts the ref", not as "the pipeline advanced a collision-ref shop from RECEIVED to a card."** No composed pass was executed and no real photograph has traversed the seam. The Work Order's own `outcome` says the acceptance event is a Telegram photo arriving at the live runtime and "may not rest on a manual invocation of any delivered function." That test is not yet satisfied |

## Evidence provenance

- **Reviewer home:** the primary checkout `C:/Fusion247PKA`, read-only against product head
  `3bf9e1e`. **Veritas wrote nothing into the repository except this receipt**, and holds no `Edit`
  tool.
- **Isolation:** all mutation testing ran in `git archive 3bf9e1e | tar -x` exports at
  `C:/…/scratchpad/vx`, outside the repository. No worktree was created, no `.git` state was
  touched, no branch was cut.
- **Repository HEAD** — `3bf9e1e` at review start. **`65f7375` at review end**, because Warwick
  committed the governance amendment mid-review (see §Governance note). **The reviewed product head
  did not move**: `git diff 3bf9e1e 65f7375 -- services/` is empty. All product evidence in this
  receipt was gathered against `3bf9e1e` and is presented as evidence about `3bf9e1e` only.
- **Repository `git status --porcelain`** — empty at start; at end, this receipt alone (untracked,
  expected). The mid-review dirty state was Warwick's amendment in flight and is now committed.
- **Live runtime:** inspected via process and scheduled-task metadata only. `Get-CimInstance` shows
  PID 7068 = `node.exe C:\Fusion247PKA\services\asdair\pipeline\runtime.js --watch`, started
  10/08/2026 17:24:07; the merge `3bf9e1e` is timestamped 17:22:31 — **so the live process loaded
  post-fix bytes from the canonical checkout.** `MyPKA-AsdAIr-Runtime` reports `LastTaskResult: 0`,
  `NumberOfMissedRuns: 0`.
- **NOT inspected, and this is a boundary not an omission:** anything under `C:\.fusion247\**` —
  `runtime.log`, the offset state file, the media store — and **the live database**. GL-012 §1
  denies that root by default, this dispatch declared `private_surface: none`, and
  `credential_scope` is none. A directory listing of `C:\.fusion247\asdair\` was taken before I
  re-read GL-012; no file content was read. **This is the reason current durable state could not be
  established — see D-6.**

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `cd services/asdair/pipeline && node --test` | 0 | **396** | 396 pass / 0 fail |
| `cd services/asdair/shop && node --test` | 0 | **102** | 102 pass / 0 fail |
| `cd services/asdair/packet && node --test` | 0 | **110** | 110 pass / 0 fail |
| `cd services/asdair/handoff && node --test` | 0 | **117** | 117 pass / 0 fail |
| `cd services/asdair/intake && node --test` | 0 | **34** | 34 pass / 0 fail |
| MUTATION 1 (export): terminal branch → `if (true)`; source proven changed (39842 → 39800 bytes) | 1 | **396** | 391 pass / **5 fail** — `not ok 69` AC2-supersedes, `not ok 339` **AC6 REGRESSION**, `not ok 340` AC1, `not ok 341` AC2, `not ok 343` **AC9** |
| MUTATION 2 (export): `listDateOf` pin reverted to strict; source proven changed (107441 → 107431) | 1 | **396** | 394 pass / **2 fail** — `not ok 242`, `not ok 343` **AC9** |
| Restore proof: fresh `git archive` → `sha256sum shopStore.js` | 0 | n/a | `7236374567142ccb1f26b46ca99c3124065c10645d00e55afad6627c8afb58e7` — matches Larry's quoted before/after digest |
| `git branch -r --contains 3bf9e1e` | 0 | n/a | **empty — the reviewed head is on no remote ref** |
| `git diff --stat aba9a28 3bf9e1e -- services/` | 0 | n/a | **empty — product bytes identical to the pushed worker head** |
| `git ls-remote --heads origin` | 0 | n/a | `origin/main = 6eaf0dc`; `build-015/b15-07-… = aba9a28` |
| Repo-wide grep for `^SHOP-[0-9]{4}…$` pins | 0 | n/a | Only the 5 widened pins in `services/**`; one strict pin remains in `Builds/**` schema (R3, declared) |
| **Current durable state of `asdair.shop` for 2026-08-10** | — | **0** | **NOT ESTABLISHED — no credential scope, live store behind GL-012. This is D-6** |
| **The real production journey — a Telegram photograph through the live runtime to a card** | — | **0** | **NOT EXECUTED** |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The fix is Warwick's product rule, not a workaround: identity grounded in the inbound event, terminal row never revived or mutated, plain date form unchanged for an ordinary week |
| Design fidelity | **PASS** | Insert-first preserved; `matched_by`'s three values unchanged with the collision reported in a new field; no clock, no counter, no randomness introduced into a deliberately pure module; no migration; loud refusal (not a fabricated identity) on a non-Telegram inbound, per Settlement 3 |
| Functional proof | **HOLD** | Every layer is proven against `fakePg` and an injected Telegram client. The composed production path has not run. AC2's exact PostgreSQL semantics are the one mechanism the double is solely certifying |
| Integration | **PASS** | Tests drive the real `pollIntake` → `commands.receiveList` → `shopStore.createOrResumeShop` chain, not isolated units. All five downstream pins located and covered — including the callback-button budget the dispatch did not name |
| Durability | **HOLD** | The offset-hold ordering is correct in source and the runtime is on fixed bytes; but the durable store was never exercised **and its current contents were never read** |
| **Current readiness** (Warwick, `65f7375`) | **HOLD** | **The mandatory question — «given the durable state that exists RIGHT NOW, what will the production system do when Warwick re-sends the photograph?» — is NOT established.** No current-state read was possible. D-6 names a concrete, plausible state under which the exact next action still produces no card |
| Test quality | **PASS** | Both mutations turned **named** tests RED with non-zero executed counts, executed by me in isolation. `buildExecutionPacket.test.js:554` pins the R3 divergence so it cannot rot silently |
| Git truth | **HOLD** | Larry's report is accurate — suite counts, digests and provenance all reproduce exactly. But `3bf9e1e` is reachable from **no** ref on `origin`. Product bytes are durable (identical to the pushed `aba9a28`); the integration commit is local only |
| Documentation truth | **HOLD** | D-1: `SOP-021` §1 actively instructs an operator to run the intake path R1 declares unsafe, and asserts a safety property that path does not have |
| Residual risk | **PASS** | R1–R6 are explicit, bounded and honestly classified in the dispatch; R3 is pinned by a test; R6 is discharged by an executed budget test. D-3 and D-6 are the ones that were missing |
| Completed automation | **HOLD** | **Mandatory here** — the Work Order declares the outcome INTENDED AUTOMATIC and forbids acceptance resting on manual invocation. The real production event has not invoked the fixed path. Capability is evidenced; completed automation is not |

## Production caller and journey

Traced, hop by hop, from the entry point a real message actually reaches:

`Telegram getUpdates` → `shopperIntake.runIntake` → **`onRecord` (`runtime.js` `persist`)** →
`commands.receiveList` → `shopStore.createOrResumeShop` → *[first INSERT conflicts]* →
*[inbound key checked first — a redelivery returns here]* → *[ref matches a TERMINAL row]* →
`collisionShopRef` → **second INSERT, fresh row** → `recordShopCreated` (milestone naming the
superseded ref) → return → **`state.write(offset)` only now** → downstream: `listDateOf` /
`buildExecutionPacket` / `buildHandoff` / callback button.

**Every hop above is real production code and is exercised by the tests through `pollIntake`.**
What is *not* on any executed journey: the real Telegram client, the real PostgreSQL server, and
the advancing passes that turn a `RECEIVED` shop into a card. `listDateOf` and
`buildExecutionPacket` were reached in the AC9 test by direct call — correctly, since the point is
whether they accept the runtime-created ref — but that is a validator check, not an advance.

**And the branch this trace takes depends entirely on the status of the row that currently holds
`SHOP-2026-08-10`, which was not read.** That is D-6.

## Restart and durability

The live runtime survived a ~5 minute cutover outage and is running the fixed bytes. **No evidence
of loss, and loss in that window is structurally prevented rather than merely unobserved:** the
offset advances only *after* a durable persist, so a stopped process acknowledges nothing, and
Telegram retains unacknowledged updates. The launcher **refusing to start without
`SHOPPER_BOT_TOKEN` is a fail-safe firing correctly**, not a defect — starting a poller without its
token would have been the dangerous outcome. What I could **not** verify: that the process is
currently polling successfully, because `runtime.log` is behind GL-012.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** the two `services/asdair/**` READMEs documenting the
  date-only convention (report-only, his to place); the Wayfinder's ACTIVE SESSION WORK PACKAGE
  still naming WP-B15-3 (declared, frozen by Warwick, **non-blocking — confirmed as declared**).
- **Verified independently of his list:** the `Builds/**` execution-packet schema still pins the
  strict form (R3) — confirmed, and pinned by a test so it cannot rot.
- **What his list missed:** **`Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md` §1.** See
  D-1. This is the one document in the estate that tells a human what to *do*, and it is wrong in
  exactly the way this Work Package exists to fix.
- **Closure claims since the last receipt, and the receipt behind each:** none found. Larry's
  reporting stayed inside «integrated and submitted to Veritas». No unbacked completion claim.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D-6 | **HIGH — the one that matters** | **Current readiness for the exact next action is NOT established, and there is a concrete state under which it still fails.** If the row currently holding `SHOP-2026-08-10` (or a `-M` sibling) is in a **LIVE** status rather than terminal, the re-sent photograph takes the **unchanged AC3 path**: it resumes that shop, its `raw_media_path` never reaches any shop row, the offset advances, and **Warwick gets no card again** — same symptom, different cause (D-3). WP-B15-07 fixes the terminal collision; it does not fix this. **Which branch fires is decided entirely by a durable fact nobody has read.** Discharge is cheap and non-mutating: a read-only `SELECT shop_ref, status, telegram_message_id, created_at FROM asdair.shop WHERE shop_ref LIKE 'SHOP-2026-08-10%'` by an actor holding the credential scope | **blocking** the recommendation *"re-send now"* — **not** blocking the re-send once the state is read | Larry (read-only preflight) |
| D-1 | HIGH | `SOP-021` §1 instructs an operator to "use the committed receiver" `services/asdair/intake/fetch-shopper-list.js` and states it "holds the offset on genuine failure so a list can never be silently consumed and lost". Per R1 that script's live mode passes **no `onRecord`**, so it advances the shared offset and persists nothing — one live run permanently consumes a pending list. The SOP also warns that a second concurrent poller destroys a list, and PID 7068 is polling now. **The claim is false and the instruction is live during the acceptance window.** | **blocking** — of any use of `SOP-021` §1 while the live runtime polls | Larry |
| D-2 | MEDIUM | AC2's fresh-insert mechanism (second `ON CONFLICT DO NOTHING` in the same transaction, then re-select) is certified solely by `fakePg`. R4 declares this; repeated here because it is the mandatory property AC2 turns on | non-blocking; **gates AC2** | Larry |
| D-3 | MEDIUM | **A sibling silent-absorb path AC5's audit did not report.** A *different* message arriving on a date whose shop is **LIVE** matches by `shop_ref`, resumes, and its `raw_text`/`raw_media_path` never reach any shop row — the offset then advances. Fixing it is **out of scope by AC3's own ruling**; reporting it was asked for by AC5 and it is not in R1–R6. It is also the mechanism behind D-6 | non-blocking to this WP; **Warwick's decision whether it becomes work** | Larry → Warwick |
| D-4 | LOW | The reviewed head `3bf9e1e` is on no remote ref. Product bytes are remotely durable at `aba9a28`; only the integration commit is local | non-blocking | Larry |
| D-5 | INFO | Recorded for provenance, not as a fault: `Team/Veritas …/AGENTS.md` was dirty in the working tree mid-review and was committed at `65f7375` as Warwick's binding amendment. **Veritas did not author it and holds no `Edit` tool.** My contract load remains the committed blob `635653a` at the dispatched governance head; the amendment binds by Warwick's authority, not by appearing in a working tree. No product code was touched | non-blocking | — |

## Verdict

**HOLD** — the seam is well built, honestly evidenced and mutation-proven, and **I found no defect
in the fix itself**; but AC9's *advance*, AC2's real-database mechanism and AC8's private-store half
are unknowns on mandatory acceptance properties, and the Work Order's own words forbid accepting an
intended-automatic outcome on offline evidence.

**On Larry's proposed ordering — his sequencing is wrong in one direction and I was wrong in the
other. Both corrections are needed.**

1. **Waiting for a PASS before the re-send is circular** and should not stand. The re-send *is* the
   evidence that discharges AC2, AC9 and the automation dimension. No further offline review can
   substitute for it, and another review cycle before it would produce nothing.
2. **But I may not certify that the seam is ready to receive the photograph, and I nearly did.** An
   earlier draft of this receipt said "ask Warwick to re-send now" on the strength of: fixed bytes
   in the live process, correct offset ordering, green suites, mutation proofs. **Every one of those
   evidences CAPABILITY and none evidences CURRENT READINESS** — which is precisely what Warwick's
   amendment `65f7375`, committed while I was writing, forbids. **The exact failure it describes was
   in my draft.** D-6 is the concrete case: if today's shop row is currently LIVE rather than
   terminal, the re-sent photograph is absorbed by the untouched AC3 path and Warwick gets no card
   again.

**The correct next step is neither "wait for PASS" nor "re-send now". It is one read-only SELECT.**
Have an actor with the credential scope read the current status of `SHOP-2026-08-10%` and the
intake offset — non-mutating, seconds of work, no acceptance event manufactured. **If those rows
are terminal, the re-send lands squarely on the fixed path and should be requested immediately.**
If any is live, D-3/D-6 applies and Warwick must be told that before he sends, not after.

## Next review trigger

The real production event: a Telegram photograph traversing the live runtime onto a terminal date,
producing a fresh live shop and a card Warwick receives — **preceded by the D-6 current-state
read**. **ONE focused confirmation, of D-6, D-2/AC2, AC9 and AC8 only.** Not a re-review of
anything already PASS above, and **not this receipt moving HEAD.**
