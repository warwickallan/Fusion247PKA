# CareerAIR (BUILD-016) — durable state recovered from the record, 2026-08-14

**RAW RECONNAISSANCE, BANKED. READ-ONLY pass; nothing was changed.** Commissioned so the next CareerAIR
session starts from established truth rather than chat. **This is NOT a Wayfinder** — Warwick paused that
to reconcile the estate first. **Do not treat this as directive.**

## Two structural facts that shape everything

**CareerAIR has almost no presence in the public repo** — 7 documents under `Deliverables/` plus a session
log. **No `Builds/BUILD-016*`, no `services/careerair/`.** The product lives entirely at
`C:\.fusion247\private\careerair\`.

**🔴 THAT PRIVATE TREE IS NOT A GIT REPOSITORY.** `git rev-parse --is-inside-work-tree` there returns
`fatal: not a git repository`. No commits, no remote, no history. **Measured against this estate's own
definition — *"DURABLE means canonical, remotely recoverable"* — the entire CareerAIR codebase,
migrations, contracts, canonical career source and build record are NOT durable.** Recorded as a state
fact for Warwick's decision, not actioned.

**Three broken pointers**, each naming a repo path that does not exist: the specialist contract (claimed
`Team/CareerAIR…/AGENTS.md`, actually `private/careerair/specialist/AGENTS.md`) · the build record
(claimed `Builds/BUILD-016…`, actually `private/careerair/build-record/`) · the contracts (claimed
`services/careerair/`, actually `private/careerair/contracts/`).

## The goal — verbatim

> Given a genuine opportunity from Warwick, CareerAIR materially reduces the effort required to decide
> whether to apply and, where he should proceed, produces a high-quality evidence-grounded tailored
> application package that is ready to send.

> The product's economic purpose is **not** "produce a CV". It is to materially reduce the effort of
> deciding whether to apply… A generator that drafts for everything has thrown that purpose away.

**It builds a ready-to-send package and STOPS.** *"Submitting is this product's checkout… A bad shopping
basket costs a few pounds; a bad application costs a shot at a job."*

## Live right now — executed 2026-08-14

```
[cockpit] :8090  UP    [api] :8791 UP    [asdair] :8710 UP    [email] :8787 UP    [bot] UP
```

**⭐ The supervisor that now runs AsdAIr is CareerAIR's** — `private/careerair/scripts/ensure-local-services.mjs`,
task `MyPKA-Local-Services-Live`. Three of its five services are CareerAIR's.

**The processor is automatic and succeeding; the collector is automatic and FAILING.**
`CareerAIR-Email-{0800,1200,1700}` all exit `0` — **but exit 0 includes "nothing to do", and queue depth is 0.
It is succeeding at processing nothing.** `CareerAIR-Graph-Collect` returns `LastTaskResult = 2`.

**`runtime/ops/state.json`, written 2026-08-14T18:50:02Z:**
`collector_state: "down"` · `last_error: "CAREERAIR_GRAPH_CLIENT_ID not set…"` · incident
`graph_auth_required` open since **2026-08-07**, **muted**, **`suppressed_alert_count: 757`**.

## Proven by execution (capability, never completed automation)

Zapier-MCP intake on 4 real messages (persist-before-ack, dedupe, no-dupe-on-restart, deny-by-default) ·
DOCX generate/validate/render, 4 of 5 stages · Google Doc comment loop · requirement-set determinism
closing a real fit-score drift on the 7/10 threshold · Scout LinkedIn detecting a real sign-in wall and
pausing · **24 migrations**.

## ⛔ NOT proven — the North Star journey itself

**No record exists of Phase 1's own bar being met** — *"One real job completing the whole journey, from
intake to a downloadable tailored CV."* `AC-01`…`AC-13` have a proof plan and **no recorded results**.
`careerair.requirement_set` is **empty on live data**. **Stated as absence of evidence.**

## Broken / held

**The provider contradiction, three-way and unresolved:** `config/source-providers.json` says Graph ACTIVE ·
`runtime/ops/state.json` says `zapier_webhook` · the authorised route is **Zapier MCP only, Graph
explicitly not authorised**.

**BACKLOG C-10** — descoped by Warwick 2026-08-06, *"we will come back to CareerAIR"*. Veritas Gate 1
**FAIL** at `0cf70c9` because **the capability is absent, not the evidence**: a headless `claude -p` gets
NO-MCP-TOOLS. **Five banked findings must not be re-derived**, including 🔍 **the silent-zero trap** —
Zapier's folder picker lists top-level folders only, so `CareerAIR` reads `totalItemCount: 0` while its
child folders hold **160 messages**; a collector built on it reports success and collects nothing forever.

**`HELD-ITEMS.md` — untouched for 16 days.** A reply to a notification card cannot be resolved after a
restart (in-memory reply index) · two-thirds of the bot's notification surface has nothing to fire from ·
**the acceptance blocker is with Warwick: the drafting layer echoes evidence bodies rather than composing
prose** · Scout needs a one-time LinkedIn sign-in · the reboot path is unproven.

**⚠️ `contracts/LIVING-PLAN.md` is STALE (2026-07-29) and will misdirect a fresh reader** — its "next
action: Outcome D" is work its own body records as 4/5 proven. **Do not adopt it as the frontier.**

## The frontier — and the honest answer

**The record does NOT ground an implementation next action. None was invented.**

The only forward-pointing statement is **a Warwick decision, not a task** — C-10: *"reclassify as manual ·
authorise Graph consent · fund a paid trigger. **Not decided.**"* All three are mutually exclusive and two
cost money or consent he has not given.

**Phase 1's completion state is UNMEASURED.** Outcomes A–H and `AC-01`–`AC-13` have no recorded status.
**A Wayfinder written now would record a frontier nobody has measured** — so the grounded first step is
reconnaissance completing what this pass could not.

**No CareerAIR development activity for 8 days.** Last CareerAIR commit `bd11f96`, 2026-08-06.

## ⛔ Proofline contamination — flagged, not resolved

`2026-08-04-proofline-wayfinder-plan.md` is **3,350 lines**, named Proofline, and its body is the
**BUILD-020 Phase 4** Wayfinder. CareerAIR content is confined to Amendments 3 and 4, the private-surface
declaration, package block B, **struck** row 3, and **mixed** row 4. **Row 4 is genuinely ambiguous** — a
Cockpit acceptance requirement whose subject is CareerAIR's operational view, still carrying an open
residual. **Not decided here.** Row 3's *evidence* is safely reusable (duplicated into C-10); its
*acceptance journey text* is descoped Proofline scope and **must not** be lifted into a CareerAIR
Wayfinder as current acceptance — that is the masquerade Warwick prohibited.

## Private surface boundary

**`C:\.fusion247\private\careerair\**` — never the root, never a sibling.** Access means read **and**
write. **Credential material stays forbidden inside it.** The split: *"Git contains the machine. Git does
not contain Warwick's career activity"* — no employer, vacancy, salary, recruiter, application state or CV
content, **including in a branch name or commit subject**.

## Four unreconciled disagreements

1. **Active provider** — three sources, three answers.
2. **Contract location** — three documents point into the repo; the artefacts are private.
3. **Mailbox reading** — a Phase 1 *non-goal* per the programme, yet the whole 2026-08-06 programme.
4. **Implementation status** — "in progress" vs "activation: not yet" vs a running processing system.
