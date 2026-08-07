# Session-report Supabase green proof (BUILD-020 Phase 4 / Gate 1 row 5)

**Date:** 2026-08-06  
**Branch:** `build-020/phase4-automation-law`  
**PR:** #97 remains HOLD — no Codex, no merge.

## Investigation (names / paths only — no secret values)

| Fact | Evidence |
|---|---|
| Intended project | Supabase project ref **`kerdinlgcfxnjrztwqde`** (BUILD-002 / fusion-capture-gateway / same project as `DATABASE_URL` in the approved runtime). Host form: session pooler `aws-0-eu-west-1.pooler.supabase.com`. |
| Approved durable path | `C:/.fusion247/fusion-capture-gateway.env` (same file as FusionDevBot `ding.mjs` `CREDENTIALS_PATH`) |
| Credential **names** present | `DATABASE_URL`, `DATABASE_SSL_CA_FILE`, plus Telegram/ClickUp names (not used here) |
| Credential **names** absent | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL` |
| Process env before proof | No `SUPABASE_*`, no `DATABASE_URL` exported |
| Secondary project (not used) | `control-plane-dev.env` has `CONTROL_PLANE_DEV_DATABASE_URL` → project `iiqstxfqjbrbyplwwsql` (legacy control-plane host; tower merge-check is now SQLite) |

## Implementation gaps closed

1. **`populate.mjs` self-load** — now reads the fixed approved path inside the process (ding pattern). File is authoritative; inherited `process.env` secrets are **ignored**. Values never printed, never written to `process.env`.
2. **Schema application route** — `tools/session-report/apply-schema.mjs` (wrapper) and `populate.mjs --apply-schema`. Applies idempotent `schema.sql` via `psql` + `DATABASE_URL`.
3. **Transport** — durable path uses **Postgres via `DATABASE_URL`** (the credential that actually exists). Optional PostgREST fallback remains if REST key **names** are ever added to the same file.

## Fresh-shell proof (no `--env-file`, no exported `SUPABASE_*` / `DATABASE_URL`)

### Schema apply

```text
node tools/session-report/apply-schema.mjs
→ exit 0
→ {"ok":true,"why":"schema-applied","mode":"database-url"}
```

### Populate + verify (safe non-secret result)

```text
node tools/session-report/populate.mjs --file <probe.json>
→ exit 0
→ {
    "ok": true,
    "why": "populated",
    "rotation_id": "abb52929-b139-4eea-8dfc-8d37b747aefe",
    "closing_head": "5de77a1c82929baf31a74849e13fa58cf4d0bf87",
    "deliverable_path": "Deliverables/2026-08-06-session-report-supabase-green-proof.md",
    "mode": "database-url",
    "verified": true
  }
```

Durable log line appended to `~/.mypka/governor/session-report-populate.jsonl` with the same non-secret fields.

**Note:** After the product commit lands, re-populate at the new tip so Veritas sees a row matching the exact integrated head under review.

## Acceptance vs durability bar

| Bar | Status |
|---|---|
| Real production event invokes it (`/rotate` → populate) | Mechanism now self-loads; /rotate already calls populate |
| Credentials from stable approved runtime | `C:/.fusion247/fusion-capture-gateway.env` |
| Success/failure observable | stdout JSON + jsonl; non-zero exits |
| Failure never silent | preserved (credentials-absent → exit 2) |
| Fresh session needs no reminder / no shell prep | Proven this run |
| Acceptance exercised real path not only manual script isolation | Schema + insert + SELECT verify against live project |

## Files

- `tools/session-report/populate.mjs` — self-load + schema + populate + verify
- `tools/session-report/apply-schema.mjs` — authorised schema entrypoint
- `tools/session-report/schema.sql` — unchanged
