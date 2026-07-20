---
session: BUILD-014 — Tower supervisor/watcher loop — close + parking
date: 2026-07-20
author: larry
build: BUILD-014
status: PARKED (original outcome demonstrated end-to-end; watcher branch NOT merged; CI red — see §6A)
supersedes_for_resume: this is the durable overnight handoff. Resume from §9.
---

# BUILD-014 — Tower supervisor/watcher loop — close-session / parking log

Anchored to the **original build outcome**:
> Codex acts as GPT's stand-in to keep Larry aligned; the Larry↔Codex interaction is stored
> durably in Supabase; and Tower/Watcher automatically notifies Warwick through Telegram
> without Warwick copy-pasting between agents.

This log exists so a fresh Larry session can resume safely without re-reading four days of chat.
It is the single handoff — no new architecture doc, no new build plan, no duplicate source of truth.

---

## 1. ORIGINAL OUTCOME AND SCOPE

The delivered loop, per turn:
- Tower reads the **approved supervisor prompt from Supabase FIRST**.
- Warwick's **genuine instruction** + **Larry's response** are persisted.
- Codex reviews the persisted exchange **as GPT's stand-in** (no Supabase/Telegram creds).
- For **merge-class turns** Codex additionally inspects **real Git evidence** (repo/branch/base+head/diff/changed-files/CI) under the approved Tower-QA skill.
- The **verdict + reasoning are persisted**.
- **Tower/Watcher acts** on the verdict (proceed / redirect / block / ask-Warwick).
- **TowerBot sends an automatic Telegram** where the verdict warrants it.
- **Warwick is NOT the relay** between Larry and Codex.

**Explicitly OUT of this original outcome (later optional scope, all deferred — see §7):**
Directus cockpit · broader assurance architecture · Fable/Grok routing policy · autonomous merge · expanded security hardening · live production deployment.

---

## 2. DURABLE IMPLEMENTATION STATE (verified facts)

| Item | Value |
|---|---|
| PR #51 (control-plane foundation) | **MERGED** to main |
| Main merge SHA | `0d05af547683ef53f6971add7f8f4b8898e502f6` |
| Supervisor/watcher branch | `build-014/tower-supervisor-loop` (**not merged**) |
| Current branch head (full) | `4b365f7265d0a4113db62cc3bfff416260c9dae4` |
| Isolated Supabase DEV project | `iiqstxfqjbrbyplwwsql` |
| Supabase schema | `tower` |
| Active supervisor prompt | v1 · hash `4cf88eaac3e411bb753f031b0e8615381e5d6361e1ec7938d76cb965afb149fc` · `approved_by='ai-authored-unapproved'` (corrected at close — see §4) |
| Watcher (runtime evidence only) | PID **21060**, bot **@Fusion247towerbot**, alive at close — **NOT a durable service guarantee** (see §6F) |

**Bot separation (do NOT cross credentials/destinations):**
- **DevBot** (`C:\.fusion247\fusion-capture-gateway.env`) = Warwick↔Larry handbacks.
- **TowerBot** (`C:\.fusion247\tower-baton.env`) = automated Tower/Codex review channel.

**Runtime env (local, off-repo):** watcher DB via `C:\.fusion247\control-plane-dev.env`
(`CONTROL_PLANE_DEV_DATABASE_URL`, DB-only); TowerBot token/chat via `C:\.fusion247\tower-baton.env`.
DB password was pasted in chat and should be rotated (Warwick's call).

---

## 3. WHAT HAS BEEN PROVEN (end-to-end, against Supabase DEV, real Codex, real Telegram)

- approved prompt loaded from Supabase **first**;
- Warwick instruction persisted; Larry response persisted;
- durable turn **reconstructed from Supabase**;
- **genuine Codex** invoked with NO Supabase/Telegram credentials;
- Codex verdict persisted; Tower acted on it;
- **Telegram sent automatically by the watcher**;
- restart reconstruction produced a **matching packet hash**.

**Initial proof turn** — `521d1127-0a15-4b43-bbe7-96d5da78afb7` (seq 1, state `blocked`):
Codex correctly **blocked** Larry's invented ETL-framework response to a one-file CSV→JSON request;
Telegram **message_id 87**; restart reconstruction hash matched (`8f11a646…`==`8f11a646…`).

**Real instruction-capture proof** — `f2f61fc0-8323-4c31-bd51-946d85bb8026` (seq 12, `awaiting_warwick`):
captured the **genuine Warwick instruction** ("Good. The TowerBot correction is accepted…") — NOT a
system/tool notification; Codex reviewed the selector change (merge-class, Tower-QA skill).

**Next real continuous turn** — `1b5b4b91-b82d-44ec-9e9b-6705fecd73ba` (seq 13, `acted`):
Tower correctly identified that Larry buried Warwick's requested AsdAIr action under unrelated Tower
administration, and **extracted the practical next action** — same watcher, no relaunch between #12→#13.

---

## 4. BUGS FOUND AND FIXED

- **Watcher wired to DevBot instead of TowerBot.** Fixed (relaunched on `tower-baton.env`).
- **Transcript bridge selected a system/task-notification as the instruction** (turn #10 captured a
  `<task-notification>`). Fixed: `isSystemGenerated()` skips system/tool/hook/notification rows and
  the selector **fails closed** when no genuine Warwick instruction exists.
  Commit `937a6b363ed2c98226757eadc2fca3c973cb2c59`.
- **One durable turn emitted two Telegram messages** (ids **77** + **78** for turn `f2f61fc0` — one for
  merge-QA `request_changes`, one for supervisor `ask_warwick`). Fixed: one turn → one priority-picked
  notification, merge-QA verdict folded in. Commit `4b365f7265d0a4113db62cc3bfff416260c9dae4`.
- **Live active-prompt row falsely labelled `approved_by='warwick'`** (the pre-fix seed; `seed.mjs` code
  was corrected but the already-seeded row was not). **Corrected at close** to `ai-authored-unapproved`.
  Warwick has NOT reviewed/approved the supervisor-prompt text.

---

## 5. WHAT WORKS NOW (accurate claims only)

- Real Larry responses are **automatically captured** (Stop hook in `.claude/settings.local.json`).
- The approved Tower-QA skill prompt is loaded for merge-class turns.
- Codex reviews the stored interaction; merge-class turns can include actual repository evidence.
- Results are durable in Supabase; Telegram arrives automatically via TowerBot.
- The watcher processed **consecutive real turns** (#12→#13) with no relaunch.
- The **foundation (PR #51) is merged to main**.

**Do NOT claim:** Codex is infallible · it will catch every error GPT would · the process survives a
Yoga reboot (NOT proven — see §6F) · the watcher branch is merged (it is NOT) · cockpit/assurance work
is complete.

---

## 6. REMAINING WORK — ORIGINAL BUILD ONLY (ordered)

- **A. CI is RED on the current head** (`4b365f7`). Job `db-proofs` step *"Tower-loop — supervisor
  watcher CI acceptance"* failed: the CI step does **not pass `CONTROL_PLANE_DEV_DATABASE_URL` to the
  watcher child processes it spawns**, so 6 subtests time out (`[ci-w1..w3] FATAL: … is not set`). This
  is a **CI-wiring bug in the workflow step**, not a watcher-logic bug (the live Supabase acceptance
  passed). Fix: set/propagate the isolated-Postgres DSN into the spawned watcher children in the CI step.
- **B.** Open/update the single bounded watcher PR against current main.
- **C.** Return the exact-head merge gate.
- **D.** Merge only after Warwick's **explicit** approval.
- **E.** After merge, launch the watcher from **merged main** and prove: one further genuine turn · one
  Telegram · no duplication · correct Supabase persistence · correct prompt version/hash.
- **F. Durable operating method — current truthful limitation:** the watcher runs as a **detached hidden
  Windows process** (`Start-Process node … watcher.mjs`, redirecting to `C:\.fusion247\logs\`). It
  **survives terminal closure and Claude-session closure** (it is not tied to the session). It does **NOT
  survive Windows sign-out/reboot** and **requires a manual start command** afterwards — there is **no
  service, scheduled task, or startup entry**. **Do NOT build a Windows service unless Warwick explicitly
  authorises it.** Manual restart command:
  `Start-Process -FilePath node -ArgumentList '--env-file=C:\.fusion247\control-plane-dev.env','--env-file=C:\.fusion247\tower-baton.env','watcher.mjs' -WorkingDirectory 'C:\Fusion247PKA\services\control-plane\tower-loop' -WindowStyle Hidden -RedirectStandardOutput 'C:\.fusion247\logs\tower-watcher.out.log' -RedirectStandardError 'C:\.fusion247\logs\tower-watcher.err.log'`
- **G.** Later: improve ordinary-turn Telegram rendering so merge-QA boilerplate is not shown unless it
  materially affects the current action or a merge decision is being requested.

---

## 7. DEFERRED / PARKED (not forgotten; none blocks completing/merging the loop)

- Directus cockpit + views · Grok-vs-Fable comparison · broader risk-tier reviewer routing ·
  role-based-readiness activation · autonomous merge.
- The three Codex `REQUIRED_BEFORE_LIVE` findings from the (separate, merged-foundation) review:
  1. CI + Warwick decisions as **mandatory** packet evidence;
  2. a **distinct approved adversarial** prompt;
  3. **calibrated security-assurance routing** with a real fulfiller.

---

## 8. DELIVERY LESSON (standing — see memory `deliver-thin-working-slice-first`)

Anchor every build to Warwick's original one-sentence outcome · build a **visible walking skeleton
first** · add only minimum-viable reliability around it · governance/assurance follow demonstrated risk ·
**do not build verification machinery before the product exists** · "done" = Warwick can genuinely use,
hear, or open it · surface only real external blockers · define and respect an explicit parking point.

---

## 9. RESUMPTION INSTRUCTION (exact restart point)

> Resume from the current watcher branch. Verify remote head and CI. Do not reopen architecture. Finish
> the bounded PR/merge path, relaunch from merged main, prove one real automatic TowerBot turn, record
> evidence, and park BUILD-014.

First concrete step on resume: **fix §6A (CI env wiring for the spawned watcher children)** so CI goes
green on the exact head — that is the gate before the merge recommendation.

---

## 10. CLOSE

Watcher (PID 21060) was **left running on purpose** — not intentionally stopped. No further Tower
implementation performed after this log. AsdAIr starts afresh in a new session.
