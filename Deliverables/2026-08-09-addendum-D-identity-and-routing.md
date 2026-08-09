# Addendum D — identity, access and routing for a second household principal

**Author:** Vex (Security Engineer) · **Date:** 2026-08-09 · **Type:** read-only establishment
**Status:** NON-GATING. Does not alter, extend, delay or re-grade BUILD-015. No branch, head or live
configuration was modified. All reads were read-only; the `wp-b15-2` worktree was read, never written.

**Public repo discipline:** no credentials, no tokens, no tailnet addresses, no household personal
data. Telegram user ids are masked as `telegram:<id>` throughout.

---

## The question this answers

A second human — an 84-year-old, technology-phobic — will operate her own private Cockpit from a
permanently-assigned tablet over Tailscale, while Warwick keeps his administrative Cockpit.

> **Same household does not mean same human. Network reachability is not authentication.**

Referred to below as **the second principal**.

---

## 1. What actually exists for actor identity

### 1a. The command ledger already carries a per-human actor string

Every AsdAIr command records an actor, and it is mandatory — not optional, not defaulted:

- `services/asdair/pipeline/commands.js:60-61` — `requireActor()`, rejecting empty/whitespace.
- `services/asdair/pipeline/commands.js:97` — the actor is folded into the durable ledger payload:
  `payload: { ...payload, actor, shop_ref: shop.shop_ref, command }`, written to
  `asdair.pipeline_command.args` (jsonb).
- `services/asdair/pipeline/commands.test.js:259-263` — a missing or blank actor is proven to reject.

**Verdict: the carrier for "which human" already exists and is already mandatory.** Nothing needs to
be built to hold the fact. What matters is where the string comes from.

### 1b. The Telegram path derives the actor server-side from an authenticated sender

This is the good pattern, and it is the one to copy.

- `services/asdair/intake/shopperIntake.js:284-302` — `classifyUpdate()` enforces an **allowlist,
  default-deny**, against `from.id` supplied by Telegram, not by the message body. An unlisted sender
  is `UNAUTHORISED_SENDER` and ignored.
- `services/asdair/intake/shopperIntake.js:157-165` — the allowlist is required and may not be empty;
  there is deliberately **no allow-all**.
- `services/asdair/pipeline/runtime.js:136` — the actor is then *derived*, not accepted:
  actor is set to the string `telegram:` followed by the authenticated sender id.

A real tap today records `telegram:<id>` where the id is a sender the platform vouched for.
**That is already a genuine principal, and already distinct per human.**

### 1c. The Cockpit path accepts the actor from the request body and defaults it to Warwick

`services/asdair/cockpit-api/httpApi.js:217-220` builds the dispatch args with
`requested_by` set to the string `cockpit:` concatenated with `String(body.actor || 'warwick')`.

Three problems, in order of consequence:

1. **The actor is client-supplied.** Any caller that can reach `POST /asdair/command` names itself.
   There is no authentication on this route and no check that the claimed actor is the caller.
2. **It defaults to `warwick`.** An unattributed call is durably recorded as Warwick's. If the second
   principal ever gets a write surface without this being fixed, **her actions are recorded under
   Warwick's name in the permanent ledger** — a false audit trail, which is worse than an absent one.
3. **`requested_by` is not the field name the pipeline records.** The Telegram path writes `actor`;
   this path writes `requested_by`. Two names for one concept across two surfaces is where an
   attribution query silently misses half the rows. Reconcile before a second principal exists.

**Mitigating fact, established by execution:** the Cockpit does **not currently proxy the command
route at all**. `services/cockpit/server.mjs` proxies only reads — `/asdair/workspace` (line 287),
`/asdair/rules` (303), `/asdair/packet` (325), `/asdair/media` (337-341) — and its POST routes
(385, 400, 417, 432, 441) are Foundry/CAPAE, not AsdAIr. **Today the Cockpit is read-only against
AsdAIr and the write path is Telegram.** So this is a defect to fix *before* the second principal is
given a write surface, not a live exposure today.

### 1d. `interpreted_by` is a class vocabulary, not a human identity — do not use it for this

BUILD-015's `asdair.shop_decision`, read read-only from the worktree
`C:\Fusion247PKA-wp-b15-2\services\asdair\db\017_shop_decision.sql`:

- line 173 — `interpreted_by text not null`
- lines 248-249 — `constraint shop_decision_interpreter_known check (interpreted_by in ('terra','human','rule'))`

That answers **"what kind of thing decided this"** — model, person, or deterministic rule. It does
**not** answer **"which person"**, and the CHECK makes it structurally incapable of doing so. The
column list carries no human-identity column, deliberately: `evidence_shop_line_id` is commented
*"EVIDENCE ONLY, NEVER IDENTITY"*.

**⛔ Do not widen the vocabulary to `human:mum` / `human:warwick`.** That conflates two orthogonal
facts in one column and destroys the three-value CHECK that makes it readable. Human identity belongs
where it already is — on the command.

### 1e. What would have to change to distinguish the two humans durably

Ordered smallest-first. **None of these requires a schema migration.**

| # | Change | Where |
|---|---|---|
| 1 | Derive the Cockpit actor from an authenticated session, never from `body.actor`; remove the Warwick default and hard-fail an unauthenticated command instead | `services/asdair/cockpit-api/httpApi.js:218` |
| 2 | Reconcile `requested_by` to the pipeline's field name (`actor`) so one query answers "who did this" across both surfaces | `httpApi.js:218` vs `commands.js:97` |
| 3 | Allocate the second principal her own principal string — e.g. `cockpit:<principal-id>` — distinct from `cockpit:warwick`, allocated once and never inferred | config constant |
| 4 | For provenance, join `asdair.shop_decision.question_id` to the `answer_question` row in `asdair.pipeline_command` and read `args.actor` | query-level only |

**That join is the durable answer.** `interpreted_by` says a human decided; the command ledger says
which human. Both facts are already written today.

---

## 2. Low-friction authentication for a permanently-assigned household tablet

**Constraint accepted as binding:** must not force an 84-year-old through repeated technical login
ceremonies. **Explicitly out of scope: any enterprise IAM project, any identity provider, any
password, any OTP, any MFA prompt, any session that expires while she is using it.**

### The ingress as it stands

`services/cockpit/server.mjs:58` binds `COCKPIT_BIND` defaulting to loopback, with the inline comment
that Tailscale serve exposes it tailnet-only over HTTPS. **There is no application-layer
authentication and no notion of a user.** Every tailnet device that can reach the endpoint is, today,
the same anonymous caller.

### Recommended: tailnet peer identity as primary, device-bound cookie as fallback

**Primary — tailnet peer identity.** Tailscale Serve can attach the calling tailnet user's identity
to the proxied request, and that identity is asserted by the tailnet rather than by the browser. The
second principal's tablet joins as its own node under its own account (or a dedicated tagged device),
and her Cockpit derives her principal from that identity. **Ceremony for her: none, ever.** She opens
the tablet; the page is hers.

**Two conditions, both mandatory, or this is worse than nothing:**

- **The identity assertion must be un-spoofable at the app.** The server may treat such a header as
  trustworthy *only* when the request demonstrably arrived via Serve. Because the bind is loopback,
  anything else on that host can forge the header by connecting directly. Either verify the peer
  out-of-band against the real remote address, or strip-and-reinject at a single trusted point.
  **A header trusted by name alone is not authentication** — this is the one place where getting it
  wrong turns a good design into a false one.
- **Serve, never Funnel.** See §3.

**Fallback — a device-bound opaque credential.** If tailnet identity does not survive the real
topology, the proportionate alternative is a **long-lived, high-entropy, opaque cookie**, set **once**
by Warwick on that tablet, scoped to that principal only:
`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<years>`. No login screen exists for her at all.
Revocation is server-side. The secret is stored hashed server-side — never in the repo, never in a
markdown file, never in a screenshot.

**Non-negotiable in either design: her credential is a SEPARATE, NARROWER principal.** It grants her
Cockpit only. **⛔ It must never be Warwick's administrative Cockpit identity and must never be the
same secret.** Two devices on one tailnet is a network fact, not an identity fact. If both hold the
same credential, an administrative credential is sitting unattended in a household — that is the one
item in this document that would meet the escalation bar on its own.

**Rejected, and why:**

- **Password or PIN on her tablet** — a repeated ceremony; fails the stated constraint outright.
- **OAuth / IdP / hosted login** — an enterprise IAM project; explicitly excluded.
- **Allowlisting her tailnet address** — addresses are not identities.
- **"It is on the tailnet, so it is fine"** — the exact conflation this addendum exists to refuse.

---

## 3. Exposure, judged against the HOBBY BRAIN bar

The test from root `CLAUDE.md`: *would a failure here meaningfully affect Warwick's real life?*

### ESCALATE — credible impact

| Condition | Why it clears the bar |
|---|---|
| **The second Cockpit is published via Tailscale Funnel rather than Serve** | Funnel is the public internet. That is *"a private service accidentally made public"* — a named escalation example. Household content and every read route would be exposed. **Serve only; verify the mode explicitly at setup, never infer it from the command that was intended.** |
| **The tablet is issued Warwick's administrative Cockpit credential, or one of equivalent scope** | A credential with administrative reach, held permanently on an unattended household device. Credentials are a named escalation category. |
| **A write surface is opened to her while the request-body actor and its Warwick default stand** (`httpApi.js:218`) | Her actions become durably recorded as Warwick's. Not money, not credentials — but it corrupts the only record that answers *"who decided this"*, silently and permanently, since no role holds UPDATE on the decision table. Fix before enabling writes, not after. |

### PARK — recorded, not escalated

- Someone already on the tailnet could read household shopping content or fiddle AsdAIr rows.
  This is Warwick's own worked example of a park.
- The `requested_by` / `actor` field-name split. Real; tidy it inside whatever work opens the write
  surface. Not worth an interrupt.
- Theoretical tampering with the second principal's Cockpit by an actor who already has tailnet
  access. Park.

### Not a concern, established by execution

The command route cannot reach money. `services/asdair/cockpit-api/httpApi.js:30-34` records that the
deny list refuses **checkout / payment / slot / credential**-shaped names before anything is loaded,
and line 205 restricts dispatch to `commandSurface.COMMAND_NAMES`. **No Cockpit principal — Warwick's
or the second one's — can spend money through this surface.** That is the single largest reason this
whole area sits below the escalation bar by default.

---

## 4. Routing — fan out by audience, not by kind

### What exists

The destination is chosen in exactly one place, `services/asdair/pipeline/runtime.js:629`, which
takes the shop's own `telegram_chat_id` and falls back to the bot's configured chat.
**Routing today is by shop ORIGIN, to one Telegram chat.** Whoever sent the photo receives
everything — questions and milestones alike. There is no audience concept anywhere in the outbox:

- `services/asdair/pipeline/store.js:663` — `enqueueMessage(deps, { householdId, shopId, kind, key, payload })`. No audience parameter.
- `services/asdair/pipeline/store.js:691-709` — `listOutbox()` returns `id, kind, key, payload, shop_id, household_id`. No audience.
- `services/asdair/pipeline/runtime.js:623` — the renderer is selected by `bot.messages[item.kind]`.
  **Kind selects the renderer *and* implies the destination.** That coupling is the thing to break.
- Enqueue sites: `runtime.js:460` and `runtime.js:513` (questions), `runtime.js:581` (basket ready).

### The smallest change that fans out by audience

**No new table.** `asdair.pipeline_command.args` is jsonb and already carries an arbitrary payload.

1. **Add `audience` to the enqueued payload** at the three enqueue sites. Two values suffice:
   `shopper` (the person answering) and `observer` (Warwick). A milestone both need enqueues **two
   rows, one per audience** — not one row sent twice.
2. **Resolve the destination from the audience in `drainOutbox`**, replacing line 629's shop-origin
   lookup with a channel map: `shopper` to her Cockpit audience, `observer` to FusionDevBot via the
   existing `ding.mjs` path. An absent audience keeps today's behaviour, so nothing regresses.
3. **⛔ The one real constraint: the outbox family key must include the audience.**
   `services/asdair/pipeline/keys.js` `outboxKeyFor(shopRef, family)` derives the idempotency key
   from the milestone (`runtime.js:460`, `:581`). Two rows for one milestone at two audiences would
   **collide on that key and one would be silently dropped** — and which one is dropped is not
   deterministic from the caller's point of view. **Fold the audience into the family key** or the
   fan-out is a message-loss bug wearing a routing feature's clothes. Highest-consequence
   implementation note in this section.

### The audience assignment Warwick specified

| Event | shopper (her Cockpit) | observer (Warwick, FusionDevBot) |
|---|---|---|
| Shop submitted | — | yes |
| Question raised | yes | **no — he is not her question relay** |
| Waiting on her | — | yes (one summary, never one per question) |
| Individual question answered | — | **no — "do not send Warwick every UI interaction"** |
| All questions resolved | — | yes |
| Plan ready | yes | yes |
| Blocked / failed | yes | yes |
| Basket ready for his checkout | — | yes |

**Her questions need no push channel at all.** Her Cockpit is a pull surface; the browser already
polls the read routes. A question reaches her by appearing on her Cockpit, filtered to her audience.
That removes a whole delivery mechanism from the design, and with it the failure mode of an
84-year-old being expected to notice a notification.

**Warwick's observer stream stays where it is** — FusionDevBot via `ding.mjs`, unchanged. The
`observer` audience is a filter on what is enqueued, not a new transport.

---

## Summary of what would have to change

| # | Change | Where | Class |
|---|---|---|---|
| 1 | Stop accepting the actor from the request body; remove the Warwick default | `services/asdair/cockpit-api/httpApi.js:218` | **must, before any second-principal write** |
| 2 | Authenticate the Cockpit — tailnet peer identity verified out-of-band, or a device-bound cookie | `services/cockpit/server.mjs:58` plus a new check | **must** |
| 3 | Separate, narrower principal for the second human — never Warwick's credential | config | **must** |
| 4 | Serve, never Funnel — verified explicitly at setup | deployment | **must** |
| 5 | `audience` on the enqueued payload, resolved in `drainOutbox` | `runtime.js:460,513,581,629`; `store.js:663` | should |
| 6 | Fold audience into the outbox family key | `services/asdair/pipeline/keys.js` | **must, if 5 is done** |
| 7 | Reconcile `requested_by` to `actor` | `httpApi.js:218` | park / opportunistic |

**No schema migration is required. `asdair.shop_decision` is not touched. BUILD-015 is unaffected.**

---

## Scope of this establishment — what it did NOT cover

Stated so no later reader borrows an unrelated green:

- **No live configuration was inspected.** Whether the current Cockpit is served by Serve or Funnel
  today was **not** established here — §3 states the requirement, not a measurement.
- **No penetration testing.** No request was issued against any running service.
- **Tailscale identity-header behaviour was not empirically verified** on this topology. It is a
  design recommendation with a stated verification condition, not a proven control.
- **BUILD-015 branches and heads were not modified.** The `017` migration was read read-only from an
  existing worktree.
