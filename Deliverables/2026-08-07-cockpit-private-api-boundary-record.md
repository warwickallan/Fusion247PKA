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
| Repair | **LANDED AND INTEGRATED** — WO-31 @ `02c4520`; CI gate registered @ `3254c69` and **proven to execute on the runner** |
| Independent verification | **DONE** — Vex, one bounded pass, `3254c69c`. See §"Re-verification" below. |
| Live exposure closed | ⬜ **NOT YET.** Closes only when the repair reaches the live runtime at route step 18. |

## R1 — ACCEPTED BY WARWICK, 2026-08-07. **The GREEN is conditional and the condition is named.**

**His ruling:** *"ACCEPT the contingency for this system. Record that cross-site no-`Origin` GET remains permitted and that the security conclusion assumes GET on the private upstream is non-mutating. Do not add further machinery now. Verify the real CareerAIR/live journey at step 18; if that exposes a side-effecting GET, close it there."*

**Precisely what this means, so it is never restated as more than it is:**

- A cross-site **GET carrying no `Origin`** — the `<img>` / `<script>` / `<iframe>` / no-cors shape — **remains permitted** through the proxy, and is genuinely reachable from any untrusted page.
- **It is NOT a read.** No read permission is emitted to any origin, so the page cannot see the response.
- **It is only an ACTION if the off-repo private upstream gives a safe-shaped GET a side effect.** That cannot be established from this repository — there is no caller here.

> **🔴 THE VEX GREEN IS CONDITIONAL ON THIS ASSUMPTION, AND THE ASSUMPTION IS UNVERIFIED.** Any statement that *"the boundary is closed"* **without** carrying *"assuming GET on the private upstream is non-mutating"* has **overstated an accepted verdict.** **Verification is a named binding item at route step 18** (migration plan §4.8.4) — not a footnote, and **not discharged by this acceptance.**

**R2 — Warwick ruled APPLY**, as *"a bounded reliability improvement, not authority for further hardening"*: a small server-side guard refusing an **unsafe** method carrying **no `Origin`**, so the property stops depending on the browser attaching it — **provided it breaks no known legitimate caller.** Issued as **WO-32**. **Safe methods with no `Origin` remain permitted — that is R1, deliberately unchanged.**

**Nothing here may be described as fixed, closed or accepted until the repair is independently verified
and reaches the live runtime.**

## Re-verification — Vex, 2026-08-07, head `3254c69cccca7141b64fdeba1ff70884fc37b584`

> **Still sanitised.** What follows states the property, the test *categories* and the residuals.
> **No reproduction steps, no header values, no exploit detail** — the constraint at the top of this
> file binds this section exactly as it binds the rest.

### Verdict — **GREEN** on the governing question

**The accepted answer is now NO for both halves that were RED.** An untrusted webpage cannot read from
the private upstream through the proxy, and cannot write to it by any request shape a browser treats as
unsafe. Established **by execution**, not by reading the diff: the real handler was booted from its own
module against a **recording fake upstream** on ephemeral loopback ports, driven at the raw socket layer
so the exact bytes on the wire were under the reviewer's control. **No database module was imported, no
credential was used, no live Cockpit, port or scheduled task was touched, and no production upstream
received traffic.**

**124 independent assertions; 118 PASS, 6 attributable to three benign normalisation cases** (below).

### What now holds, by category

| Category | Result |
|---|---|
| **The write half — the deciding criterion** | **Refused before the body is read and before anything leaves the process**, for every preflight-avoiding content type and for every unsafe method tested, including a streamed body. **The recording upstream registered 0 requests and 0 bytes across all of them.** The builder's AC3 evidence is **independently reproduced.** |
| **The read half** | **No cross-origin read permission is emitted to anyone, on any response** — including responses to allowed requests, refusals, and the not-configured case. |
| **Refusal ordering** | The decision is made on the **request**, before buffering and before the upstream call, and is applied to **every method equally**. Verified by the upstream's own record, not by the response. |
| **Opaque origins** | Refused. |
| **Header-manipulation class** | Duplicate and malformed header shapes **fail closed**. One first-wins parsing case exists at the transport layer and is **not producible by a browser** (see R3). |
| **Host/origin near-miss class** | Differing port, containing-name, sub-domain suffix, userinfo, case, whitespace-padding, query/fragment/path smuggling — **all refused**. |
| **Path containment** | Prefix-escape, encoded-escape, protocol-relative and backslash host-injection shapes **all refused**; no request left the configured upstream origin. |
| **Advance-question handling** | The bridge no longer answers on the upstream's behalf; a refused one never reaches it. |
| **Opt-in gating** | Unconfigured → not a route, and **no cross-origin header of any kind**. |
| **Allowlist shape** | **Empty by default.** Every unusable and over-broad shape tested is dropped **and warned**, never silently kept. A mixed list keeps only the usable entry and warns about the rest. |
| **Both halves of the boundary** | The legitimate same-origin path **still works** and still receives no read permission it does not need. A boundary that only refuses is half a boundary. |

### The CI gate — what it actually examines

`services/cockpit/origin-boundary-check.mjs` was **run independently and inspected, not taken on
trust.** It executes **51 assertions**, **asserts its own executed count is non-zero** (a gate that
asserts nothing also exits 0), and **mutation-tests itself**: four in-memory permissive policy fixtures
— including *the handler as it stood before this repair* — each of which must turn assertions red, and
an inert fixture is treated as a failure. **All four were caught.** This is a control that has been made
to fail, which is the only kind that is evidence.

**Stated beside the result, per the rule that a control must declare its ground:** the gate does **not**
cover the transport-level header-duplication class, host-alias normalisation, or non-`http(s)` origin
schemes. Those were covered by this review's own probe instead, and are recorded as R3 below.

### Residuals — recorded, not hidden

- **R1 — a cross-site request using a browser's *safe* shape is still forwarded.** It carries no origin
  by design, so it is allowed and reaches the upstream. **The page cannot read the response** — no read
  permission is granted, and browsers additionally block opaque cross-origin payloads from the contexts
  that could attempt it. So this is **not a read**. It is only an *action* if the off-repo upstream
  gives a safe-shaped request a side effect, which **cannot be established from this repository** —
  there is no caller here (see the CareerAIR residual). **Warwick's to accept or close before step 18.**
- **R2 — the unsafe-method half is closed at the server for every request that identifies its origin,
  and relies on the browser to attach that identification to unsafe methods.** That rule is unconditional
  in the fetch standard and no browser write path is known to omit it, but **it was not exercised against
  a real browser in this pass.** A small server-side belt-and-braces exists if Warwick wants the property
  to stop depending on the client. Recorded, not raised as work.
- **R3 — three benign normalisation cases** where an origin naming *the Cockpit's own host by an
  equivalent spelling* is treated as the same host, plus one transport-level first-wins parsing case.
  **None is producible by a webpage**: the equivalent spellings all designate the Cockpit itself, and the
  parsing case requires a client that is not a browser. **Not exploitable; recorded for completeness.**
- **Unchanged and not re-litigated:** the CareerAIR overlay is still unproven against this change and is
  Larry's at step 18; `Host` preservation through the fronting terminator is unresolved, with the
  allowlist as the hatch and **no value set**; DNS rebinding remains a deliberate non-goal at this risk
  level; no new authentication system, per ruling 4.

### Scope of this GREEN

**It covers the governing question at this head and nothing else.** It is not a statement about
Cockpit-wide authentication, which ruling 4 places out of scope, and it is **not** a statement that the
live runtime is fixed — the live exposure closes at step 18, not here.
