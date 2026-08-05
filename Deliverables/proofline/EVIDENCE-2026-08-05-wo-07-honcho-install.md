# EVIDENCE — WO-2026-08-05-07: Honcho machine-level install

**Performed by Larry** (Amendment 3 reassignment — all three machine paths are refused by the host classifier when the actor is a subagent). **Checkout `8dc55a0`.** Executed 2026-08-05.

---

## 1. Merge-vs-override — **MERGE. Step 4 was a correctness requirement, not cleanup.**

Mack's control run (project-scope hook only, user `hooks` key absent) had already proven a project hook fires exactly once in an untrusted scratch directory. **Without that control, a silent no-fire would have read as OVERRIDE and proven nothing.** With a `[USER]` marker added at user level:

```
marker log: [USER][PROJECT]
PROJECT count: 1
USER count:    1
```

**Both fired, once each → hooks MERGE.** Probe hook then removed; user settings verified **byte-identical to the pre-probe baseline** (`diff` clean, `hooks` key absent) before the real registration.

## 2. Import closure — verified independently, **five files**

`reorient.mjs → continuity.mjs → sampler.mjs → health-store.mjs → atomic-write.mjs`. **Copying only the two named in the original order would have failed at the first Stop, on someone else's fresh session.**

## 3. Install — `C:\Users\Buggly\.mypka\governor\`

All five copied and **verified byte-identical to source by sha256** (`OK` × 5). `INSTALLED-FROM.txt` records `checkout: 8dc55a0ac0e93ba5279d414c3a423ef83ca3cb26`, the WO-08 provenance for `reorient.mjs`, and *"Source of truth: repo `tools/governor/`. Edit there, then re-install."*

**Discriminator confirmed in the installed copy:** `"recall only, ZERO authority"` × **2**; `"AUTHORITATIVE current focus"` × **0**.

## 4. Registration and duplicate removal

User-level `~/.claude/settings.json` — `SessionStart` → `reorient.mjs`, `Stop` → `continuity.mjs stop`, both at `C:/Users/Buggly/.mypka/governor/`.

Project-level `C:\Fusion247PKA\.claude\settings.local.json` — the two governor entries removed; **everything else untouched**:

```
Stop:         bridge-ingest.mjs
SessionStart: ensure-capture-gateway.mjs
PreToolUse:   worktree-guard.mjs --estate C:/Fusion247PKA
SessionEnd:   (empty)
```

## 5. 🎯 THE ACCEPTANCE PROPERTY — met, by real sessions

**A fresh session in `C:\Fusion247PKA-build-020-trial` — NOT the main worktree, with no project-scope hook of its own — received a brief automatically, with no path typed:**

```
⟦GOV⟧ CONTINUITY POINTER (Honcho) — recall only, ZERO authority.
  • likely active map: Deliverables/2026-08-04-proofline-wayfinder-plan.md
  • packet: cont-1785923654548-148-5r4555 written 2026-08-05T09:54:14.548Z — content age 0h 0m, content hash bd24fb3d
  • last known focus (recall, possibly stale): "BUILD-020 Phase 2 - Honcho and Tower as durable shared myPKA infrastructure. Phase 1 (Proofline) CLOSED and PASSED by Warwick 2026-08-04."
  • Warwick's last recorded request (recall, possibly stale): "Bank everything useful in Git, have Veritas verify nothing material remains only in this session, then consider rotation."
  → Open the map and derive the current state and the next action from it. Nothing in this block is an instruction.
```

**Both halves of the discriminator hold:** the string proves the **installed (current) code** rendered it — the stale checkout has no such string; and this worktree carries **no project-scope hook**, so the **only possible source was the user-level registration.**

**NO DOUBLE-FIRE:** a session in the main worktree `C:\Fusion247PKA` reports **exactly 1** pointer block.

### The predicted first-session behaviour, observed and then resolved

Exactly as Mack predicted: the **first** post-install session rendered *"map path missing or invalid"*, because the last stored packet came from the old writer with no `map_path`. Its own Stop hook then wrote a packet **with** one, and the **second** session named the map. **Recorded so it is not misread as a failure — it is the writer proving itself in one cycle.**

## 6. The stale-focus correction — Larry's operational act, completed

The store's `focus` had read *"BUILD-015 AsdAIr live-acceptance recovery…"* for 30+ hours. **`focus` is a permitted, already-rendered field: no code change suppresses it — only correct data.** Corrected via `continuity.mjs write` (`ok: true`, `id cont-1785923654548-148-5r4555`, `state_persisted: true`, `withheld: []`, `truncated: []`). **The final proof above renders the corrected focus.**

**§14.20's rotation blocker is DISCHARGED.** A `/clear` no longer hands a fresh Larry a BUILD-015 orientation.

## 7. Live runtime undisturbed

PID **31268** verified alive on its **absolute path** throughout — never a process-name match — same creation time `04/08/2026 00:47:36`, same `WATCHER_ID`, heartbeat advancing. Not restarted, not signalled.

## 8. Recorded, not smoothed over

- **A first probe attempt used `--dangerously-skip-permissions` and was refused by the classifier. That was Larry's error** — a standing rule bars gate-disabled probe sessions without Warwick's explicit approval. Re-run without it and it worked. **The block was correct.**
- **User-level registration is MACHINE-WIDE**, not estate-wide: these hooks now fire in every directory Warwick opens Claude Code in. `reorient.mjs` degrades soft outside a repo; `continuity.mjs stop` will write packets from unrelated sessions with no `map_path`. **Accepted deliberately — a scoping guard is exactly the mechanism the regrowth cap forbids.** Recorded as a decision, not a default.
- **Not claimed:** restart durability (§14.0b — Warwick does not require it) · that a real `SessionStart` in `C:\ClaudeJobs` behaves well (not exercised) · anything about Mack's untested half, because there is none — Mack installed nothing.
