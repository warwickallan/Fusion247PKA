# Lane C progress, and the dispatch defect that cost four Work Orders

**Larry, 2026-08-09.** Executed while Warwick is away. Branch `b15-3/lane-c-browser-wiring`.

---

## 1. ⚠️ THE DISPATCH DEFECT — mine, four times in one day

**Four Work Orders were issued and all four were REFUSED. Every refusal was correct.** The root
cause was identical each time and it was not the workers:

> **I generated the envelope and then dispatched it without AUTHORING it or reading it back.**

`tools/wo/envelope.mjs` emits a template with `AUTHOR REQUIRED` slots. Live recomputation on two of
the orders returned `{"authorCount":24,"unresolvedCount":0,"ready":false}` — **twenty-four unfilled
mandatory fields**, including `outcome`, `acceptance_property`, `veritas_gate`, `security_inputs` and
`operational_handoff`, plus the whole body: acceptance criteria, the acceptance command, inputs,
out-of-scope and sequencing.

**The substance was in my dispatch message. The order file is the artefact, and it was empty.**

Second, compounding cause: **I guessed the `file_surface` instead of tracing it.** Both workers
proved by execution that the declared surface could not deliver the declared outcome — the ingress
order omitted `telegramAdapter.js` (where `answer_source` is set) and `commands.js:307` (the defect
it named); the Lane C order omitted eight of the eleven files a C3 reconciliation touches, every test
path, and the two files carrying the actual defect.

**This is the CAPAE family "Work Order issued outside the generated envelope route" firing four
times, in a form the family description does not quite cover** — the route was *used* and its output
was *not read back*. Recorded as a qualified exposure. **MUST: generate the envelope, AUTHOR every
slot, run `--count-markers` to zero, THEN issue.** A dispatch message is not an order.

**Cost:** roughly 370k worker tokens and three elapsed hours producing zero product change — though
not zero value, because the refusals located two real defects nothing else had found (below).

---

## 2. ✅ C3 RECONCILED onto the executable route

`git merge build-015/browser-method-contract` → `6a2c6dc`, clean, 18 files, +3,343 lines.

**`handoff/instructions.js` v2 is now on the executable branch** — 18 ordered `BROWSER_METHOD` steps
and 5 `PROHIBITED_ACTIONS`, carrying every behaviour Warwick has had to re-explain across four
sessions: `regulars_favourites_first`, `set_brand_az_ordering`, `batch_adds_and_split_on_failure`,
`quantity_by_stepper_not_typing`, `read_structure_not_pixels`, `one_session_one_page_context`,
`verify_each_add_from_trolley`, `reconcile_from_quantity_field`, `batch_questions_into_one_ask`,
`audit_trolley_first`, `reacquire_refs_after_mutation`, `stop_at_checkout_ready_basket`.

**Larry took this merge directly rather than delegating it**, because `b399c23` changes
`Builds/BUILD-015-.../SONNET-BROWSER-EXECUTION-PACKET.schema.json` and **Keel's contract categorically
forbids writing under `Builds/**`** (critical rule 5). The worker identified the trap precisely:
`packet/committedSchema.js` reads that schema by absolute resolve and the packet suite validates the
producer against it *by design* — a literal held outside the source under test. Bring the producer
without the schema and the suite goes red **by design**; bring the schema and the worker breaches its
contract. **Neither option was available to it. It was available to me.**

---

## 3. ✅ THE CI GAP — 213 tests that had never run

`.github/workflows/asdair-tests.yml` named **twelve** working directories. **Neither
`services/asdair/handoff` nor `services/asdair/packet` was among them.**

Executed locally on this branch after the merge: **handoff 104/104 pass · packet 109/109 pass.**
**213 green tests CI had never once executed** — including the two that most needed running:
`handoff/method.test.js` (pins `BROWSER_METHOD` and `PROHIBITED_ACTIONS` against literals held
outside the source they check) and `packet/buildExecutionPacket.test.js` (validates the producer
against the committed schema).

Fixed at `d9c2ca6`; the workflow now carries 19 steps and both packages are verified present.

> **The lesson, and it is a repeat:** an unrun suite is indistinguishable from a green one in a run
> list. **This is how the entire C3 deliverable stayed CI-invisible while being described as
> complete.** Same failure class as a path-filtered workflow vanishing from the run list.

---

## 4. 🎯 THE ~12GB TAB-PER-ITEM CAUSE IS LOCATED — two files, not the architecture

Warwick: *"last week claude opened a tab for every bloody item and nearly killed the yoga with its
12gb memory."*

Found by the Lane C worker, **independently re-verified by Larry**:

| File | Line | Call |
|---|---|---|
| `services/asdair/browser-runner/actions.cjs` | **:8** | `const t = await newTab(url);` |
| `services/asdair/browser-runner/readTrolley.cjs` | **:4** | `const t = await newTab(url);` |

**`browser.cjs` is already correct** — it calls `cdp.reuseTab(...)` and does not appear in a
`newTab` grep at all.

**So the tab-per-item behaviour is two direct `newTab` calls, not a design flaw in the runner.** That
materially changes the one-tab work: it is a bounded fix in two files plus an enforcement guard, not
an architectural rewrite.

**Consequence for the guard's design, and the worker was right to raise it:** a guard placed only
inside `cdp.js` either makes those two modules throw at runtime — changing the behaviour of files
outside the worker's surface — or is trivially bypassed by importing `newTab` directly, which is not
an invariant at all. **Both files must be in the amended surface.**

---

## 5. What is NOT done, stated plainly

- **`buildHandoff` / the execution packet still have no production caller.** Reconciled ≠ wired.
- **`verifyBasket` still has no production caller**, and `verificationFor` is still unset in
  `realWiring()`, so a basket handback still renders "NOT VERIFIED" by omission.
- **The one-tab invariant is not yet executable or mutation-tested.**
- **Free-text ingress is unchanged** — a typed reply is still dropped at `inboundRouter.js:152` and
  silently skipped at `runtime.js:235`.
- **Nothing here has been proven against a live authenticated ASDA session.** Warwick's six live
  proofs (session persists · authenticated state visible · navigation without spawning tabs · one
  bounded item added · trolley read back and verified · clean recovery) all remain **NOT PROVEN**,
  and they require his manual sign-in.

**No claim is made that the browser operation works.** Chrome being driveable is not that claim, and
today's ten-item add — one tab, £23.65, visually confirmed by Warwick — proves transport and the
one-tab capability, nothing more.
