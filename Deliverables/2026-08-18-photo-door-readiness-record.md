# The photo door — readiness, established by execution

**WO-2026-08-18-01 (Keel, proof) and WO-2026-08-18-02 (Asdair, readiness), 2026-08-18.**
Written by Larry because neither dispatch holds a `Write` grant for `Deliverables/`. Every figure
below came back from an executed command, not from a reading of code.

**The question both orders existed to answer:** is *"SEND THE PHOTO TO @Fusion247shopperbot NOW"*
the whole of what remains to be asked of Warwick?

> ## ⛔ THE ANSWER IS NO — and the blocker is DEFECT 2, not the runtime.
>
> The runtime is READY. The chain is observable. The blocker is that **a mis-bound answer is
> permanent**, which makes cancel-and-resend a technical step *after* SEND — the exact thing the
> send instruction may not carry. Repair dispatched as **WO-2026-08-18-03**.

---

## 1. The send window — measured, not inferred

`listDate` is the **UTC date of arrival** (`runtime.js:151`). The ref is `SHOP-<listDate>`
(`commands.js:176`). `createOrResumeShop` mints a fresh `SHOP-<date>-M<messageId>` **only when a
colliding row is terminal**; a **live** row is RESUMED. `TERMINAL_STATUSES = ['RECONCILED',
'CANCELLED']`.

Read from `asdair.shop` as `asdair_ro` at 2026-08-18T11:43Z:

| Send date (UTC) | Existing row | Behaviour | Verdict |
|---|---|---|---|
| **2026-08-18** | id 34 `SHOP-2026-08-18` CANCELLED — terminal | mints `SHOP-2026-08-18-M<msgid>` | **SAFE** |
| **2026-08-19** | id 35 `SHOP-2026-08-19` **READY_TO_SHOP — LIVE** | **RESUMES Mum's delivered basket** | **⛔ STOP** |
| **2026-08-20** | no row | fresh shop | **SAFE** |
| **2026-08-21** | no row | fresh shop | **SAFE** |
| **2026-08-25** — the acceptance shop | no row | fresh shop | **SAFE** |

**The STOP is ONE DAY WIDE and the acceptance date is unaffected.** The readiness dispatch reported
the window's opening (*"expires at 01:00 BST tonight"*) without naming its closing; enumerating every
date rather than the next one shows the window shuts again on 20 August. The correction matters
because "expires tonight" invites a rushed send, and there is nothing to rush.

**Not a defect in the minting rule.** Resuming a live shop of the same date is correct behaviour for
an amended list. It is only a hazard because `SHOP-2026-08-19` is *delivered* while still carrying a
non-terminal status. **Recommendation, for Warwick, not urgent:** transition id 35 to `RECONCILED`,
which is what actually happened to it. It is a live write on a real shop and is therefore his.

## 2. The three defects — mutation-proven

| Defect | Verdict | The proof |
|---|---|---|
| **1 — Terra invention** | ✅ **PREVENTED ON PHOTO** | `runPipeline.js:712` calls `deps.prepareImage` **before** the model on a real `kind:'photo'` payload. `createDeps().prepareImage.name === 'realPrepareImage'` — the *name*, because a callable stub passes a `typeof` check. Executed against Mum's actual photograph: `{source 720×1280, scale 2, → 1440×2560, prepared:true}`, decoded to real pixels. Four mutations killed 12 tests. |
| **2 — mis-bound answers** | ⛔ **NOT PREVENTED for free text** | A guard *does* exist (`answersASettledQuestion`, `d132aeb`) and works. It is **unreachable by all nine real answers**: it fires only via `resolveExactCandidate()`, which requires `label === answer`. *"Ice lollies are in favourites. stupid question"* equals no candidate label. |
| **3 — first-answer-wins as a trap** | ⛔ **NOT PREVENTED, no in-product route** | Exactly **two** statements write `asdair.shop_question` — an INSERT `ON CONFLICT DO NOTHING` and one UPDATE `WHERE id=$4 AND status='open'` — pinned to a literal `2` in the test. The command allowlist is 12 names and contains no reopen and no amend. `cancelShop` is the only escape. |

**The structural finding that explains the whole history:** the photo and text doors **rejoin at
`resolveAll`**. Questions, binding and first-answer-wins are *shared* machinery. Attempt 3 succeeding
on text was therefore never evidence about the photo door's *reading* half — and was always evidence
about the shared half. That is why defect 2 survived a green text run.

## 3. The runtime — READY, on two independent proofs

An earlier claim in the readiness dispatch that pid 42548 had bypassed the launcher was **withdrawn
by its author**: the child carries no `--env-file` because `spawnRuntime` passes `env: process.env`,
which is ordinary inheritance. `runtime.log` carries `launcher_spawn` at `17:21:45.628Z`, matching
the process creation to the second.

- **Structural:** `start()` refuses to spawn unless `preflight()` passes, and preflight blocks on both
  DB roles, `FUSION_GATEWAY_URL` reachable, `FUSION_GATEWAY_KEY` authenticating, `FUSION_MODEL_VISION`
  present in the gateway's own `/models`, and `pg` resolving from all seven folders.
- **Behavioural, and stronger:** pid 42548 transcribed a **real photograph inside its own lifetime** —
  `17:59:12Z` → `TRANSCRIBING`, `18:01:01Z` → `PROCESSING`, *"interpreted 37 line(s) against a
  catalogue of 109 known products"*. `vision()` throws outright when the gateway is unset, so a
  successful transcription proves gateway URL, key and a served vision model were all present.

**The limit, stated rather than implied away:** this proves configuration *presence*. It does not
prove the gateway is reachable *this minute* — last proven 17:59Z on 17 August.

## 4. Observability — READY at stage level, with two traps

**Stall test — can we tell stage N from N+1 without asking Warwick? YES**, from `shop_event`
transitions plus the `advanced` step names (`act:transcribe`, `act:interpret`, `act:plan`,
`wait:basket_request`, `wait:browser_runner`, `wait:build_command`).

**Trap 1 — `status.json` is a start-time cache that reads like a live surface.** It self-labels *"a
SNAPSHOT … not a source of truth"*, is frozen at `17:21:56Z` on 17 August (`uptime_seconds: 11`), and
is where the stale offset `171031180` in the Work Order came from. The live offset is `171031185`.
**Do not diagnose from it during the event.**

**Trap 2 — `runtime.log` is 99.97% untimed.** 26 of 86,596 lines carry a timestamp. It gives order and
position, never elapsed time, so it cannot distinguish *stalled* from *slow*. The authoritative timed
surface is `asdair.shop_event.occurred_at`.

## 5. GATE ZERO — PARTIAL, and exactly how

The invariant is SOURCE → DURABLE TRANSCRIPTION WITH PROVENANCE → LINES → RECONCILIATION BACK TO SOURCE.

- Source photo **bound** — `shop_source_image`, sha256, 99,139 bytes. ✅
- Per-line read text **durable** — `shop_line.raw_reading`, e.g. `"3 4pts Arla semi skimmed milk"`. ✅
- **Provenance ABSENT** — `shop_line_provenance` is **empty across the entire database**;
  `raw_transcription` empty and `transcription_confidence` null for lists 24–26. ⛔

So within seconds of SEND we can read *what it thought the list said*, per line. We **cannot** say
which model read it, at what confidence, or reconcile a whole-transcript count back to the
photograph. **Reconciling to the source photograph remains a human act** — and on 17 August that is
precisely where it bit: an invented product on line 14, and a duplicated line 16 that silently lost
Heinz sausage and beans.

## 6. The browser leg — available; session validity not establishable without a live check

Metadata only, no contents read, no cookie store parsed: the profile exists (46 entries, dir mtime
18/08 11:18), `Default\Network\Cookies` 94,208 bytes mtime 18/08 10:15, and **9 `chrome.exe`
processes are running on it now** with `--remote-debugging-port=9222`. Whether the ASDA session is
*signed in* needs the cookie store or a driven browser — both forbidden. **CANNOT ESTABLISH WITHOUT A
LIVE CHECK.**

**Why that does not earn its own dispatch:** an invalid session presents cleanly and durably, not as a
mid-run ambush. `browser.cjs:310` throws `ReauthRequiredError`; `runner.js:264` parks the request with
`human_reauth_required` and refuses to retry blind. The cost is a parked run and a legitimate re-auth
ask, which TEN gap 5 already permits.

## 7. What stands in the way of the send instruction

1. **⛔ DEFECT 2 — a mis-bound answer is unrecoverable.** Repair dispatched (WO-2026-08-18-03). This is
   the blocker: it makes cancel-and-resend a technical step after SEND.
2. **⚠️ Provenance unwired** — reconciliation to the photograph stays manual. Not a blocker; it is the
   state every previous run also had.
3. **📅 19 August is a STOP.** 18 August and 20 August onward are safe.

## 8. Parked, deliberately

- ~~**The correction / reopen command** — TEN gap 6, parked by Warwick on his own reasoning. Not built.~~
  ⚑ **NO LONGER PARKED. UNPARKED BY WARWICK the same day, 2026-08-18**, when he ruled CORRELATION
  POLICY = A and refused to accept the residual that ruling leaves: *"an answer that matches nothing at
  all is still accepted and cannot be changed afterwards. That permanence is not acceptable as the
  completed North Star."* It is **required work before Veritas**, dispatched as
  `Deliverables/2026-08-18-wo-b15-audited-answer-correction.md`. **This line is corrected rather than
  left standing** — the order that falsified it declared `document_impact: []`, which was untrue, and
  the worker named it at read-back rather than letting a parked-and-not-built row survive beside a
  ruling that had already overtaken it.
- **Two secret-scan hits** in `transcribe/cli.test.js` and `transcribeList.test.js` — self-declared
  synthetic redaction sentinels, untouched by this work, predating it. Not credentials.
- **Five stale live shops** (ids 7, 26, 28, 31 and 35) that the runtime advances every pass. Residue,
  not a hazard; only id 35 has a dated consequence, at §1.
