# Amended WP recon evidence — BUILD-020 Phase 4 + CareerAIR + Cockpit

```yaml
date: 2026-08-06
branch: build-020/phase4-automation-law
map: Deliverables/2026-08-04-proofline-wayfinder-plan.md
private_surface: C:\.fusion247\private\careerair\**
author: larry
```

## Scope

Amended ACTIVE SESSION WORK PACKAGE functional rows 1–4 recon and partial repair. **No private email bodies, CVs, tokens, or mailbox identifiers beyond the authorised address already named by Warwick.**

---

## Row 1 — BUILD-020 durability / promotion (recon)

| Boundary | Finding | Survives? |
|---|---|---|
| External / session-independent | Honcho continuity pointer, Wayfinder in Git, ding install under `~/.mypka/governor/`, Supabase session-report path | Dead Larry session: **yes** (Git + Honcho + installed runtime) |
| Machine-global install | `~/.mypka/governor/*` (ding, continuity, footer); live Cockpit under `C:\Fusion247PKA\services\cockpit` | Worktree delete: **yes** for install; **no** for trial-only unmerged PR assets |
| Generic repo assets in PR #97 | WO route, `/rotate`, Veritas, session-report tooling, Grok orientation, Watcher start, DevBot source, automation law in `CLAUDE.md` | Fresh branch from **current main**: **no** until #97 merges |
| BUILD-020-specific | Trial worktree state, PR #97 tip | Branch from main **after** merge: **yes** for merged assets |
| Installed-runtime restart | Local supervisor `MyPKA-Local-Services-Live` was **Disabled** (last run 2026-08-04); re-enabled this session | Restart: **partial** — supervisor now Ready; logon trigger still Warwick-unproven per private HELD-ITEMS |
| Replacement-machine DR | **Not executed** | Classified **out of scope** for this phase |

### Post-merge install alignment (identified)

| Live install | Source | Action after #97 merge |
|---|---|---|
| `~/.mypka/governor/ding.mjs` | repo blob | Re-align if tip differs |
| Live cockpit `C:\Fusion247PKA\services\cockpit\server.mjs` | PR + live patch | 🔴 **DO NOT PROPAGATE. RE-CUT 2026-08-07 — Veritas Gate 1 @ `07aa166` D-2, blocking.** ~~Propagate private-api proxy (applied live + banked in trial)~~<br>**Executing that instruction at route step 18 would PUT THE DEFECTIVE HANDLER BACK ON THE LIVE COCKPIT.** The live clone's `server.mjs` carries the **pre-WO-31** bridge — the one that echoed an arbitrary `Origin` and answered preflights on the upstream's behalf, and which **Larry confirmed was ARMED on the running Cockpit**. **WO-31 removed it by extracting the handler to `services/cockpit/private-api.mjs` with the origin decision on the request; WO-32 then added the unsafe-method no-`Origin` guard.** **The merge carries the repaired code. Porting the live copy forward would reintroduce the exposure the whole Vex gate exists to close.** → migration plan §2 and §4.8.<br>⚠️ **Larry re-cut the migration plan's copy of this claim after the `3254c69` D-2 and MISSED THIS SIBLING.** *(The recurring shape: a record true when written, not re-cut when the work moved.)* |
| Claude host hooks | tracked `.claude/**` | ⛔ **VOID — RE-CUT 2026-08-07 (Veritas Gate 1, row 1 blocker ③).** This row read *"**Next Claude WP** — do not install in this Grok session"*. **Amendment 5 DESCOPED AND DISABLED the specialist-return reminder hooks the following day, so there is no "next Claude WP" to install them in and nothing to align.** **Correct disposition: NOT PART OF THE PHASE — the outcome was withdrawn, not deferred.** Shipped state verified in the Veritas export at `3e4c9d9`: `.claude/settings.json` = `{"hooks": {}}`, `.claude/state/return-cues/` absent, all six implementations still tracked under `.claude/hooks/` as inert source. *(A deferral row and a withdrawal row read almost identically and mean opposite things — this one was pointing a fresh reader at work that no longer exists.)* |

---

## Row 2 — Old Gate 2 residuals disposition (against current evidence)

Prior Gate 2 receipt: `Deliverables/2026-08-06-veritas-gate2-phase4-receipt.md` @ `95f8826`.

| Residual | Disposition | Basis |
|---|---|---|
| P-JOB1 ordinary WO route | **DISCHARGED** | Gate 1 row 1 PASS @ product head; hermetic suite banked |
| P-JOB2 FusionDevBot path | **DISCHARGED** | Gate 1 + ding transport evidence |
| P-LAW automation law | **DISCHARGED** | Canonical in root `CLAUDE.md` |
| P-CUE combined cue→ding journey | ⛔ **RE-CUT 2026-08-07 (Veritas Gate 1 @ `275ec07`, second finding on this table).** Was **"RECLASSIFIED / STILL OPEN for phase"** — **two labels where row 2 permits exactly one**, and the "next-WP Claude host install" it points at is the route **Amendment 5 withdrew**. **Correct single disposition: NOT PART OF THE PHASE.** | The cue half does not exist: hooks descoped and disabled, proven by execution (fresh session, four dispatches, four returns, **zero** injections). The ding half stands on its own and is unaffected. **🔴 Larry missed this row at the previous re-cut** — he grepped for the wording he already knew (*"Next Claude WP"*) and this row says *"next-WP Claude host install"*. **Third occurrence in one session of searching for known phrasing and missing a variant**; the same mistake produced Gate 1 Defect 1. **The corrective is to enumerate by MEANING — every row whose disposition is not exactly one of the four permitted values — never by remembered wording.** |
| P-TOWER Watcher durability | ⛔ **RE-CUT 2026-08-07 — STILL OPEN.** Was **"DISCHARGED (capability) with residual park"**: a **qualified** label plus a park, where row 2 permits **exactly one** of the four. | Cold-start + start-watcher are banked, and the operator-notify residual was parked conditionally (*"non-blocking … if not required by North Star journey"* — a condition nobody has since evaluated). **🔴 "DISCHARGED (capability)" is the exact capability-versus-durability confusion this Sub-phase keeps hitting: the residual claims DURABILITY, and capability does not discharge it.** **STILL OPEN is the honest single value** — it neither manufactures a discharge nor invents a new category. **Found by Larry 2026-08-07 while enumerating this table BY MEANING (every disposition that is not exactly one of the four) rather than by remembered wording. Veritas did not name this row; it is the same defect class as the two it did, and searching by meaning is what surfaced it.** |
| P-ROTATE + green Supabase | **DISCHARGED** | Real `/rotate` + green populate banked @ freeze head |
| P-CLOSE ordered phase close | **STILL OPEN** | Phase PASS still requires Gate 2 re-verdict at final head; honest **WP PASS / Phase HOLD** remains valid if post-merge Claude host journey is the remaining North Star acceptance |
| Green populate unestablished (old text) | **DISCHARGED** | Superseded by later Gate 1 isolation green |
| Combined cue→ding one journey | ⛔ **RE-CUT 2026-08-07 (Veritas Gate 1, row 2).** Was *"may remain Gate 2 / **Next Claude WP**"*. **NOT PART OF THE PHASE.** | **Amendment 5 abolished the cue half the day after this table was cut.** The `cue → ding` journey cannot remain a Gate 2 residual because **the cue no longer exists**: hooks descoped and disabled, proven by execution (fresh session, four specialist dispatches, four returns, **zero** injections, against 8 false fires at dispatch alone previously). **The ding half stands on its own and is unaffected.** *(Row 2's rule is that every residual returns exactly one of DISCHARGED · STILL OPEN · RECLASSIFIED · NOT PART OF THE PHASE — "may remain" is none of the four, which is how this survived a re-cut.)* |

### 🔴 D-2 CORRECTION (Veritas Gate 1 @ `0cf70c9`) — dispositioned **by the source receipt's own labels**

**The defect, accepted in full:** the table above uses `P-JOB1`/`P-CUE`-style labels that **appear
nowhere in the source Gate 2 receipt**, whose residuals are numbered **V9-1 … V9-4**. Coverage
therefore could not be audited by name — and **V9-3 and V9-4 received no disposition at all**, though
row 2 requires exactly one for *every* residual. Larry's omission, found by Veritas, not by me.

Source of truth for the labels: `Deliverables/2026-08-06-veritas-gate2-phase4-receipt.md` lines 147–150.

| Source residual (verbatim label) | Severity | Disposition | Basis |
|---|---|---|---|
| **V9-1** — Phase 4 promise unmet for Gate 2; green Supabase populate unestablished; combined return-cue → Rule 4a → ding not one proven production journey; ACTIVE WP rows 2–5 PARTIAL; §17.5 closure incomplete | high, **blocking** | **STILL OPEN** — *partially discharged, and the remainder is honestly still open* | Green Supabase populate **DISCHARGED** (later Gate 1 isolation green). The **combined** cue → Rule 4a → ding production journey remains **NOT** proven as one journey: the return-cue half is now live-proven at `0cf70c9`, but the ding remains a **Larry judgement call**, deliberately un-mechanised (root `CLAUDE.md` § Rule 4a). **It continues to block any Phase 4 PASS / complete / closed / accepted claim.** |
| **V9-2** — Watcher/Tower: TowerBot-credentialed restart and fresh-session discovery residual; live log not re-proven at this exact tip | medium | **STILL OPEN** | Not addressed by this package and **not claimed**. No TowerBot-credentialed restart was executed at `0cf70c9`. Non-blocking for unrelated work; **gates row-4 strict PASS**. Owner: Mack / Larry — park or re-prove. |
| **V9-3** — AC-5 accept notes remain thin (1–2 lines); "materially lower cost" not freshly instrumented for the three-order streak | low | **STILL OPEN — parked** | Untouched by this package. No fresh cost instrumentation was performed, and I do not claim any. Explicitly **non-blocking**; parked to the one scheduled documentation reconciliation per the finding-disposition rule. |
| **V9-4** — No full-package Gate 1 PASS receipt at tip `95f8826` for ACTIVE rows 1–5; map still lists Gate 1 pending | process | **DISCHARGED — as to the process gap only** | A **full-package** Gate 1 receipt now exists at the exact head `0cf70c9`, graded **per-row across the complete amended functional set (rows 1–4)**, with scope **explicitly not narrowed**: `Deliverables/2026-08-06-veritas-gate1-amended-wp-0cf70c9-receipt.md`. **⚠️ Read this precisely:** V9-4 recorded the *absence of a full-package receipt*, and that absence is closed. **The receipt's verdict is FAIL, so nothing here supports treating Gate 1 as a package PASS** — the very thing V9-4 warned against. The process gap is discharged; the package is not. |

**Coverage check, auditable by name:** V9-1 ✅ · V9-2 ✅ · V9-3 ✅ · V9-4 ✅ — **4 of 4**, each with exactly
one disposition. The `P-*` table above is retained as the working narrative that produced these, not
as the coverage claim.

---

## Row 3 — CareerAIR Outlook intake

### Intended route (discovered, not assumed)

**Zapier is transport; CareerAIR never pulls Graph in the accepted design.**

```
Outlook rules → CareerAIR/Opportunities + CareerAIR/Application Updates
  → Zapier "New Message in Folder"
    → POST /careerair/email-intake (shared secret)
      → durable queue (message.id idempotency)
        → scheduled processor 08:00/12:00/17:00 Europe/London
```

Private contracts: `contracts/EMAIL-INTAKE-CONTRACT.md`, `config/outlook-scout.json`.

### Live facts

| Fact | Evidence |
|---|---|
| Mailbox | `warwickallan@outlook.com` (authorised) |
| Folders | CareerAIR parent exists (Graph list_folders); 2 children; parent item count 0 at recon |
| Email tables | `careerair.email_message`, `email_delivery`, `email_run` present |
| Pre-session queue | 0 messages, 0 runs |
| Webhook secret | Generated into `C:\.fusion247\careerair.env` as `CAREERAIR_EMAIL_WEBHOOK_SECRET` (value never logged) |
| Webhook server | Listens `127.0.0.1:8787`; supervised via `ensure-local-services` service key `email` |
| Controlled fixture (synthetic POST) | POST → `emailMessageId=73`, `duplicate:false`; second POST `duplicate:true` deliveryCount=2 |
| Controlled fixture **from Outlook folder** | Draft created → moved to CareerAIR/Opportunities → normalised POST → `emailMessageId=75` duplicate-safe → processor claimed 1, processed 1 → new opportunity; **no application submitted** |
| Processor | recovery runs claimed/processed fixtures → states `done` (2 messages) |
| Scheduled processor tasks | `CareerAIR-Email-0800/1200/1700` created |
| Public Zapier reachability | **NOT DONE** — Tailscale Funnel **not enabled** on tailnet (requires Warwick account action at Tailscale admin URL); no Hetzner deploy this pass |
| Outlook rules → folders | **UNPROVEN** — folders empty of real mail; rules recommendations exist private-only |
| Graph pull | **Not built** — rejected by accepted design; do not invent second collector |

### Acceptance journey status

| Step | Status |
|---|---|
| Message in intended Outlook location | **Partial** — folders exist; no real eligible mail observed |
| Production collector discovers without Larry session | **HOLD** — Zapier public ingress not live; local webhook is up |
| Self-load credentials | **PASS** for webhook secret + DB env-file |
| Persist before ack | **PASS** (fixture) |
| No-dupe on restart/retry | **PASS** (fixture duplicate) |
| Enters intake path | **PASS** (fixture → opportunity) |
| Correct next governed state | **PASS** for fixture classification path |
| No application submitted | **PASS** (no external consequential action) |
| Observable success/failure | **PASS** (run summary + email-ops) |
| Kill/restart collector resume | **PASS** for webhook process restart; queue durable |
| Fresh session health/last success/pending/oldest | **PASS** via `/careerair/api/email-ops` |

**Honest residual for automatic Outlook:** public Zapier (or Funnel) + two Zaps + mailbox rules — irreducible network/account setup. Local half of the intended route is restored and proven with controlled fixture.

---

## Row 4 — Cockpit production

### Root causes found

1. **`MyPKA-Local-Services-Live` Disabled** since 2026-08-04 → cockpit eventually ran without overlay.
2. **Missing `pg` module** under `C:\Fusion247PKA\services\control-plane\node_modules` → supervised restart failed until `npm install pg`.
3. **Missing `/private-api` bridge** in public cockpit despite overlay requiring `API='/private-api'` and supervisor setting `COCKPIT_PRIVATE_API` → CareerAIR data 404 through same-origin path.
4. CareerAIR API healthy independently on `:8791`.

### Repairs

| Repair | Result |
|---|---|
| Re-enable `MyPKA-Local-Services-Live` | Status **Ready**, next run scheduled |
| Restore `pg` | Cockpit starts |
| Ensure supervisor | Cockpit UP + overlay ~58–60kB with CareerAIR |
| Public private-api proxy | Banked in trial `services/cockpit/server.mjs`; applied live |
| `/careerair/api/email-ops` + overlay strip | Collector/consumer/pending/last success; distinguishes no messages vs collector down |
| Email in supervisor | `ensure-local-services` now includes `email` service |

### Browser / executable journey

| Check | Result |
|---|---|
| `GET /` 200 | PASS |
| `GET /private-apps.js` contains CareerAIR | PASS |
| `GET /private-api/careerair/health` | PASS |
| `GET /private-api/careerair/api/overview` | PASS (counts only) |
| `GET /private-api/careerair/api/email-ops` | PASS when webhook up; correctly **unhealthy** when webhook down |

**Browser shoot executed** (`cockpit/shoot.mjs` → `runtime/proof/cockpit-home`, private):

| Shot | Result |
|---|---|
| Home | rendered |
| Apps grid — CareerAIR tile | rendered |
| Overview — overlay rendered 65716 chars | **PASS** (email strip + KPIs path live) |
| Opportunities / Fit / Applications / Documents / About / Add-a-job | rendered |
| Desktop Fit 1280 | rendered |

API + shell routes also executed against live ports Warwick uses (`8090` / tailnet `:8443`).

---

## Explicitly not done this recon slice

- Zapier Zap creation / Funnel enable (account-authority)
- Full Veritas Gate 1 / Gate 2 / Codex (after more integration)
- ~~Claude host hook install (next WP)~~ ⛔ **RE-CUT 2026-08-07 (Veritas Gate 1 @ `19fc792`, finding E-2, non-blocking).** *"next WP"* recorded this as **DEFERRED**. **Amendment 5 WITHDREW the outcome** — the reminder system is descoped and disabled. **It is not a next-WP item and there is no WP it is waiting for.** *(Same defect class as the four re-cut in the map, and it survived four map re-cuts because **it lived one document over**. Larry's grep of the map was correct and still missed it — the class is not confined to the artefact you last repaired.)*
- C-1..C-9, C-11..C-15
- Replacement-machine DR
