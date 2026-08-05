# WO-2026-08-05-09 — WP-2E: TowerBot carries the real Codex/Larry QA exchange (W-4, gate S-4)

> **AMENDMENT 1, 2026-08-05.** Build delivered and accepted at `c2535c995609150627bb3a3245257d3d8b287002` on `origin/build-020/wp-2e-qa-exchange` — that part of this order is DONE and unchanged below. **Larry then instructed integration into `build-020/live-trial` inside the ORIGINAL worktree/branch fields (`C:\Fusion247PKA-wo-2e` / `build-020/wp-2e-qa-exchange`) — outside the assignment.** Keel correctly `REFUSE`d: critical rule 2 forbids git outside the assigned worktree/branch, and a mid-task message cannot silently relocate the assignment. **This amendment is the correction — it explicitly authorises exactly one further action, the integration, in a named different worktree/branch, and nothing else.**
>
> **Integration authorisation, superseding worktree/branch below FOR THIS STEP ONLY:**
> - **worktree:** `C:\Fusion247PKA-build-020-trial` (the shared trial worktree)
> - **branch:** `build-020/live-trial` (target of the merge)
> - **source:** `build-020/wp-2e-qa-exchange` at `c2535c995609150627bb3a3245257d3d8b287002` (already pushed, unchanged)
> - **action authorised:** merge (fast-forward or merge commit; no rebase of already-pushed `wp-2e` history) `build-020/wp-2e-qa-exchange` into `build-020/live-trial`, re-run `services/control-plane/tower-loop/test/run-tower-loop-tests.mjs` and `.../test/notify.test.mjs` at the integrated head with executed counts pasted, push `build-020/live-trial` to `origin`.
> - **not authorised:** touching `main`, any other branch, force-push, branch deletion, or any further design change. Do not edit the map — Larry updates §14.19/§14.1 after receiving the integrated SHA.
> - **exclusivity:** Larry is not touching `C:\Fusion247PKA-build-020-trial` while you hold this step — you have exclusive git access to it until you report the integrated SHA back.
>
> Everything else in this Work Order (file_surface, private_surface, credential_scope, etc.) is unchanged and governed the build already delivered; it does not extend to this integration step beyond what is stated above.

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-09 |
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | Keel |
| **governance_head** | `8020615074cc15348b0858cfae7da4a456803388` (full SHA — current HEAD of `build-020/live-trial`) |
| **authorised_by / date** | Warwick, 2026-08-05 — map §14.0 **W-4**, gate **S-4** |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **§14.19 is the single live-frontier statement.** The design you are building against is **settled, not yours to redesign**, at **§14.7**. The gate you are aimed at is **§14.0c S-4**. Also read §14.0b (restart durability is explicitly NOT in scope — do not build or test for it) |
| **branch** | `build-020/wp-2e-qa-exchange` |
| **worktree** | **`C:\Fusion247PKA-wo-2e`** — new, cut from the governance head. **NOT the shared tree.** The live watcher (PID 31268, verified alive at dispatch time) runs from the **main** worktree on `build-015/live-acceptance-recovery-2026-08-03` — your change reaches it only at integration, exactly the caveat §14.0c already records for WP-2F's S-3. Do not claim S-4 live from your worktree; your acceptance evidence is executed tests, not a live watcher observation |
| **file_surface** | `services/control-plane/tower-loop/watcher.mjs` · `services/control-plane/tower-loop/findings.mjs` · `services/control-plane/tower-loop/postVerdict.mjs` · `services/control-plane/tower-loop/notify.mjs` · `services/control-plane/tower-loop/ingestComment.mjs` · `services/control-plane/tower-loop/pollPrComments.mjs` · their existing `test/**` counterparts · new test file(s) as needed inside `services/control-plane/tower-loop/test/` · `Deliverables/proofline/EVIDENCE-2026-08-05-wp-2e-qa-exchange.md` |
| **private_surface** | `none` |
| **credential_scope** | **none.** Do not read any file under `C:\.fusion247\**` (GL-012 — deny by default) and do not perform a live Telegram send. Prove W3/W4 through the **existing injected-transport test seam** `notify.mjs` is already tested with — same pattern as the rest of this service's test suite |
| **network** | none — tests only, no live calls |
| **live_authority** | `none` |
| **acceptance_property** | **Verbatim from §14.0c S-4:** the real Codex/Larry dialogue appears on TowerBot — Codex's **actual finding content**, Larry's **actual rationale prose** explaining how he is dealing with it, and **each subsequent exchange or disposition as a further turn**, all rendered from **one named durable source** (`tower.finding` / `tower.supervisor_review`) **after the write**. NOT satisfied by: a run notification · a mirror · a one-way post · a disposition enum without the rationale text · a single digest instead of an ongoing thread · a summarisation cap that clips the rationale |
| **veritas_gate** | Phase 2 gate (§14.0c) — contributes **S-4** |
| **integration_owner** | Larry |
| **document_impact** | the map — **owner: larry.** §14.19's "Delivered and integrated" row and §14.1's WP-2E row update once this integrates; §14.7's "Named as unestablished" items get closed or carried forward there, not silently dropped |
| **out_of_scope_policy** | report-only |
| **operational_handoff** | none |
| **dependency_policy** | no new runtime dependencies — this is a **wiring job against code that already exists** (§14.7), not a build |
| **blocking_dependencies** | none. WP-2F (canonical store), WP-2A (legacy removal) and WP-2B (Honcho render+install) are already integrated per §14.19 |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ the governance head |
| **contract_basis** | `services/control-plane/tower-loop/**` — implementation code, core Keel surface |
| **contract_conflicts** | not pre-judged — yours to state at read-back |
| **capability_evidence** | Keel delivered `WO-...-01`, `-02`, `-03`, `-05`, `-06` this session, including mutation-tested controls and injected-seam capture |
| **return_to** | Larry |

## What is already settled — do not redesign it

§14.7 is the outcome of an executed investigation, not a proposal. In particular:

- **The single canonical store is `tower.db`** — `tower.finding` as the exchange ledger, `tower.supervisor_review` as the immutable record it derives from. Not Postgres, not a new file, not a new convention.
- **No Telegram inbound feature.** Warwick was explicit: *"I did not ask to reply to TowerBot from Telegram."* GitHub/the PR is the control-and-disposition surface (where Larry posts, in the existing `@tower finding <id>: <disposition> — <why>` grammar, already parsed by `ingestComment.mjs`). Telegram/TowerBot is the **watch-only** surface. If your read-back finds a reason this is wrong, that is a `CLARIFY`, not a silent reversal — see WO-06 Amendment 2 for the standard this order expects.
- **The four wires, no new store, no new mechanism** (§14.7):
  - **W1** — after `supervisor_review` persists, loop `merge_review.qa.findings[]` and call the existing `openFinding()` (`watcher.mjs:254`, currently called only by the acceptance harness and tests, never by the live review path). **Must fail closed if the findings array is absent** — do not guess whether `merge_review.qa.findings[]` is schema-guaranteed; treat it as untrusted input.
  - **W2** — `composeVerdictComment` (`postVerdict.mjs`) lists the findings it already instructs the reader to reply about. Today it publishes an unfollowable instruction (no ids listed) — fix that.
  - **W3** — `notify.mjs` gains a third message part carrying finding ids and impacts. No transport change. **Check the existing summarisation cap against the rationale field before calling this done** — a cap that clips rationale text silently destroys the one thing Warwick asked for.
  - **W4** — Larry disposes by posting one PR comment in the existing grammar (no checkpoint marker, so no new Codex round fires). Telegram then echoes **the parsed, persisted disposition read back from the store** — not what Larry claimed in the comment. This read-back-after-write is the spine of the design: it is what makes this an exchange rather than a mirror. It must fire on **every** disposition event (an ongoing thread), not once per review.
- **What Telegram must show, exactly** (Warwick's own words, §14.7): (1) Codex's actual finding — id, impact, reachability, required disposition, evidence text, not a count or a verdict word; (2) Larry's actual `disposition_rationale` **prose**, not the `disposition` enum alone; (3) every subsequent turn — a re-disposition at a new head, a finding moving `remains_open` → `addressed` — each appears as a further message, not folded into one digest.

## Named as unestablished at design time — yours to close or carry forward, not to guess

- Whether `merge_review.qa.findings[]` is schema-guaranteed or model-dependent (observed populated 2/2 real reviews; validation path not read). **W1 fails closed on absence regardless of the answer.**
- Whether the live watcher (PID 31268) can still send Telegram at all (launched with no `--env-file`; last confirmed successful send 2026-08-02) — **this is a live-state question outside your credential_scope. Do not attempt to answer it by reading `C:\.fusion247\**` or sending live.** Name it as still open in your read-back if it matters to your design; Larry will verify it separately before integration.
- Finding-id mapping — Codex reuses short ids like `TQA-001` across reviews; `tower.finding.id` is a generated UUID. How Codex's reference maps to the id Warwick types back in a reply is an open design point **for you to settle inside W1**, and to state explicitly in your read-back and evidence file.
- Whether Veritas receipts should ever join this ledger — not investigated, not assumed, **not in scope for this order.**

## Explicitly out of scope — the regrowth cap

No new watcher, no new store, no new registry/validator/control-plane/enforcement-counter, no Telegram inbound/webhook/`getUpdates`, no restart/reboot/power-cut proof (§14.0b — withdrawn as a claim, not deferred). If your design starts to need any of these, that is the signal to stop and report, not to build it.

## Acceptance evidence expected

- Baseline `node --test` per touched file, in your own worktree, before and after — assert `# tests` and `# fail` counts explicitly, never the exit code (this service's `test` aggregate has been shown to hide subsystems before — check `package.json`'s `test` script actually reaches `tower-loop/test/**`).
- **A mutation proving the read-back-after-write claim is load-bearing** — e.g. make W4 render from the in-memory comment text instead of the store re-read, and show the test that catches it.
- **A test proving the truncation cap does not clip `disposition_rationale`** — a rationale string long enough to hit today's cap, asserted intact in the outgoing message.
- **A negative test for W1's fail-closed behaviour** — `merge_review.qa.findings` absent or malformed, assert no crash and no silent finding loss.
- `bash scripts/secret-scan.sh --surface <each declared path>` — `--surface` mode only.
- New/updated evidence written to `Deliverables/proofline/EVIDENCE-2026-08-05-wp-2e-qa-exchange.md`.

Read the settled design (§14.7) and the gate (§14.0c S-4) in full before your read-back. **Proceed if sound; one further read-back only if a material defect remains** (root `CLAUDE.md`). `export MSYS_NO_PATHCONV=1` before any Windows command. Git for your branch and worktree is yours to execute — you do not decide the merge.
