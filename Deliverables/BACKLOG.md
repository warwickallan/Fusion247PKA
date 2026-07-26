# Fusion247 — Backlog (feature requests + bugs)

The single place we park things so they don't derail the current build. Larry logs here rather than
chasing a tangent mid-flow (see the "challenge context-diluting requests" rule). Newest first.

## 🐛 Bugs
- **[HIGH] Live YouTube capture still says "knowledge note pending — I'll write it next session" (manual).**
  Reported 2026-07-25 (Warwick sent a YT vid, no card/learn happened). The automatic Cairn → learn-worker →
  §7.1 → LightRAG → graph pipeline EXISTS (IDEA-007) but is NOT wired into the live capture bot / not running
  as a daemon, so a captured video sits un-learned until a session runs the worker by hand. This is a real
  gap, not by design. Fix: wire "Save to Brain" (or auto) → enqueue a Cairn LEARN job → run the learn-worker
  as a live daemon (with the enrich step). Separate from the cockpit build.
- **[LOW] `runtime.json` holds the OLD Directus admin password after Warwick changed it in the UI.** Harmless
  (Directus only uses ADMIN_PASSWORD to create the admin, which already exists), but stale — refresh it if any
  re-provisioning tooling ever needs the admin password again.

## 💡 Feature requests / ideas
- **Backlog surface in the cockpit.** Once the cockpit's mature, surface this backlog as a cockpit area (or an
  Attention/Output feed) so feature-requests/bugs are captured + triaged from the phone, not a markdown file.
- **A "Save to Brain" tap that genuinely triggers the auto-learn** (ties to the bug above) — the button exists
  on the capture card; make it drive the live learn pipeline end-to-end.

## 🔨 Cockpit (IDEA-016) — remaining after the Brain slice
- Shopping projector → Attention (mum's shopping: alternatives-awaiting-choice, budget flags) — DONE-criterion #3.
- Builds/System live projections (replace the hand-curated Home/overall_state tables) — DONE-criterion #1 (full).
- Telegram notification loop: durable outbox → consequential notification → deep-link into the exact cockpit
  item → act → receipt — DONE-criterion #5.
- CareerAIr plug-in proof (sidebar route + one projector) — DONE-criterion #7.

## 🔨 Shopping actions (next focused pass — mutates live household data)
- Wire the governed choose/approve buttons for shopping decisions (choose_alternative, accept needs-decision
  item, approve over-budget) via the asdair command_request seam + a new allowlisted command in the asdair
  worker. Deliberately NOT done at the tail of a long session because it MUTATES live household shopping data —
  do it in a focused pass with proof-first. Shopping is already VISIBLE in the cockpit (read-only projection).

## 💡 Cockpit UX (from Grok's cold-read of the screenshots, 2026-07-25)
- **Outputs cards read passive.** The "so what" cards state an observation but don't carry a clear next
  action or a strong "this matters because…". Give each output a recommended next step or a sharper stakes line.
- **A "parked / later" state for Build-lane questions** so architectural decisions never sit in the same
  urgency lane as "we're about to run out of toothpaste". (Life/Build lanes are the first cut of this; a real
  defer state is the next.) Ties to notify_policy.
- DONE in this pass: killed duplicate shopping cards (one decisive card per item, swap folded in); split
  Attention into Life vs Build lanes (blockers stay loud on top).
- The metric that matters (Grok): "how often do you clear the Attention list in under two minutes?" — worth
  instrumenting once actions are wired.
