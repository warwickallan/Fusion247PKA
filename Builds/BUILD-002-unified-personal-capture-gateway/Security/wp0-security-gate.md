---
build: BUILD-002
component: Cross-cutting (security)
wp: WP0
artifact: wp0-security-gate
status: draft-for-wp0
author: vex
created: 2026-07-16
---

# WP0 Security Gate — Unified Personal Capture Gateway

Part of [[BUILD-002-unified-personal-capture-gateway]]. Owner: **Vex** (security gate, WS-003 style).

This artifact **defines what the WP0 security gate checks**. It is a design/definition document, not an audit. No live code exists yet; execution of this gate happens later, against the implemented baseline, immediately **before** real secrets and the live phone-visible acceptance proof go live. Until then, everything runs on synthetic/non-sensitive fixtures.

**The gate is the hard boundary between fixtures and real secrets/live proof.** Per Warwick's explicit instruction: fixtures until the authentication, access-control and secret-handling baseline passes this gate; then, and only then, the real phone-visible acceptance proof.

---

## 1. Identity & single-user access control

The gateway serves ONE authorised user (Warwick) and ONE Larry/Fusion Telegram bot. No open enrolment, no multi-user path in WP0/WP1.

- [ ] **Sender allowlist enforced.** Every inbound Telegram update is checked against a single authorised numeric Telegram `user_id`, held in config/secret store — not a username (usernames are mutable/spoofable), not a chat title.
- [ ] **Default-deny.** Any sender who is not the one authorised `user_id` is silently ignored — no reply, no capture, no error that confirms the bot exists. Rejection is logged (sender id + timestamp), not actioned.
- [ ] **No self-enrolment path.** There is no `/start`-style command, invite link, or runtime flow that adds a new authorised user. Adding a user is a config/deploy change, never a chat-driven action.
- [ ] **Webhook/poll authenticity.** If using Telegram webhooks, a secret path token (or `X-Telegram-Bot-Api-Secret-Token`) is verified so arbitrary callers cannot inject fake updates. If long-polling, only the bot's own token receives updates.
- [ ] **Worker trusts only the gateway.** The local Larry-worker accepts capture jobs only from the authenticated gateway path, not from an open local port reachable by other processes without authentication.

## 2. Secret handling & credential hygiene

- [ ] **No secret in Git / Markdown / ClickUp.** Telegram bot token, Supabase keys, webhook secret, any service credential — never committed, never pasted into a Markdown note or ClickUp task. (A committed secret is an immediate RED, no override.)
- [ ] **Injection via env / secret manager.** Secrets are loaded from environment variables injected by a secret manager or an OS-keychain-backed `.env` that lives outside the repo tree — not read from a tracked file.
- [ ] **`.env.example` only.** Repo ships `.env.example` with key names and empty/placeholder values only — zero real values.
- [ ] **`.gitignore` covers secrets.** `.env`, `*.key`, credential files, and any local secret store are gitignored; verified before first real secret is introduced.
- [ ] **Secret scanning wired.** A pre-commit hook and/or CI secret-scanner (gitleaks/trufflehog-class) runs and blocks on token-shaped strings before merge.
- [ ] **Least privilege on Supabase keys.** The `service_role` key is used ONLY by the trusted server-side worker, never in any client/bot surface reachable by inbound content. RLS is enabled on every table so the anon/authenticated key alone cannot over-read. Prefer a scoped key/role over `service_role` wherever the operation allows.
- [ ] **Bot token protection.** The Telegram token is treated as a full account credential — one home (secret store), masked in every log and output, never echoed back into a chat or error.
- [ ] **Rotation posture defined.** A documented, tested rotation path exists for the bot token and Supabase keys (how to rotate, where, expected downtime). Rotation does not require a code change to hardcoded values (because there are none).

## 3. Authorization boundaries

The gateway records **intent + technical typing** of a capture. It is not an actuator.

- [ ] **No Confirmed Actions from the gateway.** The gateway/worker cannot perform external or consequential system changes (sending mail, posting to third-party systems, deleting data, spending) without an explicit user confirmation step. Save-to-Brain durable capture is authorised by the chosen capture action itself; normal conversation/drafting needs no extra approval.
- [ ] **Confirmed-Action intent is inert.** Where an inbound message *implies* a consequential action, the gateway may record the intent and type it, but must not execute it — execution stays behind the confirmation gate.
- [ ] **Scoped write path.** The worker's Markdown write is confined to the single approved canonical destination (the governed Brain path). No path traversal (`../`), no writing outside the approved root, no arbitrary filename injection from untrusted content.
- [ ] **Store separation honoured.** Supabase is operational/staging only; Markdown is canonical. The gateway cannot promote operational data to canonical except through the governed worker write path.
- [ ] **Health data hard-excluded.** Fusion Health / health data is OUT of scope. No code path ingests, stores, or types health data without a separate authority/privacy/security decision.

## 4. Data protection (GDPR-style technical controls)

Single-user personal data, but the controls still apply: least privilege, encryption, access logging, deletion.

- [ ] **Encryption in transit.** TLS on all hops — Telegram API, Supabase, and any worker RPC. No plaintext local socket carrying content or secrets.
- [ ] **Encryption at rest.** Supabase at-rest encryption confirmed; private raw source objects (original inbound media/text) stored in an encrypted bucket/volume, not a world-readable local path.
- [ ] **Privacy/retention classes applied.** Raw source objects and originals are tagged with their retention/privacy class; retention is enforced, not indefinite-by-accident.
- [ ] **Access logging.** Privileged operations (capture write, raw-object read, config change) are logged who/what/when — without logging secret values or full sensitive payloads.
- [ ] **Deletion capability.** A working deletion path exists for a captured item and its raw source object across BOTH stores (Supabase row + storage object + any Markdown), including a documented answer for backups/shadow copies.
- [ ] **Minimisation.** Only fields needed for capture/routing are stored; no speculative retention of extra metadata.

## 5. Abuse / failure safety

- [ ] **Idempotency prevents double-write.** Each inbound capture carries a stable dedupe key (Telegram `update_id` / message id). Reprocessing (retry, restart, redelivery) results in one canonical write, not duplicates.
- [ ] **Offline queue is safe.** A queued/offline capture cannot leak content to disk in cleartext outside the protected store, and cannot report "saved to Brain" until the canonical Markdown write has actually succeeded. No false-completion signalling.
- [ ] **Untrusted inbound handling.** All inbound content is treated as hostile: validated/typed server-side, size-limited, and neutralised before it touches a filesystem path, a shell, a Markdown template, or a log. No message content is interpolated into a command, a query, or a file path unsanitised.
- [ ] **Rate limiting / flood control.** Inbound handling is bounded so a burst (even from the authorised user, or spoof attempts before allowlist rejection) cannot exhaust the worker or the write path.
- [ ] **Fail-closed.** On auth ambiguity, secret-load failure, or write-target unavailability, the gateway declines and reports failure — it does not fall back to an unauthenticated or unscoped path.

## 6. Fixtures-until-gate rule (the hard boundary)

Until this gate PASSES against the implemented baseline:

- **MUST use synthetic/non-sensitive fixtures:** the Telegram bot token (dev/throwaway bot, not the real Larry/Fusion bot), Supabase keys (dev project, synthetic rows), all captured content, all raw source objects, and the "authorised user id" (a test id, not Warwick's real account for the live proof).
- **MUST NOT happen before PASS:** wiring the real Telegram bot token, the production Supabase keys, real personal data capture, or the phone-visible acceptance proof from Warwick's actual device.

**Exact pass condition that unlocks real secrets + live proof:** Sections 1–5 all check GREEN against the implemented baseline (no CRITICAL/HIGH findings open), with special hard-stops satisfied — sender allowlist enforced and default-deny proven, zero secrets in Git/Markdown/ClickUp with `.gitignore` + secret-scanning live, `service_role` isolated to the worker with RLS on, worker write path scoped and traversal-proof, and a working deletion path. On PASS and Vex sign-off, real secrets and the live phone-visible proof are authorised — not before.

> **CLOSED 2026-07-17 — live credential/transport sign-off: GREEN-WITH-CONDITIONS** at head `ecaec0c` (0 CRITICAL / 0 HIGH / 1 MEDIUM / 3 LOW / 3 INFO; mandated follow-up FU-1: pin Supabase CA + `sslmode=verify-full` before unattended operation). See [[wp0-live-signoff-2026-07-17]].
>
> **WP1 delta 2026-07-17 — GREEN-WITH-CONDITIONS** at `9c69cfb` (0/0/0 CRIT/HIGH/MED, 3 LOW, 5 INFO; FU-1/2/3/4 closed — FU-1 pending only the dashboard CA cross-check; all four live actions approved: 0006 apply, edge deploy, PR open, worker restart). See [[wp1-delta-review-2026-07-17]].

## 7. Gate outcome

- **PASS** = Vex has executed this gate against the real implementation and all of §1–§6 are GREEN (no open CRITICAL or HIGH findings; §6 hard-stops satisfied).
- **YELLOW** = only non-blocking MEDIUM/LOW items remain; Larry surfaces them and Warwick explicitly accepts each before proceeding. YELLOW never covers a §6 hard-stop.
- **RED / no override** = any committed secret, missing sender authentication, disabled RLS on a data table, an unscoped/traversable worker write path, or a missing `SECURITY.md` for the component. RED blocks the transition to real secrets and live proof; there is no override path.
- **Sign-off required.** Vex must sign off (WS-003 §2 style gate) before WP0 goes live with real secrets/proof. Larry does not advance past this boundary on GREEN-from-Vex, or an explicitly Warwick-accepted YELLOW, only.
- **Execution is later.** This document defines the checks. The gate's actual execution — grep sweeps, exploit proofs, RLS tests, deletion-path verification per [[SOP-004-vex-security-audit]] — runs against the implemented baseline as a distinct step and produces a severity-tagged findings report under `Deliverables/`.
