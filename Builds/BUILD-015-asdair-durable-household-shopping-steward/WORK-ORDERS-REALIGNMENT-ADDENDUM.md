# BUILD-015 — WORK ORDERS created by the 2026-08-04 realignment ruling

**Companion to** `DURABILITY-CLOSEOUT-WORK-ORDERS.md`, which holds WO-A…WO-O.
**Authority:** Warwick, 2026-08-04, `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`.

> Read `RUNTIME-DECISION.md` and `CANONICAL-WEEKLY-SHOP-PROCESS.md` first. These work
> orders implement them. **WO-C is superseded and WO-D is cancelled** — see the parent file.

---

## WO-P — The Sonnet Browser Execution Packet

**Ruling §1E.** Owner: **Keel.** Size: M. **Replaces WO-C.** Critical path.

The product itself must produce one durable packet per shop. **No Claude session builds it
by hand** — which is exactly what happened three times on 2026-08-03.

Fields per line: shop ref · original list line · canonical product ID and name · brand ·
**source view (Regulars or Favourites)** · ASDA product reference · required quantity ·
known-or-newly-approved · exact approved search term (new items only). Plus, per packet:
**expected distinct-product count** and **expected total-unit count**.

**Sort: normalized brand A–Z, then canonical product name A–Z.** This is the order Sonnet
uses in ASDA — the ordering *is* the speed.

Stored in Postgres; exposed as JSON, as a human-readable checklist, in the Cockpit, and to
the Sonnet handoff. Schema: `SONNET-BROWSER-EXECUTION-PACKET.schema.json`.

## WO-Q — Order- and spelling-tolerant catalogue matching

**Ruling §1C.** Owner: **Keel.** Size: M. Critical path — it is what makes §1D possible.

A known product must **never** become a question because exact-string matching failed. Must
tolerate word-order changes (`"yazoo choc"` ↔ `"choc yazoo"`), one-letter spelling errors
(`"Glouester"` ↔ `"Gloucester"`), punctuation and spacing, household shorthand, prior aliases,
and previous decisions. **Previous decisions must be consulted before any question is
generated.** Both examples are real 2026-08-03 failures — see `DEFECT-LEDGER.md`
D-2026-08-03-15.

## WO-R — One interpretation entry point, with evidence

**Ruling §1A/§1B.** Owner: **Keel.** Size: S–M.

Exactly one photo-interpretation entry point; any open-ended transcription path deleted,
retired, or made to **fail closed**. Fail closed when: the catalogue is absent or empty · the
model was not given the catalogue · the model is unavailable · the output claims an unknown ID.

**Record sanitized evidence of what catalogue and decisions were actually supplied to the
model.** Asserting `loadCatalogue()` was called is not evidence — and a `--dry-run` that skips
the model call proves nothing about the model call (D-2026-08-03-04, which cost a live shop).

## WO-S — Basket reconciliation against expected counts

**Ruling §3.** Owner: **Keel.** Size: M.

Compare expected **distinct products** and expected **total units** against the real basket;
reconcile each product identity and quantity; identify unavailable items **without
substituting**; identify anything omitted or unexpected; confirm no checkout, payment or slot
action occurred.

Only then send: *«Basket ready for Warwick to review and order.»*

**A matching headline count alone is insufficient** if the wrong product or quantity is present.

## WO-T — Close the new-item learning loop automatically

**Ruling §4.** Owner: **Keel.** Size: M.

Per new product: persist ASDA reference and URL · canonical name and brand · **the
photographed wording as an alias** · the approved search wording · Regulars-or-Favourites ·
confirm the ASDA Favourite action completed · make it next week's catalogue input.

Per answer: durable decision event · `rule_qa_log` · promote continuing rules · add aliases ·
**prevent the same question next week**.

`outcome/update-regulars.js` already works — six regulars were written with it by hand on
2026-08-03. **What is missing is the shop driving it automatically.**

## WO-U — Cockpit operational repair

**Ruling §5.** Owner: **Felix** (in progress 2026-08-04). Size: M.

Treat as an **open operational defect**, not a completed UI task. Prove: Overview loads the
real current shop · Details loads the retained photograph · interpreted lines show catalogue
identity · genuinely new items visibly distinct · previous decisions visible · the
**Brand-ordered Sonnet packet visible** · basket reconciliation visible · **stale
service-worker assets cannot keep serving a broken version** · the API and proxy report
**unhealthy** when a dependency is unavailable rather than showing a reassuring placeholder.

The Cockpit must not be *required* for the shop to proceed — but when presented as
operational it must actually work. Status: `COCKPIT-OPERATIONAL-STATUS.md`.

## WO-V — Apply the Drive decisions, and fix what blocks them

**Ruling §4.** Owner: **Larry** (admin path). Size: S. **DOWNGRADED — NOT blocked on Warwick.**

> **CORRECTED 2026-08-04.** This entry previously said it was **BLOCKED needing Warwick's
> ruling on a three-way Sure conflict.** **That was false and is withdrawn.** Rules **32**
> (*"ROTATE the variant each week — pick DIFFERENT from the previous order"*) and **37**
> (*"round qty UP to an even number… add a FEMALE variant to complete the last pair
> (Mum 3 male → add 1 female = 4). Combines with the rotate-variant rule"*) are
> **complementary and complete**, and match exactly what Warwick stated independently on
> 2026-08-04. The "conflict" came from reading stub `note` columns and the Drive doc while
> ignoring `rule_text`. **No ruling from Warwick was ever required. Do not ask him again.**

Migration `011_decisions_log_rule_notes_seed.sql` is written and **NOT APPLIED**. Its real
status:

- It back-fills the **optional `note`** column on rows whose **`rule_text` already carries
  the decision**. Worth applying for completeness; **not on the critical path**, and **not**
  the cause of any 2026-08-03 question.
- **D-2026-08-04-01** — `asdair.rules` genuinely holds **three rows** matching `"sure male"`
  (ids 23, 32, 37). They are **complementary** — a `map` and two `info` — not contradictory.
  The migration's ambiguity guard still fires because one entry claims all three, which is
  correct behaviour for a `note` back-fill. Resolve by scoping per-row, not by a ruling.
- **D-2026-08-04-02** — the apply needs the admin path; both attempts were blocked by
  permission gating, and the temporary grant was **revoked and verified**.

**The real work is WO-Y, not this.**

## WO-W — Amend every superseded document

**Ruling §6.** Owner: **Larry.** Size: S–M. **Partially done.**

| Document | State |
|---|---|
| `RUNTIME-DECISION.md`, `CANONICAL-WEEKLY-SHOP-PROCESS.md` | **created** 2026-08-04 |
| `DURABILITY-CLOSEOUT-WORK-ORDERS.md` (WO-C, WO-D) | **amended** |
| `DEFECT-LEDGER.md` | **amended** — D-2026-08-04-01/02 added |
| SOP-021 | **NOT AMENDED** |
| SOP-021a | **NOT AMENDED** |
| `Team/Asdair - Household Shopping Steward/AGENTS.md` | **NOT AMENDED** |
| `services/asdair/browser-runner/README.md` | **NOT AMENDED** |
| BUILD-015 Goal Contract | **NOT AMENDED** |
| `ACTIVATION-DEFERRED.md` / continuation records | **NOT AMENDED** |
| decision ledger (WO-F) | **NOT WRITTEN** |

Still to create: `SONNET-BROWSER-EXECUTION-PACKET.schema.json` ·
`CATALOGUE-GROUNDED-INTERPRETATION.md` · `NEW-ITEM-LEARNING-LOOP.md` ·
`COCKPIT-OPERATIONAL-STATUS.md`.

**Mark superseded methods explicitly. A fresh instance must never be left choosing between
Sonnet, Larry and the CDP runner.**

## WO-X — Prove it without touching the live ASDA account

**Ruling §7.** Owner: **Keel** (build) + **Pax** (evidence). Size: M. **Runs after WO-P/Q/R.**

From committed code, private household state and the retained 2026-08-03 inputs — **no
further live basket experiment** — prove:

- the real household catalogue loads;
- **Regulars and Favourites are both represented** (currently NOT VERIFIED);
- aliases and previous decisions enter the model request;
- the photographed list maps known products to known IDs;
- **`"yazoo choc"` resolves through `"choc yazoo"`**;
- the misspelled Gloucester cheese resolves to the known item;
- the previously-answered coffee and toothpaste decisions **do not become questions**;
- only genuinely new items enter the question batch;
- the execution packet is **Brand A–Z**;
- expected product and unit counts are calculated;
- new-item write-back produces next-week catalogue input.

---

## Revised sequencing after the realignment

```
WO-B (done) ──► WO-Q ──► WO-R ──► WO-P ──► WO-X
                                    └──► WO-S ──► WO-T

WO-V   BLOCKED — needs Warwick's Sure ruling + an admin-path apply
WO-U   in progress
WO-W   continuous
WO-A, E (done), F, G, H, I, J, K, L, M, N, O — unchanged in the parent file
```

**WO-C and WO-D are no longer on this graph.**

Nothing here should be read as a claim that BUILD-015 is durable, complete or ready.
