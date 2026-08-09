# Addendum C — the transport-independent ingestion seam

**Pax · 2026-08-09 · READ-ONLY · NON-GATING for BUILD-015.** No file was altered. No shell was available to this pass, so every claim below is established by reading source, not by execution — that limit is marked where it bites.

Two checkouts were read: `C:\Fusion247PKA` (main, tip `959a64b`) and `C:\Fusion247PKA-wp-b15-2` (branch `build-015/wp-b15-2`, where `017_shop_decision.sql`, `shopDecisions.js` and `decideAnswer` live and where they are **not yet on main** — `Grep` for `shop_decision` across main returns Deliverables only).

---

## 1. The earliest transport-independent seam is `receiveList`, and it is already neutral

`services/asdair/pipeline/commands.js:123` — `receiveList(spec, deps)`.

What it genuinely requires (`commands.js:126-133`): `householdId`, `sourceKind ∈ {text, photo}`, `actor` (non-empty; `commands.js:60-62` names `cockpit:warwick` as a first-class shape), and either `shopRef` or `listDate`. **Every Telegram field is optional and defaults to `null`** — `telegramChatId`, `telegramMessageId`, `telegramUpdateId` (`commands.js:126`). Nothing Telegram-shaped is load-bearing.

Telegram-specific work stops one layer up, in `pollIntake` (`services/asdair/pipeline/runtime.js:95-164`), which is a *translator*: it reads `record.payload.kind`, `meta.chatId/messageId/updateId`, stamps `actor: telegram:<senderId>` (`runtime.js:136`), and calls `commands.receiveList(spec, deps)` at `runtime.js:145`.

> **The exact function a Cockpit submission calls is `receiveList(spec, deps)` in `services/asdair/pipeline/commands.js`.** A Cockpit intake adapter is the same twenty lines as `runtime.js:116-146` with `actor: 'cockpit:<user>'` and the three `telegram*` fields left unset. **No second pipeline. No new decision spine.**

**The one blocker at this seam:** `receiveList` is **not on the Cockpit's allowlist**. `services/asdair/cockpit-api/commandSurface.js:38-49` lists ten names; `receiveList` and `interpretList` are absent, so `httpApi.js:205` answers `400 unknown_command`. That omission was deliberate for a read-only viewer and is now the thing standing between a Mum Cockpit and the spine.

---

## 2. A tapped Regular is already a structured fact — on the answer path, not the list path

**Answer path (exists, correct, costs nothing).** `shopDecisions.resolveExactCandidate` (`.../pipeline/shopDecisions.js:294-330`) resolves a tap deterministically when the offered candidate carries a real `regular_id` and `answer_text` equals its label. `decideAnswer` calls it *before* the interpreter (`runPipeline.js:880-890`) and returns `model_called: false`, `interpreted_by: 'human'` (`shopDecisions.js:322-324` — "NOT 'terra'. No model was asked"). Free text falls through to `deps.interpretAnswer` (`runPipeline.js:925-929`) — the Terra seam — which is exactly where interpretation is genuinely needed. **A Cockpit tap reuses this by sending the candidate label as `answerText`. Zero new code.**

**List path (the genuine gap, and it is smaller than it looks).** A typed list already spends **no** model call: `runPipeline.js:225-233` routes `sourceKind: 'text'` through `deps.shopperRoute`, and the header at `runPipeline.js:183-184` states it plainly — *"Deterministic; no model involved."* Only the photo branch calls `deps.interpretPhoto` (`runPipeline.js:213`).

So a Mum Cockpit list of tapped Regulars submitted as `sourceKind: 'text'` costs **zero Terra calls today**. What it still loses is *certainty*: identity is re-derived from the name by `deps.resolveAll(...)` (`runPipeline.js:239`) rather than carrying the `regulars.id` the tap already held. A tap that resolved to id 47 becomes the string "Arla 4pt", which `resolveByCatalogue` must map back — and may return `needs_confirmation`, manufacturing a question about a fact nobody was unsure of.

**The missing thing is one field, not one pipeline:** `receiveList` has no structured-lines argument, and `shop_line` identity is written only inside `stepInterpret`. The right shape is a pre-resolved reading carried into interpretation (matched, `matched_regular_id` set, `raw_reading` preserved as evidence beside it, per the invariant at `runPipeline.js:235-238`). **Confidence: High on the absence; Medium on the shape — this is design, not established fact.**

---

## 3. The answer path is reused whole. Nothing Cockpit-specific is needed.

A Cockpit answer calls `commands.answerQuestion` (`commands.js:301`) — already permitted (`commandSurface.js:42`). It writes the **same** `asdair.shop_question` row via `deps.shopStore.answerQuestion` (`commands.js:315`), first-answer-wins.

The decision is then derived off the interactive path, in `stepReplan` → `decideAnswer` (`runPipeline.js:761-787`, `:872`), writing `asdair.shop_decision` under `shop_decision_question_uniq` (one decision per question, ever). Recomputation follows the same `transition(shop.id, 'PROCESSING', ...)` at `runPipeline.js:836`.

Clarification rounds already carry lineage: `openQuestion({..., question_round: nextRound, parent_question_id: held.question_id })` at `runPipeline.js:511-524`, added only when `nextRound > 1` so round-1 INSERTs stay byte-identical.

> **Verdict: no Cockpit-only question table, no shadow decision table, no separate interpretation semantics is required — and each would be a defect, because `answerQuestion` is one function writing one row.** Confidence: High.

---

## 4. What genuinely does not exist — "find its production caller"

Applied literally to `POST /asdair/command` (`services/asdair/cockpit-api/httpApi.js:196`). **It has no production caller, and four further faults sit behind it.**

| # | Fault | Evidence |
|---|---|---|
| 1 | **The live Cockpit never mounts it.** `services/cockpit/server.mjs:394-397` proxies four routes — `workspace`, `rules`, `packet`, `media`. All GET. There is no POST route to `ASDAIR_ORIGIN` anywhere in that file. | `server.mjs:394-397` |
| 2 | **The shipped UI routes the user away.** `services/cockpit/public/app.js:1619`: *"Answer it in Telegram — the cockpit shows this question, it does not answer it."* Beside `apps.js:121`, which claims it *"forwards the same named commands the Telegram bot uses."* **Those two shipped strings contradict each other.** | `app.js:1619` vs `apps.js:121` |
| 3 | **Argument-name mismatch.** `httpApi.js:217-220` sends `requested_by: 'cockpit:'+actor`. `commands.js:128` calls `requireActor(spec.actor)`, which throws on absent. Every command would fail on arrival. | both |
| 4 | **Arity mismatch — the deps container is never passed.** `commandSurface.js:189` calls `commands[name](args \|\| {})` with **one** argument. Every pipeline command is `(spec, deps)`; `store.requireShop(deps, spec)` would receive `undefined`. | `commandSurface.js:189` vs `commands.js:207` |
| 5 | **Module-system mismatch, masked by a false green.** `pipeline/package.json:7` is `"type": "module"`; `cockpit-api/package.json:7` is `"type": "commonjs"` and `commandSurface.js:150` does `require(PIPELINE_COMMANDS_PATH)`. Meanwhile `isBound()` (`:161`) uses `require.resolve`, which **succeeds without evaluating** — so `/asdair/health` reports `command_surface_bound: true` (`httpApi.js:131`) whether or not the require would work. **Whether `require()` of ESM throws depends on the Node version; I had no shell and did not execute it. Single-source, UNVERIFIED — this one needs a runtime check before anyone designs on it.** | `package.json:7` ×2, `commandSurface.js:150,161` |
| 6 | **Wrong database role.** `cockpit-api/server.js:12` documents `ASDAIR_DB_URL` as *"the SELECT-only `asdair_ro` connection string"*. That process cannot write a command row even with 1–5 fixed. | `server.js:12` |

Note the test blind spot behind #5: `commandSurface.test.js:48-58` only `require`s the real module when `isBound()` is true, and `httpApi.test.js` injects `d.dispatch`. **The real require × real dispatch combination is exercised nowhere.**

---

## 5. The honest verdict on the API boundary

**It is wiring an existing boundary, not building a missing one — with exactly one genuine extension.**

The boundary is real and correctly conceived. `commands.js:5-15` already names the Cockpit as a first-class caller; `commandSurface.js:4-24` already refuses a local fallback on principle; `answerQuestion` already carries the whole answer journey. Nothing about a Mum Cockpit requires a second decision spine, and Warwick's constraint is already honoured by the code as written.

What is missing is **plumbing plus one field**:

1. Wire the six faults above (transport, arg name, arity, module system, role, and a health check that stops lying).
2. Add `receiveList` to `commandSurface.COMMAND_NAMES` — the one *capability* extension. It is a write of a new shop, so it deserves Warwick's explicit yes, not a quiet allowlist edit.
3. Extend `receiveList`'s spec with pre-resolved lines so a tapped Regular keeps its `regulars.id` instead of being re-derived from its own label.

**Anti-pattern to avoid, named explicitly:** building a "Cockpit intake service." The moment a second module owns list intake, `pollIntake`'s translator layer has been copied rather than joined, and two truths exist. The correct artefact is a **~20-line adapter** that shapes a Cockpit submission into `receiveList`'s existing spec — the same relationship `runtime.js:116-146` has to Telegram.

**Second anti-pattern:** "fixing" #5 by relaxing `isBound()`. `command_surface_bound: true` should mean *dispatch would work*, and today it means *a file exists on disk*. That is the same class of false green `httpApi.js:107-116` was already written to kill once.

---

## Limitations

- **No execution.** No shell in this pass: no `node -v`, no test run, no git verification of the two checkouts beyond file reads. Every claim is source-read. #5 in particular is version-dependent and unproven.
- **Single-checkout claims.** `decideAnswer`, `shopDecisions.js` and `017_shop_decision.sql` were read at `C:\Fusion247PKA-wp-b15-2` only. If that branch changes, §2–§3 line numbers move.
- **Live runtime unobserved.** Whether `cockpit-api/server.js` is actually running on 8710 was not checked. `server.mjs:201` expects it; that is an expectation, not evidence.
- **Out of scope:** authentication for a Mum Cockpit (a *different* actor writing commands is a real product and permissions question, and nothing in §1–§5 addresses it).
