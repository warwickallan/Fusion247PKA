---
build: BUILD-002
component: Ingestion & Storage Foundation
wp: WP0
artifact: Source-of-Truth & Authority Matrix
status: draft-for-wp0
author: silas
created: 2026-07-16
---

# Source-of-Truth & Authority Matrix

Related build: [[BUILD-002-unified-personal-capture-gateway]]

Fixes the source-of-truth boundary for BUILD-002 so that no component silently
becomes a competing canonical Brain. Supabase is operational; Markdown/myPKA is
canonical for durable general knowledge. Approved domain stores are
authoritative only where explicitly governed (via BUILD-003, out of WP0 scope).

---

## 1. Authority & source-of-truth matrix

| Data class | Canonical store | Operational store | Who decides destination | Authority to write |
|---|---|---|---|---|
| Durable general knowledge | **Markdown / myPKA / Obsidian** | Supabase (transient intake only) | Larry + existing specialists (Cairn/Penn) via semantic classification | Governed intake worker on explicit `SaveToBrain`; write lands in Markdown canonical store |
| Operational intake / queue / processing state / relationships | (none — not canonical knowledge) | **Supabase** | Gateway + worker (mechanical) | Gateway (intake), worker (state transitions) |
| Private raw source objects (originals) | (none — not canonical knowledge) | **Supabase storage** (originals retained) | Gateway (on capture) | Gateway writes once; immutable retention thereafter |
| Structured domain records | **Approved domain store** (gated by BUILD-003) | Supabase (staging only) | Governed domain owner per BUILD-003 write-contract | **Out of WP0.** No writes to structured domain stores in WP0; align identifiers only |
| Code / evidence | **Git** | (n/a) | Author + evidence worker | Evidence worker commits proof; code via normal Git flow |
| Delivery / governance | **ClickUp** | (n/a) | Delivery owner | Delivery owner / governance process |

Notes:

- The gateway records intent and performs **technical** typing only; it never
  decides semantic destination. `destination_hint` on a `SaveToBrain` action is
  advisory, resolved by Larry/specialists.
- BUILD-003 (issue #17) owns structured domain-record schemas. WP0's live proof
  writes to the already-governed **Markdown** destination. This matrix
  references BUILD-003 identifiers for alignment but does not depend on it.
- Supabase may hold *derived* or *cached* representations of knowledge for
  processing, but never the authoritative copy (see §3 guardrail).

---

## 2. Privacy & retention classes

A minimal class set for WP0/WP1. WP0 and WP1 assume a **single authorised
user**; originals are **retained throughout the initial build**.

| Class | What it covers | Retention | Who may access |
|---|---|---|---|
| **Public** | Knowledge intended to be shareable/publishable | Canonical in Markdown; retained per normal versioning | Authorised user; shareable by explicit decision |
| **Operational** | Queue rows, processing state, relationships, receipts, non-sensitive metadata | Lives in Supabase; retained while relevant to processing/audit | Authorised user; gateway + worker service context |
| **Private-raw** | Original captured objects (voice/image/pdf/email/text) and their raw payloads | **Retained throughout initial build**; never deleted on promotion | Authorised user only; service access scoped to processing |
| **Sensitive** | Private-raw items flagged as higher-risk (credentials-adjacent, personal/health/financial) | Retained with tightest scope; excluded from any preview/caching not strictly required | Authorised user only; no broader exposure |

Rules:

- Promotion of an item to canonical Markdown never deletes the retained
  original; the `original_source_ref.retained` flag stays `true`.
- WP0/WP1: exactly one authorised sender identity; multi-user access control is
  a later work package, not designed-in speculatively here.
- No secrets/credentials are stored by these contracts; sensitive material is
  retained as opaque private-raw objects, not parsed into knowledge.

---

## 3. The one hard guardrail

**The operational store (Supabase) never holds the canonical copy of durable
general knowledge. Markdown stays canonical.**

This enforces myPKA AGENTS.md §1 (SSOT — every fact lives in exactly one file,
everything else links via wikilink) and §6 (Markdown-only memory). Supabase
carries intake, queue, processing state, relationships, and retained private
raw objects — all operational. The moment an item becomes durable general
knowledge, its authoritative home is Markdown/myPKA, and any Supabase
representation is explicitly derived/cached, never the source of truth. No
BUILD-002 component may invert this.
