# EVIDENCE — WO-2026-08-05-12 · WP-3A: fix Honcho properly

**Builder self-test evidence — NOT independent review.**

| | |
|---|---|
| **Work Order** | `Deliverables/proofline/WO-2026-08-05-12-wp3a-honcho.md`, as amended by **Amendment 1** (`899b0a7`) |
| **Governance head** | `7bcfef70a3eea5763951019673120887544554d4` |
| **Worktree / branch** | `C:\Fusion247PKA-wp3a-honcho` · `build-020/wp-3a-honcho` |
| **Surface written** | `tools/governor/continuity.mjs` · `tools/governor/continuity.test.mjs` · this file. **Paths outside `file_surface`: 0** |
| **Authorities** | `credential_scope: none` · `live_authority: none` · **`network: none`** (struck from `BOUNDED` by Amendment 1 A-1) · `private_surface: none` · `dependency_policy: no-new-runtime-deps` — no dependency added |
| **Not done, deliberately** | No install. `~/.mypka/**` untouched. The fix is inert until WP-3E (Mack) |

---

## 1. Preflight findings

Run before any file was written; four became Amendment 1.

| # | Finding | Outcome |
|---|---|---|
| P-1 | **`network: BOUNDED` was not executable inside `credential_scope: none`.** The only live route is `hf()` → `honchoCtx()` → `loadHonchoEnv()` → `readFileSync('C:/.fusion247/honcho.env')` — the secrets-store **root**, ungrantable under GL-012 §4, forbidden material under §2, with §1 naming a read-only escape as *"precisely the leak this boundary exists to close"*. *"The module reads it, not me"* is a judgement step and GL-012 §3 exists to remove exactly that step. | **Upheld. Field struck to `none`.** Larry recorded that he had authorised the identical route earlier the same night (Amendment 2 to WO-10) and that it executed — a breach going to Warwick. Nothing in this Work Package needed it |
| P-2 | `file_surface` carried a judgement clause (*"…if and only if the fix genuinely requires it"*) in the one field git, the scope check and the scanner read literally | **Upheld.** `continuity-derive.mjs` removed from surface; it was not needed (it contains no read, write or pagination path) |
| P-3 | `operational_handoff` was free text (`WP-3E (Mack)`) where the worker must *check* the field, not infer it | **Upheld → `none`.** The runbook gate correctly does not bite: this is a defect repair inside an already-installed module, not a runnable service passing to Mack |
| P-4 | `capability_evidence` absent (mandatory field) | **Supplied from executed probes** — recorded in Amendment 1 A-4 |
| P-5 | Baseline established by execution before any edit: `node --test tools/governor/continuity.test.mjs` → **`# tests 92 / # pass 92 / # fail 0`** | Sound |

---

## 2. What changed, and why it is a *change* rather than a mechanism

Warwick's verbs for this phase are **remove, shorten, combine, change**. Nothing below adds a module, a store, a cache, a mirror, an outbox, a checker, a validator, a registry or a document family (§16.4). One field was added to an existing packet, two fields to an existing return value, one dead function removed.

### (a) Reliable frontier read at present and expected store size

**The hazard is not the one the order first named, and this is the reframing Amendment 1 adopted.** E-B established the abort was a **transient** (10/10 page-1 reads, worst case 9.8% of the 9,000 ms budget), so nothing here is built on "the store grew past the timeout". E-C established growth adds **pages**. The decisive risk is that **`reverse=true` is documented and whether the deployed server honours it is NOT established**: if it does not, page 1 is the **oldest** 100 of 149 and `readLatest` returns a packet roughly fifty writes behind the frontier — while `pages`, `total`, the repeat guard and the short-page rule all look healthy, because every one of those is a statement about the **walk** and none is a statement about the **order**.

- `listAllMessages` now returns **`incompleteReason`** (`page-failure` · `page-mismatch` · `repeat-window` · `page-cap` · `short-of-total`) and **`total`**, instead of a bare boolean that could not tell a reader whether one page was rejected or the whole ordering was wrong. `complete` is kept — every prior caller and test reads it.
- **Two positive checks replace two inferences.** `page-mismatch` reads the page the envelope *echoes* rather than deducing an ignored `page` from seeing nothing new; `short-of-total` reconciles what was collected against the `total` the envelope declares. Both are one comparison against data already in hand, on a path that normally terminates on the first response — **no extra request**.
- `readLatest` now returns **`latestIsAuthoritative`**, true only when the walk reached the end **or** the server positively demonstrated newest-first ordering in what it returned. It still returns `latest` when false, deliberately: throwing would remove the brief's honest-degradation path and turn a slow page 2 into a broken Stop hook. Warwick's bar is *"impossible or loud"* — this is the loud half, and both consumers (`readContinuityBrief`, `writeContinuity`) read it.
- **WO-OR-18's `⚠️ PAGINATION INCOMPLETE` floor is kept and graded, not replaced.** Both wordings still carry `PAGINATION INCOMPLETE` and `prefer the git map`; the new `🚨` form fires only when the frontier itself is unestablished.
- **Removed:** the dead `listMessages` wrapper (no callers).

### (c) No fail-open write-authority guard — done before (b), because it is the root

E-I: `writeContinuity` ran a full `readLatest` inside the write path, in a `catch` that fell through to an **unconditional write**. So the guard failed **open** exactly when it could not do its job — and E-F is the consequence: a slow Honcho made the read time out, the guard fell open, and the stale pointer was **kept**. Each fault hid the other.

Both constraints are honoured rather than traded:

- **The guard does not silently do the wrong thing.** An authority it cannot establish now **withholds** the pointer instead of publishing it.
- **The packet is not lost.** It is still built, still delivered, and every other field still writes normally. The Stop hook still does not throw.
- **And the withholding is recorded on the packet** (`map_path_withheld`, one of two **stable literal** codes). The previous silent `delete` made a withheld pointer byte-identical to a packet that never had one — two different situations with two different next actions for the reader. The codes are stable literals on purpose: `map_path_withheld` enters `packetContentHash`, so a reason carrying a network error string would change on every blip, defeat the Stop-hook dedupe, and write a packet per Stop.
- **Cost fell.** The guard reads **one page** (`maxPages: 1`) instead of walking the store — it only ever needed the newest packet's `ts` — and a server that ignores `reverse` can no longer fool it, because `latestIsAuthoritative` refuses to confirm an order it never saw. Asserted as a call count: 1 request where a full walk of the same fixture takes 3.
- **Preserved deliberately:** a manual `write`/`backfill` supplies no `sessionStartedAt` because it has **no session**, and still publishes. Folding that into the unestablished case would mean `continuity.mjs write` could never set a map pointer again. An **unparseable** value is a different thing and does land on the unestablished branch.

### (b) Correct `map_path` delivery

E-D/E-E: stripping was latent, and n=1 under the guard was itself the masked case. E-H: the next packet write is **at rotation**, which is exactly when the pointer is load-bearing. With (c) fixed the pointer can no longer be dropped *because the read was slow*, and the render now tells **withheld** apart from **never recorded** apart from **recorded but not present in this checkout**.

### (d) Degraded fallback identifies itself AND still orients

E-J: the success path already rendered an age and a closing orientation line; the failure branch rendered **neither**, despite holding the data. It now labels the cached focus `STALE BY CONSTRUCTION` with the age from `updated_at`, says plainly when there is **no** recall at all rather than trailing off, and **always** ends on the same instruction-free pointer to the map. *A degraded render that is honest but leaves the reader nowhere to go has met half the requirement.*

---

## 3. Executed evidence

All commands run in `C:\Fusion247PKA-wp3a-honcho` on Node **v22.18.0**. **Counts are asserted, never the exit code** — `node --test` exits 0 on zero tests (map §2).

### 3.1 The suite

```
node --test tools/governor/continuity.test.mjs
# tests 107
# pass 107
# fail 0
```

**Baseline before this Work Order: `# tests 92 / # pass 92 / # fail 0`.** 15 tests added; of the 92 inherited, **90 passed unchanged** and 2 were changed — see §5, which discloses exactly what and why.

### 3.2 Neighbours — nothing else in the module family regressed

```
node --test tools/governor/atomic-write.test.mjs tools/governor/continuity-derive.test.mjs \
  tools/governor/evaluator.test.mjs tools/governor/health-store.test.mjs \
  tools/governor/reorient.test.mjs tools/governor/sampler.test.mjs \
  tools/governor/statusline-live.test.mjs tools/governor/worktree-guard.test.mjs
# tests 253 / # pass 253 / # fail 0

node --test tools/governor/footer.test.mjs
# tests 65 / # pass 65 / # fail 0        (WP-3B's surface — untouched here, run only to prove it)
```

### 3.3 Mutation gate — nine controls, each made to fail and restored

*A control is not evidence until it has been made to fail.* Each mutation was applied to `continuity.mjs` alone, the suite run, the file restored, and the restoration verified by **sha256**.

Pristine and final sha256: **`ab904088b0f1b8fe6205121e6ee25e3489a84a22376299f462f048d011e90d4d`** — identical after all nine.

| # | Control broken | Suite | Killed by |
|---|---|---|---|
| M1 | positive page-echo check (`page-mismatch`) | 2 red | POSITIVE PAGE CHECK · EVERY INCOMPLETE WALK NAMES ITS CAUSE |
| M2 | count reconciliation (`short-of-total`) | 3 red | A SINGLE PACKET CONFIRMS NOTHING · COUNT RECONCILIATION · …NAMES ITS CAUSE |
| M3 | `latestIsAuthoritative` hardcoded `true` | 3 red | THE HAZARD · A SINGLE PACKET CONFIRMS NOTHING · THE BRIEF |
| M4 | `ordersNewestFirst` strict-decrease requirement dropped | 1 red | A SINGLE PACKET CONFIRMS NOTHING |
| M5 | **guard fails OPEN again on a read failure — the original defect** | 2 red | NO FAIL-OPEN · **COMBINED CASE (E-F)** |
| M6 | guard walks the whole store again (E-I cost) | 1 red | COST: the guard reads ONE page |
| M7 | degraded fallback loses its orientation line | 2 red | both DEGRADED RENDER tests |
| M8 | withheld pointer stops marking itself (silent `delete`) | 4 red | WRITE-AUTHORITY · NO FAIL-OPEN · COMBINED CASE · MUTATION CONTROL |
| M9 | escalated `🚨` render collapses into the mild one | 1 red | THE BRIEF |

**All nine killed. Final suite after all restorations: `# tests 107 / # fail 0`.**

### 3.4 The E-F combined case, as demanded

E-F is the phase's central test-design lesson: *"a test that exercises them one at a time will pass while both are broken."* `WP-3A(c) COMBINED CASE (E-F)` drives **both faults in one call** — a comparison read that aborts **and** a session whose start predates the stored write — and asserts the pointer is still withheld, the packet still delivered, and the stale path never rendered. Its partner, `MUTATION CONTROL: the combined case is not vacuously always-withhold`, proves all three directions are distinguishable: transport failure → `authority-unestablished`, timing → `stale-session`, healthy and fresh → **published**.

### 3.5 Secret scan — surface-scoped

```
bash scripts/secret-scan.sh --surface tools/governor/continuity.mjs \
  tools/governor/continuity.test.mjs Deliverables/proofline
```

Reported at handback in §6 with its coverage.

### 3.6 Scope check

```
git diff --stat 7bcfef70a3eea5763951019673120887544554d4
 tools/governor/continuity.mjs      | 263 +++++-
 tools/governor/continuity.test.mjs | 405 ++++++-
```

Reconciled against `file_surface`. **Paths outside the surface: 0.**

---

## 4. 🔴 The limit — what was NOT established, stated so it cannot be read as more

- **No live measurement was taken and none is reported.** `network: none`. The latency figures in evidence remain **E-B's**, not this Work Package's, and are not restated as if they were re-measured.
- **This proves the CODE's behaviour under a server that ignores `reverse`. It says NOTHING about what the deployed Honcho actually does.** Establishing that requires a live read, and the only route to one is `loadHonchoEnv()` reading the secrets-store root — refused here, and correctly. **The uncertainty is not resolved; it is made survivable.** If the server does honour `reverse`, these paths are inert insurance. If it does not, the reader is now told loudly instead of being handed a fifty-write-old frontier that looks healthy.
- **`total` is trusted as the server's own count.** If the envelope's `total` were itself wrong, `short-of-total` inherits that error. No independent count exists to check it against without a live read.
- **`short-of-total` can over-report.** A packet written between our page 1 and page 2 raises `total` under us, and the walk then reports incomplete for a store it read correctly. That direction was chosen deliberately: over-reporting costs a reader one look at the git map; under-reporting is the silent partial read this WP exists to remove.
- **Builder evidence on a disposable target only.** Everything above ran in this worktree with an injected transport and a sandboxed `HOME`. Nothing was proven on the real machine, against the real store, with the real config. **First live behaviour is not mine to give.**
- **The `map_path_withheld` field is new on the wire.** Packets written by an installed older copy carry none, and render exactly as before. An unrecognised code renders quoted verbatim rather than being dropped.

---

## 5. ⚠️ Two inherited tests were CHANGED — disclosed, because "changed" and "weakened" look identical in a diff

Neither is a relaxation. In both cases the **requirement** moved and the old assertion had come to encode the defect.

1. **`FALLBACK: a readLatest failure degrades to the unconditional write, not a block`** → replaced by **`WP-3A(c) NO FAIL-OPEN: a readLatest failure WITHHOLDS the pointer and still delivers the packet`**. The old test asserted `r.packet.map_path === 'Deliverables/map.md'` after a failed comparison read — that *is* the fail-open guard stated as a requirement, and removing it is the whole of WP-3A(c). **The half that was always right is kept and still asserted**: the Stop hook must not throw and the packet must not be lost. Two assertions were added, not removed.

2. **`WRITE-AUTHORITY: a session that STARTED BEFORE the stored pointer's last write does NOT replace it`** — one assertion inside it changed from `assert.match(brief, /map path missing or invalid/)` to asserting the **withheld** render. That old assertion required a withheld pointer to be *indistinguishable* from a packet that never had one, which is precisely the silence this WP was commissioned to remove. The test now asserts **strictly more**: the stale path still never renders, the reader is told the pointer was withheld, is told **why**, and is still oriented to the map.

No assertion was deleted to go green, no skip or `only` was introduced, no tolerance widened, no expected value hardcoded.

---

## 6. For Mack — WP-3E machine install

**Nothing here is installed. `~/.mypka/**` was not touched.**

- **Ship:** `tools/governor/continuity.mjs` to the installed copy at `~/.mypka/governor/`. `continuity.test.mjs` is repo-only.
- **No config change, no new environment variable, no new dependency, no hook re-registration.** The CLI surface (`stop`, `read`, `read --json`, `write`, `backfill`, `set`) is unchanged.
- **Verify after install, without a network read:**
  1. `node ~/.mypka/governor/continuity.mjs read` renders a brief and does not throw.
  2. `node ~/.mypka/governor/continuity.mjs read --json` now includes `total`, `incompleteReason`, `newestFirstConfirmed` and `latestIsAuthoritative`. **Their presence is the install landing.** If they are absent, the old copy is still in place.
  3. On the next Stop, confirm the turn ends normally.
- **What to expect that is new and is NOT a fault:** a packet may carry `map_path_withheld` instead of `map_path`, and the brief may then say `MAP POINTER WITHHELD BY THE WRITER`. That is the guard working. `stale-session` means an older session's Stop fired late; `authority-unestablished` means the one-page comparison read could not be made.
- **What WOULD be a fault:** the brief showing `🚨 …THE NEWEST PACKET IS NOT ESTABLISHED` on a healthy store. That means the walk is being truncated **and** newest-first is not being demonstrated — i.e. the deployed server is not honouring `reverse`, which is the open question in §4. **Escalate to Larry; it is not a Mack fix.**
- **Rollback:** restore the previous `continuity.mjs`. There is no state migration, and no stored packet is rewritten.

---

## 7. Acceptance property

| Warwick's property | Where it is proven |
|---|---|
| **(a)** reliable current-frontier read at present **and expected** store size | §2(a) · `THE HAZARD` (+ its mutation control), `SINGLE PACKET CONFIRMS NOTHING`, `POSITIVE PAGE CHECK` (+ control), `COUNT RECONCILIATION` (+ control), `EVERY INCOMPLETE WALK NAMES ITS CAUSE`, `THE BRIEF` (+ mutation). Mutations M1–M4, M9 |
| **(b)** correct `map_path` delivery | §2(b) · `WRITE-AUTHORITY`, `DIFFERENTIATING PROOF`, `COMBINED CASE`. Mutation M8 |
| **(c)** no fail-open write-authority guard | §2(c) · `NO FAIL-OPEN`, `COMBINED CASE (E-F)`, `MUTATION CONTROL`, `COST`. Mutations M5, M6, M8 |
| **(d)** stale/degraded fallback identifies itself **and** still orients | §2(d) · both `DEGRADED RENDER` tests. Mutation M7 |

**Builder self-test evidence — NOT independent review.** Assurance for this phase is Veritas's, on the exact integrated head, and Warwick's `merge-decision` is his alone.
