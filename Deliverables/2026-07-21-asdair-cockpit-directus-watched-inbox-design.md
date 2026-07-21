---
title: "AsdAIr in the myPKA Cockpit — tab design, watched-inbox abstraction, weekly cadence & any-device access"
author: Mack (Automation Specialist)
date: 2026-07-21
type: design-brief
idea: IDEA-012 (AsdAIr) · relates-to BUILD-014 (control-plane records architecture)
audience: Warwick (final gate), Larry (orchestrator), Silas (asdair schema + worker), Felix (cockpit UI), Vex (auth gate)
status: DESIGN ONLY — no live changes, nothing deployed
data_boundary: "Contains ZERO household data. Architecture + schema names only. AsdAIr data stays in private Supabase + gitignored-local, NEVER on this public repo."
---

# AsdAIr in the myPKA Cockpit — design brief

**One-line recommendation:** build AsdAIr as a **native tab (drop-in module) inside the existing myPKA Cockpit**, backed by its **own guarded server module** that talks directly to the private `asdair` Supabase schema, converging every input channel on a single **`asdair.inbox`** table. Reach it on any phone/tablet via the **already-decided Tailscale-serve** private path. **Do not stand up Directus for this** — it buys nothing here and costs a second auth system and non-public-schema friction. Full reasoning below.

This brief contains no household data. All examples are structural.

---

## 1. What exists today, and how a tab is added

### 1a. The myPKA Cockpit (this is the "cockpit" Warwick means)
Location: `Expansions/mypka-cockpit/`. Architecture (read from source, `HOW-IT-WORKS.md` + `server/` + `web/src/`):

- **One process, one origin.** An **Express** server (`server/server.js`) serves both a JSON API under `/api/...` **and** the built **React SPA** from `web/dist/`. Default bind `127.0.0.1:4317`, loopback-only. Single origin → no CORS.
- **Read model.** The cockpit reads a **derived SQLite mirror `mypka.db`** *read-only* (two belts: `readonly` open flag + `query_only` pragma). `mypka.db` is regenerated from the **public markdown** by `regen-mypka-db.py`. **Markdown is canonical; the cockpit never writes it** (one narrow exception: Fleeting Notes).
- **Write model.** The only writable stores are `mypka-cockpit.db` (planner layout + module prefs, gitignored, machine-local) and Fleeting-Notes markdown. Writable endpoints run a hard guard stack: `writeGate → session (or loopback-without-PIN) → CSRF (custom `X-Cockpit: 1` header + Origin match) → scoped body parser`.
- **Access posture.** Loopback by default; **LAN exposure is opt-in and refuses to start without a PIN** (`COCKPIT_BIND_LAN=1` + `COCKPIT_PIN_HASH`); TLS is a single switch. A DNS-rebinding guard limits the PIN-less convenience to genuine loopback `Host` headers.
- **How a tab/module is added** (`web/src/lib/moduleRegistry.tsx`): append **one entry** to `COCKPIT_MODULES` — `{ slug, navLabel, navIcon, navSection, View, enabled? }`. That single entry yields the sidebar row (`Sidebar.tsx`), the hash route `#/<slug>` (`router.ts` resolves unknown top-level slugs through the registry), and the content mount. Modules can **feature-gate** themselves via `enabled?: () => boolean` — when it returns false the module is fully absent (no row, no route, no mount). The documented module pattern assumes the view fetches from **read-only SELECTs over `mypka.db`**.

### 1b. Directus in this repo — there is **none running**
- The only Directus artifact is a bare npm-install **spike** at `services/control-plane/wp-d-proof/directus/` (contains **only** `node_modules/`, no config, no compose file, no instance). `WP-D0-README.md` states plainly: *"No live DB apply, no Directus."*
- The BUILD-014 control-plane (`services/control-plane/`) is Postgres migrations + a notifier, **DEV-only**, no live Directus, over an **`ops`** schema — a **different schema from `asdair`**.
- The prior research (`Deliverables/2026-07-19-records-architecture-directus-git-supabase-research.md`) already recommended **against** committing to Directus: it **duplicates** auth/permissions instead of deferring to Supabase RLS, it **writes `directus_*` tables into your DB**, and it has **weak support for non-`public` Postgres schemas** (open issues #3164/#3228). `asdair` is deliberately a **non-public schema** — so Directus hits that friction head-on.

### 1c. The key architectural fact for AsdAIr
`asdair` data is **PRIVATE** and must **never** land in `mypka.db` or the public repo. Therefore **AsdAIr cannot ride the `mypka.db` read path** the other modules use. It needs a module with its **own backend** that connects to the private `asdair` Supabase directly (credentials in a gitignored `.env`), and unlike every existing module, **it needs to write**. This makes AsdAIr closer to a **connector** (like the existing ClickUp/Todoist/IMAP connectors that hold keys in a local vault) than to a read-only `mypka.db` module. That is the one pattern-extension this build introduces; everything else reuses existing cockpit machinery.

---

## 2. The AsdAIr tab — design + data flow

A single tab `#/asdair` ("AsdAIr — Shop"), three panels. All three read/write the private `asdair` schema through a new guarded server module `server/asdair/*`; the client never touches Supabase directly (single-origin, credentials stay server-side).

### (a) Regulars picker — list ALL regulars, per-item number + add/added toggle + submit
- **Read:** `GET /api/asdair/regulars` → `SELECT` from `asdair.regulars` (id, name, brand, category, high_level_category, typical_qty, substitutes_allowed, asda_product_id). **Ordered brand A–Z** — this deliberately mirrors the proven live-add strategy ("DEFAULT = sort Regulars by BRAND A–Z, tick all matches, bulk add in one go").
- **UI:** a scannable list grouped by brand (or category toggle). Each row: item name, a **number stepper** (defaults to `typical_qty`), an **add/added toggle**. A **sticky Submit button at the bottom** with a running count of selected items.
- **Write (submit):** `POST /api/asdair/inbox` with `{ source: 'cockpit_picker', payload: { items: [{ regular_id, qty }, ...] }, idempotency_key: <client-uuid> }`. Server writes **one `asdair.inbox` row** and returns `202 Accepted`. The submit is the **simplest, already-structured channel** — it needs no OCR, no fuzzy resolution — which is exactly why it's the walking-skeleton slice (§6). Behind the cockpit write-guard stack; the client sends the `X-Cockpit: 1` CSRF header.

### (b) Current basket
- **Read:** `GET /api/asdair/basket` → the current/open `asdair.shopping_lists` row + its `asdair.shopping_list_items` joined to `asdair.regulars` for display names. Shows, per line: resolved item, qty, and **status** — `added` / `needs_decision` / `out_of_stock`. The OOS surfacing matters (banked lesson: one OOS item silently fails a whole bulk-add; surface it so Warwick can drop it).
- Read-only display. The basket is **built by the brain/worker**, not edited directly in this panel — keeps one write path (the inbox), not two.

### (c) Next week's self-building list
- **Read:** `GET /api/asdair/next-list` → the **draft** `asdair.shopping_lists` row for the next cycle (status `draft`) + its items, each flagged `auto` (brain-seeded) vs `manual`. Warwick reviews/adjusts before it is promoted to the active list.

### Data-flow sketch (all channels → one convergence point)
```
  Channels (identical row shape) ─────────────┐
   (i)  Shopper-bot TEXT      source=shopper_text   │
   (ii) Shopper-bot PHOTO     source=shopper_photo  │   ┌───────────────────────┐
   (iii)Cockpit PICKER submit source=cockpit_picker ├──►│   asdair.inbox        │  (durable, audited,
   (iv) Fusion app (later)    source=fusion_app     │   │   status='pending'    │   idempotent)
                                                    ┘   └──────────┬────────────┘
                                                                   │  worker drains:
                                                                   │  SELECT … FOR UPDATE SKIP LOCKED
                                                                   ▼
             photo → Claude-vision OCR → items ┐        ┌──────────────────────────────┐
             text  → parse → items            ├──────► │ resolve_regular() → build/     │
             picker→ items (already structured)┘        │ append shopping_lists +        │
                                                        │ shopping_list_items → basket   │
                                                        └──────────────────────────────┘
                                                                   │
                                                                   ▼  (NEVER auto-order / auto-pay)
                                                        basket "ready for review" → ping Warwick
```

---

## 3. The watched-inbox abstraction (the heart of this design)

**Recommendation: one `asdair.inbox` table, one worker draining it with `SELECT … FOR UPDATE SKIP LOCKED`.** Every channel writes the *same row shape*; the brain watches exactly one place. This is the production-safe Postgres hand-off pattern the records-architecture research endorsed, and it is Mack's core discipline: idempotent, retry-safe, single convergence point, fully auditable.

Proposed shape (Silas owns the migration; this is the design intent, not final DDL):

```
asdair.inbox
  id               bigint generated always as identity primary key
  household_id     bigint  references asdair.households
  source           text    not null   check in ('shopper_text','shopper_photo','cockpit_picker','fusion_app')
  payload          jsonb   not null    -- channel-native raw payload (see below)
  idempotency_key  text    not null unique   -- dedup: telegram update_id / submit-uuid / app msg id
  status           text    not null default 'pending'
                           check in ('pending','processing','resolved','needs_decision','error')
  received_at      timestamptz not null default now()
  processed_at     timestamptz
  result_list_id   bigint  references asdair.shopping_lists   -- what it produced (nullable)
  error            text
  -- helpful: index on (status, received_at) for the drain query
```

Per-channel `payload` (all four collapse to the same table):
- **(i) shopper_text** — `{ raw_text, telegram_update_id, from_user_id }`
- **(ii) shopper_photo** — `{ telegram_file_id, local_path, telegram_update_id }`. OCR (Claude vision) is a **downstream worker step**, not part of ingest — so a photo lands instantly and is transcribed on drain.
- **(iii) cockpit_picker** — `{ items: [{ regular_id, qty }], submitted_by }`. Already structured → the fast path.
- **(iv) fusion_app** (later) — `{ ... }`. Adding this channel is **zero brain change** — it just writes an inbox row. That is the whole point of the abstraction.

**Why a table, not a bare queue:** you get the **audit trail** ("what came in, from where, when, what it produced") and **replayability**, which directly serves the AsdAIr data boundary (*what got ordered → the asdair schema*). A pure fire-and-forget queue loses that.

**The drain worker** (a small Node process; can run alongside the existing Shopper intake worker):
- Loop: `UPDATE asdair.inbox SET status='processing' … WHERE id IN (SELECT id FROM asdair.inbox WHERE status='pending' ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT n)` — safe for concurrent workers, never double-processes.
- Classify by `source`: picker → items straight through; text → parse; photo → Claude-vision OCR → items. Then `resolve_regular()` → build/append `shopping_lists` + `shopping_list_items`. Set `status='resolved'` (or `needs_decision` for ambiguous/Banana-Yazoo-style rows, or `error`).
- **Idempotency:** the `unique(idempotency_key)` makes a Telegram redelivery or a double-tapped Cockpit submit a **no-op** (`ON CONFLICT DO NOTHING` at insert) — retry-safe by construction.
- **Wake optimisation (optional, later):** `pg_notify` on insert to wake an idle worker, or Supabase `pgmq`. Not needed for v1 — a 5–15s poll is plenty for a weekly shop.

**Boundary note:** the worker/brain (planner logic) already exists and is **read-only + never checks out** (the `asdairskill` planner). The inbox worker only *builds the list/basket*; it must **never place the order or automate payment** (hard rule, IDEA-012).

---

## 4. Weekly cadence — checkout → prompt → self-building next list

Trigger is **explicit only** (a human tap), never inferred from payment — honouring the never-auto-order rule.

1. **Confirm done.** Warwick taps **"Shop confirmed done"** in the Cockpit basket panel (or replies to the Shopper-bot ping). No automatic detection.
2. **Record.** The active `asdair.shopping_lists` row → `status='completed'`; an `asdair.orders` row is written (what was ordered).
3. **Prompt.** A Telegram ding via the Shopper bot (and a Cockpit banner): *"Shop confirmed done. Start next week's list?"* (Ding path is the standard Shopper-bot outbound.)
4. **Self-build on yes.** Create the next-cycle **draft** `shopping_lists` row; seed it from: regulars with a weekly cadence + promoted/learned `asdair.rules` + `typical_qty`. Mark each seeded item `auto`.
5. **Accumulate through the week.** Any inbox item tagged for the *next* cycle appends to the draft. It self-builds.
6. **Review.** The Cockpit "Next week" panel shows the draft; Warwick adjusts, then promotes it to active when the shop window opens.

This makes the cadence a loop with a human gate at both ends (start next list; confirm done) and no autonomous ordering in between.

---

## 5. Any-device access — reuse the Tailscale decision, skip Directus

The private-access question was **already decided** (`Deliverables/2026-07-20-cockpit-private-access-options.md`): **Tailscale `serve`** — a private WireGuard mesh, genuinely free for one user, runs from the Yoga, **no public exposure**, reachable from the phone browser over the authenticated tailnet (`https://yoga.<tailnet>.ts.net`). Fallback: VS Code/GitHub dev tunnels (no phone app). LAN mode (`COCKPIT_BIND_LAN=1` + PIN) covers the same-home-wifi case.

**This is the clinching argument against Directus for AsdAIr:** Directus would *also* need Tailscale to reach the phone, so it buys **nothing** on the access axis — while adding a second auth system, `directus_*` tables in the private DB, and the non-public-schema friction. The Cockpit tab reuses the mesh, the PIN, and the single origin you already have.

### Security requirement I must flag (Vex to confirm)
The cockpit grants a **PIN-less convenience for genuine loopback `Host` headers**. `tailscale serve` **proxies to `127.0.0.1`**, so depending on how it rewrites the `Host` header, a tailnet request could *look* like loopback to the cockpit and bypass the PIN. For a tab that reads **private household data**, that is not acceptable. Concrete requirements for the build:
- **A PIN MUST be set** (`COCKPIT_PIN_HASH`) whenever the AsdAIr module is enabled and reachable beyond pure local loopback.
- The **AsdAIr routes should require a real authenticated session unconditionally** — i.e. **not** honour the loopback-without-PIN convenience — so private data is never served on the strength of a proxied loopback `Host`.
- Vex should verify the exact `Host`/`X-Forwarded-*` behaviour of `tailscale serve` against the cockpit's DNS-rebinding guard before this goes anywhere near the phone.
- `ASDAIR_DB_URL` lives only in `Expansions/mypka-cockpit/.env` (gitignored, `chmod 600`), **never logged, always masked** in any echo. The client never sees it.

### Where Directus *could* still earn its keep (and why I'd still say no for now)
The one thing Directus is genuinely good at is a **generic CRUD back-office** — e.g. bulk-editing the ~89 regulars or the rules by hand. But: (a) that trips the non-public-schema friction, (b) it duplicates auth, and (c) **Supabase Studio already gives Warwick raw table editing of the `asdair` schema for free, natively, with no new system.** So even the back-office case is covered without Directus. Recommendation: use **Supabase Studio** for raw edits; revisit Directus only if a *non-technical* back-office is later needed **and** the schema friction is solved.

---

## 6. Honest recommendation + phased build plan

### Recommendation
Build AsdAIr as a **Cockpit drop-in module with its own guarded backend to the private `asdair` schema**, unified on **`asdair.inbox`**, reached on any device via **Tailscale serve**. **Do not deploy Directus.** This is the simplest architecture that (1) unifies all input channels, (2) works on a phone browser, (3) reuses the cockpit's origin/auth/CSRF/private-access you already built, and (4) keeps household data off the public repo by construction. The "on Directus" framing in the ask is, I believe, a carry-over from the BUILD-014 records-architecture direction; for *this bespoke shopping workflow* the Cockpit tab is the better home and Directus is the wrong tool — I'm flagging that disagreement plainly rather than building the heavier thing.

### Phased plan — smallest useful slice first
Ordered so each phase is independently useful and you can stop between any two. (Owners: Mack = wiring/endpoints/worker; Silas = `asdair` schema + drain logic; Felix = React view; Vex = auth gate.)

- **Phase 0 — walking skeleton: picker → inbox → basket (one channel, end to end).**
  - Silas: `asdair.inbox` migration + a minimal worker that drains `cockpit_picker` rows into a `shopping_lists`/`shopping_list_items` draft.
  - Mack: wire `ASDAIR_DB_URL` into the cockpit `.env` (gitignored, masked); add `server/asdair/` (a `GET /api/asdair/regulars` read + a `POST /api/asdair/inbox` write behind the existing guard stack); gate the module off when `ASDAIR_DB_URL` is unset (`enabled: () => !!config.asdair`) so the public scaffold cockpit is unaffected.
  - Felix: `AsdairView` — the brand-A–Z regulars picker (stepper + add/added toggle + sticky Submit); one registry entry.
  - **Outcome:** open Cockpit → AsdAIr tab → tick regulars → Submit → row in `asdair.inbox` → basket shows it. Proves the whole spine on the *easiest* channel.

- **Phase 1 — basket + next-list read panels.** `GET /api/asdair/basket`, `GET /api/asdair/next-list`; render current basket (with OOS/needs-decision status) and the draft next-week list.

- **Phase 2 — converge the Telegram channels onto `asdair.inbox`.** Point the existing Shopper-bot intake (text + photo) at the **same** table (`source=shopper_text|shopper_photo`); photo transcription (Claude vision) becomes a worker drain step. Now three channels converge, brain unchanged.

- **Phase 3 — weekly cadence.** "Shop confirmed done" → record order → prompt → next-list self-build seeded from regulars + learned rules.

- **Phase 4 — private phone access.** Tailscale `serve` + PIN, with Vex's `Host`-header verification (§5) as a hard gate before any private data is reachable off-loopback.

- **Phase 5 (optional, later) — Fusion app channel.** The app writes `asdair.inbox` `source=fusion_app`. **Zero brain change** — the inbox abstraction already absorbs it.

### What I explicitly did NOT do
No live changes, no schema writes, no deployment, no Directus install, no Supabase mutation. This is design only. The `asdair` schema details here are grounded in the documented IDEA-012 runtime state and the memory record, not a live probe; Silas should confirm exact column names against the live migrations (`asdair_001_schema`, `asdair_004_regulars`) before writing the `inbox` migration.

---

## Return summary (for Larry)
- **Wire status:** design/plan only — nothing connected or deployed.
- **Recommendation:** AsdAIr as a **Cockpit tab + own guarded `asdair`-Supabase backend**, unified on **`asdair.inbox`** (SKIP-LOCKED drain, idempotent), phone access via **Tailscale serve** — **not Directus** (duplicates auth, non-public-schema friction, buys nothing on access; Supabase Studio covers raw edits).
- **Hand-offs:** **Silas** owns the `asdair.inbox` migration + drain-worker logic and must confirm live column names; **Felix** owns `AsdairView`; **Vex** must verify the Tailscale `serve` `Host`-header behaviour against the PIN/loopback convenience before private data is reachable off-loopback; **Mack** (me) owns the `.env` wiring, `server/asdair/*` endpoints, and the module gate.
- **Deliverable path:** `Deliverables/2026-07-21-asdair-cockpit-directus-watched-inbox-design.md` (this file; contains no household data).
