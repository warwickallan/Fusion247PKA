---
agent_id: larry
session_id: build-002-wp0-live-proof-passed
timestamp: 2026-07-17T02:15:00Z
type: proactive
linked_sops:
  - SOP-019-fusion-delivery-tracking
  - SOP-004-vex-security-audit
linked_workstreams: []
linked_guidelines: []
linked_tasks: []
runtime_host: Claude Code (Warwick's dev machine)
---

# BUILD-002 WP0 — live phone-visible acceptance proof PASSED (tap-gated); Vex live sign-off GREEN-WITH-CONDITIONS

_Checkpoint log written mid-session (Warwick asleep, session held open for a follow-on assignment). The full arc is also in the ClickUp BUILD doc (00.1 / 01.1 / 03) — this is the repo-side durable record._

## Context

Resumed on the dev machine — the exact environment the 2026-07-16 21:14 close-out log called for (Supabase MCP + open egress + local secrets). Warwick supplied the go signal and the runtime secrets over the evening.

## What happened, in order

1. **Drift reconciliation** (Warwick baseline-correction directive): this machine's earlier session had — unaware of PR #29 — independently fixed the 0001 enum/table collision on `main` (identical rename: `fcg.capture_processing_state`) and applied main's 0001–0002 to the live project. Reconciled: checked out `build-002/wp0-live-integration` (`b49f854`), dropped the empty drifted `fcg` schema, applied the branch chain **0001–0005 verbatim via MCP**, live-verified RLS/policies/anon-deny/`dead_letter`. The parallel duplicate Vex 0003 artifact was preserved out-of-tree, never committed or applied. Larry's earlier `sb_secret` request was wrong per the corrected credential model and was retracted; the env store was reduced to exactly `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `AUTHORISED_TELEGRAM_USER_ID`, `WORKER_ID`.
2. **Provisioning snags, all human-side, all fixed masked** (no secret values ever in chat/logs): template `YOUR_POOLER_HOST` in the DSN; missing `DATABASE_URL=` prefix; pg v8.22 strict-TLS vs the pooler's Supabase CA → `uselibpqcompat=true&sslmode=require`; a dashboard password reset whose button was never pressed. Bot token rotated twice; dead token verified rejected (401).
3. **First live captures** flowed end-to-end (message → durable Postgres → governed Markdown in `Team Inbox/captures/` → evidence → completed → phone card). Live use immediately surfaced: (a) the reviewed auto-capture design completes in <1s — buttons untappable by humans; (b) a **photo produced an empty capture falsely marked completed**; (c) Telegram auto-linked `.md` filenames as Moldovan URLs.
4. **Warwick decision (Option B, binding): tap-gated capture.** Mack implemented: hold at `accepted` until the Save-to-Brain callback (`confirmSave()`), non-text politely refused, receipt path as code span. Then live running exposed the **~45s residential NAT kill window** → 25s named poll constant, one-shot transport-only retry, bounded card-recovery sweep (rescued a stranded cardless capture on restart).
5. **False-alarm forensics:** a suspected tap-gate bypass on restart was disproven — cycle-scoped timestamps made Warwick's real 11-seconds-later tap read as a 2ms machine action. Fixed with per-step timestamps; hardening shipped anyway: store `enqueue()` is now **fail-closed** (`tap-gate violation` without the `confirmedByTap` token) + a restart-over-waiting-cards regression test.
6. **Final acceptance proof PASSED** on build `6c5cbea`: capture `f25c4641` ("Mac and Larry rock!") at 01:42 — waiting card → human tap → completed → file + evidence verified. Four captures total through the gate tonight; suite **185 tests / 171 pass / 14 env-gated skips / 0 fail**.
7. **GDPR erasure exercised live** on Warwick's instruction: four test captures erased (cascade verified 0 envelopes/queue/evidence/keys + files deleted).
8. **Vex live credential/transport sign-off: GREEN-WITH-CONDITIONS** (0 CRIT / 0 HIGH / 1 MED / 3 LOW / 3 INFO), with his own live TLS socket inspection and RLS probes. Report: `Builds/BUILD-002-unified-personal-capture-gateway/Security/wp0-live-signoff-2026-07-17.md` (commit `d65003a`). The MEDIUM = encrypted-but-unverified server cert via `uselibpqcompat`; **FU-1 (pin Supabase prod CA + `sslmode=verify-full`) is mandated before unattended operation / WP1 entry.** Other FUs: FU-2 DSN doc drift (SECURITY.md/README/.env.example still describe bare `sslmode=require` on the direct host); FU-3 restrict the machine-local secret-store folder ACL; FU-4 redact the runner's fatal-path log; FU-5 set the SECURITY.md security contact; carried F-08 + V-05. Vex methodology notes worth keeping: `pg_stat_ssl` shows `ssl=false` through the session pooler (that is the pooler→DB hop, NOT the client hop — only socket inspection answers the client-TLS question); his reusable masked probes live in the session scratchpad (`vex-live-signoff-check.mjs`, `vex-tls-probe.mjs`). V-07 closed: the resident worker's tree verified byte-identical to the committed head.

## Decisions recorded

- **Tap-gated capture is the WP0 UX contract** (Warwick, explicit). Auto-capture-on-text is dead; the tap is the authorisation, enforced fail-closed at the store.
- **Non-text is refused in WP0** — never an empty capture, never a false completion.
- `Team Inbox/captures/` is **gitignored** (personal captures vs public repo — found in the ship-shape sweep with live captures one `git add -A` from publication).
- Two interim 16-Jul commits on `main` (`787316f` enum fix — superseded by the branch's identical fix; `59e85b3` Supabase agent-skills pack, Vex-scanned GREEN) form the known merge-conflict surface for PR #29.

## Open threads

- [ ] **Warwick: push** `build-002/wp0-live-integration` (local `d65003a`; GitHub still at `b49f854` — outward push is human-gated; reviewers reading GitHub see a stale branch until then).
- [ ] **Warwick: PR #29 merge decision.**
- [ ] Mandated follow-ups FU-1…FU-5 (FU-1 hard-gates unattended operation).
- [ ] WP0 formal closure per SOP-019 after the above; ClickUp 02/02.1 delivery record finalises then.
- [ ] The live worker was left RUNNING on the proven build (captures remain live while the machine is up); `.claude/skills` junctions dangle on this branch (targets tracked only on `main`) — self-heals at merge.
- [ ] Warwick signalled a follow-on "chunky" assignment for the Opus session; candidate on the table: the **cloud-intake design dossier** (always-on webhook intake while the local machine sleeps) — design-only, not an authorised build.

## Cross-links

- [[2026-07-16-21-14_larry_build-002-wp0-live-integration-and-preprovision-correction]] — the web-session arc this run resumed from.
- [[2026-07-17-01-11_mack_wp0-tap-gated-capture-and-nontext-rejection]] · [[2026-07-17-01-28_mack_wp0-nat-kill-window-resilience]] — Mack's specialist logs.
- Canonical build record: `Builds/BUILD-002-unified-personal-capture-gateway/`
