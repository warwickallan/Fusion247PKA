---
build: BUILD-015
scope: gate3-documentation-and-git-truth-third-submission
gate: 3
reviewed_sha: 94f135f5ddc8bc9bfa3fe7beaa8edc8b13ce1530
governance_sha: 94f135f5ddc8bc9bfa3fe7beaa8edc8b13ce1530
branch: build-015/live-acceptance-recovery-2026-08-03
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/c--Fusion247PKA/76f29046-649e-43fc-8650-08e4c2b3def7/scratchpad/veritas-94f135f
worktree_head_at_start: 94f135f5ddc8bc9bfa3fe7beaa8edc8b13ce1530
worktree_head_at_end: 94f135f5ddc8bc9bfa3fe7beaa8edc8b13ce1530
worktree_status_clean: true
verdict: HOLD
receipt_sha256: 08dc80b0d6864b3d3a983a762640dfe72d334f15a8d332c1bac0ebf5ee6ca51a
reviewed_by: veritas
reviewed_date: 2026-08-04
next_review_trigger: Resubmission of a new exact integrated head after D-G3-21 through D-G3-24 are corrected -- SHIT-TO-DO.md row 11 (the false secret-scan claim sourced from Veritas), SHIT-TO-DO.md:167, the "four commits back" count at SHIT-TO-DO.md:49 and map:244, and the missing branch in the map's discharge test at :434-443. D-G3-26 (receipt digest CRLF false tamper, now proven) is a Warwick decision and should be taken before any external party verifies a receipt.
---

## Scope reviewed

**In scope, as dispatched:** the ten files changed by `94f135f` discharging `D-G3-12`…`D-G3-20`.

**Scope I widened, and why.** Gate 3 fires on *every affected active source*, and this round required
two widenings Larry did not ask for. **First, my own prior receipt.** Larry reported that
`veritas-gate3-documentation-d63668f.md`'s evidence table contains a fabricated row and asked me to
verify it. I did, and I found **two** falsified rows, not one — the second was previously undetected
by anyone and has already propagated into an active document as a defect that does not exist.
**Second, the controls themselves.** `SHIT-TO-DO.md` rows 11 and 12 record two control defects on my
authority. Neither had ever been executed to failure. I executed both. One is confirmed and worse
than recorded; **the other is false, and I am its source.**

Beyond that: the whole `Deliverables/` resumption chain, all five Work Order artefacts as artefacts,
every `permitted_by` in the entire export, the build record, `.claude/agents/thin-larry.md`, and a
closure-claim enumeration across both commits since my last receipt.

**Deliberately out of scope:** the seven pre-existing dirty entries (verified untouched below);
Codex's external PR and release gate; Pax's final BUILD-015 acceptance; any live database or CI
state.

## Evidence provenance

- Isolated export of `reviewed_sha` at
  `…/scratchpad/veritas-94f135f`, created with
  `git archive 94f135f5ddc8bc9bfa3fe7beaa8edc8b13ce1530 | tar -x -C <workspace>` — exit 0. **No
  `.git` in the export**, confirmed by `ls -a | grep -c '^\.git$'` → `0`. **No `git worktree` was
  created** — `git worktree list` at the end shows only the 22 pre-existing entries, unchanged.
- Repository `git rev-parse HEAD` at start / end — `94f135f5ddc8bc…` / `94f135f5ddc8bc…`, identical.
- Repository `git status --porcelain` at start / end — **byte-identical**: 4 modified + 3 untracked,
  all pre-existing, every one left exactly as found. `services/asdair/skill/planner.js` still has an
  empty `git diff --numstat` (CRLF warning only), as recorded in both prior receipts.
- One additional artefact outside the repository: a **read-only local clone** at
  `…/scratchpad/veritas-clonetest`, made solely to execute the row-12 control claim. A local clone
  does not mutate the source repository. Both scratchpad artefacts are ephemeral and uncommitted.
- `reviewed_sha` and `governance_sha` are **identical**. My contract and the receipt template were
  loaded from this checkout; neither is touched by the reviewed diff.
- `private_surface: none`, `credential_scope: none`, `live_authority: none` — all honoured.
  `C:\.fusion247\**` never read. No commit, stage, push or mutating git command executed.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test` in `services/asdair/packet` (in the export) | 0 | **104** | 104 pass · 0 fail · 0 skip |
| `git rev-parse {ecfb04b,d63668f,c9b04cf,94f135f}:services` | 0 | — | **`faa781b5…` × 4** — code tree byte-identical across the whole range |
| `git rev-parse {…}:tools` | 0 | — | **`17e1a6b1…` × 4** — identical |
| `git diff --name-only d63668f 94f135f -- services tools scripts` | 0 | — | **empty** — no code changed, so `ecfb04b`'s 1609-subtest run carries forward |
| `git rev-parse {d63668f,94f135f}:scripts/secret-scan.sh` | 0 | — | **`c9b1e59d…` both** — byte-untouched, as claimed |
| `git rev-parse {c9b04cf,94f135f}:…/Assurance` | 0 | — | **`2c347fa6…` both** — `Assurance/` byte-untouched by `94f135f`, as claimed |
| `bash scripts/secret-scan.sh --surface <the 10 changed paths>` | 0 | — | **10 files scanned, 26 detection classes, 0 findings** — non-zero file count is the proof it ran |
| `grep -rn "permitted_by" --include=*.md .` (whole export) | 0 | — | **32 sites**; every live one re-cited and independently proved (below) |
| `grep -i "recon" AGENTS.md` | **0** | — | **TWO hits** — `:76` `reconcile`, `:116` `reconciled`. **My `d63668f` receipt recorded exit 1 / no match. FALSIFIED.** |
| `grep -i "reconnaissance"` / `"read-only"` / `"unrestricted"` on `AGENTS.md` | **1, 1, 1** | — | **no match, all three** — the D-G3-14 finding itself is CONFIRMED |
| `bash scripts/secret-scan.sh` with no `--surface`, in the no-`.git` export | **128** | — | `fatal: not a git repository`. **NOT exit 0. My `d63668f` receipt recorded exit 0. FALSIFIED.** |
| `bash scripts/secret-scan.sh --surface <file>`, in the no-`.git` export | 0 | — | **scanned 1 file correctly** — `--surface` mode needs no `.git` at all |
| `bash scripts/secret-scan.sh --surface <nonexistent>` | **2** | — | `NOT SCANNED — target does not exist`. The script's own convention works. |
| `git clone` of this branch → recompute `receipt_sha256` of the `d63668f` receipt | 0 | — | **`968cd4cb…` vs claimed `d7dbd993…` — MISMATCH.** CRLF false tamper signal **PROVEN**, not theorised |
| `git config --get core.autocrlf` / `git ls-files \| grep gitattributes` | 0 / 1 | — | `true` / **none** — the precondition for the above |
| `git log d63668f..94f135f`, all lifecycle fields, all phase markers | 0 | — | closure enumeration clean (below) |
| Line/clause resolution of every cited clause in SOP-022, `work-order.md`, Nolan's contract | 0 | — | **all resolve, all say what is claimed** |

**Evidence unavailable, declared by name, never treated as passed:**
1. **Host load of the edited `thin-larry.md` shim** — observable only at a host session start. Not
   established here, and frontmatter parsing is not the same property.
2. **No CI run exists at this head.** An absent run is not a passing run.
3. **No live database was reached.** Every live claim in the package remains `UNVERIFIABLE OFFLINE`.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | All three HIGH findings are genuinely discharged, and `D-G3-14` — the one that had survived four rounds — is discharged **exhaustively**. See §"Answers" 4. |
| Design fidelity | **PASS** | No mechanism grown. The `D-G3-12` fix is a rewritten sentence plus a one-line `ls`, not a checker. The map states in terms that nothing makes it self-updating and that building something that would is the regrowth cap. Correct, and correctly refused. |
| Functional proof | **n/a** | Documentation and governance scope; no runtime capability is claimed. The 104 subtests were executed as provenance, not as proof of a production path. |
| Integration | **HOLD** | Unchanged and unresolvable from here: the `CLAUDE.md` reaching a fresh agent is still not reliably the repository's. Now recorded honestly as **unexplained** rather than mis-explained, which is the correct handling — but the first hop of the governance journey is still not evidenced as sound. |
| Durability | **n/a** | Nothing durable is claimed by this scope, and the map states plainly that durability is claimed nowhere in this build. |
| Test quality | **PASS** | 104 executed live, non-zero. The 1609-subtest figure is reused on proof of tree-object identity across four heads, not assumed. Evidence reuse, correctly grounded. |
| Git truth | **PASS** | Head, branch and upstream verified identical. Ten files, matching Larry's count. Both byte-untouched claims proved by tree-object identity rather than by `git diff` alone. Every SHA in the package resolves. |
| Documentation truth | **HOLD** | **Down from FAIL.** No surviving invented citation, no surviving false remediation claim — the two classes that produced the previous FAIL are gone. What remains is four checkable false statements in active documents (`D-G3-21`…`-23`, `-25`), **two of which I authored**. |
| Residual risk | **PASS** | Again the strongest dimension. `D-G3-20`'s handling is the best epistemics in this estate: both mechanisms falsified, **no third guess offered**, the first-person limit named as a limit on the evidence, and the probe explicitly not designed. Rows 11 and 12 are recorded and deliberately unfixed with the reason stated. |

## Production caller and journey

**Governance scope — the journey is the route by which a fresh instance is actually directed.**
Traced hop by hop at this head:

1. Host session start → root `CLAUDE.md`. **Unchanged by this commit and still not evidenced as
   sound** — three observations, no mechanism. Correctly recorded as unexplained.
2. → `Deliverables/` sweep → the precedence block. **Sound.** Byte-identical across the five
   resumption documents; `NEXT-ASDAIR-SESSION-brief.md` opens with an explicit
   *"THIS DOCUMENT IS NON-DIRECTIVE. IT STATES NO NEXT ACTION."* and states none.
3. → the map, precedence entry 2, the sole document permitted to state an exact next action →
   **§10 now states an action that is genuinely outstanding at the head carrying it.** `D-G3-12` is
   discharged. **One blind spot at the next head — `D-G3-24`.**
4. → the build record, precedence entry 1 → `ACTIVATION-DEFERRED.md` now opens with a scoping banner
   that names the merge event, the date, the reviewed head, and the current position. `D-G3-17`
   discharged and **revert-proofed** by a stated reason.
5. → `.claude/agents/thin-larry.md` → now says service-estate git has a contracted owner and
   **governance/documentation git has NONE**, with a dated do-not-restore note naming my receipt.
   `D-G3-16` discharged and revert-proofed.

**On the journey and sound:** hops 2, 4 and 5, and hop 3 at this head.
**Not on the journey:** the five Work Orders — reachable only by a reader who already knows to open
them. As a register they are correct; as a route they are not. Unchanged from my last receipt.

## Restart and durability

**n/a** — no durability is claimed by the reviewed scope and none exists in the build. No
kill-and-revive was owed and none was performed. Recorded: the three skipped tests remain the
destructive Postgres tests, and no row has ever been written to Postgres by the intended journey.

## Documentation contradiction scan

**Larry's declared DOCUMENT IMPACT:** 9 changed · 1 created · 5 identified-not-changed (D5 classes
4–8) · 2 declared byte-untouched.

**Verified independently — what held, and it is the substance of this round.**

- **Every `permitted_by` in the entire export was enumerated (32 sites) and every live one was
  proved by resolving the clause it names.** `SOP-022` §"Phase 2 — the preflight" exists at `:121`
  and its quoted sentence at `:123`; `work-order.md` §"On `document_impact`" at `:188`, "Default
  owners" at `:194-196`, §"Body sections" at `:285` with the secret-scan line at **exactly** `:294`;
  `SOP-022` step 9b's command at **exactly** `:183`; Nolan's contract §6 and its never-list entry
  both exist and both name `.claude/agents/<slug>.md` explicitly. **No surviving citation names a
  clause that does not exist.** The only remaining occurrences of the invented clause are four
  quotations *of the defect*, inside my receipt, `wo-g3a:122`, `SHIT-TO-DO.md:127` and `wo-g3e:136`.
  **This is the answer to the question Larry said he no longer trusted his own sweep of, and the
  answer is that his sweep was right.**
- **Every claimed remediation was verified performed**, not read: `wo-g3d`'s `## AMENDMENTS` exists
  at `:230`; all six invented-citation sites are corrected; all four receipt filenames cited in the
  map exist on disk; the stale `ecfb04b` HOLD pins are corrected in five map sites and three brief
  sites, with `d63668f` marked *"This is the live HOLD"*.
- `D-G3-18` discharged — "Five orders issued, five CLARIFY" against a table of exactly five.
- Both byte-untouched claims are true, and proved by tree-object identity rather than by his method.

**What his list missed — the point of the control:**
1. **`SHIT-TO-DO.md` row 11 is false, and I am its source** (`D-G3-21`). He inherited it faithfully
   from my receipt and labelled it *"inherited from Veritas's evidence, which is first-hand."* It was
   first-hand and it was wrong.
2. **`SHIT-TO-DO.md:167` contradicts its own paragraph** (`D-G3-22`).
3. **"a blob four commits back" is wrong in two active documents** (`D-G3-23`).
4. **The `D-G3-12` discharge test has a blind spot at the head that carries a new receipt**
   (`D-G3-24`) — which is the *next* head, the one he is about to create with this receipt.
5. **The map calls itself 430 lines and is 547** (`D-G3-25`) — inside the authorisation block, and
   it is the `D-G3-12` mechanism in miniature for the third time.

**Active documents that would misdirect a fresh instance:**
- `Builds/BUILD-015-…/SHIT-TO-DO.md:51` (row 11) — would send someone to repair a control that
  works, and teaches distrust of legitimate secret-scan evidence.
- `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:434-443` — at the receipt-carrying
  head only, would send a fresh instance to resubmit rather than to act on the HOLD it just received.
- **Nothing else.** No active document sends anyone down a superseded *route*, which is a real
  change from both prior rounds.

**Closure claims since the last receipt, and the receipt behind each.** Two commits enumerated in
full. `c9b04cf` commits my `d63668f` receipt — that receipt is itself the artefact, so nothing is
claimed without one. `94f135f` carries an explicit `NOT CLAIMED` section stating that nothing is
complete, operational, durable, ready, accepted, production-safe or closed. All **five** Work Orders
are `status: draft`. No phase is marked PASS; the map states *"No phase is marked PASS. Phase 0 is
IN PROGRESS."* `VERITAS_PASS` appears only as a precondition, never as an assertion.
**No closure claim lacks a receipt. No suppressed receipt detected.**

## Answers to the questions Larry asked me to attack

**1. `D-G3-12` — judged as a mechanism. It survives its own commit. You have NOT moved the defect.**

The old shape (*"integrate the package currently uncommitted"*) is **falsified by the very commit
that carries it**. The new shape (*"submit the head containing this line and obtain the receipt that
does not exist at it"*) is **created** by its commit: a receipt for a head cannot exist at that head,
so the sentence is necessarily true from the instant it is committed. Writing no SHA and resolving
with `git rev-parse` removes the second staleness vector. **This is a correct structural fix and the
reasoning in the map is sound.** `D-G3-12` is discharged.

**The blind spot, which is real and is at the next head.** Trace the discharge test at the head that
carries *this* receipt. The reader resolves `HEAD` = the receipt commit, runs `ls Assurance/`, and
finds a receipt naming `94f135f` — **not** the head they just resolved. The test therefore takes its
second branch and tells them *"the action above is outstanding and is yours"* — so they resubmit a
head whose only delta is a receipt, and **never read the HOLD verdict sitting in it.** The map's
claim that the reader *"can discover that unaided, in one command"* is not true at that one head
class. This is not the old defect and it is not destructive; it is a missing branch. The
correction is one clause, not a mechanism: *if the newest receipt names the immediately preceding
head, read it — a `HOLD` names your correction set.* Recorded as `D-G3-24`, MEDIUM.

**2. `D-G3-13` — an honest resolution. You have not buried it.**

The test I applied is whether a reader can distinguish a repository-verifiable fact from an attested
one *at the point of use*, without already knowing to be suspicious. They can. The block quotes the
words, names the date, states in terms that it is **Larry's account**, that it is **not verifiable
from the repository and not reproducible by any reviewer working from the estate alone**, and it
concedes that my finding was right and that the defect was the estate's silence. It then states the
residual risk in the exact words of the failure mode — *"a false authorisation is now recorded one
layer deeper than the contradiction it replaced"* — and builds nothing to manage it.

**The separation of route-authorised from map-not-accepted is the load-bearing part**, and it is
sustained everywhere: `SHIT-TO-DO.md:45` is explicitly *"a pointer to it, not a second record"*, and
map `:277` and `:347` both defer to the block rather than restating it. **One record, quoted,
labelled, deferred to.** That is the correct handling of an out-of-band authorisation, and deleting
it to satisfy a grep would have been the falsification — `wo-g3b:34` says so and is right.

**It remains a `product-decision` for Warwick to close**, by confirming the words once. I record it
as unclosed residual risk, not as a defect.

**3. `D-G3-20` — the wording is honest and does not over-claim. One countable error inside it.**

*"Unexplained"*, both mechanisms explicitly falsified, **no third mechanism offered**, caching named
as a hypothesis rather than a finding, and the first-person irreproducibility stated as *"a real
limit on this evidence, not a hedge."* That is exactly right, and refusing to supply a third guess
after two were wrong is the discipline this dimension exists to reward.

**But the count is wrong.** *"A blob four commits back"* appears in `SHIT-TO-DO.md:49` and map
`:244`. Verified: blob `8d865ed1…` was `CLAUDE.md` at `ecfb04b`, `565351d`, `7ca8c3b` and `cd51ac0`,
and `75a19c4b…` from `d63668f` onward. It was **last current at `cd51ac0`, two commits before the
observing session's `HEAD` of `c9b04cf`**; it **first appeared five commits back**, at `ecfb04b`.
Four is neither. `D-G3-23`, MEDIUM — a checkable number, in the fog register, in the passage whose
whole subject is not asserting what you have not executed.

**4. `SHIT-TO-DO.md` — the remediation claims are now true. Two other false claims remain.**

Every *remediation* claim in that file is verified performed. The class you asked about is closed.
Two different false statements remain — `D-G3-21` and `D-G3-22` — and **one of them is mine.**

**5. `permitted_by` — swept exhaustively. Clean.** Answered in the contradiction scan above.

## My own two falsified evidence rows, recorded because nobody else can

**You were right, and it is worse than you reported.** `veritas-gate3-documentation-d63668f.md`
contains **two** falsified evidence rows, not one:

- **Row 15** — `grep -i "recon\|read-only" AGENTS.md` recorded as exit 1, "no match". It returns
  **exit 0 and two hits**. I did not run the command I wrote down; I almost certainly ran
  `reconnaissance` and `read-only`, then wrote a shorter pattern I had not executed. **The finding
  was and is correct** — `reconnaissance`, `read-only` and `unrestricted` each return exit 1 across
  all 336 lines — **only the proof was fabricated**, which is precisely the defect I was auditing.
- **Row "Evidence unavailable" item 1** — `scripts/secret-scan.sh` recorded as emitting
  `fatal: not a git repository` *"while still exiting 0."* **It exits 128.** The likely cause is
  mine and it is ordinary: reading a pipeline's exit status instead of `PIPESTATUS[0]`. **This one
  nobody caught, and it has already become an active defect row in the estate.**

**Both receipts are committed and immutable; a receipt is never amended.** This receipt is the
correction of record for both. **The assurance gate reproduced the fault it was auditing, twice, and
the second instance propagated into the estate as a defect that does not exist.** That belongs in
the record more than any finding below it.

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| D-G3-21 | **MEDIUM** | **`SHIT-TO-DO.md:51` (row 11) is false, and its source is my own receipt.** The row states `scripts/secret-scan.sh` *"exits 0 when it cannot scan"* and concludes *"**every 'secret scan exit 0' produced outside a git working tree in this estate is unevidenced**, including the claim in `d63668f`'s own commit message."* Executed at this head in the no-`.git` export: full-repo mode exits **128**, not 0; `--surface` mode **does not need `.git` at all** and scanned correctly (exit 0, 1 file, then 10 files over the changed surface); a non-existent target exits **2 NOT SCANNED**. The script's stated invariant — *"IT MUST NOT BE POSSIBLE TO GET A PASS FOR GROUND THAT WAS NOT SCANNED"* — **holds in all three modes.** The consequence sentence is therefore false and `d63668f`'s secret-scan claim is **not** unevidenced. Residue worth keeping: full-repo mode exits 128 rather than the script's own `2` convention, which is untidy but is not a false green. **The row prescribes repairing a control that works and teaches distrust of legitimate evidence.** | Larry to correct the row; **the error is Veritas's** |
| D-G3-22 | **MEDIUM** | **`SHIT-TO-DO.md:167` — *"Neither false sentence is reproduced in any artefact."*** It is contradicted eight lines above in its own paragraph, which correctly states that `veritas-gate3-documentation-d63668f.md` *"carries the same defect independently"* — and that receipt is a committed, active, permanently unamendable artefact carrying the false sentence at `:67` and `:218`. A reader trusting this line will not go looking, and will then read a Veritas evidence table that states a false grep result as verified evidence. **Correct to: neither false sentence survives in any *correctable* artefact; the `d63668f` receipt carries both permanently and cannot be amended — see the successor receipt.** | Larry |
| D-G3-23 | **MEDIUM** | **"a blob four commits back" is wrong** — `SHIT-TO-DO.md:49` and `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:244`, and immutably in `94f135f`'s commit message. Blob `8d865ed166c339208a94a425e1a508115b556c04` was `CLAUDE.md` at `ecfb04b`, `565351d`, `7ca8c3b` and `cd51ac0`; `75a19c4b…` from `d63668f` onward. **Last current two commits back from the observing `HEAD` `c9b04cf`; first appeared five commits back.** The correct and checkable wording is available and should replace it. A countable claim, unanchored to a reference frame, inside the fog register — pattern 6 in the file's own list. | Larry |
| D-G3-24 | **MEDIUM** | **The `D-G3-12` discharge test has a blind spot at exactly the head class that carries a new receipt — which is the next head.** `map:434-443` tells the reader that if no receipt names the head they resolved, *"the action above is outstanding and is yours."* At the commit that adds this receipt, no receipt names that head, so the test fires its second branch, sends the reader to resubmit a receipt-only delta, and **routes them past the HOLD verdict they were meant to read.** The map's claim that staleness is discoverable *"unaided, in one command"* is untrue at that head. **One clause fixes it, and no mechanism is needed:** *if the newest receipt names the immediately preceding head, read it first — a `HOLD` names your correction set, and that is your action.* **`D-G3-12` itself is discharged; this is a new, narrower and non-destructive successor.** | Larry |
| D-G3-25 | LOW | **`map:92` — *"this 430-line map"*. It is 547 lines at the head it ships in**, and it was lengthened by the same commit that carries the sentence. It sits inside the authorisation block, the most sensitive paragraph in the estate, and the number is the one thing in it a reader can check. **The third instance of the `D-G3-12` mechanism** — a self-referential count falsified by its own commit. Give it no number, exactly as §12 already does for the dirty-tree entries and for the stated reason. | Larry |
| D-G3-26 | **CONFIRMED, not new** | **`SHIT-TO-DO.md:52` (row 12) is correct and I have now proven it by execution.** A fresh `git clone` of this branch materialises `veritas-gate3-documentation-d63668f.md` with **CRLF** (`core.autocrlf=true`, no `.gitattributes` anywhere in the repository) and the recomputed body digest is **`968cd4cb689965f80089ad7eb187845426d37d199bef48144fd6a4fbd942beea`** against a claimed **`d7dbd993…`** — **a false tamper signal on a clean checkout.** Row 12 was recorded as a reasoned prediction; it is now a measured fact. **Consequence for my own role: the tamper-evidence property of every Veritas receipt, including this one, is currently non-functional for any verifier who clones and recomputes.** The digest is meaningful **only** against the blob — `git show <sha>:<path> \| tail -n +18 \| sha256sum`. Row 12's two proposed fixes remain correct and remain deliberately unapplied. | Warwick to decide; Larry to sequence |

**Creditable, recorded so the corrections are not over-read.** `D-G3-12` and `D-G3-13` are
**genuinely and well** discharged, and `D-G3-14` — the finding that had survived four rounds — is
discharged more thoroughly than I asked for: six sites where I named four, every replacement proved
by grep against the document it names, and the false remediation claim corrected in the log rather
than quietly overwritten. `D-G3-15`, `-16`, `-17` and `-18` are discharged, and `-16` and `-17` are
**revert-proofed** with dated do-not-restore reasoning naming the receipt — that property was absent
from this build until last round and is now becoming habitual. `D-G3-19` was annotated rather than
re-pinned, which was the right call and avoids recreating the drift one commit later. **`D-G3-20` is
the best epistemic work in this estate**: two of your own hypotheses killed, no third offered, the
evidence's first-person limit stated as a limit, and no probe designed under obvious pressure to
design one. And you brought me a fabrication in your own Work Order that a worker found, then
dispatched a third hand to correct the order itself rather than only the log — **that is the
mechanism working, and it is why the deepest finding in this receipt is about me and not about you.**

## Verdict

**HOLD** — the three HIGH findings are genuinely discharged and the two classes that produced the
previous `FAIL` are gone: **no surviving invented citation, and no surviving false remediation
claim.** Documentation truth rises from `FAIL` to `HOLD`. But the acceptance property you restated is
*"**every** active document in the resumption chain is true at the head it ships in"*, and four
active documents are not: a false claim about a working control, a claim contradicted by its own
paragraph, a wrong commit count in two places, and a map that misstates its own length.

**Why HOLD and not FAIL.** The closure enumeration is clean — five Work Orders `status: draft`, no
phase marked PASS, an explicit `NOT CLAIMED` section in the commit message, and a receipt behind
every claim. **No suppressed receipt, no false completion claim.** What remains is inaccuracy, not
concealment, and the residue is materially smaller and different in kind from both prior rounds.

**Why not PASS, given how much of this round is right.** Because two of the four remaining defects
were introduced by **my own receipt**, and passing this head would ratify a control defect that does
not exist and leave a correct control recorded as broken. **The bar is not being held against you
here; it is being held against the assurance gate itself.** On your standing instruction: it does not
deserve a PASS, and the sharpest finding of this round is that the reviewer fabricated evidence twice
in the document that was auditing fabricated evidence.

**On my own scope, stated so it can be audited:** the two most consequential findings — `D-G3-21` and
the second falsified row behind it — are outside every file you dispatched, and inside an artefact
you have no authority to correct.

## Next review trigger

Resubmission of a **new exact integrated head** after `D-G3-21` through `D-G3-24` are corrected —
specifically: `SHIT-TO-DO.md` row 11 rewritten to what the scanner actually does in each of its three
modes, with the false consequence sentence withdrawn and the correction attributed to Veritas;
`SHIT-TO-DO.md:167` corrected to distinguish correctable artefacts from the immutable receipt;
*"four commits back"* replaced in both active sites with the verified frame; and the map's discharge
test given its missing branch for a receipt-carrying head. `D-G3-25` is LOW and may ride along.
`D-G3-26` is a decision for Warwick — a `.gitattributes` entry pinning `Assurance/*.md` to `eol=lf`,
or a template statement that the digest is meaningful only against the blob — and it should be taken
before any external party is asked to verify a receipt, because **Codex audits these receipts and
would currently compute a mismatch on a clean clone.**

**Recompute this receipt's digest against the blob, never against a checked-out file:**
`git show <sha>:<path> | tail -n +18 | sha256sum`
