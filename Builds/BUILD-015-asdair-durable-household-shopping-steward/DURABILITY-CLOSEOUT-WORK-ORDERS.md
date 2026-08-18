# BUILD-015 — DURABILITY CLOSEOUT: THE WORK ORDER PROGRAMME

**Commissioned:** Warwick, 2026-08-03, after an 8-hour live acceptance run that built a
real basket but required extensive hand-holding.
**Authority:** Warwick's directive of 2026-08-03, "BUILD-015 DURABILITY CLOSEOUT — GIT IS
THE RECOVERY AUTHORITY", 18 sections. That message is the specification; this file is the
executable decomposition of it.

> **This file is NOT a claim of completion.** It is the plan. Warwick's own closing
> instruction stands: *"Do not declare 'durable,' 'complete,' 'ready' or 'recovered.'
> That verdict belongs to independent audit against the exact submitted head."*

---

## Honest statement of scale, written before any work order

The directive asks for something considerably larger than one session. Sections 4, 5, 6,
12, 13, 15 and 16 alone are each multi-day work. Attempting to claim them done tonight
would repeat the exact failure this programme exists to correct — asserting durability
that was never proven.

**What is already true (evidence in git, not assertion):**

- Tonight's live defects are recorded in `DEFECT-LEDGER.md` (20 entries, this build folder).
- `Team Knowledge/SOPs/SOP-021a-asdair-live-execution-method.md` holds the mechanical
  execution reality, written from the code rather than the prose.
- Migration `010_household_and_list_grants.sql` is committed and applied (`b19a097`).
- The catalogue id-type root cause is fixed with a real regression test (`62e4b61`).
- Asdair's contract and SOP-021 no longer contradict the proven Node/CDP runner (`27f4619`).

**What is emphatically NOT true yet:** everything else in the 18 sections. The work orders
below name it honestly.

---

## WO-A — Repo-level install and test for the whole AsdAIr product

**Directive §3.** Owner: **Keel.** Blocking: none. Size: S.

Thirteen-odd folders each with their own `package.json`. There is no single command that
installs and tests the product, which is why three separate `pg`-missing defects
(D-2026-08-03-01) reached a live run.

- One repo-level command that installs from lock files and runs every AsdAIr suite.
- Fails loudly on a missing lock file or an undeclared dependency.
- Each executable module documented with: install command, test command, runtime command,
  configuration contract, error behaviour, ownership boundary.
- Must run from a **clean checkout**, not from this machine's warmed state.

## WO-B — Preflight that actually proves the live configuration

**Directive §8.** Owner: **Keel.** Blocking: none. Size: M. **Highest value per unit effort.**

Four of tonight's defects (D-02, D-04, D-05, and half of D-07) would have been caught by a
preflight that checked what it claims to check. Warwick's words: *"A default model name
that the gateway does not provide must never survive preflight again."*

Preflight must prove, before consuming a shopping request:

- bot credentials present (without printing them); allowlist valid;
- read AND write DB connections work; required tables exist;
- **grants genuinely exist** for both roles (`has_table_privilege`, not assumption);
- media path writable;
- gateway reachable AND authenticating;
- **`FUSION_MODEL_VISION` is present in the gateway's own `/models` response**;
- Chrome exists; dedicated profile exists; runner can connect;
- exactly one runtime; dependencies resolve; scheduled task points at the current checkout.

Plus the full `.env.example` + configuration reference table (§8's field list) covering
every variable and every consuming process.

## WO-C — ~~The plan builder (resolved shop → browser-runner plan)~~ **SUPERSEDED 2026-08-04**

> **⚠️ RE-CUT 2026-08-17 — WARWICK'S PRODUCT RULING. This programme is a HISTORICAL record of the
> 2026-08-03 commissioning; the note below is corrected because it would otherwise misdirect priority.**
> **AsdAIr drives the browser and chooses its own execution mechanism; the CDP runner is AUTHORISED**
> (goal contract **S-5, S-7, S-8**). An executable plan for an authorised executor is therefore **back on the
> critical path**, and the right artefact is a durable, deterministic, Brand A–Z execution packet **produced by
> the product itself and never hand-assembled by a Claude session** — whichever executor consumes it.
>
> ~~**SUPERSEDED by Warwick's ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`, 2026-08-04.**
> See `RUNTIME-DECISION.md`. The live basket writer is **Sonnet in Claude for Chrome**, not
> the custom CDP runner, so a plan builder that targets that runner is no longer on the
> live-runtime critical path.~~
>
> ~~**What replaces it: WO-P**, the Sonnet Browser Execution Packet — a different artefact for
> a different consumer, ordered **Brand A–Z**, exposed as JSON, as a human checklist, in the
> Cockpit and to the Sonnet handoff.~~ *(Struck 2026-08-17: the packet is not Sonnet's, and the runner is not
> excluded.)* The diagnosis below stays on the record because it is still true and still the reason that
> night's basket needed hand-assembled files.

**Original entry, retained:** Owner: **Keel.** Blocking: none. Size: M. **Largest functional gap.**

`step_id` exists in 9 files, all inside `browser-runner/`. `stepQueueBrowserBuild` writes
the request row and never populates `progress.plan`. Tonight's basket came from three
hand-written plan files. Until this exists, "runs independent of any Claude Code session"
is false by construction (D-2026-08-03-12).

- Convert resolved `shop_line` rows + `regulars` product refs into a validated plan.
- `add_known_product` where a product ref is known; a real search path where it is not.
- Respect quantities exactly; never invent; hold ambiguous/`possible_duplicate` lines.
- Idempotent `step_id`s; must survive the D-14 re-run trap (new request row, not a reseed).
- Tests against realistic pg-typed fixtures (string bigints), per D-06's lesson.

## WO-D — ~~Bulk add via the Regulars grid~~ **CANCELLED 2026-08-04**

> **CANCELLED as live-runtime work** by the same ruling. It rested on SOP-021's description
> of the proven process as a *"tick everything, one bulk Add selected"* operation.
> **Warwick's correction: the proven process was FAST ORDERED TRAVERSAL, not an assumed
> one-click bulk operation.** The speed came from Brand A–Z ordering and sequence, not from
> a bulk control.
>
> So this work order was written against a misreading of a document that was itself
> describing the browser process rather than specifying runner code. Do not document the
> proven method as mass checkbox selection unless evidence proves that was the action.
> Cancelled, not deferred — there is nothing here to build.

**Original entry, retained:** Owner: **Keel**, after WO-C. Size: M. Requires a **product decision** first.

Measured: the current one-at-a-time path is ~13s/item, ~25–30s on fallback — 10–20 minutes
for a 40-line shop, against Warwick's ~5 minutes browser-driving benchmark. SOP-021's
bulk method was never runner code (D-17).

- Open question, **not decidable by a builder:** is the Regulars bulk control safe to drive
  programmatically? `EXPERIMENT-RESULT.md` records only that the control *exists*.
- Must preserve: no auto-substitution, out-of-stock isolation (SOP-021's "one OOS item
  rejects the whole batch" lesson), read-back verification.

## WO-E — Backfill the defect ledger across all of BUILD-015

**Directive §9.** Owner: **Pax.** Size: M.

`DEFECT-LEDGER.md` currently covers 2026-08-03 only. Backfill every prior class from
branches, PRs, reviews, session logs and commit history — the ~25 classes Warwick
enumerated (scratchpad receiver, no durable learning, allowlist name mismatch, machine
ledger as human actions, stale tap ordering, command consumed twice, offset-before-persist,
reboot recovery unproven, budget collapsing catalogue scope, rule conflicts, and the rest).
Every entry needs the full field set, and a **pointer to** its commit — the commit message
is evidence, not the ledger.

## WO-F — Decision ledger

**Directive §10.** Owner: **Pax.** Size: M.

Ordered, with exact wording where a ruling materially constrained the product; superseded
decisions marked superseded, **not left side by side**. Must preserve the documented arc:
session-driven shop → supervised Larry operation → Asdair as judgement layer → independent
Node/CDP runner → runtime independent of Claude Code → Git as function authority, Supabase
as operational state → all reconstruction knowledge Git-backed.

## WO-G — Database reconstruction from empty Postgres

**Directive §4.** Owner: **Silas.** Size: L.

Git must be able to build the complete AsdAIr database from nothing: ordered migrations
covering every live object (tables, constraints, partial indexes, enums, sequences, views,
functions, triggers, extensions, RLS state and policies, role definitions without
passwords, and the full `asdair_ro` / `asdair_rw` / `cp_directus` / `cp_worker` privilege
matrix). Plus: idempotent runner, teardown path, **automated empty-database reconstruction
test**, live-schema export + normalisation + diff, CI failing on unexplained drift, and a
sanitized schema snapshot carrying no data or secrets.

Migration 010 must be part of the ordered set, not an incident patch.

## WO-H — Data inventory and the public/private recovery split

**Directive §5.** Owner: **Silas.** Size: L. **Touches personal data — read GL-012 and the
public-repo rule first.**

`services/asdair/db/DATA-INVENTORY.md` per §5's field list. Two layers:

- **Public:** schemas, migrations, sanitized fixtures, seed format + validation,
  export/import scripts, checksums, recovery docs.
- **Private, encrypted:** the real household catalogue, aliases, rule rows, budget config,
  historical rotation state, a complete restorable backup.

The public manifest names the private artefact, its encryption, version, checksum, backup
date and restore instructions — **without exposing contents.** No plaintext household data,
ASDA credentials, bot tokens, DB passwords or gateway keys in the public repo, ever.

Note: migration `011_decisions_log_rule_notes_seed.sql` already exists and is correctly
gitignored under the sanctioned `*seed*.sql` pattern because it carries household rows. It
is **written but not applied** (needs the admin role; `asdair_rw` deliberately lacks UPDATE
on `rules`). See D-16.

## WO-I — Google Drive migration

**Directive §6.** Owner: **Pax** (Larry must fetch — subagents have no Drive access). Size: M.

Every AsdAIr / IDEA-012 / BUILD-015 Drive document: fidelity-preserving export **plus**
normalized Markdown, with Drive file ID, original title, export date, checksum, and whether
it remains canonical / absorbed / provenance-only. Under
`Builds/BUILD-015-.../Sources/google-drive/`, linked from the manifest.

Known so far (found tonight): "Asda - Decisions Log" (`1GF-2o3vP0GsZv1jrerK358SJqNj7ZEGJ49hsMDNFL8w`),
"ASDA Regulars - Category and Name" (`1EUSAHb6cK_4DlpT-p5svi64XnA1yCKgnBFiUOvIOM4k`),
"ASDA Shopping Agent - Method Statement", "AGENT — AsdAIr Household Shopping Manager.md",
"Asda - Order History", "README — AsdAIr Household Shopping (START HERE).md", plus copies.
**A PDF dump alone is insufficient.**

## WO-J — Durability manifest and index

**Directive §1/§2.** Owner: **Larry**, after WO-E…WO-I land. Size: M.

`DURABILITY-MANIFEST.yaml` (per §1's field list, **failing CI when a required path is
absent**) and `DURABILITY-INDEX.md` as the front door. Plus the complete BUILD-015 system
record per §2 — goal contract, North Star, scope, non-goals, authority split, supervised vs
autonomous boundary, full state machine, the four invariants, acceptance criteria, accepted
residuals, deferred capabilities, open decisions, and the **exact** operational-readiness
and live-acceptance status.

## WO-K — Machine reconstruction and runbook

**Directive §11.** Owner: **Keel** + **Mack** (Mack owns operation). Size: M.

Idempotent bootstrap for a fresh Windows machine, plus runbooks for: first install, normal
weekly operation, reauthentication, bot-token rotation, DB credential rotation,
gateway-model change, Chrome-profile loss, machine replacement, database restore, recovery
after abrupt termination, rollback to last known good. **No step may say "Larry knows where
this is."**

## WO-L — Backup, restore and DR proof

**Directive §12.** Owner: **Silas** + **Mack**. Size: L.

Schema backup, encrypted data backup, manifest, checksums, restore scripts and ordering,
post-restore verification, rollback, RPO/RTO statements, and **evidence of a real restore
into a disposable database** verifying table counts, constraints, grants, rules, regulars,
aliases, last-order data, pending questions, incomplete shops, browser-build requests and
learning history. *A backup that has never been restored is not evidence.*

## WO-M — CI and automated controls

**Directive §13.** Owner: **Keel**. Size: L. Depends on WO-A, WO-G.

Everything in §13's list, from a clean checkout. Critically: **no skipped test may
disappear into a green total** — every skip listed with its reason and whether it blocks
durability.

## WO-N — Fix the open defects from tonight

Owner: **Keel**. Size: S–M each. All are in `DEFECT-LEDGER.md` with full detail.

| Ref | Defect | Note |
|---|---|---|
| D-09 | Progress card fires once per shop, not per attempt | Cost Warwick real confusion; he double-tapped |
| D-10 | `answerCallbackQuery` always fails; every tap looks broken | **Do not fix by acking first** — that breaks persist-before-ack |
| D-13 | Latent bigint-as-string in `shopLines` fallback branch | Unreachable today; identical to the CRITICAL defect |
| D-15 | Exact-string alias matching (word order, typos) | Cost two needless questions tonight |
| D-16 | `planner.js:882` **sums** quantities on dedupe | Contradicts the household's own recorded rule. Money-consequential |
| D-19 | Runtime stalls silently while reporting `running: true` | Detect via `last_write_at` vs wall clock |

## WO-O — Clean-room durability proof

**Directive §16.** Owner: **a fresh agent that has not seen this session.** Size: L.
**Runs last.** 24 numbered steps, from a new checkout at the exact proposed merge head,
with no narrative briefing from Larry. Recorded against each acceptance criterion.

---

## Sequencing

```
WO-B, WO-A  ──►  WO-C  ──►  WO-D (needs a product decision)
WO-G ──► WO-H ──► WO-L
WO-E, WO-F, WO-I  (parallel, independent)
        └──►  WO-J  ──►  WO-M  ──►  WO-O  ──►  §17 live acceptance
```

Highest value first: **WO-B**, then **WO-C**. Those two remove most of tonight's
hand-holding.

---

## SHOP-2026-08-03 — what actually happened

Per §17, stated plainly, with repairs **not** misreported as delivery:

- **Completed:** a real basket was built against Warwick's live ASDA account — 35 products,
  43 items, £136.94. Intake, catalogue-grounded interpretation, question batching, planning
  and browser execution all ran against real data.
- **Required hand-holding (the honest list):** three hand-assembled plan files (no plan
  builder exists); five live config/grant fixes applied mid-run; three service dependency
  installs; two runtime restarts after silent stalls; questions answered directly into the
  database by Larry rather than by Warwick through Telegram; product IDs captured by a
  hand-written scraper; six new regulars written by hand.
- **Failed / not delivered:** substitutions left ON (runner is hard-blocked by design —
  requires a human pass); ASDA Allergy & Hayfever tablets genuinely out of stock (correctly
  flagged, not substituted); Stardrops not stocked at ASDA (held, not substituted —
  closest is ASDA Pine Fresh Thick Disinfectant, ref 1181700, **Warwick's decision**).
- **Not proven:** that the runtime completes a shop without an active Claude Code session.
  Tonight it did not.

**Durable gains beyond the basket:** 13 existing regulars backfilled with real ASDA product
IDs; 6 new regulars created (ids 108–113) with aliases covering tonight's misreads
("bottle azera coffee", "white pepper", "tea towels"); the catalogue id-type defect fixed
with a regression test; the grants provenance gap closed in git.
