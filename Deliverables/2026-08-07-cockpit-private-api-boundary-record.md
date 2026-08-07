# Cockpit `/private-api` boundary — finding, repair and verification record

> **⚠️ SANITISED BY RULING. Warwick, 2026-08-07:** *"Keep the detailed Vex review / attack journey off
> the public repository. Preserve it privately. Git may contain only the minimum sanitised finding,
> repair and verification record needed for durable truth."*
>
> **This repository is PUBLIC.** This file is that minimum record. **It deliberately contains no attack
> journey, no reproduction steps, no header values and no exploit detail.** The full review is preserved
> privately at `~/.mypka/security/` (22,530 bytes, `sha256 55ae63349af76bc3…`), outside this repository
> and outside the secrets store. **Do not restore attack detail into this file, into a commit message,
> into a test name or into any other committed artefact.**

## Provenance

- **Gate:** Amendment 8, Sub-phase 4B route step **15a** — one bounded security review of the final
  live-facing Cockpit boundary, authorised by Warwick.
- **Reviewed head:** `443d0fa85e9e40a0483df776af037c9c8c0073b5`.
- **Reviewer:** Vex, one pass, closed nine-item scope, ceiling ≤~120k.
- **Origin of the gate:** raised by Keel during an unrelated WO-24 read-back, **received as a report,
  parked, and put to Warwick once**. It had never been assessed. Warwick's instruction at authorisation
  was carried verbatim into the dispatch: *"'Reflected CORS' is a reason to inspect, not an assumed
  vulnerability."*

## Verdict — **RED**, scoped precisely

**RED applies to the `/private-api/*` bridge as written, when armed.** **The other eight scope items are
GREEN and proven.**

**The governing question — Warwick's own words:** *"Can an untrusted webpage running in Warwick's browser
read from or perform actions against the Cockpit's private upstream services through the proxy, without
possessing an authority Warwick deliberately granted?"*

**Answer at the reviewed head: YES, both halves — read and write.** Established by execution against an
isolated instance with synthetic credentials and a fake upstream. **No production database, no private
upstream and no live service were contacted during the review.**

**Confirmed live, separately, by Larry:** the bridge was **armed on the running Cockpit** at the time of
the finding, using a probe that the Cockpit answers itself and that reaches no upstream. **The exposure
predates this branch and is not introduced by it.**

### What was NOT wrong — recorded, because it is most of the surface

Vex tested five reasons the design might be safe. **Four hold:** opt-in gating (unset → 404 with no CORS
headers), credential stripping (no cookies, no auth headers forwarded), SSRF containment (manual redirect
handling, `location` not forwarded), and request-size / timeout limits. **Least-privilege database access
verified** — `grants.sql:44-47`, SELECT-only, nothing granted to `anon`, `authenticated`, `service_role`
or `cp_worker`. **No committed secret; credentials gitignored, untracked and absent from every response.**

**Scope item 9 — rotation-report data requires NO stronger access restriction.** It is less sensitive
than data already served unauthenticated on the same surface; restricting it alone would be theatre.

### The durable lesson — F6, and it is the part worth keeping

**`/private-api` is the one live-facing handler never extracted from `server.mjs`.** `server.mjs` imports
`db.mjs`, which constructs two production database pools **at module scope**, so **no CI gate could
execute this handler.** `static.mjs`, `provenance.mjs`, `rotation-report.mjs` and `down-reason.mjs` were
all extracted for exactly that reason; this one was not. **The defect survived because it was
unreachable by any test, not because the behaviour was subtle.**

## Warwick's rulings, 2026-08-07

| # | Ruling |
|---|---|
| **1** | Detailed review **off the public repository**, preserved privately; git carries this sanitised record only. |
| **2** | **Repair promptly and proportionately.** A private hobby system, not an enterprise incident-response exercise; **no evidence of exploitation**. Smallest reversible live containment authorised **to Larry** if necessary. **Do not prematurely migrate the Cockpit or expand scope.** |
| **3** | **The accepted answer to the governing question must become NO.** **Removal of reflected CORS headers alone is explicitly NOT sufficient** — a browser write capable of avoiding preflight must also be prevented. **The team chooses the smallest correct implementation and proves the actual browser-origin property.** |
| **4** | **No new authentication system.** The deliberately private local/Tailscale boundary is **proportionate at MyPKA's current risk level**. Revisit only if the exposure model materially changes. |
| — | **Use WO-31.** No security programme, no credential-rotation exercise, no unrelated hardening. |

## Larry's containment judgement — recorded because declining an authority needs a reason

**No live containment applied.** The only containment available without patching live code would
**break the CareerAIR overlay**, which ruling 2 argues against. Weighed against a bounded exposure
(it requires opening an untrusted page on a tailnet device), no evidence of exploitation, and a durable
repair already in flight, **the functional cost exceeded the benefit.** Interim precaution: avoid opening
untrusted pages on tailnet devices until the repair lands. **Reversible in one step if Warwick prefers
otherwise.**

## Repair

**WO-31** — `Deliverables/proofline/WO-2026-08-07-31-private-api-origin-boundary.md`, issued to Keel at
governance head `2e9a3047`. **The implementation is deliberately not prescribed by Larry** (Warwick's
ruling 3, and because Larry has twice prescribed a method that would have holed one of his own controls).

**The deciding acceptance criterion is the WRITE path**, not the read: a request shape browsers never
preflight must be refused **before its body reaches any upstream**, proven by an upstream that recorded
nothing. **A gate must also be able to execute the handler** — see F6.

## Verification status

| | |
|---|---|
| Repair | **IN FLIGHT** (WO-31) |
| Independent verification | **OWED** — Warwick: *"After the repair is independently verified, continue the existing Proofline route."* |
| Live exposure closed | ⬜ **NOT YET.** Closes only when the repair reaches the live runtime at route step 18. |

**Nothing here may be described as fixed, closed or accepted until the repair is independently verified
and reaches the live runtime.**
