---
agent_id: larry
session_id: wp0-merge-and-wp1-overnight-build
timestamp: 2026-07-17T05:05:00Z
type: proactive
linked_sops:
  - SOP-019-fusion-delivery-tracking
  - SOP-004-vex-security-audit
linked_workstreams: []
linked_guidelines: []
linked_tasks: []
runtime_host: Claude Code (Warwick's dev machine, overnight authority)
---

# BUILD-002: WP0 merged (9d59d7c); WP1 Always-On Cloud Intake built, proven and Vex-reviewed overnight

_Overnight execution under Warwick's written authority ("OVERNIGHT AUTHORITY", 2026-07-17 ~02:30): fix CI → merge PR #29 when green → minimal tidy → build WP1 on a fresh branch, no live cutover, PR left unmerged, morning checkpoint._

## CI fix → merge (WP0 closure)

- **Mack diagnosed BOTH eras of the integration-CI failure** with a local throwaway Postgres (scoop): (1) a latent fresh-cluster **role-creation race in migration 0003** (check-then-act on the cluster-shared catalog; two parallel test DBs; ~1-in-4 on virgin clusters — exonerates the earlier green run as genuinely green); (2) tonight's **mock message-id collision** (module-level counter fix; real Telegram cannot collide). Nothing weakened. Commit `93b32b1`: 185/185 with real Postgres, five consecutive virgin-cluster runs, 200 forced race rounds clean.
- CI green on the exact head (unit + postgres:16 integration + secret-scan, push and PR runs) → **merged PR #29 → main `9d59d7c`** per the authority's conditions. One rehearsed conflict (0001 → branch version incl. `dead_letter`); both sides' test guards and both `.gitignore` protections survived. Merged-main suite 186/172/0; main CI re-verified green. WP0 records flipped in ClickUp (00.1/01.1/03).

## WP1 — Always-On Cloud Intake Foundation (branch `build-002/wp1-cloud-intake-foundation`)

- **Pax** (research, cited): webhook auth via `X-Telegram-Bot-Api-Secret-Token`; `setWebhook` disables `getUpdates` (409) → live bot stays on polling, proof is synthetic/throwaway-bot; node-postgres DSN `sslmode=require` silently skips CA validation (the WP0 posture's true mechanism); CA download URL drift; Edge reliability fine at our scale, no queue product needed.
- **Silas** (design pack, implementation-ready): edge sends the card itself + persists `card_ref` in the WP0 shape → waking worker re-targets with zero claim-loop changes; two-layer dedup (`(channel, update_id)` transport ledger + capture idempotency); three locked-down SECURITY DEFINER RPCs (`search_path=''`, service-credential-only EXECUTE) keeping `fcg` non-exposed and DB passwords out of the edge env; cloud tap-confirm = exact twin of the local fail-closed token (`accepted → offline_queued` only); allowlist inside the RPC (strangers leave zero rows).
- **Mack** (build, 6 commits `10881c5..9c69cfb`): migration 0006 + 9 static guards; edge function (thin Deno shell over a pure portable handler; golden-vector byte-parity Node↔Deno-port = the cross-transport dedup guarantee); worker unchanged (I1–I10 test-enforced); **FU-1** pinned pooler CA + `verify-full` (`pgSslConfig.js`, DSN-trap neutralised); **FU-2** doc drift fixed + CI grep-gate; **FU-4** single redaction impl incl. fatal path; safe-cutover doc (incl. the allowlist-seed `DO UPDATE` gotcha); synthetic proof E2E-1…6 ALL PASS. Suite: **255 tests — 223/0-fail no-DB; 255/255 with real Postgres 0001→0006.**
- **Vex** (WP1 delta review, commit `7179e3c`): **GREEN-WITH-CONDITIONS** — 0 CRIT/HIGH/MED, 3 LOW, 5 INFO. Explicit gate calls: 0006 live apply YES (with §3.2 post-apply verification), edge deploy YES (after apply + fresh secrets, bot B only), PR open YES, **worker FU-1 restart YES-now**. Both flagged 0006 constructs adjudicated ACCEPTED; constant-time compare verified; no setWebhook capability in committed code. L-1 (TOFU CA cross-check vs dashboard) is the one real outstanding condition.

## Live actions taken tonight (and NOT taken)

- **Done:** FU-3 closed (`C:\.fusion247` ACL → owner/SYSTEM/Administrators); FU-1 live switch executed on Vex's explicit go — worker restarted on the WP1 build with `DATABASE_SSL_CA_FILE`, post-restart probe `cert_verified_by_client: true`, capture service continuous all night.
- **Deliberately NOT done (morning-gated):** 0006 apply to the live project; edge function deploy; any `setWebhook`; WP1 PR merge. The live bot never left long polling.

## Open threads (morning)

- [ ] Warwick: open the WP1 PR (branch pushed; body drafted in session scratchpad `wp1-pr-body.md`) — gh is unauthenticated on this machine.
- [ ] Warwick: CA cross-check (Vex L-1) — dashboard SSL cert fingerprint vs `certs/supabase-pooler-ca.pem` header; mismatch = stop-everything incident.
- [ ] Warwick: FU-5 security-contact choice; WP1 PR review + merge decision.
- [ ] Gated when ready: 0006 live apply (+ §3.2 verification + §3.3 seed upsert), then edge deploy per cutover doc (fresh webhook secret, bot B).
- [ ] Vex LOWs L-2 (redactor regression test) and L-3 (auth-before-body-read hardening) — WP1-PR-review or WP2 scope.

## Cross-links

- [[2026-07-17-02-15_larry_build-002-wp0-live-proof-passed]] — the WP0 proof checkpoint this continues.
- [[2026-07-17-03-18_mack_wp1-cloud-intake-foundation-build]] — Mack's build log.
- Canonical: `Builds/BUILD-002-unified-personal-capture-gateway/` (Architecture wp1-*, Security wp1-delta-review-2026-07-17).
