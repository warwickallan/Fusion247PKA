# CONVERGE → MIGRATE → CUT OVER → VERIFY — executed evidence, 2026-08-10

**Warwick's critical-path instruction, executed in his order. Every line below is a measurement, not
a claim.** The photograph is the next step and nothing else stands before it.

---

## 1. CONVERGE — one executable head

| Lane | Branch | Merged |
|---|---|---|
| Lane A free-text · Lane C browser · R1 rulebook · R2 wiring · R3 archive · R4 rule 37 · INT1 | `b15-3/integration` | already on it |
| Rule 37 companion line (R5) | `b15-3/rule37-companion` | ✅ **zero conflicts** |
| Remembered choice + 018 (M1) + Larry's allowlist fix | `b15-3/remembered-choice` | ✅ **zero conflicts** |

**Converged head: `c4d74d2`.** Pushed to `origin/b15-3/integration`, then **fast-forwarded onto
`main`** — so the head the runtime loads and the head under test are the same commit, not two things
that resemble each other.

### Full suite sweep AT `c4d74d2` — counts, never exit codes

| Suite | Result |
|---|---|
| pipeline | **366 / 366** |
| handoff | 114 / 114 |
| packet | 109 / 109 |
| browser-runner | 75 / 75 |
| bot | 165 / 165 |
| intake | 34 / 34 |
| reconcile | 106 / 106 |
| skill | 296 run, **287 pass**, 7 fail *(the same seven pre-existing environment failures by name — `pg` absent, `ASDAIR_DB_URL` unset)*, 2 skipped |
| `handoff/mutation-proof.js` | **9/9 guards proven load-bearing** |

**1,265 tests. No failure introduced by convergence.** A clean merge is not a working merge — this
was run, not assumed.

---

## 2. MIGRATE — 018 applied to the household database

Applied under Warwick's standing authority, no new approval round. **Preconditions checked before
applying**, not after: `asdair.households`, `asdair.regulars`, `asdair.shop`, `asdair.shop_decision`
all present; `asdair.remembered_choice` **absent**; role `asdair_rw` present; `decision_kind` values
in use include `existing_regular`.

### Verified after — schema, constraints, grants, state

| Check | Result |
|---|---|
| Table | `asdair.remembered_choice` present, **12 columns**, **0 rows** |
| CHECK constraints | **8/8 present** — `chosen_is_a_candidate`, `needs_an_ambiguity` (≥2 candidates), `candidates_are_ids`, `term_normalised`, `term_shaped`, `normaliser_shaped`, `authorised_by_known`, `source_kind_known` |
| **Composite FK** | `(source_decision_id, source_decision_kind) → asdair.shop_decision (id, decision_kind)` — **this is what makes Warwick's "authorised, not accidental" distinction PROVED rather than asserted** |
| Other FKs | `household_id → households`, `chosen_regular_id → regulars`, `source_shop_id → shop` |
| Indexes | pkey · `remembered_choice_decision_uniq` · `remembered_choice_lookup_idx` |
| **Constraints NOT VALID** | **zero** — every constraint is validated and enforcing, not merely declared |
| Grants | `asdair_rw` → **SELECT, INSERT**. `asdair_ro` → SELECT |
| **`asdair_rw` UPDATE / DELETE** | **FALSE / FALSE** — a remembered preference cannot be rewritten by any code path that exists or is added later |

*Checked deliberately: `has_table_privilege('asdair_rw','asdair.rules','UPDATE')` is still **false**.
The rules-CRUD gap is unchanged, exactly as intended — that work is off the critical path.*

---

## 3. CUT OVER — the real production route, not a hand-typed command

| Step | Command | Result |
|---|---|---|
| Baseline | `ensure-asdair-runtime.mjs --status --no-db` | PID **29668**, up 22,326 s, lock held |
| Stop | `ensure-asdair-runtime.mjs --stop` | `stopped pid 29668` |
| Start | **`Start-ScheduledTask -TaskName 'MyPKA-AsdAIr-Runtime'`** | `LastTaskResult 267009` (`0x41301` = currently running — expected in the settle window) |
| Confirm | `--status --no-db` | PID **26856**, started `23:30:07.959Z`, `identity_verified: true`, `stalled: false` |

**The scheduled task is the real production start path.** Larry handled no credential.

### ✅ The running process IS the converged head

1. **A genuinely new process holds the lock:** 29668 → **26856**, `identity_verified: true`, so a
   recycled pid cannot masquerade as this runtime.
2. **It started AFTER convergence.** `main` merged `23:25:54Z`; process started `23:30:07Z`.
3. **The bytes on disk ARE `HEAD`'s bytes**, compared with `git hash-object` against
   `git rev-parse HEAD:<path>` — **like for like**:

   | File | working tree | HEAD blob |
   |---|---|---|
   | `pipeline/runtime.js` | `e37ffa99cccc` | `e37ffa99cccc` |
   | `pipeline/runPipeline.js` | `7b26e94f82a6` | `7b26e94f82a6` |
   | `pipeline/rememberedChoice.js` | `67fec225c9ac` | `67fec225c9ac` |
   | `pipeline/deps.js` | `1290bddd5482` | `1290bddd5482` |
   | `skill/rulebook.js` | `140ad824099e` | `140ad824099e` |
   | `db/018_remembered_choice.sql` | `c661835a69bb` | `c661835a69bb` |

   `git status --porcelain services/asdair/` → **empty**.

   > ⚠️ **A trap worth recording, because it produced a false alarm here.** Comparing
   > `sha256sum <file>` against `git show HEAD:<file>` reports **MISMATCH on every file** — git
   > stores LF in its object database while this estate's working tree is CRLF, so those two can
   > never agree. **`git hash-object` applies git's own normalisation and is the correct
   > instrument.** Third line-ending trap of this work; the first two silently *passed* a broken
   > control and silently *skipped* four mutations.

4. **Node loads its module graph at startup.** The process started at `23:30:07Z` from a tree whose
   bytes are provably `HEAD`'s — **therefore it loaded the converged bytes.** Every link is an
   executed fact.

---

## 4. VERIFY RUNNING TRUTH — and the honest limit

### ✅ Proven

- The runtime is **alive, healthy and not stalled** — writing 40 s before the check, uptime 114 s.
- **It is working the schema after the restart:** `pg_stat_user_tables` shows `asdair.shop`,
  `asdair.shop_question` and `asdair.shop_decision` all scanned at **`23:30:14–23:30:19Z`**, i.e.
  *after* the `23:30:07Z` start, with no errors and no stall.
- **The runtime's own role can read the new table and cannot rewrite it** —
  `has_table_privilege('asdair_rw', 'asdair.remembered_choice', …)`: SELECT `true`, INSERT `true`,
  **UPDATE `false`, DELETE `false`**.

### ⛔ NOT PROVEN, AND NOT CLAIMED

**The runtime process has not itself read `asdair.remembered_choice`.** Its `last_seq_scan` is
`23:27:24Z` — **BEFORE** the `23:30:07Z` restart. **Those five scans are Larry's own verification
queries, not the runtime's.** The read happens on a planning pass, and no shop has been planned since
the restart.

**That is not a gap to close before the photograph — it is precisely what the photograph exercises.**
Recorded here so nobody mistakes a healthy runtime for an exercised code path. *(The identical trap
was recorded and avoided at the 017 cutover; this is the second time the same statistic would have
read as proof.)*

---

## 5. Standing limits, carried forward unchanged

- **No real shop has run.** B15-3 is **not live-complete** until the integrated production journey
  proves typed text → Terra interpretation → prose-rule application → durable decision/recompute →
  honest unresolved behaviour. Warwick has ruled that explicitly.
- **Nothing downstream — handoff packet, browser runner, reconcile — has ever been given a companion
  line**, i.e. an item that was not on the household's written list. The R5 worker flagged this
  unprompted as the most likely site of the next real defect. **Warwick has ruled that this is a
  reason to run the journey, not to delay it.**
- Rules-CRUD, rule 39's two `map` rows, and governor housekeeping are **off this path** and must not
  delay it.

**Posture reached: CONVERGE ✅ → MIGRATE ✅ → CUT OVER ✅ → VERIFY RUNNING TRUTH ✅ → PHOTO ⬅ next.**
