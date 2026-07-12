---
agent_id: silas
session_id: idea-003-wp1-869e3mw1z-synthetic-engagement-proof
timestamp: 2026-07-12T19:30:00Z
type: end-of-session
linked_sops:
  - SOP-010-warden-extract-source-to-evidence-pack
  - SOP-011-warden-meeting-prep
  - SOP-012-warden-configuration-guide
  - SOP-013-warden-meeting-summary
  - SOP-014-warden-consultant-summary
linked_workstreams: []
linked_guidelines:
  - GL-006-client-delivery-frontmatter-conventions
  - GL-009-public-private-knowledge-boundary
  - GL-001-file-naming-conventions
---

# Built the synthetic "Meridian POS Modernisation" Client Delivery engagement — GL-006 validation proof (issue #16)

## Context

Dispatched by Larry per Warwick's explicit, narrow authorization ([[tsk-2026-07-12-002-synthetic-client-delivery-engagement-proof]], GitHub issue #16 only) to build the smallest useful, entirely synthetic `Client Delivery/` engagement to validate GL-006's actual schema and Warden's actual SOP-010 through SOP-014 against a worked example — the confirmed merge blocker `tsk-2026-07-11-002` has tracked since 2026-07-11, and the exact next proof [[2026-07-12-client-delivery-operational-schema-evaluation]] §6 recommended. This is a validation/evidence exercise only, not a schema-acceptance decision (issue #17, explicitly out of scope).

Read directly before writing anything: [[GL-006-client-delivery-frontmatter-conventions]] in full (folder map, all three entity schemas, Known gaps, Future extension candidates), and [[SOP-010-warden-extract-source-to-evidence-pack]] through [[SOP-014-warden-consultant-summary]].

## What we did

- Built one entirely synthetic engagement, **Meridian POS Modernisation** (fictional 40-store US retail chain, "Meridian Retail Group"; engagement code `MRG-POS-001`; prose mnemonic `MPM`), under `Client Delivery/meridian-pos-modernisation/`, following GL-006's folder map: `Project Control/` (Engagement note), `Sources (Immutable)/` (INDEX.md + 3 synthetic captured sources), `Evidence Packs/` (3 packs, one per source, per SOP-010), `Work Packages/` (catalogue + 3 Work Package entities), `Risk-Issue-Change-Decision Register/` (5 Register Items covering all four `kind` values).
- Created 5 supporting PKM/CRM entries (`meridian-retail-group` Organization; `elena-vasquez`, `marcus-webb`, `daniel-osei`, `priya-shah` People) so the Engagement's `client_org`/`client_contacts`/`linked_stakeholders`/`owner` fields and every Register Item's `owner`/`raised_by` resolve to real files rather than dangling — per Silas's own frontmatter-integrity audit doctrine (a foreign key should be resolvable, not a broken reference left for someone else to find). Flagged to Larry: this is a small, deliberate extension beyond `Client Delivery/` itself; not prohibited by the task's hard boundaries, but worth Larry/Warwick's awareness since the task's authorization language is scoped to `Client Delivery/`.
- Explicitly exercised, and documented in-file (see the four "workaround note" sections below), all four documented workarounds the task named plus the write-and-verification limitation. Every one of these notes lives in a body section GL-006 does not define a convention for — I did not invent any frontmatter field to hold them.
- Ran the required zero-real-data grep (`NPL|Bellrock|Concerto`, case-insensitive) across every file created. Two false-positive hits surfaced on the first pass — both disclaiming/contrasting prose ("this is not NPL," "not just NPL's earlier evidence"), not real data — and I rewrote both to avoid the literal strings entirely rather than argue they were "acceptable" hits. Second pass: zero hits, confirmed by grep exit code 1.
- Did not touch GL-006 itself, `SOP-002`, any SQLite file, or `Expansions/mypka-cockpit/`. Did not create, reference, or imply anything about a real NPL engagement. Did not decide or imply any schema-acceptance outcome (issue #17 untouched).

## Findings — what worked cleanly

- **Engagement, Work Package, and standard Register Item schema (risk/issue).** [[meridian-pos-modernisation]] (the Engagement note), [[meridian-pos-modernisation-wp-001-discovery]], and the `risk`/`issue` Register Items ([[meridian-pos-modernisation-reg-001]], [[meridian-pos-modernisation-reg-002]]) all built cleanly against GL-006's documented schema with zero friction. `linked_stakeholders` as a list-of-objects, the engagement-prefixed compound slug scheme, `source_ref`/`evidence_type`/`confidence`/`reread_flag`, and the terminal-status-stays-in-place archive doctrine all worked exactly as documented on the first attempt.
- **`evidence_type`/`confidence`/`reread_flag` genuinely earn their keep.** Walking GL-006's enum in order (per SOP-010 §4) rather than defaulting to `direct-statement` produced real, defensible distinctions across the five Register Items (`inference`, `demonstrated`, `agreed-decision`, `agreed-decision`, `unresolved-discussion`) — this is not a paper exercise; each classification changed what the item's reread_flag correctly became.
- **The source-tier/reread discipline held up under a real 3-source, 3-Evidence-Pack build.** SOP-010's "read once, extract, build the pack" flow, and its explicit trigger list for setting `reread_flag`, produced consistent results across three genuinely different source shapes (a workshop transcript-style note, a multi-message email thread, a short call-notes capture).

## Findings — what required a workaround, with concrete evidence

- **Actions ([[meridian-pos-modernisation-reg-004]]).** Mapped the actual follow-through action ("Daniel to notify Elena and the store team of the revised pilot timeline") onto this decision's `owner` + `target_resolution_date`, per SOP-010 §7's documented workaround. Concretely lost, demonstrated in the item's own body: (1) the same decision implied a *second* action (updating the pilot Work Package's own `target_date`) that had no home at all in the decision and had to be tracked as a manual, undocumented cross-reference; (2) no distinct status for "the action is done" versus "the decision is accepted" — the decision's `status: accepted` says nothing about whether Daniel has actually notified anyone; (3) no action-specific title — a query for "what does Daniel still need to do" would not surface this item by title; (4) `target_resolution_date` had to do double duty (decision-resolution date vs. action-due date), and I had to invent a stand-in date for the latter since the source names no exact deadline.
- **Milestones ([[meridian-pos-modernisation-wp-003-go-live-milestone]]).** No home at all in GL-006 today — confirmed directly against GL-006's own "Future extension candidates" list, which names Meeting Metadata, Action, Deliverables, Requirements, and Dependencies but never Milestones (the evaluation's own finding, now exercised concretely rather than left abstract). Forced this into a Work Package. Concretely lost: (1) `owner` means "accountable executor of scope" everywhere else in this schema, but a milestone has a *committer* (a shared steering-committee decision, not one person) — naming Daniel here silently misattributes a joint governance call as one person's deliverable; (2) `done_state` had to describe two separable facts at once ("decision made" and "decision communicated to all 40 stores") that could genuinely slip independently, per Elena's own request on the steering call; (3) no structured conditional/dependency logic — "go only if the pilot's stability run holds and the cutover-ownership question is resolved" lives in unenforced prose; (4) a cancelled milestone would be structurally indistinguishable from any other cancelled Work Package — there is no way to query "missed milestones" as their own category.
- **Open Questions ([[meridian-pos-modernisation-reg-005]]).** Used `evidence_type: unresolved-discussion` on a `kind: issue` item, per the documented workaround. Concretely lost: (1) this isn't really an "issue" in the same sense as a manifested defect ([[meridian-pos-modernisation-reg-002]]) — filing it as `kind: issue` dilutes what a future "open issues" filter actually returns; (2) no `parked_with`/`unblocked_by` fields — Elena's "I'll check internally" is functionally "parked with Elena's IT team," with no field to record that or query "which open questions are waiting on someone specific"; (3) no structured link back to the *first* time this exact question was raised (2026-04-10, recorded only in that source's Evidence Pack) — a genuine two-month gap between a question being raised in a meeting and it becoming a queryable Register Item at all, with nothing connecting the two occurrences except prose in two different Evidence Packs.
- **Configuration Changes ([[meridian-pos-modernisation-reg-003]]).** Used `kind: change`. Concretely lost: system/component (POS firmware, Zentra Systems, v3.1→v3.2), environment (Store #14's network segment, VLAN 40 — named explicitly in the source), change-window mechanics (applied to all six terminals on a specific date), and made-by/applied-by (Priya personally deployed it, distinct from `owner`) — none of these have a field; all of it lives in prose only, and a query like "every change touching VLAN 40" has nothing to run against. This corroborates the evaluation's `adapt` disposition for Config_Changes with a second, independent, synthetic data point.
- **Write-and-verification limitation ([[meridian-pos-modernisation-reg-002]]).** Concretely demonstrated, not just cited: Priya Shah both wrote this issue (diagnosed the defect, authored the extraction) and, four days later, marked it `resolved` after deploying her own fix — a textbook violation of Warden's Critical rule 8 ("writer never self-verifies"), and **nothing in this schema catches it**. I attempted adding `created_by`/`reviewed_by` to the frontmatter to at least gesture at the missing structure, then stopped and removed the attempt — adding ad-hoc keys here would itself be the exact violation (Silas's own rule, and this task's explicit boundary against editing GL-006) this proof exists to surface, not paper over. The only place left to record any of this is unstructured prose in a body section GL-006 does not define a convention for — which means, on a real fast-moving incident, this exact paragraph would almost certainly never get written, and the self-verification would go completely unnoticed.

## Genuine schema gaps this exercise evidenced beyond the paper evaluation

- The paper evaluation ([[2026-07-12-client-delivery-operational-schema-evaluation]]) reasoned about these five gaps from one real engagement's evidence (NPL) plus GL-006's own documented self-awareness. This exercise adds a **second, independent, synthetic data point** for all five, and the specific mechanics of the loss are not identical in every case — e.g. the Milestone "committer vs. owner" mismatch and the Action "one decision implying two actions" collision are concrete failure modes this synthetic engagement surfaced on its own, not restatements of anything the evaluation already named at that level of detail.
- The **two-month gap between a question first being raised in a meeting and it becoming a queryable Register Item at all** ([[meridian-pos-modernisation-reg-005]]'s history) is a genuinely new, concrete observation: GL-006's "Intake/staging" doctrine says a *source* is indexed at capture time, but nothing requires an *unresolved discussion inside a source* to produce any structured trace until someone happens to write a Register Item for it — meaning a real open question can sit invisible to any register-based query for an arbitrarily long time, evidenced here as two full months, purely because the workaround has no "parked/pending" holding state.

## Recommendation for issue #17 to weigh (not decided here)

- This proof adds real second-engagement evidence for four of the five previously "insufficient evidence" gaps (Actions, Milestones, Open Questions, Configuration Changes) and for the write-and-verification gap — but it is still evidence from one more engagement, both synthetic. Whether that clears GL-006's own stated "needs real second-engagement data" bar, or whether that bar specifically means *real* client data rather than a second worked example of any kind, is a judgment call for whoever runs issue #17, not something this proof resolves.
- The write-and-verification gap is the sharpest and most mechanically simple to close (four candidate fields, already named in GL-006 itself) — this proof shows the *mechanics* would populate cleanly (I could write the fields if they existed) without showing whether the fields alone would actually get *used* consistently in practice under time pressure, which is a different, harder question a schema addition can't answer by itself.
- The Milestone gap looks like the most structurally different requirement of the four — its "committer vs. owner" and "two-separable-facts-in-one-done_state" problems don't obviously fit inside a `kind` extension the way Actions might; issue #17 may want to treat Milestones as a genuinely separate design question rather than bundling it with the other three.
- The Configuration Change gap's fix looks the most mechanically simple of all four (add optional `system_environment`/`applied_by`-shaped fields scoped to `kind: change`, per the evaluation's own suggested pattern) — this proof's `reg-003` is a clean worked example issue #17 could point to directly if it wants one.

## Open threads

- [ ] Five PKM/CRM files (`meridian-retail-group.md` Organization; `elena-vasquez`, `marcus-webb`, `daniel-osei`, `priya-shah` People) were created outside `Client Delivery/` to keep foreign keys resolvable — Larry/Warwick may want to confirm this is acceptable scope, or have them removed if this synthetic proof is later torn down.
- [ ] If this synthetic engagement is retired later, the clean teardown set is: `Client Delivery/meridian-pos-modernisation/` (whole folder) plus the five PKM/CRM files named above — nothing else references them.
- [ ] Issue #17 (schema-acceptance decision) remains untouched and unauthorized by this session, as instructed.

## Next steps

- Larry/Warwick review this build against issue #16's success criteria, then decide whether/when to open issue #17 using this evidence.
- No further action from Silas pending that review.

## Cross-links

- [[2026-07-12-10-00_silas_client-delivery-schema-evaluation]] — the prior session log for the paper evaluation this proof tests.
- [[2026-07-12-09-00_larry_idea-003-governance-and-evaluation-scoping]] — governance context for IDEA-003.
