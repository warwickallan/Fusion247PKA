# Codex retrospective release review — BUILD-015 AsdAIr — VERDICT: `request_changes`

**Execution 1 of the 3 permitted for this gate. Do not re-run without a genuine correction to review.**

| | |
|---|---|
| Route | `services/control-plane/tower-loop/reviewDiff.mjs --claim` — the canonical route |
| Contract delivered | `tower-qa-skill@3(approved;ratified=true)+classification-amendment@1(APPROVED_LIVE)` sha256 `5a3bac43…` |
| Range | `443cad4..915b15c`, path-scoped to 5 files |
| Diff | **46,423 of 46,423 bytes — `truncated=false`.** The verdict covers the whole staged change |
| Scope record | `Deliverables/2026-08-15-build-015-retrospective-release-scope.md` |
| Verdict | **`request_changes`** — three findings, all `BLOCKS_CURRENT_MERGE` |

> **Codex's summary, verbatim:** *"Retrospective release approval is not supportable. The staged code
> contains an active cross-household data-integrity path, while the disclosed Veritas HOLD/FAIL and failing
> main CI leave the live write-path claim without the required assurance. The audit covers only the five
> staged files; excluded release surfaces remain unreviewed."*

---

## F-1 — cross-household `shop_id` is never validated. **HIGH · ACTIVE · the one that is a real code defect.**

> **Evidence, verbatim:** *"`services/control-plane/wp-d-proof/asdairCommands.mjs`: `execute` validates
> `shop_id` only as a positive integer, resolves `household_id` separately, and `findOrCreateDraftList`
> first selects `shopping_lists where shop_id=$1`; neither that query nor `reclaimUnownedList` proves the
> shop belongs to `householdId`."*
>
> **Required correction:** *"Before reading, reclaiming, or creating a shop-owned list, require the supplied
> `shop_id` to resolve to a shop whose `household_id` equals the resolved `householdId`; fail closed on
> absence or mismatch. Provide an executed regression proving a mismatched pair writes nothing."*

**Larry's proportionality assessment, because the headline overstates today's blast radius and the
understatement would be equally dishonest:**

- **Cross-HOUSEHOLD misattribution is not reachable today.** `asdair.households` holds **one row**. There is
  no second household for an item to leak into. The defect is **latent** on that axis.
- **Cross-SHOP misattribution within household 1 IS reachable.** The 2026-08-14 close-session records
  **four non-terminal shops open for household 1**, and `SHOP-2026-08-14` still open. A wrong or stale
  `shop_id` attaches Mum's item to the wrong shop's list — which presents exactly as the failure this code
  was already repaired for once: **items she typed not appearing on the list that gets shopped.**
- **The fix is small and fail-closed** — one ownership check before read/reclaim/create.

**Recommended disposition: corrective work, banked against BUILD-015, BEFORE the Tuesday shop.**
It is an **isolated BUILD-015 defect** — `asdairCommands.mjs` has **no BUILD-006/VlogOps consumer**
(importers are AsdAIr pipeline files, `services/cockpit/public/app.js`, and its two sibling `wp-d-proof`
runners). **Per Warwick's rule it is banked without derailing VlogOps.**

## F-2 — required Veritas assurance is absent. **HIGH · ACTIVE.**

Codex confirms what the claim disclosed rather than discovering it: Gate 2 accepted-user-journey **FAIL**
never lifted, write-action-path **HOLD** sitting directly over this write door, **no receipt at all** for
migrations 018/020/021, and only HOLD coverage for 019.

**This is not a code defect — it is the assurance debt itself, now externally confirmed.** Its correction
is a committed Veritas PASS over the live write-action path **after** F-1 is fixed, not before.
**Commissioning that retrospective Veritas is Warwick's decision.**

## F-3 — a required workflow is failing on `main`. **HIGH · ACTIVE.**

`cockpit-private-apps` fails on **every** push to `main`:
`SELF-TEST FAIL — the household template anchor is missing; rewrite the mutations`
(`services/cockpit/render-vm-check.mjs --self-test`). **That gate is inside this release surface**, and it
is a control asserting it cannot currently prove anything about the screens it guards.

**Recommended disposition: investigate and repair.** It is cheap, it is red on every push, and a control
that says it is broken is the one class of red that must never be normalised.

---

## What Codex did NOT find — and it is the answer to Warwick's BUILD-006 question

**`services/obsidiwikai/src/core/models.mjs` — the ONLY file this release surface shares with
BUILD-006/VlogOps — drew NO finding.** AC-5 returned `partial` solely because *"registration and successful
live invocation cannot be established from code alone"*, which is a limit of a code-only audit, not a
defect.

> **Therefore: BUILD-006 is UNAFFECTED. Warwick's condition — *"BUILD-006 may only be affected if the
> retrospective review discovers a concrete defect in infrastructure BUILD-006 actually shares"* — is NOT
> met. Keel's WP-1 and PR #105 proceed untouched.**

## Acceptance rows — how the release claim actually graded

| Row | Result |
|---|---|
| AC-1 durable, correct-household write | **fail** — the F-1 defect |
| AC-2 no re-entry or orphaning | partial — repair is right in the matching-household path; no executed proof staged |
| AC-3 Mum's send truthfulness | partial — proxy preserves `created:false` correctly; **the UI was excluded from scope**, so the end-to-end outcome is unverified |
| AC-4 display-name write scope | partial — migration text grants only `display_name`; no applied-database privilege evidence |
| AC-5 answer-model live validity | partial — code-only limit |
| AC-6 supervised: no checkout/payment/credentials | not_applicable — `browser-runner` excluded; **the checkout guards are unchanged since the last reviewed state** |
| AC-7 required assurance route | **fail** — F-2 |
| AC-8 required CI and behaviour evidence | **fail** — F-3, plus all test/proof material excluded |

**Two `confirmed` claims worth recording as good news**, because a review that only reports the bad is not
a review: the **reclaim-before-create repair is real and correct** in the matching-household path, and the
**Cockpit proxy genuinely preserves `created:false`** — it forwards the upstream body verbatim and does not
synthesise `created`. Mum's SEND does not lie about what happened, on the code path reviewed.

## The honest limit of this verdict

**It covers five files.** Migration `020` (unconditional live `UPDATE`), `handoff/`, `packet/`,
`browser-runner/`, `skill/`, `bot/`, the Cockpit UI and **all** test and proof material are **unreviewed**.
This verdict asserts the code, **not** the evidence. **Nothing here may be read as "BUILD-015 has been
externally reviewed."** It has had one bounded pass over its highest-consequence write path.
