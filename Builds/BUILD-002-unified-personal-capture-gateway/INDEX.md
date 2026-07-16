---
name: BUILD-002 index
build_id: BUILD-002
owner: larry
tags:
  - build-002
  - index
---

# BUILD-002 — Unified Personal Capture Gateway — Index

Canonical production record for the build promoted from IDEA-002 on 2026-07-16. Foundry is provenance only.

## Contents

- [[BUILD-002-unified-personal-capture-gateway]] — **control document** (executive summary, confirmed decisions, WP map, cross-build reuse, links).
- **Work Packages/**
  - [[WP0-foundation-and-live-text-proof]] — the only authorised package.
- **Contracts/**
  - [[capture-contract-pack-v1]] — Capture Envelope / Action / Receipt v1, processing states, idempotency & retry.
- **Architecture/**
  - [[source-of-truth-and-authority-matrix]] — authority matrix, privacy/retention classes, canonical-vs-operational guardrail.
  - [[supabase-operational-foundation-boundary]] — Supabase operational baseline, secrets, local worker seam, module placement, cross-build reuse.
- **Security/**
  - [[wp0-security-gate]] — the gate that must pass before real secrets and the live phone proof.

## Delivery tracking

Governed per [[SOP-019-fusion-delivery-tracking]]: ClickUp BUILD folder/list/task in the "Fusion 247 MyPKA" space + GitHub tracking issues. GitHub is authoritative for code/merge state; ClickUp for delivery status; this folder for durable build governance.
