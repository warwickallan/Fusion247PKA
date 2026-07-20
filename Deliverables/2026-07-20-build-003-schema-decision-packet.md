# BUILD-003 — Schema Decision Packet (prep only; no decision made)

**Prepared overnight 2026-07-20 for Warwick's decision. No implementation, no recommendation — this packages the open questions + evidence so the decision can be made quickly.** Per the overnight boundary: BUILD-003 packet only.

## Status
- GitHub tracking issue **#17** "[IDEA-003][WP1] Schema decision and acceptance" — **OPEN, not yet authorised, no branch/PR exists.**
- Its stated blocking dependency (issue **#16**, synthetic/redacted engagement proof) is **now CLOSED/MERGED via PR #18** — so **#17 is unblocked to be authorised whenever you choose.**
- Canonical decision record: `Deliverables/2026-07-12-client-delivery-operational-schema-evaluation.md` §7.

## What BUILD-003 is deciding
The operational schema for `Client Delivery/` — which live NPL (first real engagement) entities to `retain / adapt / add / merge / reject`, and what needs a *second* real engagement's evidence before being schema'd (the GL-006 over-fitting discipline). The live decision surface is the "insufficient evidence" rows: **Actions, Milestones, Open Questions, Meeting Metadata, Entities, Write-and-Verification metadata.**

## The open questions (verbatim from the §7 record — YOUR call on each)
1. **Authorise or decline the §6 next proof** — add machine-checkable write/verification metadata (`created_by`, `review_status`, `reviewed_by`, `reviewed_date`) to Register Item, or as a standalone Write-and-Verification Log entity. Schema-only, tested against a synthetic engagement.
2. **Build the synthetic/redacted worked-example `Client Delivery/` engagement?** (`tsk-2026-07-11-002`'s confirmed merge blocker). The §6 proof depends on this existing first.
3. **Schema Actions / Milestones / Open Questions / Config Changes / Write-and-Verification now, or wait for a second real engagement's evidence?** (§5 recommendation vs schema-now on NPL alone — the over-fitting trade-off.)
4. **Ever build a `Client Delivery/` SQLite mirror?** If so, shared `mypka.db` or its own file?
5. **Foundry's six-WP sequencing — informative background, or discarded?**
6. *(Settled — laptop-first; phone access is a non-requirement. Not a live decision.)*
7. **How (not whether) to enrich the per-engagement GL-006 Sources register** with stable-ID / acquisition-hash / processing / meeting-event metadata **without creating a duplicate SSOT** against the GL-011 global register.

## Dependency structure (for sequencing your decisions)
- **Decision 2 (synthetic engagement) gates decisions 1, 3, and 7** — the §6 proof + the register enrichment both need the synthetic engagement to exist to test against.
- Decisions 4 and 5 are independent.
- So the natural first decision is **#2** (build the synthetic engagement y/n); the rest follow from it.

## What is NOT in scope here
No schema is written. No entity is classified. No mirror is built. Authorising issue #17 + any of the above is a Warwick decision — this packet only assembles it. Once you decide, the implementation still carries its own build + independent-review + merge gates.
