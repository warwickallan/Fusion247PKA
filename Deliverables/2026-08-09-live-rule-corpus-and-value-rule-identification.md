# The LIVE rule corpus — which rows are the retired value behaviour

**Queried live by Larry against the household database, 2026-08-09, on Warwick's explicit
instruction:** *"live-query the rule data to establish which actual rule rows correspond to the
retired value behaviour rather than relying on the uncertain historical numbering around rule 31."*

`select … from asdair.rules where active = true order by id` — **40 active rows** (ids 1–40, no 21).
Read-only. Staged here because **subagents hold no MCP tools**; the worker uses this file, not a
query.

---

## ⛔ THE ANSWER: ARCHIVE RULES 31 AND 36. NOTHING ELSE.

| id | directive | scope | match_term | Verbatim `rule_text` | Disposition |
|---|---|---|---|---|---|
| **31** | `info` | product | `ariel pods` | *"Ariel Pods: pick the BEST VALUE by price-per-wash across pack sizes (Warwick 2026-07-21)."* | **🔴 ARCHIVE** — price-per-wash optimisation, the named example |
| **36** | `info` | global | *(null)* | *"OFFER RULE: if a multibuy gives >=50% off the EXTRA item(s), buy up to the offer quantity. e.g. Tropicana Smooth OJ 1=£4.28 vs any-2-for-£5 -> buy 2 (2nd is ~72p) (Warwick 2026-07-21)."* | **🔴 ARCHIVE** — a percentage-threshold judgement about whether an extra item is worth buying. Warwick's own words name this class |

## ✅ RULE 37 IS RETAINED — Warwick, 2026-08-09, explicitly

| id | directive | scope | match_term | Verbatim `rule_text` |
|---|---|---|---|---|
| **37** | `info` | product | `sure male` | *"Sure \"any 2 for £X\": round qty UP to an even number to capture every pair; add a FEMALE variant to complete the last pair (Mum 3 male -> add 1 female = 4). Combines with the rotate-variant rule (Warwick 2026-07-21)."* |

> **Warwick's correction, quoted:** *"DO NOT ARCHIVE RULE 37. I am explicitly retaining the Sure
> rule. … Rule 37 is [DETERMINABLE HOUSEHOLD SHOPPING POLICY]. The Sure rule is determinable before
> the browser run. … Do not discard a deterministic quantity/variant rule merely because its prose
> mentions a multibuy context. The product decision I made was: ARCHIVE THE BEST-VALUE /
> BARGAIN-SHOPPING JUDGEMENT. It was NOT: ARCHIVE EVERY RULE THAT MENTIONS AN OFFER OR MULTIBUY."*

**The live text proves him right, and it is the whole argument:** the rule states its own outcome
arithmetically and price-free — **"Mum 3 male -> add 1 female = 4"**. Rounding 3 up to 4 and adding
one female variant needs **no price, no offer state and no browser**. The `any 2 for £X` clause is
the *reason the household adopted the habit*, not an input the planner must evaluate.

**Larry's error, recorded:** I conflated *"mentions a multibuy context"* with *"requires price
arithmetic"*. They are different, and the worker had explicitly labelled the reading as mine and
invited disagreement. The error is mine alone.

---

## The borderline rows I checked and am RETAINING — stated so nobody re-opens them

| id | Why it is NOT a value/bargain judgement |
|---|---|
| **12 / 25** | Nescafe Azera — *"add only if on offer, otherwise flag the full price and do not add"*. Directive is `needs_decision`: it **asks a human** rather than optimising. That is exactly Warwick's model — he is the bargain hunter |
| **15** | Toothpaste — text says *"cheapest size available"*, but the directive is `map` and `matched_product` **pins `Aquafresh (75ml, cheapest size)`**. The outcome is determinable and already decided; no plan-time arithmetic |
| **7** | *"A normal shop is GBP 120-150 …; flag the basket if it falls outside this band."* A **budget flag**, not an optimisation. It reports; it does not choose |
| **32** | Sure rotate — `rotate` directive, already actionable, price-free. **Rule 37 explicitly "combines with the rotate-variant rule"** |

---

## Facts that correct the record

1. **🔴 RULE 31 EXISTS AND IS ACTIVE.** `WO-B15-R3`'s return said its live existence was *"not
   established"*, citing `skill/ruleConsumption.test.js:62`'s list (12, 25, 32, 36, 37, 38). **That
   was an incomplete test fixture, not the database.** The Wayfinder's D4 was **correct**; the
   "may never have existed" note added at `2f59307` is **wrong and is superseded**. R1's
   "constructed paraphrase" caveat was also unnecessary — the live wording is almost exactly it.
2. **`asdair.rules` has no `status` column** — confirmed. Archival is `active = false`
   (`db/001:97`). R3's correction to Larry's order stands.
3. **40 active rules, not 39.** Ids 1–40 with **21 absent** (superseded by rule 28, per its own
   text). The map's *"23 of 39"* figure is off by one on the denominator; the argument is unaffected
   and the row is not re-cut for it.
4. **Rule 36 is `scope: global` with a NULL `match_term`** — so it was doubly inert, exactly as D4
   recorded.

## The archival SQL — NOT YET EXECUTED

```sql
-- Requires OWNER-LEVEL privileges: asdair_rw holds no UPDATE on asdair.rules (012:106-110).
update asdair.rules
   set active = false
 where id in (31, 36)
   and active = true;
-- Expect exactly 2 rows. Rule 37 is NOT in this statement and must never be added to it.
```

**Larry runs this under Warwick's authority, on the precedent of migration 017's application.**
Until it runs, `planner.js:1151` keeps surfacing rules 31 and 36 as advisory notes.
