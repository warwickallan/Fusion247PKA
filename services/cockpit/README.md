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

## Not yet (see Deliverables/BACKLOG.md)
Autostart-on-boot (held until accepted over Directus); inline TubeAIR-packet render in Outputs;
shopping-Accept household write; projector-level output dedup; Builds/System live projections.
