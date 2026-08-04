---
name: WO-Y — the pipeline does not consume rules it already holds
work_order_id: WO-2026-08-04-RULE-CONSUMPTION
build: BUILD-015
wp_number: WO-Y
status: issued
authorised_by: Warwick
authorised_date: 2026-08-04
owner: keel
return_to: larry
blocking_dependencies: none
tags: [asdair, build-015, planner, rules, high-severity]
private_surface: none
credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
out_of_scope_policy: report-only
worktree: n/a
branch: n/a — Larry retains git, do not commit
schema_decision: n/a — read the rules as committed; do not change the schema
security_inputs: n/a
operational_handoff: none
runbook_path: n/a
---

# WO-Y — the pipeline does not consume rules it already holds

**Severity: HIGH. This is the highest-value fix in the build.** It may also be cheap.

## The defect, stated exactly

`asdair.rules` and `asdair.rule_qa_log` **contain the household's decisions**. The shopping
pipeline **generated questions anyway** for items those rules already cover.

This is not a storage gap. **Everything needed was in the database and was not used.**

## Evidence — all verified live on 2026-08-04

`rule_text` is populated on **39 of 39 active rules**. `rule_qa_log` holds 5 real Q&A rows.
Verbatim, all dated 2026-07-21 or earlier:

| id | directive | `rule_text` (verbatim, trimmed) |
|---|---|---|
| 12 | `needs_decision` | *"Nescafe means Azera only; add only if on offer, otherwise flag the full price and do not add."* |
| 25 | `needs_decision` | *"Nescafe generic-phrasing trigger: flag for a human because Azera is added only if on offer…"* |
| 32 | `info` | *"Sure male: ROTATE the variant each week - pick DIFFERENT from the previous order…"* |
| 36 | `info` | *"OFFER RULE: if a multibuy gives >=50% off the EXTRA item(s), buy up to the offer quantity. e.g. Tropicana Smooth OJ 1=£4.28 vs any-2-for-£5 -> buy 2 (2nd is ~72p)"* |
| 37 | `info` | *"Sure 'any 2 for £X': round qty UP to an even number… add a FEMALE variant to complete the last pair (Mum 3 male -> add 1 female = 4). Combines with the rotate-variant rule"* |
| 38 | `info` | *"REAL cause of 'add to trolley' failing = the item is OUT OF STOCK, NOT an expired slot…"* |

`rule_qa_log` #5 (2026-07-21) already answered **Ariel Pods = "best value/wash"** and
**Sure = "rotate variant weekly"**.

**On 2026-08-03 the shop asked Warwick about Azera, Ariel Pods and Sure anyway.** Larry then
answered the Ariel question by *guessing* while the recorded answer sat in the database.

## The leading hypothesis — test this first, it is cheap

**Rules 32, 36, 37 and 38 all carry directive `info`.** If the planner does not action `info`
rows, then **every multibuy rule and every rotation rule in this system is inert** — which
would explain the Sure questions, the Ariel question, and why the Tropicana multibuy was
never applied on 2026-08-03 in one stroke.

Confirm or eliminate that before anything else. If confirmed, the fix may be small.

Other candidates, in the order worth checking:

1. **`info` is never consulted** (above).
2. **`match_term` matching is exact-string**, so the photographed wording did not match — the
   same root as WO-Q. Note rules 36 and 38 have **`match_term = NULL`** entirely: they are
   *global* rules with nothing to match on. How does the planner apply a rule with no term?
3. **Rules are loaded but only after questions are generated**, so the question queue is
   built before the rulebook is consulted. `CANONICAL-WEEKLY-SHOP-PROCESS.md` §D requires the
   opposite: *"Previous decisions must be consulted before any question is generated."*
4. **`rule_qa_log` is never read by the planner at all** — check whether anything reads it
   outside `promoteDecision.js`.
5. **`household_id` scoping** — rules 1–9 have `household_id = NULL`. Are global rules
   dropped by a household filter?

## What "done" looks like

1. **The root cause, established by execution rather than reading.** Tonight proved repeatedly
   that reading code produces confident wrong answers — run the planner against the real
   2026-08-03 inputs and observe which rules are consulted.
2. **The fix**, scoped to the actual cause.
3. **A test that fails without the fix**, asserting the property directly:
   **a list line covered by an active rule must not enter the question queue.** Use the real
   2026-08-03 cases: `"bottle Azera coffee"` → rule 12/25 · `"Ariel Pods"` → `rule_qa_log` #5 ·
   `"Sure male"` → rules 32/37.
4. **State plainly whether the multibuy rule (36) can actually execute.** `services/asdair/skill/README.md`
   records standing rule 7 as **structurally inoperative — there is no price column anywhere
   in the schema.** If so, rule 36 cannot be evaluated automatically no matter how the
   consumption defect is fixed, and that must be said rather than implied. It may belong at
   basket review instead.

## Boundaries

Read-only against the live database. Do not change the `rules` schema. Do not "fix" a rule's
content — the content is correct and is Warwick's. If the planner and a rule disagree, the
**rule** is right. Do not commit.

## Why this is worth doing before WO-P, WO-Q or anything else

Every hour of 2026-08-03 that Warwick spent answering questions he had already answered
traces to this. The rules are correct, complete, and were written weeks ago. **The product
simply is not reading its own rulebook.**
