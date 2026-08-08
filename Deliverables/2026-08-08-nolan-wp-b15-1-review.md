# Nolan Step-4 bounded review — proposed WP-B15-1

**Nolan, 2026-08-08. Commission: Warwick-authorised "Asdair Build 001" §8 Step 4. Governance head
`2cefbd8`, branch `build-015/grounded-recognition`, worktree read-only. Artefact under review:
[[Deliverables/2026-08-08-b15-proposed-aswp-01]]. Grounding read, not re-audited: Pax's Step-2
brief, the bootstrap evidence (with its in-place correction), Wayfinder §10. Source claims that
carry the WP were checked at the worktree head (`pipeline/runPipeline.js`, `pipeline/commands.js`,
`pipeline/stages.js`, `pipeline/telegramAdapter.js`, `pipeline/deps.js`,
`bot/callbackProtocol.js`, `db/`). I did not redesign, propose alternatives, or reopen Pax's
findings.**

## VERDICT: CLEAR-WITH-OBSERVATIONS — no blocker

Nothing in this WP makes execution unsafe, false-evidenced, or duplicative of existing
authority. Two observations are sharp enough that the implementer must see them before Work
Order drafting (checks 2 and 5); the rest are ordinary.

---

## Check 1 — Accidental complexity: CLEAR

The self-healing card needs no new machinery, and I verified that at source rather than taking
the WP's word: the exact once-per-shop, full-history-guarded outbox pattern the WP names already
carries the receipt card and the "reading your list" progress card
(`runPipeline.js:774–813`, `store.outboxEverQueued`), queued as a side-effect alongside a pass —
precisely the shape a card at the `wait:interpretation_confirmation` park requires. The command,
latch, gate and replan all exist (`commands.js:203`, `commandNames.js:68` LATCH,
`stages.js:306–318`, `runPipeline.js:435–436`). The WP adds one outbox kind, one card render,
one adapter mapping, one intake fingerprint capture, one migration. Proportionate. A further
point in its favour: the chosen surface (Telegram, via the runtime poller) rides the ONE
launcher-backed live process; a Cockpit write path would have depended on the launcher-less,
manually-started cockpit-api — the named liability — as well as violating that surface's
read-only design.

## Check 2 — Duplicated authority: CLEAR-WITH-OBSERVATIONS

The WP creates no second home for state or semantics: it uses the existing `needs_review` flag
(sole writer at creation, `commands.js:145–148`), the existing `confirmInterpretation` latch, the
existing `planOutcome` gate, and the existing outbox. **But one hazard must be named before
implementation: the callback vocabulary ALREADY contains `confirm`** (`callbackProtocol.js:86`),
meaning "forward the ASDA order-confirmation email", and `telegramAdapter.js:140–143` maps it to
a deliberate refusal-prompt, pinned by `runtime.test.js:398`. Pax's correction sketch (d)2 —
"Add one `confirm` action to ACTIONS" — is stale on this point; followed literally it would
either collide or silently repurpose an existing reconcile-stage semantic (one tap word, two
meanings — the exact ambiguity class the "a glance is not an approval" design exists to
prevent). The WP itself never commits to the name, so this is not a blocker — but the Work
Order must pick a distinct action name, and note the frozen byte budget: any name longer than
10 bytes ("exceptions") forces `MAX_SHOP_REF_BYTES`/`MAX_ARG_BYTES` to shrink protocol-wide
(`callbackProtocol.js:22–37`). A ≤10-byte name avoids that entirely. Second observation: the
migration-numbering wording — see the commissioned flag below.

## Check 3 — Proofline cargo-culting: CLEAR

The acceptance bar's substance — real production event through the live poller, kill/revive
proof of the once-only re-queue, "code committed and tested is not completion" — is the
constitutional § "Nothing may live only in Larry's head" clause plus the durable-means-proven
rule, both estate-wide law that AsdAIr genuinely needs here (shop 6's recovery IS the
self-healing property; proving it by kill/revive is proving the product, not ritual). The one
BUILD-020-scented token is the "(CAPAE bar applies)" label in the acceptance heading; its
content is identical to the constitutional clause already cited, so it imports a name, not
machinery. Harmless; the Work Order can carry the constitutional citation alone.

## Check 4 — Framework regrowth: CLEAR

No registry, validator, supervisor or control-plane smell anywhere, including the acceptance
section — which is where regrowth usually hides. The fingerprint is a column on the existing
shop row plus a hash at intake, not a fingerprint subsystem; the card rides the existing outbox;
the confirm rides the existing command dispatch; "any new supervisor, registry or control plane"
is explicitly excluded. The severable item 3 ports EXISTING validation logic
(`interpret-list.js resolve()`) rather than building a validation framework.

## Check 5 — Evidence proves the visible outcome: CLEAR-WITH-OBSERVATIONS

Acceptance row 1 is the visible outcome verbatim — live poller, real Telegram tap, plan-ready,
zero Larry, shop 6 recovered with no manual insert — and cannot pass as a manual invocation.
Two observations so it cannot quietly degrade in the Work Order:

1. **Wrong-week visibility (row 2).** The criterion is well-worded — "cannot be confirmed
   without the mismatch being VISIBLE on the card" — but the named render fields (received
   timestamp + fingerprint prefix + line counts) do not by themselves satisfy it: a re-sent July
   photograph arrives with THIS week's received timestamp, and a raw hash prefix is not
   human-readable evidence of anything unless compared against something. What makes the
   mismatch visible is the comparison the fingerprint enables — e.g. "identical to the
   photograph of SHOP-YYYY-MM-DD". The criterion as written would honestly FAIL a
   hash-prefix-only card, which is correct gating; the implementer just must not believe the
   field list alone meets row 2.
2. **"Every physical line represented" (row 3).** No independent physical-line count exists
   anywhere (Pax surface 8: only the model's own count is recorded), and this WP does not
   create one. The criterion is therefore verified by HUMAN comparison of card against
   photograph during the acceptance run — which is fine and is exactly what the confirmation
   gate is for — but the card and the evidence record must not present the model's own line
   count as an independent check, and acceptance must record it as human-verified.

## Check 6 — Unnecessary Cockpit/platform work: CLEAR

"No new service, no new framework, no Cockpit change" is stated in scope and repeated in the
exclusions, and the design honours it: the confirm surface deliberately avoids the read-only
Cockpit proxies and the wp-d-proof Directus UI. Nothing platform-shaped is touched.

---

## The two commissioned flags (observations, not redesign)

**Severable item 3 (candidate-evidence retention): OUT of this WP, on complexity grounds.** It
touches a different seam (the `deps.js:178–182` strip, `resolveAll` precedence, `shop_line`
persistence — likely its own schema change), its outcome is question-quality improvement rather
than journey-unblocking, and the WP's visible outcome is fully provable without it. Bundling it
makes the single acceptance event ambiguous: a defect in evidence-carry could hold the
confirmation gate hostage. Severing keeps WP-B15-1 one migration, one surface, one visible
event. It is real work with the validation logic already written — it deserves its own slice,
next.

**Migration item: scoped ALMOST tightly enough — one word needs pinning.** "Numbering
reconciled against the three live-only tables" is right to acknowledge the debt but ambiguous:
read generously it means "pick a number that cannot collide with anything live-applied"; read
expansively it means repatriating `command_request` / `previously_ordered` / `skill_steps` into
the repo — a debt-payoff project this WP does not need and should not absorb. The repo's own
`db/` numbering already has gaps (002, 003, 011 absent; 015 authored for the never-applied
packet chain), so the Work Order should say: number the new migration provably past every
live-applied and every in-repo-authored migration, record the standing debt once, repatriate
nothing here. The "applied live only under Warwick's explicit authority" clause is exactly
right and stays.

---

## Bottom line for Warwick's Step-5 decision

**CLEAR-WITH-OBSERVATIONS. Recommend: approve WP-B15-1 with item 3 severed out, the migration
wording pinned to "number past the debt, repatriate nothing", and the Work Order carrying the
two named implementation hazards (distinct ≤10-byte confirm action name — not `confirm`; the
wrong-week card must render a human-readable prior-photograph comparison, not a bare hash).**
The WP targets the execution-verified earliest break, stays inside existing patterns, and its
acceptance is written so that only the real visible event can discharge it. Nothing here is
unsafe, false-evidenced, or a second home for existing authority.
