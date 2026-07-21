---
title: "AsdAIr — extending the existing Fusion app with a favourites/regulars picker + watched-inbox submit"
idea: IDEA-012 (AsdAIr)
date: 2026-07-21
author: Larry (research pass; no live changes)
status: research — decision-ready
constraints_observed:
  - No live changes made
  - Fable not invoked
  - No private/entrusted data touched (asdair seed = Mum's real data; read schema shape only, not rows)
---

# AsdAIr × the Fusion app — feasibility research

**Bottom line up front:** The "Fusion app" on disk is a **Next.js 15 web app** (`fusion247-platform`, product = TrAIner), not a native/React-Native/Flutter mobile app — there is **no mobile app project anywhere on the machine**. The favourites/regulars picker + submit screen is a **very natural, small addition** to that stack (Next.js + Supabase + Tailwind + next-auth, all already wired). The cleanest "watched inbox" is **one Supabase intake row written through one server-side endpoint (an Edge Function)** that the app, the Telegram shopper bot, and the Cockpit all feed. **Android Studio is not needed** for the stated goal ("any web-enabled device") — a responsive web page / PWA covers phone, tablet and desktop from one codebase; keep Android Studio as an optional later wrapper only if a Play-Store install is ever wanted. **Smallest first step: a read-only `/asdair` page that lists `asdair.regulars` with a per-item qty stepper and a Submit that POSTs to one new `asdair-intake` Edge Function.**

---

## 1. What the "Fusion app" actually is (found on disk)

**Location:** `C:\Users\Buggly\fusion247-platform`
**Git remote:** `https://github.com/Warwick-25/fusion247-platform.git` (note: this is a **separate repo** from the public `Fusion247PKA`).
**Last commit:** Aug 2025 ("Major Infrastructure Improvements: MCP Integration + Vercel Deployment Fixes"). Dormant since, but complete and deployable.

**It is a web monorepo:**
- Root `src/app/stage` (Next.js App Router shell) + `apps/trainr` — the **TrAIner** product (AI personal-trainer). This is the only real app in it.
- **Deploys to Vercel** (`.vercel` present).

**Stack (`apps/trainr/package.json`):**
- **Next.js 15.4.6** (App Router), **React 18**, **TypeScript 5**, **Tailwind v4**, ESLint.
- **next-auth 4** (GitHub OAuth already working per commit history).
- **@supabase/supabase-js 2.55** — already talks to Supabase.
- `zustand` (state), `framer-motion` (animation), `openai` (LLM), `@modelcontextprotocol/sdk` + `@modelcontextprotocol/server-postgres` (MCP Postgres wiring).

**What it is NOT — verified:**
- **No React Native, no Expo, no Flutter (`pubspec.yaml`), no Capacitor, no `AndroidManifest.xml`, no `app.json`** anywhere under `C:\Users\Buggly` (searched to depth 4, excluding `node_modules`/`AppData`). No `AndroidStudioProjects` / `StudioProjects` folder.
- No PWA manifest / service worker in the trainr app today (`public/` holds only stock SVGs) — so it is currently a plain server-rendered web app, not yet installable.

**State:** builds/deploys as a Next.js app on Vercel; auth + Supabase already proven. It is a solid, idiomatic **web** foundation to extend — nothing mobile-native exists to bolt onto.

---

## 2. Feasibility of the favourites/regulars picker + submit screen

**Verdict: high fit, small effort.** Everything the screen needs already exists in the stack and in the data.

**The data is already there** (private Supabase `asdair` schema — verified table shapes, not rows):
- `asdair.regulars` — **89 ASDA Regulars live** (columns: `high_level_category`, `category`, `name`, `asda_product_id`, `asda_url`, `typical_qty`, `source`; 18 have real product IDs). This is exactly the list the picker renders.
- `asdair.shopping_lists` + `asdair.shopping_list_items` — model "current basket" and "next week's self-building list" directly: `shopping_list_items` has `requested_qty` **and** `added_qty` and a `status` (requested | added | needs_decision | not_added | excluded_this_week). A weekly `shopping_lists` row (status pending → processed → archived) is the natural "next week" container.
- `asdair.rules`, `asdair.products`, `asdair.orders` — the planner brain that already consumes lists (28/28 tests, `planner.js`).

**What the screen is, in build terms:**
- One new route/page (a `/asdair` route in the trainr app, or a sibling `apps/asdair` in the same monorepo).
- Server-side read of `regulars` → render grouped by `high_level_category` (or brand A–Z, matching the proven "sort by brand, tick all" add strategy) → a per-item number stepper (`requested_qty`, default from `typical_qty`).
- A read-only panel for "current basket" (`shopping_list_items.added_qty` on the latest processing list) and "next week's self-building list" (the pending list).
- A Submit that packages the ticked items and POSTs them to the inbox endpoint (§3).

**Effort:** a **thin working slice is ~1–2 focused build+review cycles** (list + stepper + submit → one intake row → drained by the existing planner). Reuses existing auth, Supabase client, and Tailwind — no new stack, no new infra. This matches the standing "deliver a thin working slice first" lesson: build the picker→inbox path before any basket-rendering polish.

**Effort risks (small):** the app must **never hold the Supabase service-role key in the browser**, and `asdair` is deliberately **kept off the REST/anon API** (no anon exposure — a security decision on record). So reads/writes go through a server route or Edge Function, not a browser Supabase client with the anon key. That is the same constraint the endpoint in §3 solves.

---

## 3. The "watched inbox" — recommended single abstraction

**How it works today:** the watched inbox is the **@Fusion247shopperbot Telegram queue** (its own bot, own inbox, id 8877654348). A local worker (`shopper-recv.mjs`) polls `getUpdates`, downloads any photo, Claude-vision OCRs it, and the structured items land in `asdair.shopping_lists` / `shopping_list_items`. (Separately, the dev bot writes `Team Inbox/captures/*.md` — a **different** inbox; don't conflate them.) So "the inbox" today is really *Telegram messages a worker drains into the asdair schema*.

**The trap to avoid:** making the app literally post into the Telegram bot (impersonating the user via `sendMessage`) so it "lands in the same inbox." That is hacky, fragile, and couples the app to Telegram.

**Recommended clean abstraction — one intake row, one endpoint, three feeders:**

1. **One durable queue table**, e.g. `asdair.intake_messages` (`id, source ['telegram'|'app'|'cockpit'], type ['text'|'photo'|'picker_list'], household_id, payload jsonb, status ['pending'|'processed'], created_at`). This is *the* watched inbox — a Postgres table the brain drains, source-agnostic.
2. **One write endpoint: a Supabase Edge Function `asdair-intake`** (runs with the service role, server-side). It authenticates the caller, validates, and inserts exactly one normalized `intake_messages` row. The app calls it; the Cockpit calls it; the Telegram worker calls it (or writes the row directly — it already holds `DATABASE_URL`).
3. **One drain step** (the existing planner path, generalised to read `intake_messages` instead of only Telegram) processes rows regardless of origin → builds/updates the weekly `shopping_lists`.

**Why this is cleanest:**
- The app never needs the service-role key or REST exposure of `asdair` — it POSTs to one authenticated function. `asdair` stays off the anon API (security decision preserved).
- "Same watched inbox as a shopper-bot text or photo" becomes literally true: **the Telegram worker's job shrinks to *normalise Telegram → intake row*,** so a photo, a text, and an app submission all become sibling rows the brain treats identically.
- Adding the Cockpit later is free — it's just a third caller of the same function.

**Migration note:** this is a small refactor of the current direct-write worker into "worker → intake row." Do it as its own step so the Telegram path keeps working (option-C style, its own working path) until the app path is proven — consistent with the AsdAIr↔gateway convergence discipline already on record (separate integration PR, don't fold into the core).

---

## 4. Android Studio's role — needed, or web/PWA?

**Android Studio is installed** (`C:\Program Files\Android\Android Studio`, `.android/studio` present; no SDK downloaded at the default `AppData\Local\Android\Sdk` path yet). But for the stated goal it is **not needed**.

- The requirement is **"any web-enabled device"** + Warwick sees favourites and submits. A **responsive web page** served by the existing Next.js app already covers phone, tablet, and desktop from **one codebase, one deploy, instant updates, zero app-store friction**.
- Add a **PWA manifest + service worker** (small addition to the Next.js app) to get "add to home screen," an app icon, standalone chrome, and optional web push — ~90% of the "feels like a real app" experience with no native code.
- **Native Android (Android Studio) only earns its place if** you later want a Play-Store-installable package, or device features a PWA can't reach on the target device. Even then the cheap path is a **TWA (Trusted Web Activity)** — Android Studio wraps the *same* PWA URL in a thin native shell with near-zero extra code. React Native/Flutter (a rewrite) is not justified here.

**Recommendation:** web/PWA first. Treat Android Studio as an **optional, later, thin wrapper** (TWA) over the PWA — not a build path to start on now.

---

## 5. Honest recommendation + smallest first step

**Recommendation:**
- **Build the picker as a web page in the existing `fusion247-platform` Next.js app** (new `/asdair` route, or a sibling `apps/asdair` in the monorepo), reusing Supabase + next-auth + Tailwind. **Web/PWA, not native.** Don't start a new mobile project; don't touch Android Studio yet.
- **Adopt one inbox abstraction:** a Supabase Edge Function `asdair-intake` (service role) writing one normalized `asdair.intake_messages` row; app + Telegram worker + Cockpit all feed it; the planner drains one place.
- Keep `asdair` **off the anon REST API**; the browser never holds the service-role key — all writes go through the function, all reads through server routes; **auth-gate the page** (next-auth, plus an allowed-user check mirroring `SHOPPER_ALLOWED_USER_IDS`). **Never commit the regulars/seed rows** (Mum's real data) to the platform repo — the page pulls live from private Supabase at runtime.

**Smallest first step (the thin slice to prove the whole idea):**
> A read-only **`/asdair` page** that lists `asdair.regulars` (grouped by category, or brand A–Z) with a **per-item qty stepper** and a **Submit** button. Submit POSTs the ticked items to **one new `asdair-intake` Edge Function**, which inserts **one intake row**. Prove end-to-end: tick → submit → row lands in the asdair intake → the existing `planner.js` can consume it as if it were a Telegram list.

Defer to slice 2: rendering current basket + next-week list, and refactoring the Telegram worker to also land in `intake_messages`. That first slice proves the two things that matter — **app-writes-to-the-brain** and **the single-inbox abstraction** — on the smallest possible surface, with no native tooling and no new stack.

---

### Evidence appendix (paths verified on disk)
- Fusion app: `C:\Users\Buggly\fusion247-platform` (Next.js 15; `apps/trainr/package.json` confirms stack; Vercel + GitHub `Warwick-25/fusion247-platform`).
- No mobile framework found anywhere under `C:\Users\Buggly` (no AndroidManifest/pubspec/app.json/capacitor/react-native/expo).
- AsdAIr schema + planner: `C:\Fusion247PKA-idea012\services\asdair\` (`db/001_asdair_schema.sql` = 13 tables incl. `shopping_lists`/`shopping_list_items` with `requested_qty`/`added_qty`/`status`; `skill/planner.js` 28/28 tests). `asdair.regulars` (89 rows) live per migration `asdair_004_regulars`.
- Current watched inbox: `@Fusion247shopperbot` Telegram, drained by `shopper-recv.mjs` (scratchpad) → asdair schema. Dev-bot's `Team Inbox/captures/*.md` is a separate inbox.
- Android Studio: `C:\Program Files\Android\Android Studio` present; SDK not yet at default path.
