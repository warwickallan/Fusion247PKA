# BUILD-015 — RUNTIME DECISION: who writes the live ASDA basket

**Status:** CANONICAL. Supersedes every conflicting statement anywhere in this repository.
**Decided by:** Warwick, 2026-08-04, ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`.
**Supersedes:** the operating assumption used throughout the 2026-08-03 live incident, and
every document listed under "Documents this correction reaches" below.

---

## The decision, in one paragraph

**The Stage 1 live basket writer is Sonnet in Claude for Chrome, using the proven supervised
process.** It is **not** Larry, **not** a Claude Code subagent, and **not** the custom
Node/CDP browser runner at `services/asdair/browser-runner/`. That runner is now
**experimental, deferred, not the live default, not a blocker to Stage 1, and prohibited
from further live-account testing without fresh authority from Warwick.**

## Why this ruling exists — the honest account

On 2026-08-03 a live acceptance run built a real basket (35 products, £136.94) using the
custom CDP runner, driven through three **hand-assembled plan files**. It took roughly eight
hours. Warwick's own benchmark for the same shop through the proven process is about five
minutes.

The measured cost of the CDP runner's actual implementation, taken from its code rather than
assumed: **~13s per item on the happy path, ~25–30s when `locate_product` falls back to
reference-search, plus ~1.5s between steps — 10 to 20 minutes of pure runner time for a
40-line shop, before any failure.**

Two things were also true and only became visible during that run:

1. **Nothing in the repository converts a resolved shopping list into a runner plan.**
   `step_id` appears in exactly nine files, all inside `browser-runner/`. Every plan tonight
   was written by hand. (`DEFECT-LEDGER.md` D-2026-08-03-12.)
2. **SOP-021's documented "bulk add" method was never runner code.** Its own tool names
   (`scroll_to`, `read_page`, `find`) are Claude-in-Chrome tools. It documented the
   *browser-driven* process — the real one — and the CDP runner never implemented it.
   (D-2026-08-03-17.)

So the build had been extending a slower, unproven mechanism while the proven one sat
documented in the SOP, misread as a specification for the thing being built. **That is the
error this ruling corrects.**

## What Sonnet in Claude for Chrome must do

The supervised process, as ruled:

1. Open the appropriate ASDA Regulars / Favourites view.
2. **Change the ASDA ordering to Brand A–Z.**
3. Follow the prepared execution packet **in that same order**.
4. Add known products **through Regulars or Favourites**.
5. Work through them rapidly and sequentially.
6. **Never free-search a known item.**
7. Free-search **only** a genuinely new item Warwick has approved.
8. Add the approved new product.
9. Click ASDA's **Favourite** control for that new product.
10. Capture its real ASDA product identity.
11. Stop at a **checkout-ready basket**.

### A correction about what the proven process actually was

Earlier documents describe a "Regulars tab bulk-checkbox, tick everything, one bulk *Add
selected to trolley*" method. **Warwick's ruling is that the proven process was fast ordered
traversal, not an assumed one-click bulk operation.** Do not document it as mass checkbox
selection unless evidence proves that was the action. The speed came from *ordering and
sequence*, not from a single bulk control.

This matters because a work order (WO-D) had been written to build "bulk add" as a
performance feature, on the strength of a description that may never have described a real
mechanism.

## Boundaries — unchanged, and unchanged by this ruling

Never book a delivery slot · never check out · never pay · never enter a password · never
auto-substitute. These are Warwick's gates and no change of runtime touches them.

Note the CDP runner enforces the substitution ban in three independent layers (no allowlisted
command; `substitut` in `guards.DENY_TARGET`; `forbidden.test.cjs` failing the build if the
token appears in executable source). **Sonnet in Chrome has no such mechanical enforcement** —
the boundary there is instruction and supervision, not code. That is a real, honest
difference between the two adapters and it must not be glossed over. It is recorded as an
open consideration below.

## Status of the custom CDP browser runner

`services/asdair/browser-runner/` is **not deleted and not condemned.** It is:

- **experimental** — retained, its tests kept green, its proofs kept;
- **not the live default** — it does not write Warwick's weekly basket;
- **not a blocker to Stage 1** — Stage 1 acceptance does not depend on it;
- **prohibited from further live-account testing** without fresh authority from Warwick.

Its genuine, evidenced strengths are worth keeping on the record because they may justify
revisiting it later: the single-writer lease with fencing, the atomic claim proven against
real Postgres with real concurrent processes, idempotent `step_id` replay, and the
three-layer forbidden-operation enforcement above. Its weaknesses are the ones this ruling
acts on: speed, the missing plan builder, and the fact that it was never the proven process.

## Consequences for the work-order programme

| Work order | Was | Now |
|---|---|---|
| **WO-C** — plan builder (resolved shop → browser-runner plan) | "largest functional gap", critical path | **OFF the live-runtime critical path.** Superseded in purpose by the Sonnet execution packet (§E of the ruling), which is a different artefact with a different consumer. |
| **WO-D** — bulk add via the Regulars grid | queued, needed a product decision | **CANCELLED as live-runtime work.** Rested on a description of the proven process that Warwick has now corrected. |

Neither is deleted from the ledger; both are marked superseded with the reason, so a fresh
instance sees a decision rather than a gap.

**What replaces them:** the **Sonnet Browser Execution Packet** — a durable, deterministic,
Brand A–Z ordered artefact produced by the product itself, stored in Postgres, exposed as
JSON, as a human-readable checklist, in the Cockpit, and to the Sonnet handoff. No Claude
session constructs it by hand. Schema:
`SONNET-BROWSER-EXECUTION-PACKET.schema.json`. Process: `CANONICAL-WEEKLY-SHOP-PROCESS.md`.

## Documents this correction reaches

Every one of these currently contains, or previously contained, a conflicting statement about
who drives the browser. Each must be amended to point here rather than left to contradict:

- `Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md`
- `Team Knowledge/SOPs/SOP-021a-asdair-live-execution-method.md`
- `Team/Asdair - Household Shopping Steward/AGENTS.md`
- the BUILD-015 Goal Contract
- `DURABILITY-CLOSEOUT-WORK-ORDERS.md`
- `ACTIVATION-DEFERRED.md` and any continuation record
- `services/asdair/browser-runner/README.md`
- `DEFECT-LEDGER.md` (D-2026-08-03-12, D-2026-08-03-17, D-2026-08-03-18)
- the decision ledger (WO-F)

**A fresh instance must not be left choosing between Sonnet, Larry and the CDP runner.**
The answer is Sonnet in Claude for Chrome. This file is why.

## Open considerations, recorded honestly rather than resolved

1. **No mechanical enforcement of the never-substitute / never-checkout boundary in the
   Sonnet adapter.** The CDP runner enforces it in code that cannot be talked around; the
   browser adapter relies on instruction. This is a genuine reduction in mechanical
   guarantee, accepted deliberately in exchange for a process that actually works at
   human speed. Worth revisiting if it ever bites.
2. **Sonnet in Claude for Chrome is not a headless, unattended runtime.** The standing rule
   that AsdAIr must run "independent of any Claude Code session" is satisfied in the sense
   that it no longer needs *Larry* — but it does need *a Sonnet browser session*. Whether
   that meets the intent of "fully automated" is Warwick's call, not a builder's, and it is
   not asserted here either way.
3. ~~**The evidence for the exact proven mechanism is thin.** `EXPERIMENT-RESULT.md` records
   that a bulk control *exists*; it does not record it being used successfully at scale. The
   ruling's "fast ordered traversal" description is Warwick's first-hand account and is
   treated as authoritative — but the repository does not independently corroborate it, and
   that gap should be closed by capturing evidence during the next real shop.~~

   > **⛔ CORRECTED 2026-08-09 — THIS PREMISE WAS FALSE. Warwick's ruling STANDS; its stated
   > evidential ground does not.**
   >
   > **The repository DID independently corroborate the mechanism, twice, and both artefacts were
   > committed before this ruling was written:**
   >
   > - `Team Knowledge/session-logs/2026/07/2026-07-27-19-03_larry_asdair-weekly-shop-browser-automated.md:29`
   >   — *"bulk-ticked all 25 and 'Add selected to trolley' in one go (£100 landed)"*. Git-tracked;
   >   first added in commit `db29c09`.
   > - `Builds/BUILD-015-.../DEFECT-LEDGER.md:356-362`, defect `D-2026-07-27-09` — *"Found:
   >   2026-07-27, live, during the real shop"*, describing *"the 25-item bulk tick"*. Git-tracked,
   >   **and sitting in this same build folder.**
   >
   > Established by Pax's commissioned read-only recovery audit,
   > [[Deliverables/2026-08-09-pax-browser-method-recovery-audit]] (2026-08-09), git-tracking
   > confirmed by execution. **The account was never uncorroborated first-hand testimony — the
   > corroboration was already here and was not found.** `WO-D` was cancelled on the stated ground
   > that there was *"nothing here to build"* because the description *"may never have described a
   > real mechanism"*. It did describe a real mechanism.
   >
   > **Complication, kept because it is the honest shape:** an earlier run records a 14-item bulk
   > add failing twice. **Bulk add is conditionally reliable, not simply reliable**, and the
   > out-of-stock diagnosis reconciles both observations. Anyone reviving this method inherits that
   > nuance, not a blanket guarantee.
   >
   > **Scope of this correction:** it changes the EVIDENTIAL RECORD only. The supervised-Sonnet
   > ruling remains the accepted route and **no browser work is reopened by this note** (Warwick,
   > 2026-08-09, ruling 3). Whether to revive, adapt or replace the historical method belongs to the
   > basket-writer seam, decided on Pax's §F evidence — not here, and not tonight.

4. **UNRESOLVED PRODUCT-METHOD DECISION, banked 2026-08-09 — Warwick's call, not a builder's.**
   The durable instructions forbid search-fallback for a known item (`BROWSER_METHOD:44`, the Drive
   AGENT doc rule 4 *"Sourcing is Favourites/Regulars only"*, and the START HERE README). **Two
   proven runs recovered real items exactly that way** — a hayfever product out of stock via
   Favourites but in stock via general search, and a missed sausage-roll line. **The durable rule
   and the proven practice genuinely disagree.** Pax deliberately took no side. Recorded once and
   not chased; it needs settling before a basket worker is built.
