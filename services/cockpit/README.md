# Fusion247 Cockpit (standalone)

Warwick's first-party control/output surface — the standalone app that replaces the Directus admin
shell as the front door (IDEA-016). It reads the **cockpit contracts** (`cockpit.attention_item` /
`cockpit.output_item`) and files decisions as governed intents. It never mutates module data directly —
real actions still flow `governed intent → worker → receipt`. See memory `cockpit-lift-out-of-directus`.

- **No build step.** Node http server + a no-build Vue SPA (Vue is vendored under `public/vendor/`).
- **Bounded DB access.** Reads/insert-intents as `cp_directus`; surface lifecycle (status) as `cp_worker`.
  Creds come from the gitignored live-runtime file (`COCKPIT_CREDS`, defaults to the Directus live env json).
- **Installable PWA** — manifest + service worker; add to home screen for a fullscreen app icon.

## Run
```sh
node server.mjs                 # binds 127.0.0.1:8090 by default
# env: COCKPIT_PORT, COCKPIT_BIND, COCKPIT_CREDS
```

## Expose tailnet-private over HTTPS (secure context = installable PWA)
Tailscale serve fronts localhost with a valid ts.net cert, tailnet-only. Directus stays on the root (443);
the cockpit gets its own HTTPS port so nothing collides:
```sh
tailscale serve --bg --https=8443 http://127.0.0.1:8090
# → https://warwick-yoga.tailbc1fe3.ts.net:8443   (tailnet only)
# disable with: tailscale serve --https=8443 off
```
Install on the phone: open that URL in Chrome → menu → **Add to Home screen**.

## Endpoints
- `GET /api/state` — attention (open+deferred), outputs, ingested, wins, builds
- `POST /api/decide` — `{id, decision: accept|decline|defer|reopen, intent?, args?}`
- `GET /api/health` — `{status, build, sha, dirty, provenance, sourceHash}`, all four provenance
  fields taken **once at startup** so they describe the process that is running, not the working tree
  as it is now:
  - `sha` — short git SHA, or `dev` when git could not answer.
  - `dirty` — `true`/`false` when git could answer; `null` means **unknown**, never "clean".
  - `provenance` — `clean` · `dirty` · `not-a-repo` · `git-unavailable`.
  - `sourceHash` — digest over the bytes of the modules `server.mjs` actually loads. Computed with
    `fs` only and **never consults git**, so it stays true when the git answer is stale, wrong or
    absent. Built by `provenance.mjs`; executed by `provenance-check.mjs`, which also fails if the
    module list drifts from what `server.mjs` imports.

    **`sourceHash` is NOT comparable across checkouts or machines, and a difference does not by
    itself mean the code differs.** It identifies the bytes loaded by *this* process from *this*
    checkout. Git normalises line endings on checkout, so identical tracked content can legitimately
    produce two different digests — measured: two worktrees whose tracked content was byte-identical
    gave `916d0c67479c7edf` and `b21e69c0df49c916`, differing only by 164 CR characters in one
    module. On Windows this is the default behaviour, and the live Cockpit runs from its own
    checkout, so expect it. What the digest *is* for: detecting that the running process has drifted
    from the files sitting beside it on the same machine. Line endings are deliberately **not**
    normalised inside the digest — that would make it describe git's content rather than the loaded
    bytes, which is the exact failure `/api/health` had before `provenance.mjs` existed.
- `GET /api/rotation-reports` — `{ok, reports}`. The rotation performance reports from the
  `session_report` mirror, **most recent first** (ordered by `created_at` descending, because
  `session_date` is a date and ties). Read as `cp_directus`, SELECT only. Git remains the durable
  SSOT — the human-readable report is the Markdown Deliverable; this is a queryable mirror of the
  same evidence, not a second report.
  - **`null` means UNKNOWN — not established, never measured. It never means zero.** The two are
    materially different and this API keeps them apart: `elapsedMinutes: null` says nobody measured
    the session length, while `workOrders.firstDispatchSuccess: 0` says orders were dispatched and
    *none* survived first read-back. Both appear in the same real row. **Render `null` as "unknown"
    or "—", never as `0`.**
  - `id`, `closingHead` — exactly as stored; `closingHeadShort` is the first 7 characters, derived.
  - `createdAt` — ISO instant. `sessionDate` — calendar day `YYYY-MM-DD`.
  - `host`, `hostVersion`, `branch`, `mapPath`, `deliverablePath`, `notes` — text or `null`.
  - `elapsedMinutes`, `contextTokensIn`, `contextTokensOut`, `subagentTokens` — numbers or `null`.
  - `specialistDispatches` — the **sum** of `specialists[].dispatches`; `null` when there are no
    specialist rows, and `null` if any contributing value is unknown. A sum over unknowns is not 0.
  - `workOrders` — `{total, firstDispatchSuccess, amendments, refusals}`; any member may be `null`.
    `total` is a **stored** denominator counting numbered Work Orders, never re-derived from the
    other three — that would be circular.
  - `lines` — `{docChanged, productChanged}`. `allocation` — five percentages, each or `null`.
  - `gitStat` — the measured git-stat object, or `null` meaning never measured.
  - `findings`, `unestablished` — lists. `[]` means none recorded, which is a real answer and is
    different from `null`.
  - `specialists[]` — `{specialist, dispatches, tokensIn, tokensOut, notes}`, nested under their own
    rotation. A rotation that dispatched nobody returns `[]` — never `null`, never an error.
  - **Failure is HTTP 200 with `{ok: false, error}`** — a sentence, never a bare code, and never
    carrying a DSN, host, role name or credential path. Built by `rotation-report.mjs`; executed by
    `rotation-report-check.mjs`, which proves the null-versus-zero property without a database.
  - Requires `tools/session-report/grants.sql` to have been applied. Until it is, the endpoint
    answers `ok:false` saying the read role has not been granted access; it does not crash and it
    takes no other route down.

## Not yet (see Deliverables/BACKLOG.md)
Autostart-on-boot (held until accepted over Directus); inline TubeAIR-packet render in Outputs;
shopping-Accept household write; projector-level output dedup; Builds/System live projections.
