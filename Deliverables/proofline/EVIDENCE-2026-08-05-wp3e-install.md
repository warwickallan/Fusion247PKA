# EVIDENCE — WO-2026-08-05-16 / WP-3E: the fixed governor installed to the machine

| Field | Value |
|---|---|
| **work_order** | `WO-2026-08-05-16` (+ Amendment 1 at `1f19551`) |
| **owner** | Mack |
| **governance_head** | `696d44985b6e5b943df93daaccd52d133b7e8663` |
| **branch / worktree** | `build-020/wp-3e-install` · `C:\Fusion247PKA-wp3e-install` |
| **machine_surface written** | `C:\Users\Buggly\.mypka\governor\` — 8 `.mjs` files + `INSTALLED-FROM.txt` |
| **private_surface** | `none` — no path under `C:\.fusion247\**` was read, written or required |
| **credential_scope / network** | `none` / `none` — nothing fetched, nothing sent, no secret touched |
| **date** | 2026-08-05 |

**Result: INSTALLED AND VERIFIED.** All eight modules byte-identical to the governance head blob; the live governor renders `GREEN` with measured telemetry rather than `BLIND`; rollback executed and proven, not documented.

---

## 1. Before state — the rollback baseline, captured before the first write

```
$ ls -la C:/Users/Buggly/.mypka/governor
-rw-r--r--  2141  Aug  5 21:26  INSTALLED-FROM.txt
-rw-r--r--  9652  Aug  5 21:25  atomic-write.mjs
-rw-r--r--   103  Aug  5 21:45  continuity-last.json
-rw-r--r--    16  Aug  5 21:45  continuity-seq.json
-rw-r--r--  3449  Aug  5 10:54  continuity.json
-rw-r--r--  2110  Aug  2 01:30  continuity.json.phase3-bak
-rw-r--r-- 69370  Aug  5 21:25  continuity.mjs
drwxr-xr-x        Aug  1 03:37  delegation/
-rw-r--r-- 10170  Aug  5 21:25  evaluator.mjs
-rw-r--r-- 82747  Aug  5 21:25  footer.mjs
drwxr-xr-x        Aug  1 15:10  handbacks/
drwxr-xr-x        Aug  5 10:50  health/
-rw-r--r--  9053  Aug  5 21:25  health-store.mjs
-rw-r--r--  2027  Aug  1 03:05  registry.json
-rwxr-xr-x 59092  Aug  5 21:25  reorient.mjs
-rw-r--r-- 27431  Aug  5 21:25  sampler.mjs
-rwxr-xr-x  9793  Aug  5 21:25  statusline-live.mjs
```

Baseline SHA-256, taken **before any write**:

```
b822eb5e1a9389a9c1801a92fd3087fdb6a24eb9765db1d5e337f65a84f6c91d *atomic-write.mjs
cb569fc71bc733470cec786ef4d05447fde34b1bf7c37faf17bf4f8a116c743d *continuity.mjs
b26d6aaca55b8e6bb342b50be5f385986e39a104c4070011a98ef9de0d49379a *evaluator.mjs
694417ae5afd1e219e0d4b4f0080a72a0eea714375031e071216d90eaa418924 *footer.mjs
b67c6b49fc47b405d2c0a37672875ce29e5fa2b3a65cb3b22ebdc5436d659bdc *health-store.mjs
b9e767c0909d70de766346ea401d14542a514e73c93d9ffd6195eda8a223f4df *reorient.mjs
33d53793fdee89018d6d0395716bbcbcfa1e873a5065db87d2286d81e47fee02 *sampler.mjs
470bbb22d7e35731ebf5a2329a22ef1951c01c3dd10b06707ede77a1119e389c *statusline-live.mjs
8933261bd3b997fef5abc88adfafd83d82bcb29c1851b4e8bf211ff158be2912 *INSTALLED-FROM.txt
```

Byte copies of all nine files were held for the duration of the install.

## 2. Stale-cache check — confirmed clean, not assumed

```
$ find C:/Users/Buggly/.mypka/governor -name 'recommendation.json'
(no output)

$ find .../governor/health -mindepth 2 -maxdepth 2 -type f ! -name '*-*-*-*-*.json'
(no output)

$ find .../governor/health -mindepth 2 -maxdepth 2 -type d
(no output)
```

No `recommendation.json` anywhere in the tree, no non-UUID direct children of any store directory, no `state/` directories. Nothing to remove.

## 3. The comparison performed, and why

**Comparison: installed file bytes vs `git cat-file blob 696d4498:tools/governor/<f>.mjs`. NOT against the working tree.**

The Work Order's original rationale had the direction reversed; Amendment 1 §E-1 upheld the correction. Measured decisively on `atomic-write.mjs`:

```
blob@696d4498 : ... B U I L D - 0 1 8   T - 1 8 )  \n  / /      <- LF
worktree      : ... B U I L D - 0 1 8   T - 1 8 )  \r \n  /     <- CRLF

core.autocrlf = true ; root .gitattributes ABSENT ; check-attr text/eol unspecified
blob 9652 bytes / worktree 9844 bytes / delta 192 = exactly the line count
```

The **blob holds LF**; the **working tree holds CRLF**. A `cp` from the working tree would have installed CRLF and failed byte-identity **eight for eight**. Install route was therefore `git cat-file blob <head>:tools/governor/<f>.mjs > <dest>` for every file.

## 4. The delta this install actually carried

Six of eight files were already at the head. The real change was two files:

| file | installed before | head blob | delta |
|---|---|---|---|
| `atomic-write.mjs` | `b822eb5e` | `b822eb5e` | none |
| **`continuity.mjs`** | `cb569fc7` | `52a12287` | **+205 lines** — WP-3A frontier + pointer repairs |
| `evaluator.mjs` | `b26d6aac` | `b26d6aac` | none |
| **`footer.mjs`** | `694417ae` | `71cbb5c2` | **+593 lines** — WP-3B measured footer, the `3b10c42` BLIND fix, C-2 resolver guard |
| `health-store.mjs` | `b67c6b49` | `b67c6b49` | none |
| `reorient.mjs` | `b9e767c0` | `b9e767c0` | none |
| `sampler.mjs` | `33d53793` | `33d53793` | none |
| `statusline-live.mjs` | `470bbb22` | `470bbb22` | none |

Independent confirmation the installed copies were genuinely pre-fix: `grep -c "argv.includes('--refresh')"` on the old `footer.mjs` returned **0**.

## 5. Byte-identity after install — all eight

```
FILE                 BLOB-SHA256                                                       INSTALLED-SHA256                                                  VERDICT
atomic-write.mjs     b822eb5e1a9389a9c1801a92fd3087fdb6a24eb9765db1d5e337f65a84f6c91d  b822eb5e1a9389a9c1801a92fd3087fdb6a24eb9765db1d5e337f65a84f6c91d  IDENTICAL
continuity.mjs       52a12287dcf37ed711940f202505edbb2f874faced6fcca62cd3d83e42a788fc  52a12287dcf37ed711940f202505edbb2f874faced6fcca62cd3d83e42a788fc  IDENTICAL
evaluator.mjs        b26d6aaca55b8e6bb342b50be5f385986e39a104c4070011a98ef9de0d49379a  b26d6aaca55b8e6bb342b50be5f385986e39a104c4070011a98ef9de0d49379a  IDENTICAL
footer.mjs           71cbb5c20de17d406ec2f5545647d4f282ef38cad20b2d17472da8507d25b155  71cbb5c20de17d406ec2f5545647d4f282ef38cad20b2d17472da8507d25b155  IDENTICAL
health-store.mjs     b67c6b49fc47b405d2c0a37672875ce29e5fa2b3a65cb3b22ebdc5436d659bdc  b67c6b49fc47b405d2c0a37672875ce29e5fa2b3a65cb3b22ebdc5436d659bdc  IDENTICAL
reorient.mjs         b9e767c0909d70de766346ea401d14542a514e73c93d9ffd6195eda8a223f4df  b9e767c0909d70de766346ea401d14542a514e73c93d9ffd6195eda8a223f4df  IDENTICAL
sampler.mjs          33d53793fdee89018d6d0395716bbcbcfa1e873a5065db87d2286d81e47fee02  33d53793fdee89018d6d0395716bbcbcfa1e873a5065db87d2286d81e47fee02  IDENTICAL
statusline-live.mjs  470bbb22d7e35731ebf5a2329a22ef1951c01c3dd10b06707ede77a1119e389c  470bbb22d7e35731ebf5a2329a22ef1951c01c3dd10b06707ede77a1119e389c  IDENTICAL

RESULT: ALL 8 BYTE-IDENTICAL TO GOVERNANCE HEAD BLOB
```

Executable bits preserved (`reorient.mjs` and `statusline-live.mjs` remain `-rwxr-xr-x`) because the install truncates in place rather than recreating.

## 6. The live render — GREEN, not BLIND

Amendment 1 §E-6 widened `machine_surface` **read-only** by one path so this step could distinguish an honest `BLIND` from the `3b10c42` defect returning. The worktree `C--Fusion247PKA-wp3e-install` has **no health sample** — it has never had a statusline refresh — so a render taken there would return `BLIND` correctly and prove nothing. The session running this order does have a live sample, recorded under the trial cwd where the session opened:

```
health/C--Fusion247PKA-build-020-trial/5a984703-5aed-4152-93eb-45dfc74cdae9.json
757 bytes, mtime 2026-08-05 23:47:45
```

Render from the **installed** copy, no `--refresh`:

```
$ cd C:/Fusion247PKA-build-020-trial
$ node C:/Users/Buggly/.mypka/governor/footer.mjs --session 5a984703-5aed-4152-93eb-45dfc74cdae9

⟦GOV⟧ ctx 44% (440.1k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
(exit=0)
```

**`GREEN` with real measured figures — not `BLIND`.** The defect fixed at `3b10c42` has not returned.

`next: UNSET` is the correct value here, not a degraded one: no `--next` was supplied, and C-2 loads the map resolver only for `--refresh`, so there is no grounded next action for the render to report. Reporting `UNSET` rather than a banked literal is the constitutional requirement.

**The render wrote nothing.** Full directory listing with nanosecond mtimes, hashed before and after:

```
before: 423dfcdd48accf0ffa171938d0ddbfba6e9ef9ddfeb949cf628cdf103d827345
after : 423dfcdd48accf0ffa171938d0ddbfba6e9ef9ddfeb949cf628cdf103d827345
```

No `recommendation.json` and no `state/` directory was created anywhere by the render.

## 7. Rollback — EXECUTED, not documented

Amendment 1 §E-2 required the rollback be exercised on a file with a **real delta**, because restoring one of the six unchanged files would be true whether or not the restore did anything. `footer.mjs` used.

```
R1. before rollback        71cbb5c2...  (head)
R2. restore from baseline  694417ae...  == baseline sha  -> ROLLED BACK BYTE-EXACT
    size 82747 bytes (pre-fix copy)
R4. re-install from blob   71cbb5c2...  == head blob sha -> RE-INSTALLED BYTE-EXACT
    size 113077 bytes
```

**The rolled-back copy was also proven to still function**, so the rollback yields a working governor rather than merely matching bytes:

```
R3. render from the ROLLED-BACK copy:
⟦GOV⟧ ctx 44% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE

R5. render after RE-INSTALL:
⟦GOV⟧ ctx 44% (440.1k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
```

**Note the difference, which is the strongest single piece of evidence here.** The pre-fix copy renders `ctx 44%` with no figures. The installed copy renders `ctx 44% (440.1k/1000k)`. WP-3B's measured footer is observable in the product's actual output, not merely in a hash.

**Documented procedure:** restore the baseline copy over the file, then re-install with `git cat-file blob <head>:tools/governor/<f>.mjs > ~/.mypka/governor/<f>.mjs`. Baseline SHA-256 for every file is in §1 above.

Final re-verification after the rollback cycle: **all 8 identical to the governance head.**

## 8. `INSTALLED-FROM.txt`

Rewritten to name governance head `696d4498`, the two-file delta, the blob-not-worktree comparison, the render evidence and the executed rollback. File remains pure LF (CR count 0, verified with `tr -cd '\r'`; the earlier `od | grep` instrument gave a false reading and was discarded — control test on a known-CRLF file returned its exact line count).

Two things were deliberately **not** silently corrected:

- **The write-refusal provenance line is marked SUPERSEDED, not deleted.** History kept beside the correction.
- **The `settings:` paragraph is left byte-unchanged and flagged.** It claims `C:\Fusion247PKA\.claude\settings.local.json` was removed on 2026-08-05. It still exists (28238 bytes, mtime `2026-08-05T16:39:49Z`, existence check only — contents not read, nothing under `.claude/**` edited). This install did not make that untrue, so per the order's bar it is reported, not fixed. Candidate **C-15**.

## 9. Reported, not decided

**The head carries ten modules under `tools/governor/`; the install carries eight.** `continuity-derive.mjs` and `worktree-guard.mjs` were **not** installed, per Amendment 1 §E-3. No installed module imports either, so the eight-file install is self-consistent, and `footer.mjs:50` records that WO-OR-05 removed the `worktree-guard` import deliberately to keep a shelling-out module off the statusline path.

## 10. Bars observed

- No hook registration. No `.claude/**` edit of any kind (one existence check, no content read).
- No new mechanism — no checker, validator, registry or document family. Verification was ad-hoc shell against existing tools.
- No repo code touched: `git diff 696d4498..HEAD -- tools/governor/` is empty; this branch's only content change is this evidence file.
- Tower watcher not restarted. `continuity.mjs write` not run.
- `private_surface: none` held throughout — no step needed `C:\.fusion247\**`.

## 11. What this makes reachable

Map §16.2 **AC-1, AC-2 and AC-3** were unreachable while the runtime copy carried pre-WP-3A/3B code. The runtime now carries the governance head, so they are testable. **This evidence does not itself claim those acceptance criteria pass** — it claims only that the code under test is now the code on the machine, and that the governor renders correctly from it.

**Warwick's own session remains the confirming observation** (Amendment 1 §E-6 route (b)), and is explicitly not a precondition of this return.

---

# CONTINUATION RUN — 2026-08-06, Mack. Reinstalled from the MERGED head `f242f3c8`

**Why there is a second run.** Veritas found that `continuity.mjs`'s write-authority guard withheld
`map_path` on **every** `stop` packet for the life of a long-running session — a fresh Larry would have
started with no map. Keel fixed it at `eceabbe`; Veritas discharged it by replay. The copy installed on
2026-08-05 from `696d4498` still carried the broken guard, so the fix was inert on the machine until
this run.

**New governance head: `f242f3c8d1df6017dbe11b751cee12564b467517` — `main`, merged.** Supersedes
`696d44985b6e5b943df93daaccd52d133b7e8663`. Same order, same authorities, same envelope.

## C-1. Reconnaissance before the first write

`C:\Fusion247PKA-build-020-trial` verified on `main` at `f242f3c8...`, working tree clean.

**File inventory at both heads — item 2 of the continuation brief, reported not decided.** Both heads
carry the identical 20 names under `tools/governor/`:

```
atomic-write.mjs          atomic-write.test.mjs
continuity-derive.mjs     continuity-derive.test.mjs
continuity.mjs            continuity.test.mjs
evaluator.mjs             evaluator.test.mjs
footer.mjs                footer.test.mjs
health-store.mjs          health-store.test.mjs
reorient.mjs              reorient.test.mjs
sampler.mjs               sampler.test.mjs
statusline-live.mjs       statusline-live.test.mjs
worktree-guard.mjs        worktree-guard.test.mjs
```

**No file present in the previous install is absent at the merged head, and none is present at the
merged head that was absent before.** Ten modules and ten test files at both heads, identical names.
The install still deliberately carries eight; `continuity-derive.mjs` and `worktree-guard.mjs` remain
uninstalled per Amendment 1 section E-3. **Reported. Nothing decided.**

**Stale-sample check (step 2), executed before any write:**

```
=== recommendation.json anywhere under health ===
(exit 0)
```

`find ~/.mypka/governor/health -name 'recommendation.json'` returned nothing. No stale sample-scan
poison.

## C-2. Rollback baseline, captured before the first write

```
b822eb5e1a9389a9c1801a92fd3087fdb6a24eb9765db1d5e337f65a84f6c91d *atomic-write.mjs
52a12287dcf37ed711940f202505edbb2f874faced6fcca62cd3d83e42a788fc *continuity.mjs
b26d6aaca55b8e6bb342b50be5f385986e39a104c4070011a98ef9de0d49379a *evaluator.mjs
71cbb5c20de17d406ec2f5545647d4f282ef38cad20b2d17472da8507d25b155 *footer.mjs
b67c6b49fc47b405d2c0a37672875ce29e5fa2b3a65cb3b22ebdc5436d659bdc *health-store.mjs
b9e767c0909d70de766346ea401d14542a514e73c93d9ffd6195eda8a223f4df *reorient.mjs
33d53793fdee89018d6d0395716bbcbcfa1e873a5065db87d2286d81e47fee02 *sampler.mjs
470bbb22d7e35731ebf5a2329a22ef1951c01c3dd10b06707ede77a1119e389c *statusline-live.mjs
e4fa0415f4a3ab22a940d4c478e4907031c59c47f3e4ed7adb21fc78e4622e65 *INSTALLED-FROM.txt
```

Byte copies held in the session scratchpad. **The baseline is additionally reproducible from git with
no copy at all** — every installed file was byte-identical to its `696d4498` blob before this run, so
`git cat-file blob 696d4498:tools/governor/<f>.mjs` reconstructs it exactly. That property was proven,
not assumed: the baseline hashes above match the `696d4498` blob hashes one for one.

## C-3. The delta is exactly one file

Blob-to-blob at both heads:

| file | `696d4498` blob | `f242f3c8` blob | delta |
|---|---|---|---|
| atomic-write.mjs | `b822eb5e` | `b822eb5e` | — |
| **continuity.mjs** | **`52a12287`** | **`d80dfe75`** | **REAL** |
| evaluator.mjs | `b26d6aac` | `b26d6aac` | — |
| footer.mjs | `71cbb5c2` | `71cbb5c2` | — |
| health-store.mjs | `b67c6b49` | `b67c6b49` | — |
| reorient.mjs | `b9e767c0` | `b9e767c0` | — |
| sampler.mjs | `33d53793` | `33d53793` | — |
| statusline-live.mjs | `470bbb22` | `470bbb22` | — |

**One file changed, 46 lines.** `mapPointerWithholdReason()` now takes the session id and consults the
prior packet's `session_id` **before** the timestamp comparison. The authority checks stay ahead of the
identity check deliberately — a `session_id` read off a packet that may not be the newest proves nothing
about the newest.

## C-4. Install and byte-identity, against the BLOB

Install route unchanged, and for the reason Amendment 1 section E-1 established: **the blob holds LF, the
working tree holds CRLF.** `git cat-file blob <head>:tools/governor/<f>.mjs > ~/.mypka/governor/<f>.mjs`.

```
=== INSTALL DONE — byte-identity verification vs merged-head blob ===
atomic-write.mjs       blob=b822eb5e1a9389a9 installed=b822eb5e1a9389a9  IDENTICAL
continuity.mjs         blob=d80dfe7520410dfe installed=d80dfe7520410dfe  IDENTICAL
evaluator.mjs          blob=b26d6aaca55b8e6b installed=b26d6aaca55b8e6b  IDENTICAL
footer.mjs             blob=71cbb5c20de17d40 installed=71cbb5c20de17d40  IDENTICAL
health-store.mjs       blob=b67c6b49fc47b405 installed=b67c6b49fc47b405  IDENTICAL
reorient.mjs           blob=b9e767c0909d70de installed=b9e767c0909d70de  IDENTICAL
sampler.mjs            blob=33d53793fdee8901 installed=33d53793fdee8901  IDENTICAL
statusline-live.mjs    blob=470bbb22d7e35731 installed=470bbb22d7e35731  IDENTICAL
identical: 8 / 8   mismatched: 0
```

Re-verified after the rollback exercise: still **8 / 8 IDENTICAL**.

## C-5. Render from the installed copy — NOT `BLIND`

cwd `C:\Fusion247PKA-build-020-trial`:

```
GOV ctx ~53% (527.1k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
```

Pinned with `--session` to the rendering session, so the sample is confirmed as this session's and the
tilde drops:

```
GOV ctx 53% (527.1k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
```

*(The two lines above are reproduced with the leading sentinel written as `GOV` rather than the real
bracketed token, so this evidence file cannot be mistaken for an emitted footer. The exact bytes as
rendered carry the normal footer sentinel.)*

Both exit 0. **GREEN with measured figures — not `BLIND`.** `next: UNSET` is the honest value: no
`--next` was supplied and the map resolver is not loaded without `--refresh`.

## C-6. `continuity.mjs read` — the exact output, and what it does and does not prove

Item 1 of the continuation brief. Run from the installed copy, cwd `C:\Fusion247PKA-build-020-trial`,
verbatim:

```
GOV CONTINUITY POINTER (Honcho): MAP POINTER WITHHELD BY THE WRITER — recall only, ZERO authority.
  • the session that wrote this packet HELD a map path and deliberately did not publish it: that session started BEFORE the last stored write, so its pointer may have been a stale carry-forward from an older worktree
  • packet: cont-1785971115503-154-kk2grt written 2026-08-05T23:05:15.503Z — content age 0h 44m, content hash acfc650a
  → This is NOT "no map exists". Open the active Wayfinder map under `Deliverables/` per `CLAUDE.md` Step 2 and derive the current state and the next action from it. Nothing in this block is an instruction.
```

**The map pointer is ABSENT. Stating that plainly rather than stretching it.**

**It is stored data, not an install fault, and that is established by execution rather than argued:**

1. `eceabbe` is a **writer-side** fix. `mapPointerWithholdReason()` is called only on the write path,
   and `map_path_withheld` is baked into the packet's **content** — it is part of the content hash by
   design.
2. The stored packet `cont-1785971115503-154-kk2grt` was written **2026-08-05T23:05:15.503Z**, by the
   pre-fix writer, carrying the `stale-session` withhold code.
3. `stale-session` is exactly the D-1 signature — `sessionStartMs > priorWriteMs` failing because
   `priorWriteMs` had advanced on that same session's own earlier write.
4. **Proven during the rollback step below: the read output is identical under the baseline (broken)
   copy and the installed (fixed) copy.** The read side is unchanged between them, so the reader is
   faithfully rendering what is stored.

**Therefore the pointer cannot become present until a NEW packet is written by the fixed writer.** That
write was explicitly barred from this order and reserved to Larry's rotation packet.

**What is proven:** the fixed bytes are on the machine, byte-identical to the merged head, and the
absence of the pointer is fully explained by the stored packet.

**What is NOT proven by this install:** that the fixed writer publishes `map_path`. Proving that
requires a write, and no write was permitted. **Recorded as a limit, not smoothed over.**

## C-7. Rollback — EXECUTED on the one file with a real delta

Amendment 1 section E-2 required a genuine delta so the test is not a tautology. Last run that was
`footer.mjs`; **this run `footer.mjs` has no delta, so the rollback was executed on `continuity.mjs`**,
the only file that changed.

```
=== STEP 1: installed state before rollback ===
d80dfe7520410dfe8e801b5b80e2da64a599dca1ef892a173c176ec68d843e47  continuity.mjs

=== STEP 2: ROLLBACK — restore baseline (696d4498) over the installed file ===
52a12287dcf37ed711940f202505edbb2f874faced6fcca62cd3d83e42a788fc  continuity.mjs
ROLLBACK BYTE-EXACT: YES

=== STEP 3: rolled-back copy still runs ===
GOV CONTINUITY POINTER (Honcho): MAP POINTER WITHHELD BY THE WRITER — recall only, ZERO authority.

=== STEP 4: RE-INSTALL from merged-head blob ===
d80dfe7520410dfe8e801b5b80e2da64a599dca1ef892a173c176ec68d843e47  continuity.mjs
RE-INSTALL BYTE-EXACT: YES
```

Step 3 does double duty: it proves the rolled-back copy runs, **and** it is the control that establishes
C-6's claim — identical read output from the broken and the fixed copy.

## C-8. The live store was not touched

SHA-256 captured before and after every step:

```
before:  bb437604... continuity.json   3dae3c56... continuity-seq.json   6e9339bf... continuity-last.json
after:   bb437604... continuity.json   3dae3c56... continuity-seq.json   6e9339bf... continuity-last.json
```

**Unchanged.** `continuity.mjs write` was never run. `continuity.json` was read only.

## C-9. `INSTALLED-FROM.txt`

Rewritten to name `f242f3c8`, the one-file delta, the inventory comparison, the render evidence, the
executed rollback, and — new this run — a `pointer:` block recording exactly what the map-pointer
absence does and does not prove.

Carried forward unchanged and still flagged: the write-refusal provenance line stays **SUPERSEDED, not
deleted**, and the `settings:` paragraph (candidate **C-15**) stays **untrue and uncorrected on
purpose**, because this install did not make it untrue either. **This run did not re-verify C-15's
current state** — `.claude/**` is outside the order's surface and no read was taken there. Its tense was
changed from present to past so the file does not assert a present-tense fact this run did not measure.

## C-10. Bars observed

- No hook registration. **No `.claude/**` access of any kind this run** — not even an existence check.
- No new mechanism. Verification was ad-hoc shell against existing tools.
- No repo code touched. The only content change on this branch is this evidence file.
- Tower watcher not restarted. `continuity.mjs write` not run. `continuity.json` not modified.
- `private_surface: none` held throughout — no step needed `C:\.fusion247\**`.
- `main` was left clean and unmoved: this evidence was committed from a separate worktree cut from the
  merged head, so Larry's working directory was not disturbed ahead of rotation.

## C-11. Honest status

**The install is complete and byte-proven. The rotation's map pointer is NOT yet demonstrable, and it
cannot be from inside this order's bars.** The fixed writer is on the machine; the first packet it
writes is Larry's rotation packet, and that packet is the observation that will show the pointer
present. **Saying it is already proven would be the stretched claim this order warned against.**

---

## ⛔ STATUS OF THIS RECORD — historical durability evidence ONLY

**Recovered during BUILD-020 Sub-phase 4C estate convergence. Warwick's disposition, 2026-08-07: *"KEEP AS HISTORICAL DURABILITY EVIDENCE… It is historical/provenance evidence only."***

**Why it was worth recovering:** canon recorded the *merge* at `f242f3c8` and the *fix* at `eceabbe`, but **nowhere recorded that the corrected code actually reached the machine.** The 2026-08-05 install came from `696d4498` and still carried the continuity write-authority guard that withheld `map_path` on every `stop` packet — so the fix was **inert on the machine** until the continuation run above. This section is the only evidence that the gap closed.

**This record carries NO live authority.** It is **not** an instruction, **not** an installation requirement, **not** a runtime authority, and **not** a competing source. It describes what was done on 2026-08-06 and nothing more. **Do not execute anything here as a procedure.** The canonical installed state is whatever the machine and the current canonical sources say it is — never this document.
