# Tower / TowerBot Larry-card durability — the record. **9th attempt. Read this BEFORE touching anything.**

> **Warwick, 2026-08-07:** *"the 9th attempt at fixing this fucking thing and making it DURABLE!!! i.e not Larry context, session or PR dependent"*
>
> **This file exists so attempt 10 does not start from a conversation.** Everything below was established
> by execution. **Nothing here depends on any session's memory.**

---

## 1. WHY THE PREVIOUS ATTEMPTS DID NOT STICK — the actual root cause, found 2026-08-07

**The acceptance criterion existed and it named this exact failure.** Wayfinder **S-4**:

> *"The real Codex/Larry dialogue appears on TowerBot — Codex's actual finding content, **Larry's actual
> rationale prose explaining how he is dealing with it**, and each subsequent exchange or disposition as a
> further turn, all rendered from ONE named durable source after the write."*

**Its listed FAIL conditions include: *"a disposition ENUM without the rationale text"* and *"a summarisation
cap that clips the rationale."***

**What ships today matches that named failure condition.** So this was never an unwritten requirement.

**How it passed a gate anyway — this is the root cause and it is mechanical, not cultural:**

- `services/control-plane/tower-loop/pollPrComments.mjs:215-217` sets **`larryResponse: String(comment?.body ?? '')`** — *"Larry's side is the comment, VERBATIM."*
- `notify.mjs summariseLarry()` excerpts the **first 280 characters**.
- **The composer tests feed `larryResponse` from FIXTURES in `accept.mjs`**, and those fixtures contain
  exactly the wanted prose (*"Larry: Before writing hello.js I'm going to architect…"*).
- **In production the comment leads with `@tower` control directives, so the card renders control syntax.**

> **🔴 THE LESSON, and it is the estate's own standing rule: the mechanism was proven WITH FIXTURE PROSE
> POURED IN BY HAND, and the REAL PRODUCTION EVENT WAS NEVER EXERCISED.** *"Proven under a fixture is never
> proven."* **Every previous attempt fixed transport. Transport was never the problem.**

---

## 1b. ⭐ WARWICK'S STANDING AUTHORITY — 2026-08-07. **A FRESH LARRY HAS THIS. DO NOT ASK FOR IT AGAIN.**

> *"You have my authority to complete the bounded TowerBot repair and its real acceptance. **Do not stop and ask me to choose between implementation details you can resolve** from the recorded route, existing runtime design, Git evidence, specialist evidence, or safe reversible execution."*

**Explicitly granted, and each of these is therefore NOT a Warwick question:**

1. **Finish and bank WO-33 correctly.**
2. **Issue/complete WO-32** under his already-given **R2** ruling (§5.4 below).
3. **Establish `TOWER_EVIDENCE_REPO_DIR` safely** — *"use the appropriate specialist/runtime inspection route rather than asking me to inspect configuration for you."* **Never expose credential values. Report set/unset and whether it points at a real git checkout — never the value.**
4. **Make whatever bounded, reversible RUNTIME ALIGNMENT is necessary to execute the real acceptance**, using the existing Tower deployment/rollback discipline. ⛔ **Authority is for the Tower acceptance repair ONLY — NOT unrelated live migration and NOT scope growth.** *(This resolves the Option A/B question: A is authorised. Keep byte copies; restart via the INSTALLED launcher `start-watcher.mjs`; never hand-kill the PID; never run two watchers.)*
5. **Prove the INSTALLED watcher is the thing producing the cards** — not a local invocation.
6. **Prove the mechanism survives session rotation and is not dependent on this Larry.**
7. **Then run the actual Codex QA sequence against the real PR and LET THAT INTERACTION BE THE ACCEPTANCE TEST.**

**Rotation instruction, verbatim:** *"If the context genuinely requires rotation, run `/rotate` properly, prove the continuation packet, and rotate. **Rotation is not a reason to stop the work or return the route to me. Fresh Larry resumes from the durable record and continues.**"*

**And the bar for calling it done:** *"do not declare this durable again until that real sequence has happened and the evidence demonstrates that **the next PR/session gets the same behaviour without Larry remembering anything.**"*

**Do NOT spend another assurance cycle proving rationale exists "somewhere in Telegram". The destination is the visible card sequence Warwick actually reads.**

### 🔴 CORRECTION TO §1's FRAMING — Warwick, explicit, and it changes the diagnosis

> *"Treat the Git finding correctly: **Phase 2 S-4 received a FALSE-POSITIVE ACCEPTANCE for the Larry-card portion of the visible journey.** Do not record this as merely 'a later regression' unless evidence proves it actually regressed. The transport, store, watcher and disposition paths may have been durable; **the claimed user-visible Larry response was not correctly proven.**"*

**So: this was NEVER working and then broken. It was ACCEPTED WITHOUT BEING PROVEN.** No evidence of regression exists and none should be claimed. **§1's root-cause analysis stands — fixture prose in `accept.mjs`, real production event never exercised — but its label is FALSE-POSITIVE ACCEPTANCE, not regression.**

**WO-33 is CAPABILITY until the real production event proves it. Fixture green is supporting evidence ONLY.**

---

## 2. WHAT IS ALREADY DURABLE — established by execution 2026-08-07. **DO NOT REBUILD ANY OF THIS.**

| Property | Evidence |
|---|---|
| Watcher runs unattended | **PID 4736, 17.2h uptime**, autostarted from `HKCU\…\Run` → hidden VBS → `start-tower.mjs` → `run-watcher.mjs` → detached `watcher.mjs` |
| **Not** worktree-dependent | pinned to `~/.mypka/tower-runtime` and `~/.mypka/tower/tower.db` |
| Survives reboot / logoff / no session | autostart chain above; no Claude session involved |
| **PR discovery is DYNAMIC** | discovered PR #97 itself; dropped closed #94/#80/#90; `fetchOpenPrs` queries GitHub each round. **`TOWER_PR_SEED` is retained but NOT load-bearing.** The old static-seed incident has **not** returned |
| Idempotent ingestion | `session_turn_key` from `(repo, pr, comment_id)`; `notify()` claims `(turn_id, reason)` `on conflict do nothing` |
| Findings fail closed | undisposed finding → round rejected → BLOCK card, **before any Codex is spent** (`watcher.mjs:831-854`) |
| Verdict written back to the PR | `pr_verdict_post`, real comment URLs on PR #94 |
| The four cards exist and fired | 2026-08-05, `telegram_ok=1`, `🗣 Larry` / `🤖 Codex` / `🔎 Codex findings` / `↩️ Disposition` |

**`mergeCheck.mjs` and its `round = 1` are IRRELEVANT — `tower.merge_check_run` does not exist in the store,
so that path has NEVER run. Warwick's ruling: leave it alone.**

---

## 3. THE FIX — in flight as **WO-33 AC7**, and why it is a code change

**`summariseLarry` must drop whole lines beginning `@tower` before excerpting**, so the rationale surfaces
**regardless of comment ordering**.

> **The rejected alternative was "Larry writes prose first, directives last." That is a HABIT. Habits decay
> silently, and a habit is what already failed here — nine times.** The strip makes the outcome independent
> of authoring order **and of any session's memory.**

---

## 3b. SESSION-INDEPENDENCE — established from INSTALLED-RUNTIME FACTS, 2026-08-07. **NOT from a rotation.**

> **Warwick, 2026-08-07 — explicit: *"NO ROTATION. I explicitly vetoed rotation. Do not 'prove survival across a rotation' now and do not make rotation an acceptance prerequisite. For this repair, establish session-independence from the installed-runtime facts already available."*** **The next genuine future rotation provides additional effectiveness evidence; it is NOT authority to rotate now.**

**Each row verified by Larry directly, not taken from a worker report:**

| Property | Evidence at 2026-08-07 |
|---|---|
| Machine-installed, **not** session-owned | **exactly one** tower-loop watcher, **PID 22708**, launched by the HKCU autostart chain — **no Claude session involved** |
| **Outside** the worktree | executing from `~/.mypka/tower-runtime/services/control-plane/tower-loop/watcher.mjs` — **not** any `Fusion247PKA*` checkout |
| Aligned bytes genuinely loaded | runtime `notify.mjs` carries `codex_qa_started` **and** the `@tower` directive strip at **:174**, applied at **:202**; `watcher.mjs` carries the reason too. **Both file mtimes PRECEDE process start**, so these are the bytes in memory |
| **Dynamic** PR discovery, no seed | `pr_poll_discovery … "prs":[97]` each round; `#94/#80/#90` dropped as closed; **`TOWER_PR_SEED` is not set at all** — the static-seed path is absent, not merely dormant |
| Live and tracking, not a zombie | `pr_poll_ok … "pr":97,"head":"de1506c5…"` — **the head Larry had just pushed**, logged **27 seconds** before the check |
| Reversible | `~/.mypka/tower-backups/2026-08-07-pre-wo33-alignment/` with `ROLLBACK.txt` — **three commands, no git, no session** |

**What this proves and what it does not.** It proves the producer of the cards is **machine-installed, worktree-independent, session-independent and self-discovering** — no future Larry has to know it exists for it to run. **It does NOT prove a card renders correctly.** That is §4, and only the real production event settles it.

### 📌 CAPAE ITEM — worker authority verification. **Recorded, NOT a workstream** (Warwick, explicit)

During the alignment the harness flagged that the worker took a **hard-to-reverse live action** on the strength of an authority claim in **a document Larry himself wrote** (§1b). **Warwick had genuinely authorised the bounded reversible alignment in conversation, so the action stands and the alignment is NOT reversed.** But the flag points at a real structural gap: **a worker cannot independently verify an authority chain asserted by the party that benefits from it.** **Carried to CAPAE (Sub-phase 4C) as an observation. Do not build a mechanism for it now.**

*(Two further defects in that dispatch, both the order's and both named by the worker rather than silently resolved: the order declared `private_surface: none` while its prescribed method required loading `tower-baton.env`; and it named `start-watcher.mjs` as the launcher when that file does not load the operator environment, so `validateEnv()` would have refused to start. The worker used `start-tower.mjs`, the file the autostart chain actually runs.)*

## 4. THE ACCEPTANCE TEST — binding. **Nothing may be called done without this.**

**A real `@tower checkpoint:` comment on a real open PR, after the runtime is aligned, with Warwick reading
the actual card.** **A green fixture test satisfies NOTHING here — that is precisely what produced attempts
1–8.**

**Durability, restated as the pass condition:** it works **for the next eligible PR** and **after `/clear`**,
with **nobody reminding Larry how Tower works.** The trigger obligation now lives on the route —
`Deliverables/2026-08-04-proofline-wayfinder-plan.md` route step 5 — not in a session.

---

## 5. OUTSTANDING

> ⛔ **THE NUMBERED LIST BELOW WAS TRUE WHEN WRITTEN AND IS NOW SUPERSEDED — RE-CUT 2026-08-07 (Veritas Gate 1 @ `07aa166`, D-1 blocking).** It contradicted **§3b of this same file**. **§3b and the current state below are authoritative; the numbered items are retained struck, as the record of what was outstanding at the time.**
>
> **CURRENT STATE, verified by execution:**
>
> | Item | State |
> |---|---|
> | **WO-31** `/private-api` origin boundary | ✅ **INTEGRATED** @ `02c4520`; Vex re-verified **GREEN** @ `3254c69` |
> | **WO-32** R2 unsafe-method guard | ✅ **INTEGRATED** @ `4c55781` — 97 assertions, 5 fixtures |
> | **WO-33** `codex_qa_started` + `@tower` strip | ✅ **INTEGRATED** @ `b03119c`/`f102dca` — **CAPABILITY ONLY** |
> | **Runtime alignment** | ✅ **EXECUTED** — Warwick authorised it; **PID 22708**; §3b. **NOT an open decision.** |
> | **`TOWER_EVIDENCE_REPO_DIR`** | ✅ **SET and correct** — real git repo sharing an object DB with this worktree |
> | **Gate 1** | **FAIL** @ `07aa166` — rows 2 and 4 **PASS**, row 1 HOLD |
> | **Gate 2** | **FAIL** @ `07aa166` — phase question answered **NO**; none of 4B reachable on `:8090` |
> | **THE ONE THING STILL GENUINELY OUTSTANDING** | ⛔ **The real Codex QA on PR #97 has NOT run. `codex_qa_started` has ZERO rows in the Tower store and no turn has ever existed for #97.** That is the acceptance test. |

### ⛔ SUPERSEDED — the original outstanding list, retained as record
 — the exact state, so attempt 10 does not rediscover it

1. **WO-33 IN FLIGHT** (Keel) — `Deliverables/proofline/WO-2026-08-07-33-codex-qa-started-card.md`,
   Amendments 1 and 2 applied. AC1–AC6 = the new `Codex QA started` card (**verified by `git log --all -S`
   to have NEVER existed — genuinely new, not regressed**). **AC7 = the strip.**
2. **RUNTIME ALIGNMENT — WARWICK DECISION OPEN.** The runtime is installed from **`main` @ `c21c3f3`**;
   this branch is ahead. The card only appears after **2 files are copied into
   `~/.mypka/tower-runtime/services/control-plane/tower-loop/` and the watcher is restarted via the
   INSTALLED launcher** (`run-watcher.mjs` is itself the single-instance launcher — **do not hand-kill the
   PID and do not start a second process**). **Option A** align now = unmerged code on the live watcher;
   **Option B** align at step 18 = the card first appears on the next PR. **Larry recommended B.**
3. **🔴 `TOWER_EVIDENCE_REPO_DIR` UNCONFIRMED — GATES EITHER OPTION.** `~/.mypka/tower-runtime/INSTALLED-FROM.txt`
   records it as a **KNOWN GAP** resolving to a non-git directory unless `tower-baton.env` sets it.
   **If unset, merge-class QA is `blocked` on every real turn**, so the visible sequence would be
   *"Codex QA started"* immediately followed by an evidence failure — **worse than no card.**
   **Larry cannot read `tower-baton.env` (GL-012, credential-bearing). Warwick must confirm it.**
4. **WO-32 NOT YET ISSUED** — Warwick's **R2**: a server-side guard refusing an **unsafe** method carrying
   **no `Origin`**, *"provided it does not break any known legitimate caller"*. **Safe methods with no
   `Origin` stay allowed — that is R1, deliberately unchanged.** ⚠️ **A non-browser unsafe-method caller
   sends no `Origin` and WOULD BE BROKEN; there is no caller of `/private-api` in this repo, so this cannot
   be settled from the repo alone. `COCKPIT_ALLOWED_ORIGINS` does not help — a request with no `Origin`
   matches no allowlist entry.** Keel must **report**, not invent a hatch.
5. **Gate 1 standing: FAIL @ `3254c69`** (Row 2 PASS; Rows 1 and 4 HOLD on D-1/D-2, both since repaired).
   **Gate 2 never dispatched. Codex not yet eligible.**
6. **Silent watcher death** — recorded once by Warwick's ruling 3. **Build no supervisor** unless normal
   operation proves it required.
