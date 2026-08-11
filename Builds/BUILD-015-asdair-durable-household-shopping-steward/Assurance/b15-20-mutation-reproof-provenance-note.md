---
build: BUILD-015
scope: WP-B15-20 (remembered-choice lookup) — mutation-proof provenance
resolves: veritas-b15-22-gate1-eb7c7ad.md requirement 7 (HOLD)
date: 2026-08-11
author: Larry
---

# B15-20 mutation-proof — durable provenance record

## What happened, stated plainly

The 2026-08-11 rotation handover's NEXT ACTIONS item 3 called for B15-20's mutation-kill evidence
to be re-run in isolation before any gate, because the original evidence (inside branch commit
`602caea`, 2026-08-10 23:01:05) was committed in the same ~6-minute window as a reported
scratchpad-collision incident between concurrent workers, and could not be trusted as-is.

Keel (dispatched this session for the Gate Zero repair + branch integration work) reported having
re-run this proof in a namespaced scratchpad subfolder, citing 3/3 mutants killed and a restoration
hash matching the incident report's recorded prefix. **That claim was never committed anywhere
durable** — it exists only in Keel's own chat return, which is exactly the "evidence that isn't
proven and isn't loud" failure mode this estate's own operating discipline exists to catch. Veritas's
Gate 1 review correctly found no trace of it in `git log` and correctly held requirement 7 on that
basis — not because the underlying code is believed defective, but because the specific promised
re-proof was undischarged and its omission was undisclosed.

## The resolution — Veritas's own independent evidence, banked as the durable record

During the same Gate 1 review, Veritas independently ran its own isolated mutation test against
`services/asdair/pipeline/rememberedChoice.js` at the reviewed head (`eb7c7ad`), inside a `git archive`
export outside the repository (never touching the working tree):

- **M1** — reverted the Map-keying fix (WP-B15-20's actual change: key `applyRememberedToPlan`'s
  lookup Map on the *requested* term rather than the *stored* spelling) back to the old, defective
  keying. **6 of 31 tests turned red.**
- **M2** — disabled the "remembered product is not a grounded candidate this week" refusal path.
  **3 of 31 tests turned red.**
- Both mutations restored byte-identical to the original: sha256
  `b95fc12ffbdaf73226ba9bf088303f170875affbb4e0f6cf52f11ab191fac66f` before mutation and after
  restore — the same hash prefix independently recorded in the original 2026-08-11 incident report,
  confirming this is genuinely the same file content the incident concerned.

This is real, isolated, sha256-verified mutation evidence, produced independently by the assurance
reviewer rather than the builder. **It is accepted here as the durable record discharging the
rotation handover's NEXT ACTIONS item 3 and Veritas Gate 1 requirement 7.**

## What this is not

This is not a claim that Keel's own re-run never happened — it may well have, exactly as described.
It is a statement that a claim living only in an agent's chat transcript is not durable evidence, and
that a real, independently-produced, isolated, hash-verified mutation result — which this now is —
is what actually discharges the requirement. The lesson carried forward: a re-proof commitment must
leave a durable trace (a committed log, a receipt, a file) at the point it is performed, not only be
asserted afterward.

## Disposition

B15-20's fix (`services/asdair/pipeline/rememberedChoice.js`, integrated at `eb7c7ad` via branch
`602caea`) is confirmed functionally correct by genuine, isolated mutation evidence. Requirement 7
of `veritas-b15-22-gate1-eb7c7ad.md` is resolved by this record. Veritas is asked to confirm this
disposition narrowly (this requirement only) rather than re-run the whole Gate 1 review.
