# Fusion247 — candidate queue

**Cleaned 2026-08-05 (BUILD-020 WP-3D, on Warwick's instruction).** His criteria, applied in order: remove resolved, superseded, duplicated and non-actionable entries · remove AsdAIr work, which remains explicitly deferred · remove parked maintenance that does not advance the active Star · **retain only genuine, evidenced candidates for subsequent work.**

**What this file is:** the single list of real candidate jobs. **Every entry below is evidenced** — a claim with a reason to believe it, not a worry. Nothing sits here because it might one day matter.

**What this file is NOT:** an idea board, a tracker for work already authorised and routed elsewhere, or a place to park a tangent so it looks handled. **An entry leaves this list in exactly two ways — it becomes an authorised Work Order, or it is explicitly closed as won't-fix with a reason.**

> **Removals are ledgered at the bottom, one line each.** Nothing was deleted silently, and git history holds every removed entry in full.

---

## 🔴 Evidence integrity — a green that proves nothing

| # | Candidate | Evidence | Waiting on |
|---|---|---|---|
| **C-1** | **CI can go green having run zero tests, and `node --test` inflates the count it does report.** Two halves of one defect. (a) `node --test "<glob-matching-nothing>"` **exits 0 with zero executed tests.** Nine workflows run `node --test`; `control-plane-tests.yml` documents a fail-on-0-executed-subtests guard, **whether the other eight carry one is UNVERIFIED.** (b) `node --test` executes **every `.js`/`.mjs` under `test/**`**, not only `*.test.js`, so a helper module runs and is counted as a passing entry that asserted nothing. **Any service in the estate with non-test files under `test/` has an inflated `# tests` count.** | Verified in an empty directory 2026-07-29 (a); map §2 / P-8, 2026-08-04 (b) | Larry — audit all 9 workflows for a zero-subtest guard |
| **C-2** | **Assurance receipts are unverifiable by a cloning reviewer, including Codex — and `git checkout` is not a safe byte-restore in this repository.** One root cause: `core.autocrlf=true` with **no root `.gitattributes`**. The working tree holds LF; git's checkout representation is CRLF. Restoring a file via `git checkout` produced byte-different content while git reported the tree clean; restoring the true original bytes made git report it *modified* with an empty `git diff`. **Consequence: `receipt_sha256` verifies only against the git blob, so a fresh clone renders CRLF and produces a FALSE TAMPER SIGNAL.** A root `.gitattributes` would close both halves. | Verified twice by execution (map P-10); **corroborated continuously — every commit on `build-020/phase3` emits `LF will be replaced by CRLF`** | **Warwick** — a `product-decision`, recorded and never yet decided |

## 🔒 Privacy and secrets

| # | Candidate | Evidence | Waiting on |
|---|---|---|---|
| **C-3** | **No privacy control exists over documentation, and the exposure sits exactly in the secret scanner's blind spot.** `scripts/secret-scan.sh` is a *secret* scanner — 20 detection classes for credential *shapes*, **no class for any term**. It is honestly green and never claimed otherwise. But it **excludes `.md` entirely**, and of 40 term-carrying files **34 were `.md`**. **The trap for whoever builds this:** the pattern file cannot live in the public repo — the term list would itself be the disclosure, and `git log -p` of it would be a changelog of every private project. It must live outside the repo. | Mutation-proven 2026-07-29: a planted AWS key in a tracked `.py` exits 1; the same key in a tracked `.md` exits 0 | Larry — Work Order |
| **C-4** | **Private agent shims are protected only by `.git/info/exclude` — local, un-versioned, and does not survive a fresh clone.** `.claude/agents/careerair.md` is excluded there, not in `.gitignore`. That protection exists on this machine only; any other clone or restore-from-scratch has none. **The fix is not obvious and must not be rushed: adding the name to `.gitignore` publishes the name.** It needs a pattern that does not enumerate what it protects. | Verified 2026-07-29 | **Warwick**, then Larry |
| **C-5** | **The BUILD-020 trial worktree carries a standing `Read(//c/.fusion247/**)` grant to the SECRETS STORE ROOT.** `.claude/settings.local.json:10`. GL-012 is deny-by-default with access to exactly one `private/<project>/**` subtree — **never the root, never a parent.** Found by Mack during the Honcho investigation and **not exercised**. | Verified by Larry, 2026-08-05 | **Warwick** — GL-012 disposition |

## ⚙️ Correctness and safety

| # | Candidate | Evidence | Waiting on |
|---|---|---|---|
| **C-6** | **Worktree isolation does NOT isolate the database.** `services/cockpit/db.mjs:7` and `:10` are **absolute path LITERALS** into the main checkout for both the `pg` module and the credentials file, then open a `cp_worker` **write** pool. **A worktree copy of `server.mjs` inherits live write access to Warwick's real `attention_item` rows.** The isolation a worktree provides is silently opted out of by the code itself. **Anything else in the estate resolving credentials or native modules by absolute path has the same property — worth a sweep.** Same defect from the other direction: importing `server.mjs` opens the live pool, which is *why* `serveStatic` could not be executed by any gate — so the gate grepped it as text and a deleted load-bearing line stayed green. | Found by a worker refusing to start a test server; confirmed again from the opposite direction 2026-07-29 | Larry — Work Order |
| **C-7** | **A withheld-by-policy gap is indistinguishable from a genuine absence.** In the evidence retrieval layer, `retrieval.meta.excluded_by_sensitivity` counts only rows caught by the defence-in-depth filter — so on the normal path it reports **0**. Downstream prose saying *"N pieces were held back"* therefore only ever fires when the store misbehaves, and a gap caused by **correctly** withholding sensitive evidence reads exactly like the evidence not existing. | Found by a failing test written by a consumer of the layer, not its author; both behaviours now pinned by tests | Larry — Work Order (the fix belongs in the evidence layer) |
| **C-8** | **Attention-item state transitions are not historised, and cannot be from the front end.** `attention_item` stores a single current `status` + `updated_at` — no event table, trigger or audit column across all four migrations that touch it. Both sibling lifecycles have one (`idea_event`, `opportunity_event`); this one never did. The runtime holds a column-tight `update` grant with **no insert rights anywhere**, so it could not append a history row even if the table existed. **A restored item shows *deferred → open* with no trace, and the history is not reconstructible.** Warwick's requirement that deferred items retain their status history is half-met — data yes, history no. | Verified 2026-07-29; the shipped UI states the limitation rather than implying a timeline that does not exist | Larry — Work Order (Silas decides the shape, Keel authors it) |

## 🔕 Silent channels — where absence looks like health

| # | Candidate | Evidence | Waiting on |
|---|---|---|---|
| **C-9** | **The governor writes NO log when a continuity packet fails to deliver.** `nextSeq()` increments before delivery, so seq stands at 152 while **only 149 packets are stored — three were built and never landed over the store's life, and nothing recorded any of them.** This is the sole reason the 2026-08-05 20:4xZ incident is permanently unrecoverable. **Verified negative: no governor log exists anywhere under `~/.mypka/**`** (only Tower's `watcher.log`, a different subsystem). | Mack, 2026-08-05 — `Deliverables/proofline/EVIDENCE-2026-08-05-honcho-regression.md` | **Warwick** — one durable line is arguably not a mechanism, but the regrowth cap makes that his call |
| **C-10** | **CareerAIR intake has no consumer, and the backlog grows SILENTLY.** The serving layer is genuinely healthy (bot + cockpit API up 3.4 days). The gap is downstream: nothing drains the inbox and **nothing reports its depth**, so a backlog accumulates with no signal — the same silent-channel shape that bit this estate three times in one night. **Depth is NOT established, deliberately:** the runtime lives on a private surface under `C:\.fusion247\**`, GL-012 denies by default, and no `private_surface` was declared. **BOUNDARY: the first move is VISIBILITY, not automation** — a scheduled count that dings *"N waiting, oldest X days"*. Whether to auto-run the fit gate on new intake is a **separate `product-decision`** and must not be smuggled in with the counter. | Established 2026-08-02 | Larry — Work Order **with a declared `private_surface`** (`C:\.fusion247\private\<careerair-project>\**`, named precisely — not the root, not a parent) |
| **C-11** | **A permanently-red-by-design workflow trains everyone to ignore red.** `notify-snapshot-consumers.yml` last resulted `failure` on `main` at `76fcc7f8`, **2026-07-10 — eighteen days invisible**, because it only fires when `Expansions/` changes and had dropped out of every recent run listing. The failure is documented and intentional: it fail-fasts until two repo secrets exist, and changes nothing meanwhile. **Warwick's ruling, 2026-07-28: a permanent red-by-design is not acceptable state. Do not configure or invent secrets.** Either (a) disable the automatic trigger, or (b) make missing configuration report an explicit **successful NOT-CONFIGURED / NOT-RUN** state — while retaining manual dispatch and the documented prerequisites in the header. | Found by the estate-hygiene pass applying the CI doctrine | Larry — **the decision is already made; this is execution** |
| **C-12** | **[HIGH] Live YouTube capture still says "knowledge note pending — I'll write it next session".** The automatic Cairn → learn-worker → §7.1 → LightRAG → graph pipeline **exists** (IDEA-007) but is **not wired into the live capture bot and not running as a daemon**, so a captured video sits un-learned until a session runs the worker by hand. **A real gap, not by design.** Fix: wire "Save to Brain" (or auto) → enqueue a Cairn LEARN job → run the learn-worker as a live daemon, with the enrich step. | Reported 2026-07-25 — Warwick sent a video and no card or learn happened | Larry — Work Order |

## 📐 Open design decisions — deliberate, not deferred by accident

| # | Candidate | Evidence | Waiting on |
|---|---|---|---|
| **C-13** | **Off-machine capture persistence — which ref, and when.** `persistCapture.mjs` makes generated captures durable by **committing** the note and its immutable `_raw` evidence, removing the loose-untracked failure mode that stranded two captures. **Warwick's ruling 2026-07-28: persistence stays COMMIT-ONLY — do NOT auto-push the checked-out branch**, because that chooses a branch and a moment on the caller's behalf, mid-work, which is uncertain repository semantics. Off-machine durability therefore still relies on the normal push/PR flow. **The open question is to be taken deliberately: a dedicated captures ref, a scheduled sync, or a non-git store.** `pending-warwick-review` remains the human gate regardless — **stored/durable ≠ approved/canonical.** | PR #77, 2026-07-28 | **Warwick** — a design decision, never to be inferred |
| **C-14** | **Proofline contract deviation — an approval note is durably stored but can never be read back.** Map §5.4 specifies `decision` as `{verdict, note, at}`; the service returns the bare string `"approved"`. **The note IS durably stored** — the `job.decided` journal record carries it — **but it is not readable through the API**, so a note Warwick writes when approving can never be seen again. Minor also: `error` is absent from the response rather than `null` as specified. | Verified live 2026-08-04: journal record 4 holds the note; `GET /api/jobs/:key` does not (map P-12) | **Warwick** — either the contract is wrong or the code is; his call |
| **C-15** | **`INSTALLED-FROM.txt` misdescribes the live machine.** It states the project-level `settings.local.json` *"was removed 2026-08-05"*. The file exists — 28,238 bytes, mtime 17:39. The true reading is that the **governor entries** were removed from within it; the file remains and still carries three non-governor hooks. **An install record that misdescribes the machine is a live orientation hazard**, not housekeeping. | Mack, 2026-08-05 | Larry — smallest correction, when the governor install is next touched |

## 🔨 Cockpit (IDEA-016) — remaining scope, retained because it is genuine and evidenced

- Shopping projector → Attention (alternatives-awaiting-choice, budget flags) — DONE-criterion #3.
- Builds/System live projections, replacing the hand-curated Home / `overall_state` tables — DONE-criterion #1 (full).
- Telegram notification loop: durable outbox → consequential notification → deep-link into the exact cockpit item → act → receipt — DONE-criterion #5.
- Withheld-capability plug-in proof (sidebar route + one projector) — DONE-criterion #7.

---

## 🧹 Removal ledger — 2026-08-05, WP-3D

**Every removal, one line, with the criterion applied. Full text is in git history.**

| Removed | Criterion |
|---|---|
| **Two pre-existing AsdAIr (BUILD-015) CI failures** (was row 11) | **AsdAIr — explicitly deferred by Warwick.** The diagnosis and an uncommitted fix remain in worktree `C:\Fusion247PKA-wo-asdair-ci`, branch `build-020/asdair-ci-fix` |
| **Honcho pagination / `readLatest` staleness** (was row 10) | **Superseded — its substance is now inside BUILD-020 WP-3A.** Keel has been given the row's four load-bearing facts directly, including that its `size:50` cap measurement is now stale |
| **Bidirectional PR ⇄ Tower seam** (was row 9) | **Duplicated — Warwick overturned the deferral and authorised it.** Active work in the operating-reset Wayfinder Phase 7, not a candidate |
| **`migrations/README.md` stale in the private CareerAIR tree** (was row 5) | Parked documentation maintenance; does not advance the active Star |
| **`runtime.json` holds the old Directus admin password** | Non-actionable — explicitly harmless, and stated as such when raised |
| **Stale Fusion self-model tables** (`cockpit.build`, `cockpit.overall_state`) | Non-actionable direction rather than a job, and recorded as deliberately out of scope where raised |
| **"Larry's rich context must not evaporate on compaction/restart"** | **Superseded** — substantially what BUILD-020 Phase 2 delivered and Phase 3 is completing |
| **Shopping action wiring** (governed choose/approve buttons via the asdair command seam) | **AsdAIr — explicitly deferred**, and it mutates live household data |
| **"Backlog surface in the cockpit"** · **"A Save to Brain tap"** | An idea; and a duplicate of C-12 |
| **Cockpit UX notes from Grok's cold-read** (passive Outputs cards, a parked/later state, the clear-in-two-minutes metric) | Ideas and observations, not evidenced candidates. One line in that block recorded work already **DONE** |
| **The "HELD BY LARRY" preamble** | **Retained in substance, not removed** — its rule ("nothing sits between raised and authorised without a line here") is now the second paragraph of this file |
