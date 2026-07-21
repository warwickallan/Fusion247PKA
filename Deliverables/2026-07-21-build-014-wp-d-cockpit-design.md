# BUILD-014 WP-D — Live Cockpit Design + Honest GO/KILL Framework

_2026-07-21, overnight. The scoped cockpit Warwick asked for: projects/builds · tower interactions · HUD · shopper. Live where real data exists, honest where it doesn't. No Fable. Increment-2 write-back is being built in parallel by Silas._

## Data reality (checked, not assumed)
Live DEV control-plane (`tower` schema, what the watcher actually writes): **36 turns · 36 supervisor_reviews · 35 notifications · findings · watcher_heartbeat.** The campaign's `ops` schema (builds/PRs/checkpoints/acceptance) was **de-scoped and never applied** — so it does not exist as a queryable source.

| Cockpit surface | Real data source today | Status |
|---|---|---|
| **Tower interactions** | `tower.turn` + `supervisor_review` (now incl. Larry's excerpt, PR #53) + `notification` + `finding` | ✅ **LIVE** — real supervision timeline |
| **Shopper** | `asdair` schema (regulars, basket, next-week list) — but PRIVATE household data | 🔒 **Synthetic for the proof**; real only behind Vex-gated private auth |
| **HUD** | Aggregation over the above (open findings, pending ACTION_NEEDED, last N notifications, watcher health, budget band) | ✅ Buildable now |
| **Projects & Builds** | **No table exists** (ops de-scoped). Options: (a) surface GitHub PRs read-only, (b) a minimal `tower.build`/`build_head` table | ⚠️ **Honest gap** — needs a data source decision |

## The four surfaces (implementation-ready over the increment-1 harness)
1. **Tower interactions** — chronological turn feed: seq, state, 🗣 Larry excerpt, 🤖 Codex verdict + next_action, warwick_needed, merge-class QA, deep-link to the GitHub PR/commit. This is the "see both sides of the dialogue" board — the live version of what now shows on TowerBot.
2. **HUD** — one glance: current watcher health (heartbeat age + PID), # open findings, # turns awaiting Warwick (ACTION_NEEDED), last 5 notifications, and (shopper) current basket total vs the £120–150 band.
3. **Shopper** — regulars/favourites list + current basket + self-building next-week draft, with the **check/uncheck write-back** (Silas, increment-2) and a **safe command_request** control (e.g. "rebuild next-week draft") executed by the trusted worker, not Directus. Synthetic data for the proof.
4. **Projects & Builds** — pending the data-source decision above; simplest honest first cut = read-only GitHub PR list + link to the tower review per PR. A `tower.build` table is the fuller answer but is new scope.

## The trust seam (why this is Directus-justified, not just a dashboard)
Directus is a **read + constrained-write control surface**, never the runtime. It writes only: (a) the one check/uncheck field, (b) a `command_request` INTENT row. A separate least-privileged **worker** executes commands and writes receipts. This is the write-back that the records-architecture research said is the *only* thing that justifies Directus over Metabase — so the proof stands or falls on it.

## Access
Localhost-bound during the proof. Phone access via the already-approved **Tailscale serve** path — but ONLY after Vex clears the seam the research flagged: `tailscale serve` proxies to loopback, and the cockpit's loopback-`Host` PIN convenience could bypass the PIN for private data. **Hard gate: a PIN is mandatory off-loopback + AsdAIr routes require a real session unconditionally, Vex-verified, before any real data is reachable off-localhost.**

## Honest GO/KILL framework (the required Phase-0 outcome)
Decide GO (adopt Directus for the cockpit) vs KILL (fall back to Supabase Studio + Metabase for read, per the research) on evidence, not vibes:
1. **Setup/maintenance cost** — how much bespoke glue did the proof need (non-`public` schema friction? second auth layer?).
2. **Write-back value** — did check/uncheck + command_request genuinely work through the trust seam, and is that worth Directus's overhead vs a tiny bespoke form?
3. **Auth duplication risk** — is having Directus permissions + Postgres roles two-places-to-get-authz-wrong acceptable, or a liability?
4. **Phone usability** — did it actually reduce Warwick's effort on a phone browser?
5. **The alternative** — would Metabase (read) + a 1-page bespoke write form be lower-friction for the same outcome?
### GO/KILL verdict (evidence-based — Warwick's call, my recommendation)
Increment-2 ran. Evidence:
- **Write-back works** — the check/uncheck + command_request trust seam is built, proven (33 assertions + outage test), and **Vex-GREEN** on the authorization boundary.
- **BUT at real cost, exactly as your research warned.** Least-privilege had to be enforced at the **Postgres** layer with bespoke roles/grants/triggers — Directus's own app-layer policies were **not** sufficient (Vex L2: the read-denials are app-layer-only, a defense-in-depth gap). That is the research's "two places to get authz wrong" caution, **confirmed in practice.** The stack is also heavy for a personal cockpit (native Postgres cluster + Directus 11 + two DB roles + a worker).
- **Phone access — the whole "any device" point — is blocked regardless of tool** by **CRIT-1** (a real loopback-PIN bypass in the *existing* `mypka-cockpit`) + gates G1–G8. That security debt is orthogonal to Directus-vs-Metabase.

**Recommendation (SPLIT, not a clean GO):**
- **Read dashboards (tower interactions · builds · HUD):** these are read-heavy — exactly where your research said **Metabase / Supabase Studio (or the existing `mypka-cockpit` web app) is lower-friction.** Directus's second auth layer buys nothing here.
- **Write-back (shopper check/uncheck · command_request · approve/reject):** this is the ONE place Directus genuinely beats a pure-BI tool — but a **small bespoke form on the existing cockpit** (already authenticated, already private-access-planned) may be even simpler than operating Directus.
- **Net:** the increment-2 seam is a valuable, reusable **pattern** (Directus-intent → trusted-worker-executes), whether or not Directus is the final UI. My honest lean: **KILL Directus-as-the-cockpit; keep the write-back trust-seam pattern; put read views on Metabase/the existing cockpit; do the shopper write-back as a small form.** But this is your architecture call — the proof gives you the evidence to make it, which was Phase 0's job.

**Whatever the choice: fix CRIT-1 + gates G1–G8 before ANY cockpit (Directus or not) reaches your phone with real data.**

## Honest status
Increment-1 harness = done (synthetic, localhost). Increment-2 write-back = building (Silas). Views/HUD = implementable on the harness once increment-2 lands. Live tower data = confirmed present. Projects/Builds data source = open decision. Phone-live with real data = Vex-gated. **This is NOT "Phase 0 complete" — it is the honest path to it.**
