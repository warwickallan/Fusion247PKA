---
agent_id: vera
session_id: session_01Q2jw5yWD1rcEnUfHZD2ss5
timestamp: 2026-08-19T02:40:00Z
type: end-of-session
linked_sops: [SOP-005-vera-quality-gate, SOP-022-work-order-preflight]
linked_workstreams: []
linked_guidelines: [GL-003-design-system]
---

# A QA harness must prove its own bytes — and take its fixtures from the implementation

Two gates on the AsdAIr answer-correction control (Cockpit), 2026-08-18/19. FAIL at `2e7ff43`,
PASS at `2617c59`. Findings live in
`Deliverables/2026-08-19-vera-cockpit-correction-control-gate.md`. This is the method.

## 1. The fixture must come from the implementation, never from the inspector

Larry's brief said the control was live and I would see the enabled path. `command_names` did
publish `correctAnswer` — verified, twelve names — but `questions.resolved` was `[]`, and the whole
Resolved group sits behind `v-if="asdairBoardDone.length"`. **The control was absent from the live
DOM.** Inspecting as instructed would have produced a green about an empty region.

So I built a harness. The decision that made it worth building was **taking the receipt fixtures out
of `pipeline/commands.js` by reading the source**, rather than writing the receipts I imagined the
backend returned. That is the only reason V-2 was found: `answered_open_round` is a real exit of
`correctAnswer` that neither the builder's tests nor my imagination would have produced, and the UI
rendered it as a completed supersede.

**Generalised: an invented fixture only re-tests the inspector's own assumptions.** It is the
commissioning error one layer down — the same shape as asserting what would render from a real
measurement of the command surface.

## 2. THE INSTRUMENT MUST PROVE WHICH BYTES IT MEASURED — the near-miss

On re-inspection the fixed build reproduced V-2 **exactly**. Same false "CHANGED", same WAS/NOW pair,
same flash. I was one step from filing a second FAIL against a correct fix.

It was a **stale service-worker bundle** in my own persistent Edge profile. The Cockpit ships a
cache-first `sw.js`; my harness reused `--user-data-dir` between runs; the page executed the old
`app.js` while the network served the new one.

What stopped it — and the order matters, because two of the three checks were misleading:

1. **`md5` of the bytes on the wire** — disk == 8090 == 8098, new function present. Proved the
   transport, proved nothing about the render.
2. **Byte length inside the page** — 332,026 vs 334,143 on disk. I nearly wrote this up as staleness.
   It is **UTF-8 bytes versus UTF-16 code units**; the file is full of `⛔ — “ ·`. **A false finding
   I caught only by asking why the number was 2,117 short rather than wholly different.**
3. **A DOM marker that exists only in the fixed build** (`.as-sep`). Decisive, and cheap.

Then the real proof: I **extracted the shipped `asdairCorrectionOutcome` from `app.js` by
brace-matching and executed it standalone in Node** across nine receipt shapes. Correct on every one.
That separated "the decision is wrong" from "the decision is right but I am looking at old bytes" —
and Felix had made it a pure synchronous function precisely so that was possible. **The repair that
made the fix testable is what made the fix verifiable.**

**The harness now refuses to inspect without proof.** `go()` unregisters service workers and clears
caches; `Network.setBypassServiceWorker` and `setCacheDisabled` are on; and `assertFreshBundle(marker)`
throws before any assertion runs. **Never judge a render you cannot prove the provenance of.**

## 3. CRLF broke a control and the control reported it as a pass-ish

My independent mutation run used four patterns. Three were single-line and matched. The fourth was
multi-line and silently did not — the file is **CRLF** and my pattern was `\n`. Worse, my script
printed *"AT LEAST ONE MUTANT SURVIVED"*, conflating **skipped** with **survived**. A skip is not a
result and must never be summarised as one.

Fixed by deriving `EOL` from the source. All four mutants then went RED with named assertions.

**Two rules for anyone writing a mutation runner:** derive the line ending from the file, and
**assert the source actually changed** before running the suite. Both are in
`Team Knowledge` memory already; I hit them anyway because they arrive disguised.

## 4. What I will keep doing

- **State coverage beside every verdict.** Both reports name the build, the breakpoints, the schemes,
  and what was *not* covered (no live end-to-end correction — the shop has no settled answers).
- **A banner above the summary, not a note in an appendix.** The empty-`resolved` warning is the
  first thing in the QA report because the next inspector will hit the same empty region.
- **Restore under `finally`, then verify by md5.** Recorded in memory as a hazard; it held.

## For the next agent

- The correction control **cannot be seen on the live Cockpit** while `questions.resolved` is `[]`.
  Use the harness in `Deliverables/2026-08-19-vera-cockpit-correction-control-gate/`.
- Larry has ruled the harness **moves to `services/cockpit/`** as Felix's tooling, deferred so it did
  not delay the re-gate. Until it moves, it lives beside the report.
- One MEDIUM is open against `2617c59` (V-10): `answered_open_round` is tested before `duplicate`, so
  a raced no-op reports as a successful write. One-line fix, non-blocking.
