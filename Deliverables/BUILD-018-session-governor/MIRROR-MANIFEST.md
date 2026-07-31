---
name: build-018-mirror-manifest
type: mirror-manifest
build: BUILD-018
created: 2026-07-31
private_surface: none
---

# Drive mirror manifest — BUILD-018

**Rule (Warwick, 2026-07-31):** never independently compose the same document in two places.
Declare one canonical source, generate once, mirror by uploading the **canonical file bytes**,
never reread or regenerate the body merely to create the mirror, and record the canonical
path, commit SHA and Drive file ID. On update, regenerate only the canonical source and
replace the mirror mechanically.

**Canonical:** git, this repository, branch `build-018/session-governor`.
**Mirror:** Google Drive (Warwick's private Drive), folder
`Fusion247 Brain / BUILD-018 Session Governor — git mirror`
— folder id `1_dNHz1wM5HJJ8JFOYzuEd5ExjJqkbnYF`.

## Mirrored

| Canonical path | Commit | Drive file ID | Bytes (git = Drive) |
|---|---|---|---|
| `Deliverables/BUILD-018-session-governor/evidence/T-09-rendered-session-handoff.md` | `edee1b5` | `1-4e8hVPDM3QWNCjuq9Vqm3JrgVuD5JM4` | 14218 = 14218 ✅ |
| `Deliverables/BUILD-018-session-governor/evidence/T-09-programme-state.md` | `82481d7` | `1jdAlWCGpAl7wrA70N1QYscR1_8lc0tMe` | 6267 = 6267 ✅ |
| `Deliverables/BUILD-018-session-governor/tickets/T-09-programme-state-schema.md` | `82481d7` | `1LuRZZOGgyfQvQcJstFx05KVUhBsrQpTu` | 9823 = 9823 ✅ |

Byte-count equality was checked against the Drive API's reported `fileSize` for every upload
— the mirror is verified, not assumed.

## NOT yet mirrored (stated, not silently omitted)

| Canonical path | Bytes | Why not yet |
|---|---|---|
| `02-MAP.md` | 35,156 | Largest artefact; deferred to keep this session inside its own safe boundary |
| `programme-state.json` | ~31,000 | Machine artefact — the render above is its human-readable form |
| `01-GOAL-CONTRACT.md` | 4,406 | Phase 1, unchanged by T-09 |
| `00-ESTATE.md` | 5,903 | Phase 1, unchanged by T-09 |
| `03-ROTATION-HANDOFF.md` | 7,586 | Superseded prototype of the rendered handoff |

## Known limitation of this mirror path

The Drive MCP tool takes file content **inline**, so a mirror necessarily routes the bytes
through the model rather than being a server-side copy. That is the one place drift could
enter, which is why every upload is verified by byte count against the canonical file. A
future `/mirror-deliverables` command should compare a hash, not just a length.

## On update

Regenerate the canonical source, then replace the Drive file mechanically and update the
commit SHA in this table. Never edit a Drive copy.
