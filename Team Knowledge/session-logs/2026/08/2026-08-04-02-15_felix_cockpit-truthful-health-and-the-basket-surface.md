---
agent_id: felix
session_id: WO-ZG
timestamp: 2026-08-04T02:15:00Z
type: end-of-session
linked_sops: [SOP-003-felix-build-a-component, SOP-022-work-order-preflight]
linked_workstreams: []
linked_guidelines: [GL-003-design-system, GL-012-secrets-store-access-boundary]
---

# WO-ZG — finishing the Cockpit and making its health truthful

`private_surface: none`, declared by Larry. Nothing I touched opens, parses, prints or logs a
credentials file, and I verified that at the end rather than assuming it.

## What I actually learned, as opposed to what I built

### A lying red costs exactly as much as a lying green

I found the cockpit telling Warwick *"AsdAIr's read service is not answering on 127.0.0.1:8710
— 23."* while the service answered in 6ms. The cause is worth carrying forward because it will recur
anywhere in this estate that inspects a `fetch` error:

> **A `fetch` timeout throws a `DOMException`, and `DOMException` carries a *legacy numeric* `code`
> field — `TIMEOUT_ERR = 23`, `ABORT_ERR = 20`.** A resolver written as
> `e.cause?.code || e.code || e.name` therefore **never reaches `e.name`** for a timeout. The
> `TimeoutError` and `AbortError` entries in the map were unreachable from the day they were written.

The map read correctly. It was wrong on execution. I only caught it because I probed the live surface
during preflight instead of reading the source — and it is the third time this estate has been bitten
by verifying with the same instrument that produced the claim.

I had been framing "honesty" as *don't show a reassuring green*. That is half of it. Colouring
uncertainty as a fault is the same error pointing the other way, and it is why `unknown` is now a
first-class app state rendered in `--park` grey rather than folded into "not running".

### A habit with a bell on it is still a habit

Larry's ruling on the service worker was the sharpest correction of the night: I had offered a CI
check that fails when `public/` changes without a version bump, and he took serve-time derivation
instead because *"removing the human from the loop is the requirement"*. He was right, and the
distinction generalises — **an alarm on a forgotten step is not the same as a step that cannot be
forgotten.** The mechanism then proved itself on this very change: the cache name moved
`2e0013ef8cf5 → 23fcfe05dbf4` because app.js, apps.js and styles.css changed, with nobody deciding
anything.

### My own instrument cried wolf, and that is a failure mode too

`render-vm-check.mjs` flagged the *sanctioned* "Raw payload (debugging only)" drawer as if it were
the `JSON.stringify` fallback bug. I nearly recorded five false findings. **A detector that fires on
the feature gets ignored, which ends in exactly the same place as one that misses the bug** — so it
is now mutation-tested in *both* directions: it must catch a reinstated fallback, and it must not
flag the drawer.

Related, and the reason I now distrust any harness I did not make fail: the landed render harness had
**no self-test at all**. Its Proxy `has` trap is its entire detection mechanism, and a trap that has
silently stopped trapping looks precisely like a clean run.

### The CSS class that would have quietly defeated the whole surface

`.i-why` is `nowrap` + `text-overflow: ellipsis`. I had put `quantity_rationale` in it — the one
field the packet view exists to show, and exactly the kind of sentence
(*"list said 2; rule 1 rounds up to 3 for the any-2-for-X offer…"*) an ellipsis eats. The house
already had the right primitive (`.as-sub`, added previously for precisely this reason on another
row), so no new token was needed.

**The lesson is not "check your CSS".** It is that a truncating text style is invisible in every
check I ran — it compiles, it renders, it passes the harness, and it fails only on a phone in front
of the person who needed to read it.

## Design-system position (GL-003)

I introduced **no new tokens and no new fade.** GL-003 §2c **D-17 and D-18 are open** and `opacity`
is a measured AA failure down to 2.55:1, so held / unavailable / not-produced states are signalled by
**rail plus word** — the pattern that closed D-16 — never by de-emphasis. The new `unknown` state
needed no rule at all: the unmodified `.app-pill` / `.app-status` already resolve to `--panel2` /
`--park`, which is GL-003's own "no status colour applies". I added a CSS comment saying so, because
the obvious "improvement" is to give it an amber treatment and that would be wrong.

**Still parked for Iris:** there is no sanctioned "de-emphasised but readable" treatment in this
system. I worked around its absence; I did not resolve it.

## Process notes worth keeping

- **The read-back gate paid for itself twice.** It surfaced the missing `private_surface` declaration
  *and* the fact that items 4 and 5 had no data contract at all. Building those unbriefed would have
  invented a contract Keel then had to match — with both halves green and disagreeing.
- **Larry took the publish-the-contract recommendation rather than defending the order.** That is the
  SOP-022 behaviour working in the direction it is usually not tested in.
- **Two of my own mutation tests were themselves wrong** before they were right: `String.replace`
  hit only the first of two placeholder occurrences, and a "hanging" fake pool that never settled
  produced three cancelled tests that looked like a product defect. Both times the *test* was the
  defect. Worth remembering that a red from a new control deserves the same scrutiny as a green.
- **I asserted a latency I had not measured** (`~13ms`) in a code comment, caught it on re-read, and
  replaced it with real numbers plus an explicit *"not measured: the dependency-aware endpoint, because
  it cannot run until the reader is restarted."* That is the estate's oldest failure signature and it
  still nearly got me in a comment nobody would have questioned.

## Handover facts

- Both services need a restart before **any** health claim is live. Until then the cockpit is still
  running the old code and can still say *"— 23."*
- **Keel's packet producer builds a packet but persists it nowhere** — no table, no `INSERT`, while
  the schema says "Stored in Postgres". The packet is currently ephemeral, which is the exact failure
  the artefact was created to end. My published contract supplies the missing half.
- The reconciliation document shape is **mine and unagreed**. It is a proposal until Keel builds
  against it.
- Rows 3–7 of the operational status have **never been seen by Warwick**. Harness evidence is not a
  human looking at a phone.
