---
build: BUILD-015
scope: confirmation-defect-1-and-defect-3
gate: 2

boundary: >
  ONE focused confirmation of two blocking findings from the receipt at 3d453c6 — Defect 1 (the
  geometry gate had never measured the live display names) and Defect 3 (the supervisor's coverage
  of asdair rested solely on the gated party's account). The boundary itself was NOT re-opened and
  its HOLD is unchanged.

reviewed_sha: 62929cb1f56c90beef65cc822252ed30f87e2864
governance_sha: 62929cb1f56c90beef65cc822252ed30f87e2864
branch: main
remote_reachable: false
predecessor_receipt: Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-b15-write-action-path-gate2-3d453c6.md
predecessor_receipt_sha256_recomputed: d17f329f9376677a63b51992a250965177ed12cfb0853f9b9bb931cfea1c4c33
predecessor_committed_verbatim: true

evidence_method: mixed — committed evidence artefacts, live runtime, and one granted read-only private file.
private_surface: C:/.fusion247/private/careerair/scripts/ensure-local-services.mjs
credential_scope: none — no env file opened, no adjacent path touched.
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\6b147a85-fd06-4294-bf71-d171357401f2\scratchpad
worktree_head_at_start: 62929cb1f56c90beef65cc822252ed30f87e2864
worktree_head_at_end: 62929cb1f56c90beef65cc822252ed30f87e2864
worktree_status_clean: true

review_ceiling: 30 minutes elapsed, scope limited to Defect 1 and the supervisor claim. Honoured.

verdict: PASS on the scope of Defect 1 and Defect 3. Boundary verdict UNCHANGED at HOLD.
receipt_sha256: b9f0994d7391ef024a23adc0a1e676735eaa5aab28ad57b504667b2a66bdbaf3
reviewed_by: veritas
reviewed_date: 2026-08-14
contains_erratum_against: veritas-b15-write-action-path-gate2-3d453c6.md
next_review_trigger: >
  One genuine submission from the Fire with the raw outcome captured, and the real ShopperBot
  message arriving. NEVER the head moving.
---

## Scope reviewed

**ONE focused confirmation of two blocking findings from the receipt at `3d453c6`** — Defect 1 (the
geometry gate never measured the live display names) and Defect 3 (the supervisor rested solely on
the gated party's account). **The boundary was not re-opened.** Requirements 1-4, C1, C2 and Defects
2, 4, 5, 6, 7 were not re-examined and their verdicts stand unchanged.

**Ceiling honoured:** 30 minutes elapsed, scope limited to the two findings, as dispatched.

## Prior receipt integrity

`Builds/BUILD-015-.../Assurance/veritas-b15-write-action-path-gate2-3d453c6.md`, committed by Larry
at `62929cb`. Body recomputed from the committed blob:
`d17f329f9376677a63b51992a250965177ed12cfb0853f9b9bb931cfea1c4c33` — **identical to the value stated
in its own frontmatter. Committed verbatim; not edited, summarised or excerpted.**

## ⛔ ERRATUM AGAINST MY OWN PRIOR RECEIPT — the reviewer's error, not the builder's

**Named first, because a successor review checks exactly this and because the standard I applied to
Larry applies to me without discount.**

**Row corrected:** §Evidence executed or inspected, the `/api/asdair/rules` row — *"Max length is 21,
not 20 — `"Deodorant — Quantum"`"* — and every restatement of it, including in Defect 1's body and in
my return message.

**It is wrong. The live maximum is 20, exactly as Larry stated.** The cause is mine: I read the JSON
with Python's `open()` at the Windows default encoding (cp1252) instead of UTF-8, so a UTF-8 em dash
`E2 80 94` decoded as three characters `â€"`. That inflated every em-dash name by two characters and
manufactured a 21-character maximum that does not exist. Re-read with `encoding='utf-8'`:

| Name | I reported | Actually |
|---|---|---|
| `Deodorant — Quantum` | 21 chars | **19 chars**, one U+2014 |
| `Salt & vinegar crisp` | 20 | 20 — correct |
| `Malted milk biscuits` | 20 | 20 — correct |

**What survives the correction, and it is the substance of Defect 1:** the gate served a committed
fixture and had never measured the live catalogue, live names sat at the 20-character mark where the
gate's own sweep recorded `4 lines → -17px FAIL`, and the packing of specific words — not their
length — decides the cliff. **The finding was sound. One of the numbers I used to argue it was
mine and was wrong**, and it made the case sound sharper than the evidence entitled me to.

*This is the same defect class I recorded against the dispatch as Defect 5: measuring with an
instrument whose scope you have not checked. Recorded here at equal weight.*

## Defect 1 — CONFIRMED DISCHARGED

**Verdict on this finding's scope: `PASS`.**

Checked as executable evidence rather than accepted as reported:

| Check | Result |
|---|---|
| Committed run output | `evidence-2026-08-14-geometry-gate-vs-LIVE-names.txt:169` — **`SHOPPING-GEOMETRY-CHECK PASS — 104 viewports measured in a real browser, 0 violations.`** |
| **The input actually consumed = the input committed** | Run header names `…/scratchpad/rules.live.json`. `sha256` of that file and of the committed `evidence-2026-08-14-live-names-fixture.json` are **both `d26b9acb76684bc0f0e19516c90a3dae4a9356aef1e3a2d517175a332c8475f3` — byte-identical.** This is the check that makes the run checkable rather than reported, and it closes the shared-scratchpad substitution hazard. |
| Fixture really is the live catalogue | 109 display names in each; **multiset identical** to the live `/api/asdair/rules` payload I pulled independently. |
| The named worst viewport | `:111` **`portrait 300x512 rows=109 headroom= 1px`** — the Fire HD 8 in portrait at 200%, and identical to the fixture's own 1px. Held across all eight screen states including the confirm screen and all four SEND outcomes. |
| The other Vera viewport | `:102` **`landscape 512x300 rows=109 headroom= 31px`**. |
| Row 0 | Fixture index 0 is **`"Malted milk biscuits"`** — 20 chars, the joint-longest live name, placed where the landing-screen assertion measures. Confirmed by reading the fixture, not from the claim. |
| The em-dash names | Present in the run: **four names carry U+2014** — `Deodorant — Quantum`, `Deodorant — Sport`, `Eggs — box of 12`, `Eggs — box of 6`. **Larry's U+2014 claim is exactly right.** |

**One property I record rather than pass over:** the fixture's row order is **not** the live payload
order — the joint-longest name has been lifted to index 0. **That is disclosed in the dispatch and it
makes the test harder, not easier**, so it is conservative and I accept it. What was measured is
therefore *"the live names with the worst one forced into the measured position"*, which is a
stronger claim than *"the live page as it happens to sort today"* and contains it.

**On the mechanism being permanent:** `COCKPIT_RULES_LARGE` as an **override, not a default**, is the
right call and I would have objected to the alternative. A regression gate whose input can change
underneath it stops being a regression gate. **The consequence to state honestly: this is a
point-in-time proof, not a standing one.** Nothing re-runs it when Warwick renames a product, and the
14-character warning on his names page is explicitly a warning and not a limit. **Non-blocking**, and
parked — it does not gate anything, and the warning surface plus this run is proportionate for a
household of one operator.

## Defect 3 — CONFIRMED DISCHARGED as to the supervisor's coverage of `asdair`

**Verdict on this finding's scope: `PASS`.**

**Read under the granted surface and nothing else:** exactly
`C:/.fusion247/private/careerair/scripts/ensure-local-services.mjs`. **No env file was opened, no
sibling, parent or adjacent path under `C:/.fusion247/**` was touched, and `credential_scope: none`
was not widened** (GL-012 §1, §2).

| The three checks | Result |
|---|---|
| An `asdair` entry in the services table | **`:327`** — `asdair: { label: 'asdair API :8710', envFiles: [ENV_ASDAIR, ENV_SHOPPER], … }` |
| `health()` reads `command_names` for `receiveList` and returns `degraded`, not `up` | **`:339-342`** — `if (!names.includes('receiveList')) return { state: 'degraded', detail: '…a submission would 400 at the last hop' }`. Exactly the property that makes a silently half-working page detectable. |
| `start()` targets the real checkout | **`:355-365`** — guards `fs.existsSync(ASDAIR_DIR/server.js)` where `ASDAIR_DIR = 'C:/Fusion247PKA/services/asdair/cockpit-api'` (`:104`), then spawns node with the two `--env-file` **paths passed as argv and never opened by this script** — consistent with `credential_scope: none`. |

**Two things I checked that were not on the list, both within the granted file:**

- **The driver acts on both states**, not just one: `:484` `if (h.state === 'down')` and `:495`
  `if (h.state === 'degraded' && svc.repair) await svc.repair();` → `:497` `svc.start()`. So a dead
  service and a stale-but-alive service both lead to a start. `repair()` (`:350-354`) kills the stale
  pid first, which is what makes the degraded path meaningful rather than a no-op.
- **The observability mechanism exists and is wired:** `log()` (`:136-142`) writes to `console` **and**
  appends to a rotating `supervisor.log` (`:76-77`). **This upgrades my prior finding.** I wrote that
  no log exists outside the private store and that *"failure must never be silent"* was therefore
  unproven; the correct statement is that **the logging mechanism is confirmed present and wired,
  and its contents sit inside the store and remain outside the granted surface.** Mechanism proven;
  contents not read, by design.

**What Defect 3 alleged is answered.** The coverage of `asdair` no longer rests on the gated party's
account — I read it. **Granting the file rather than asking me to take your word is the correct
response to an independence finding, and it is the reason this converts to a `PASS` in one pass.**

**What remains, narrowed and non-blocking:** the kill-and-revive and stale-stub mutation are still
**builder evidence, labelled as yours** in `services/cockpit/README.md`, and I have not re-derived
them — correctly, since doing so means modifying live state. **Reading the code proves the mechanism
is right; only the kill proves it fires.** The two together are proportionate for a hobby brain and
I am not asking for more. The up-to-15-minute blind window after a crash is unchanged and stays a
recorded property, not a defect.

## Assurance dimensions touched by this confirmation

| Dimension | Verdict | Basis |
|---|---|---|
| Functional proof | **PASS** *(for these two findings only)* | 104 viewports, 0 violations, on the live catalogue with the input hash-matched to the committed artefact. |
| Durability | **HOLD → improved, still HOLD for the boundary** | Supervisor coverage of `asdair` now independently established from source. The boundary's HOLD is unchanged and rests on C2 and the unexecuted journey, not on this. |
| Test quality | **PASS** *(scope: the geometry gate)* | Override rather than default preserves determinism; the run is reproducible from committed bytes. |
| Completed automation | **HOLD** *(unchanged)* | The supervisor half is materially stronger. The notification half is untouched: the real send has still never fired. |
| Residual risk | **PASS** | Larry volunteered the `431/431` correction against himself and disclosed the mid-review commit as his own fault before I raised it. Both held up. |

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| E1 | **MEDIUM** | **Erratum against my own prior receipt** — the `max length 21 / "Deodorant — Quantum"` row is wrong and is a reviewer decoding error. The live maximum is 20. See §Erratum. | **non-blocking** — the finding it supported is discharged anyway. | Veritas |
| 8 | **LOW** | The live-name geometry proof is **point-in-time, not standing**. Nothing re-runs it when a `display_name` changes; the 14-character notice on the names page is a warning, not a limit. Proportionate as-is. | **non-blocking** — parked. | Larry |

## Verdict

**PASS on the scope of Defect 1 and Defect 3 — both DISCHARGED.**

**The boundary verdict is UNCHANGED: `HOLD`,** and this confirmation does not touch its grounds — the
primary user journey has still never been executed, the head is still not remotely reachable
(`C2`), Defect 2 (the running service's notification configuration is unobservable) and Defect 4 (two
blocks both headed CURRENT on the active Wayfinder) are still open, and requirements 1-4 stand at
HOLD.

**Stated as plainly as I can, because it is the operative sentence:** **I no longer hold any finding
that argues against putting the page in front of Mum.** Defect 1 was the one I said I would fix
first, and it is fixed and checkable. **What remains is not fixable by building — it is the human
evidence that only the real send produces**, and my prior receipt's position is unchanged: those
requirements are answered *by* her sending, not before it.

## Next review trigger

**One genuine submission from the Fire with the raw outcome she saw captured, and the real ShopperBot
message arriving.** Not the head moving, not a receipt, not another documentation repair.
