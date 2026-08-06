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
| Live cockpit `C:\Fusion247PKA\services\cockpit\server.mjs` | PR + live patch | Propagate private-api proxy (applied live + banked in trial) |
| Claude host hooks | tracked `.claude/**` | **Next Claude WP** — do not install in this Grok session |

---

## Row 2 — Old Gate 2 residuals disposition (against current evidence)

Prior Gate 2 receipt: `Deliverables/2026-08-06-veritas-gate2-phase4-receipt.md` @ `95f8826`.

| Residual | Disposition | Basis |
|---|---|---|
| P-JOB1 ordinary WO route | **DISCHARGED** | Gate 1 row 1 PASS @ product head; hermetic suite banked |
| P-JOB2 FusionDevBot path | **DISCHARGED** | Gate 1 + ding transport evidence |
| P-LAW automation law | **DISCHARGED** | Canonical in root `CLAUDE.md` |
| P-CUE combined cue→ding journey | **RECLASSIFIED / STILL OPEN for phase** | Claude live; Grok Option C honest; combined host-automatic journey is next-WP Claude host install — **not** this package's product row |
| P-TOWER Watcher durability | **DISCHARGED (capability)** with residual park | Cold-start + start-watcher banked; operator notify residual non-blocking for phase if not required by North Star journey |
| P-ROTATE + green Supabase | **DISCHARGED** | Real `/rotate` + green populate banked @ freeze head |
| P-CLOSE ordered phase close | **STILL OPEN** | Phase PASS still requires Gate 2 re-verdict at final head; honest **WP PASS / Phase HOLD** remains valid if post-merge Claude host journey is the remaining North Star acceptance |
| Green populate unestablished (old text) | **DISCHARGED** | Superseded by later Gate 1 isolation green |
| Combined cue→ding one journey | **NOT PART OF THIS AMENDED WP product rows** / may remain Gate 2 | Next Claude WP |

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
| Controlled fixture | POST → `emailMessageId=73`, `duplicate:false`; second POST `duplicate:true` deliveryCount=2 |
| Processor | recovery run claimed 1, processed 1 → 1 new opportunity; state `done` |
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

Full CDP screenshot campaign: optional; API + shell routes executed against live ports Warwick uses (`8090` / tailnet `:8443`).

---

## Explicitly not done this recon slice

- Zapier Zap creation / Funnel enable (account-authority)
- Full Veritas Gate 1 / Gate 2 / Codex (after more integration)
- Claude host hook install (next WP)
- C-1..C-9, C-11..C-15
- Replacement-machine DR
