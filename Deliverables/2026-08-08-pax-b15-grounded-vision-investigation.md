# BUILD-015 Step-2 investigation — grounded vision, source binding, earliest still-broken link

**Pax, 2026-08-08. Commission: Warwick-authorised "Asdair Build 001" Step 2 (map §10, mirror §11).
Governance head `0908103`, branch `build-015/grounded-recognition`, worktree `C:\Fusion247PKA-b15`.
Method: source reading of `services/asdair/**` at the worktree head + the staged live evidence
[[Deliverables/2026-08-08-b15-bootstrap-evidence]]. No Bash, no database access; every live claim
below cites the staged evidence or is listed under (e) as a fact Larry must fetch. Evidence classes:
READ (source read), ENUMERATED (importer/caller enumeration), STAGED-LIVE (bootstrap evidence §n),
NOT VERIFIED.**

---

## (a) Verdict on the one question

> «Can Mum's exact photograph be interpreted safely, catalogue-grounded and without Larry — and
> what is the earliest still-broken link in the real photo-to-checkout-ready journey?»

**CONDITIONAL YES on interpretation; NO on the journey.** The interpretation stage itself — photo →
catalogue → grounded prompt → Terra-with-image → deterministic identity from our rows → questions —
exists as the one production path, is guarded at source against every ungrounded fallback, and
demonstrably RAN live on 2026-08-03 (35 lines against a 97-candidate catalogue, 11 questions,
replan — STAGED-LIVE §5). The conditions: (1) that live run predates the 2026-08-04 fixes and was
manually rescued — the current bytes have never interpreted a live photo shop, so the stage is
**LIVE — NOT COLD-START PROVEN** on current source; (2) two product invariants are open **inside**
the stage: no immutable image fingerprint exists anywhere (invariant C) and Terra's
catalogue-constrained candidate evidence is discarded before identity resolution (invariant D,
§11E — confirmed at source).

**The journey cannot reach checkout-ready without a human hand-crafting an HTTP call, because of a
break EARLIER than the packet seam and absent from the seven-break table: the
interpretation-confirmation gate has no production surface and no notification.** See (c).

---

## (b) The nine surfaces

### 1. Exact source-photo binding — **READ + STAGED-LIVE. Provable, with one missing invariant-C field.**

A shop is bound to its Telegram message by: `sourceId = tg:shopper:chat:<chatId>:msg:<messageId>`
(`intake/shopperIntake.js:240`), plus `telegram_chat_id`, `telegram_message_id`,
`telegram_update_id`, `raw_media_path` (local downloaded bytes; filename embeds sourceId +
Telegram's `file_unique_id`, `safeMediaFilename`), `list_date` from the receiver's own stamp, and a
unique `(telegram_chat_id, telegram_message_id)` index that makes redelivery resume, never
duplicate (`pipeline/runtime.js` pollIntake; durability-before-ack boundary at runtime.js:102–113).
Downstream: `shop_line` rows per line (migration 008, UNIQUE (shop_id, line_no)), lines linked to
list items (`linkListItem`), a sanitised grounding-evidence record (catalogue count, prompt chars,
readings returned, matched ids — `runPipeline.js:228`), and the Cockpit media proxy can display the
exact stored photograph (`services/cockpit/server.mjs:337`). **Where it breaks: no immutable image
fingerprint is recorded anywhere** — the only `fingerprint` in the schema is
`shop_question.render_fingerprint` (grep of `services/asdair/db/*.sql`); `handoff/fingerprint.js`
fingerprints the PACKET only, and that chain is unreachable (surface 7). The image binding is by
mutable file path plus Telegram identifiers, not by content hash.

### 2. Production image entry point — **ENUMERATED. Exactly one production route; no silent bypass.**

Every callable photograph-interpretation path:

| Path | Grounded? | Production? |
|---|---|---|
| `pipeline/runtime.js` → `runPipeline.stepInterpret` → `deps.realInterpretPhoto` → gateway `vision()` | YES | **THE production route** (scheduled task → `ensure-asdair-runtime.mjs` → `runtime.js --watch`, STAGED-LIVE §2) |
| `interpret/interpret-list.js` CLI | YES, fail-closed (exit 3/4; `--dry-run` removed after D-2026-08-03-04) | Diagnostic only; self-labels `not_the_production_path` |
| `transcribe/transcribe-list.js` CLI | **NO — ungrounded by design** | **Zero non-test importers in all of `services/` (enumerated)**; standalone CLI only |

The required order holds at source: `stepInterpret` loads the catalogue first
(`assertCatalogueLoaded` throws on missing/empty — runPipeline.js:89–101), builds the grounded
prompt, makes ONE vision call with the image attached (base64 data URL → OpenAI-style `image_url`
content part, `models.mjs:28`), resolves identity only from `asdair.regulars`
(`resolveByCatalogue`), and opens questions for the rest. `vision()` **refuses** to run without
`FUSION_GATEWAY_URL` and has deliberately no text-model fallback (models.mjs:56–67). Regression
guards pin this: `catalogueGrounding.test.js:168` and `interpret-entrypoint.test.mjs:175–178`
assert no `transcribeList` fallback. **No route can bypass catalogue grounding as a silent
production fallback** (source truth; tests are capability evidence only).

### 3. Catalogue completeness — **READ + STAGED-LIVE, with row-level gaps for Larry.**

What reaches the recognition set (`loadCatalogue.js:65`): ALL active regulars for the household —
`id, name, brand, category, aka, typical_qty` go to the prompt; `asda_product_id`/`asda_url` are
held back in `regularsById` for the resolver only. **There is no filter on `asda_product_id`
anywhere in the recognition path — invariant B is satisfied at source** (missing ASDA IDs cannot
gate recognition; they are deliberately never even shown to the model). Also loaded: rules with
directive `exclude|map|rotate|needs_decision` (`info` deliberately excluded from the prompt) and
the last completed order from `asdair.orders` (`total_added is not null`). Live: 103/103 active
regulars, `source={regular}` only — **Favourites is not a live concept** (fog 5 resolved,
STAGED-LIVE §4). **The live-only `previously_ordered` table is read by NOTHING in this repo**
(enumerated) — its existence implies prior-order data the recognition set never sees; row-level
content is a Larry fetch. Alias counts, duplicate aliases, and the 97-vs-103 reconciliation are
row-level facts (see (e)) — the plausible reading of 97→103 is six regulars added/activated after
2026-08-03, but that is NOT VERIFIED.

### 4. What Terra actually receives — **READ (source truth); live demonstration NOT performED.**

Per `groundedPrompt.js`: every candidate as `id: name` with brand, category, aliases, usual
quantity; the interpretation-affecting rules; the last completed order's lines; the seven-rule task
block; a strict JSON schema asking for `raw_reading, quantity, matched_regular_id, match_basis,
confidence, alternatives, status` per line. The image is attached as a data URL in the same request
(deps.js:157–183, models.mjs:26–28) — **source-level proof of attachment; the live proof for a new
shop is the grounding-evidence row (prompt chars, readings returned), which only writes after the
call returns.** NOT supplied to Terra: prior ANSWERS (`rule_qa_log` reaches only the planner via
`loadPlanningInputs`), `high_level_category`, anything from `previously_ordered` — a gap against
the Star's "prior answers and prior orders" wording, partially compensated at planning time.
**97 vs 103:** the prompt string "interpreted 35 line(s) against a catalogue of 97 known products"
is generated from `catalogue.candidates.length` (runPipeline.js:280) — so 2026-08-03's live
recognition set genuinely was 97 active regulars; today's is 103; the delta is unexplained at row
level (Larry fetch). **§11D's demonstration with one explicitly approved retained photograph was
not performed: no approved retained photograph is named in any staged evidence.** Shop 6's image
presumably sits at its `raw_media_path`; whether the file exists, and whether Warwick approves its
use, are both open. I did not substitute anything.

### 5. Catalogue-constrained candidate evidence — **READ. Constrained where used; unused in production.**

The prompt constrains Terra to supplied candidate ids ("matched_regular_id MUST be an id from the
list above, or null. Never write a product name into matched_regular_id"). The validation that
enforces it — id coercion, refusal of unknown ids, catalogue-only name lookup, `unknownIdClaims`
whole-reply refusal — **exists only in the diagnostic CLI** (`interpret-list.js resolve()`,
lines 73–119, 173–184). The production path never validates Terra's candidates because it never
reads them (next surface). So in production the constraint is vacuously safe: no model id is ever
used, hence none can escape the catalogue.

### 6. Is useful candidate evidence discarded? — **YES. CONFIRMED AT SOURCE (invariant D / §11E).**

`realInterpretPhoto` strips the model's reply to `{line_no, raw_reading, quantity}`
(deps.js:178–182), throwing away `matched_regular_id`, `confidence`, `alternatives`, `match_basis`
and `status` that the prompt explicitly requested — then `stepInterpret` re-solves identity from
raw text alone via `resolveAll` (runPipeline.js:195). This is precisely the pattern invariant D
prohibits: *"do not throw away useful catalogue-constrained evidence and then try to solve the
handwriting again from raw text alone."* The deterministic re-solve is the SAFETY half of D
working (deterministic matches win; nothing outside the catalogue enters); the EVIDENCE half is
violated. Consequence: a line Terra confidently and correctly grounded ("needs_confirmation with
both alternatives listed", say) collapses to whatever the string-matcher can recover from
`raw_reading`, inflating the question load and losing the ranked alternatives that would have made
each question card better. Smallest safe correction is in (d).

### 7. Earliest still-broken link — see (c). **The confirmation gate, then the packet chain.**

### 8. Wrong-week protection — **READ. Partial; the required fingerprint fields do not exist.**

What exists: the week is derived once from the receiver's stamp (`listDate`, runtime.js:121);
`shop_ref = SHOP-YYYY-MM-DD` with `listDateOf()` refusing any mismatch (runPipeline.js:60–64) —
"NO CLOCK: a retry that crossed midnight must not put this week's items on next week's list";
the packet schema pins `shop_ref` format and `fingerprintPacket()` supplies content identity for
supersession — but that chain has no production caller. The Cockpit can display the shop's actual
photograph (read surface for "which photograph generated this plan"). **What does not exist:
immutable image fingerprint, independent physical-line count (only the model's own line count is
recorded), and any check binding plan/packet/basket back to image content.** A re-sent old
photograph becomes a NEW shop dated to its arrival week — the arrival-date binding prevents
cross-week contamination of lists, but nothing would expose "this is July's photograph" to the
approval flow. Invariant C: partially met; the fingerprint requirement is unimplemented.

### 9. Larry / live-Claude dependence — **READ + STAGED-LIVE. Larry-less until the confirmation gate; not beyond.**

Larry-less at source and in live deployment: intake (runtime scheduled task, cold-start launcher —
STAGED-LIVE §2), vision through `FUSION_GATEWAY_URL` (no Claude session), question cards and answer
capture inside `runtime.js` (source-fixed, wired, running canonical bytes since 2026-08-08 21:50 —
never live-exercised). NOT Larry-less: **(i) the interpretation-confirmation gate — the only
production-reachable way to issue `confirmInterpretation` today is a hand-crafted
`POST /asdair/command` to cockpit-api (httpApi.js:196), i.e. an operator/Larry act;** (ii)
cockpit-api itself has no launcher — manual start, known liability (STAGED-LIVE §2) — and it is the
only host of that command surface; (iii) the basket stage: the ruled writer is supervised
Sonnet-in-Chrome (RUNTIME-DECISION), but the handoff artefact it would consume is unreachable
(break 3) and `stages.js:85` still names "the supervised browser runner (Larry, at the keyboard)"
as WAITING_FOR_BROWSER's waitsFor; (iv) historically, the one live run (2026-08-03) was manually
rescued. The 2026-08-03 defect that forced the rescue (string-keyed `regularsById` Map missing
every lookup) is fixed at source with a real-shape test (loadCatalogue.js:107–122) — fixed, not
live-proven.

---

## (c) THE EARLIEST STILL-BROKEN LINK

**The interpretation-confirmation gate: every photo shop deterministically parks, silently and
permanently, at `wait:interpretation_confirmation`, because no production surface can issue
`confirmInterpretation` and nothing tells Warwick it is being waited on.**

The mechanism, all READ at source:

1. Every photo shop is created `needs_review = true` and **nothing ever clears it** — "There is no
   writer for needs_review afterwards" (commands.js:145–148).
2. After planning (and after every question is answered and replanned), `planOutcome` requires
   `needsReview → interpretationConfirmed` before READY_TO_SHOP (stages.js:306–318). Unconfirmed,
   it returns `to: null` — a legal park that **writes no event and queues no card**
   (runPipeline.js:439–445; no outbox kind exists for this park — enumerated).
3. `confirmInterpretation` exists as a command (latch, commands.js:203) — but: the Telegram
   router/adapter has **no confirm action** (telegramAdapter.js:83–88 deliberately maps "review" to
   a read; the ACTIONS vocabulary contains no confirm); the live Cockpit's asdair proxies are
   **read-only by design** ("no mutation, no new intent", cockpit/server.mjs:280–283) and its UI
   says "reply in Telegram" (public/app.js:372–374) — advice Telegram cannot honour; the only UI
   with a "Confirm this reading" button is the Directus `wp-d-proof` extension
   (asdairWorkspace.vue:161), which is **not a running production process** (STAGED-LIVE §2 lists
   the three live processes; Directus is not among them).

**Shop 6 is the live instance.** Its trail ends "every question is answered - re-planning" →
PROCESSING at 20:10:40, not one event in five days (STAGED-LIVE §5). That is exactly what a
silent legal park at this gate looks like: each pass re-runs stepPlan, open questions = 0,
`needs_review = true`, no confirm ever issued, `stepped:false`, no event. **This corrects the
staged evidence's attribution** ("stuck at the exact seam where the execution-packet chain has no
production caller"): the packet seam is DOWNSTREAM of READY_TO_SHOP; shop 6 never reached
READY_TO_SHOP. The correction needs one live confirmation (fetch list, (e)1) — but the source
logic is deterministic, so only a surprising live fact (e.g. `needs_review` false, or a confirm
row) could overturn it.

Why each earlier link is considered working, and on what evidence:

| Link | Status | Evidence |
|---|---|---|
| Durable photo intake + shop row | WORKING | Live rows exist (shop 6); ack-after-persist boundary at source; runtime live on canonical bytes (STAGED-LIVE §2, §5) |
| Source binding | WORKING minus fingerprint | Surface 1; live shop 6 carries the binding columns |
| Catalogue-before-vision | WORKING | Live trail string "against a catalogue of 97 known products" is generated only by the grounded step; source invariant throws otherwise |
| Grounded Terra call with image | RAN LIVE 2026-08-03, with defects since fixed at source | 35 readings returned live; Map bug fixed + real-shape test; not re-proven on current bytes |
| Identity resolution + questions + answers + replan | RAN LIVE 2026-08-03 (manually rescued); question-card/answer wiring now at source in the running process | Breaks 1–2 SOURCE FIXED — NOT LIVE (map §10 rows 1–2); shop 6's 11 answers are real rows |
| Plan (planner path) | RUNS, over-asks | CI integration red is a planner-contract divergence that turns a term-matched regular into `needs_decision` (STAGED-LIVE §3) — degrades to extra questions, not a stop |
| **Interpretation-confirmation gate** | **CANNOT HAPPEN in production today** | This section |
| Packet → handoff chain (breaks 3–5) | CANNOT HAPPEN — next broken link behind the gate | `handoff/` has zero non-test importers; `buildHandoff()` exists only in a runtime.js comment (map §10 row 3, re-enumerated in this worktree) |
| Basket writer (break 4) | OPEN by ruling | RUNTIME-DECISION; no programmatic surface, deliberately |

"Earliest still-broken" per the commission's definition — the first link that cannot happen in
production TODAY — is therefore **the confirmation gate**, an eighth break not present in the
seven-break table (map §10). The 2026-08-04 END-TO-END-PROCESS-AUDIT enumerated module-caller
wiring; this gate is correctly wired at code level, and what is missing is the HUMAN surface. The
anti-pattern to carry: **enumerate the human acts a journey requires, not only the module calls.**

## (d) Smallest-correction sketch (no implementation)

**For the earliest broken link (the gate):** stay inside the existing patterns; nothing new is
invented.

1. **Card the park.** When stepPlan parks at `wait:interpretation_confirmation`, queue a
   once-per-shop outbox card (the exact self-healing `outboxEverQueued(deps, shop.id, kind)`
   pattern the receipt and progress cards already use, runPipeline.js:774–813) summarising the
   interpreted list with a "Confirm this reading" inline button. Self-healing matters: shop 6 then
   recovers on the next pass with no manual insert.
2. **Give Telegram the deliberate act.** Add one `confirm` action to `bot/callbackProtocol.js`
   ACTIONS and one `telegramAdapter.js` case mapping it to `COMMANDS.CONFIRM_INTERPRETATION`.
   `routeTaps` → `commands.dispatch` already carries it; the command, latch, gate and replan all
   exist. The "a glance is not an approval" property is preserved — it is a distinct tap on a
   distinct card.

Rejected as larger: wiring a Cockpit write path (violates the live Cockpit's deliberate read-only
design and needs UI + proxy mutation work).

**For §11E (candidate-evidence loss), when its WP comes:** keep Terra's per-line evidence through
the seam — validate it exactly as `interpret-list.js resolve()`/`unknownIdClaims` already do
(coerce id, refuse unknown ids, names only from our rows), persist it on `shop_line`, and hand it
to `resolveAll` as an assist consulted **only** where deterministic passes 1–4 fail or tie —
deterministic exact matches keep winning, close candidates still become a human question, and the
question cards inherit Terra's ranked alternatives. The validation code already exists; the change
is moving it from the diagnostic CLI into the production seam.

## (e) Facts Larry must fetch (read-only)

1. **Shop 6 park proof (decisive for (c)):** `shop.needs_review` for shop 6; whether any
   `confirmInterpretation` command was ever issued for it (pipeline_command/ledger); ideally one
   `runtime.js --once` report or shopStatus showing `step: wait:interpretation_confirmation`.
2. **97 vs 103:** `regulars` count for household 1 active on 2026-08-03 vs today
   (created_at/updated_at distribution) — reconcile the six-candidate delta.
3. **`previously_ordered` rows:** count, columns, sample — does it hold prior-order items absent
   from the recognition set (§11C)?
4. **`asdair.orders`:** does a completed order (`total_added is not null`) exist for household 1 —
   i.e. was/is the prompt's `last_order` context populated, and was it on 2026-08-03?
5. **Alias metrics (§11C):** alias count, duplicate/conflicting aliases across active regulars;
   count of regulars lacking `asda_product_id`/`asda_url`.
6. **Shop 6 image:** does the file at its `raw_media_path` still exist (size, mtime) — the
   candidate "explicitly approved retained photograph" for §11D, **pending Warwick's approval**.
7. **Grounding-evidence row:** whether shop 6 has one (the recorder post-dates its run; expected
   absent — confirms the evidence gap for the 2026-08-03 run).

## (f) What I did NOT establish

- Any live-runtime fact beyond the staged evidence: the park diagnosis in (c) is source-derived
  and consistent with the five-day event silence, but not yet confirmed by a live snapshot (fetch 1).
- Whether the current (post-fix) bytes interpret a real photo correctly end-to-end — no live shop
  has exercised them; §11D's demonstration was not run (no approved photograph named; no Bash).
- The 97→103 catalogue delta; `previously_ordered` contents; alias/duplicate metrics; completed
  orders presence (fetches 2–5).
- Root cause of the CI integration red beyond the staged characterisation (planner-path,
  `data.js` adapter ↔ planner contract; inherited baseline) — out of scope to fix.
- Whether the Fusion gateway's `fusion.vision` alias is currently serviceable (the 2026-08-03
  incident was a gateway alias failure; `vision()` fails loudly, but "fails loudly" ≠ "works").
- Anything about basket-stage design, Cockpit redesign, or BUILD-020 — out of scope by commission.
- §11F acceptance corpus: prepared knowledge only — Gourmet cat food is encoded as the invariant
  guard's origin story (runPipeline.js:85), Dreamies cheese and the 2026-08-03 yazoo/Gloucester
  failures are encoded in resolver passes 2b/3; Weetabix Protein, Wall's sausage rolls, Arla milk,
  Mars/Milky Way and the wrong-week control have no code-level or live evidence yet and belong to
  the future acceptance run.

*Single-source note: sections relying on the bootstrap evidence rest on one probe session by one
agent (Larry, 2026-08-08). Its execution provenance is named per claim, and nothing in source
contradicts it except the shop-6 stall attribution corrected in (c).*
