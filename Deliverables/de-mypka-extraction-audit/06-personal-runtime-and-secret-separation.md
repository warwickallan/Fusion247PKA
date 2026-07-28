# 06 — Personal, Runtime and Secret Separation

No sensitive content is reproduced below — categories, paths, and counts only, per audit instructions.

## Headline: the separation doctrine is real, explicit, and largely already followed

Unlike most of this audit, this is not an archaeology exercise — `.gitignore` **directly documents** Fusion's
own personal/secret separation policy in prose comments, and the tracked-file evidence is consistent with it
being followed. This is a genuine, verifiable finding, not an inference.

## What `.gitignore` itself declares (read directly, safe — structure not content)

| Category | Excluded pattern | Comment in the file |
|---|---|---|
| Secrets | `.env`, `.env.*` (all depths), `.mcp.json`, `.cursor/mcp.json`, `*.key`, `*.pem`, `id_rsa` | Standard secret-file exclusion |
| One named exception | `services/fusion-capture-gateway/certs/supabase-pooler-ca.pem` | Explicitly carved back in as a **public** CA cert, guarded by a test + `scripts/secret-scan.sh` |
| Personal PKM material | `PKM/Journal/`, `PKM/My Life/Current Context/`, `PKM/My Life/About Warwick/` | "Private/local Warwick context while this repository is public" |
| Raw personal captures | `Team Inbox/captures/` | Raw captures from a live Telegram→Brain gateway |
| Household/personal data | `services/asdair/db/002_asdair_seed.sql`, `services/asdair/db/*seed*.sql`, `services/asdair/**/*.local.*` | Explicitly commented: carries "REAL household/personal data (family names, health items, shopping habits, budgets)"; lives only in a private Supabase schema, never git |
| Derived databases | `*.db`, `*.sqlite*` except the shipped `/mypka.db` fallback | Derived/regeneratable, not source-of-truth |
| Immutable raw sources | `/Sources (Immutable)/**` except its own INDEX/README | Transcripts/PDFs/uploads |
| Build artifacts | `node_modules/`, `dist/`, `build/`, `.next/`, TubeAIR's `.venv`/`out/` | Standard |

**One credential-adjacent note found: `Obsidian Local REST API` plugin folder is called out by name** in a
`.gitignore` comment as holding a bearer key + TLS material that must never enter the repo — the comment
states the real key lives at `C:\.fusion247\obsidian-rest-api.env`, entirely outside this repository. This is
disclosure of a *pattern*, not a secret value — no key material was read or is reproduced here.

## PKM/ — the declared "sacred" personal root (29 tracked files)

Structure: `.user.yaml`, `CRM/{Organizations,People}`, `Documents/`, `Images/2026/05/`, `Journal/2026/05/`,
`My Life/{Goals,Habits,Key Elements,Projects,Topics}`.

**Confirmed by `git diff 2eb9461 HEAD`** (not inferred): 22 of the 29 tracked files are byte-identical to the
original scaffold import — i.e. still the shipped example/demo content (`dr-schmidt-clinic.md`,
`dr-schmidt.md`, `passport.md`, the two demo images, `first-day.md`, `ship-mvp-by-q3.md`,
`morning-build-session.md`, `health.md`, `side-project-mvp.md`, every `INDEX.md`). 6 files were added and 1
modified after import: `.user.yaml` and 4 new `CRM/` entries (Meridian Retail Group + 4 named people), plus
one edit to `My Life/Topics/ai-tooling.md`.

**By filename alone** (content not read, per instruction): `My Life/Key Elements/health.md` and the two
`dr-schmidt` CRM files read as health/medical category — but both are **unmodified scaffold demo content**,
not live personal data. No filename anywhere under `PKM/` suggests family or financial content. Real personal
journaling, current-context, and "About Warwick" material is designed to **never reach git at all** — those
three subpaths are the `.gitignore`-excluded set above, and the one tracked `Journal/` entry present is the
pre-existing demo file from before/at import, not evidence that live journaling has entered version control.

**Open question, not resolvable from git diff alone**: whether the 4 new `CRM/People` entries and the
`meridian-retail-group.md` organization are further scaffold-style demo/example content (consistent with the
existing `dr-schmidt` demo pair) or genuine Warwick-added contacts. Names read as plausible either way. Not
resolved here — flagged for whoever is authorized to open the files.

## What must separate into which layer, going forward

| Layer | What belongs here | Evidence this boundary already exists |
|---|---|---|
| **Reusable core** | Bootstrap logic, orchestration pattern, task/session mechanics, SOP/GL *mechanism* (not text) | These are exactly the P0/P1 items in `02-upstream-and-derived-map.md` — currently mixed with upstream text, need reimplementation |
| **Capability packs** | Domain governance patterns Fusion built independently: Foundry-to-Build (SOP-010–014, GL-006), Idea Intelligence (SOP-015/016, GL-008/011, Arc/Cairn/Mason), worker-commissioning (SOP-021/022) | Confirmed Fusion-owned, see `03-fusion-owned-assets.md` |
| **Warwick private instance** | `PKM/Journal/`, `PKM/My Life/Current Context/`, `PKM/My Life/About Warwick/`, `Team Inbox/captures/`, AsdAIr seed/local data — all *already* gitignored, never in this repo | `.gitignore` comments above |
| **Buggly / Jola private instances** | Do not exist yet — see `08-family-instance-blueprints.md`. Nothing in this repo currently mixes their data with Warwick's or with the reusable core (they have no footprint here at all) | N/A — clean slate |
| **External runtime configuration** | Directus, Neo4j, LightRAG, Honcho connection details — referenced by name in 60-130+ files across `services/` and `Deliverables/`, but **no live credentials, no Dockerfile, no docker-compose committed anywhere in this repo** (`docker-compose*`/`Dockerfile*`: zero repo-wide hits) | See `04-lifecycle-and-reachability.md` |
| **Secrets management** | `.env` family, `.mcp.json`, key/pem files — all gitignored; one deliberate public-cert exception, documented and tested | `.gitignore`, `scripts/secret-scan.sh`, `secret-scan.yml` CI |
| **Generated/cache/database storage** | `mypka.db` (tracked, 1.2MB, regenerated on demand — see lifecycle note below), all other `*.db`/`*.sqlite*` gitignored | `.gitignore`; `git log --oneline -- mypka.db` = exactly 1 commit in this repo's history |
| **Historical archive** | The entire current `Fusion247PKA` repository, as-is | Per the audit's own north star — this repo stays intact as lineage, nothing here is deleted |

## `mypka.db` — a specific runtime-artifact flag

`mypka.db` is tracked in git (1,228,800 bytes) as a deliberate no-Python-required fallback (per
`manifest.json`'s own comment). It is a **derived, regeneratable index** over the markdown vault — not source
of truth, not itself personal data, but it is a full mirror of PKM/Team Knowledge/Team content including
whatever real content exists in those trees. **Recommendation for any new core/instance: do not ship a
pre-baked `.db` file containing another person's content.** Each instance should regenerate its own from its
own vault on first run.

## Sensitive-content flags found during this audit (minimal description only)

- **Raw third-party YouTube transcripts committed verbatim** to this public repository under
  `Team Knowledge/Sources/_raw/` (~20 video transcripts). Not personal data, but a distinct third-party
  copyright question — see `09-licence-and-provenance-risk-register.md`. Not a Fusion personal-data issue;
  flagged here because it is content committed to a public repo that Fusion did not itself author.
- No other unexpected sensitive content was found committed. The separation doctrine documented in
  `.gitignore` appears to be holding.
