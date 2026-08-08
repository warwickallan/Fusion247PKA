# 08 — Family Instance Blueprints

Design only. No instance is deployed by this audit. Each blueprint draws only on `CORE`/`PACKS` components
classified in `01`–`07`; nothing here invents a capability not evidenced in this audit.

## Warwick — maximum-complexity reference instance

**Purpose**: the full-capability proving ground; every `CORE`/`PACKS` component gets its first real user here.

| Boundary | Definition |
|---|---|
| Required core services | `CORE/bootstrap`, `orchestration`, `task-and-decision-store`, `skills-framework`, `agent-framework`, `governance`, `audit-and-qa`, `adapters` — all of `CORE`. |
| Required capability packs | `knowledge`, `research`, `software-development`, `life-administration` (asdair pattern) |
| Optional capabilities | `business-operations` (pending the licensing gate in `09`/`07`), `career` (currently unbuilt — see `07`'s CareerAir finding), `health` |
| Private data boundary | `PKM/`-equivalent root, `Team Knowledge/tasks|session-logs`-equivalent operational history, the raw external-source evidence store (pending the copyright question) — all stay in `INSTANCES/Warwick`, never in `Fusion Core` |
| Secret boundary | Channel credentials (Telegram, Directus, DB), API keys — external to the repo entirely, per the existing `.gitignore`/env-file pattern confirmed working in `06` |
| User identity boundary | Single principal, full administrative authority over the instance |
| Deployment model | Local-first, with the option of the external cloud-runtime pattern (Neo4j/LightRAG/Honcho) this repo already integrates with — reimplemented, per `07`, not copied |
| Backup and recovery | Git-tracked governance/operational history (this repo's own pattern is sound and worth keeping: markdown as durable interface, regeneratable derived index, never a pre-baked personal `.db`) |
| Minimum useful visible proof | One end-to-end capture→intake→governed-vault-write→session-log cycle, and one exact-head-gated merge, both free of myPKA/ICOR branding |

## Buggly — minimal GCSE study-support instance

**Purpose**: study support only. Deliberately the smallest instance, proving `Fusion Core` scales down, not
just up.

**Must NOT inherit** (per instruction, cross-checked against what actually exists in this repo so nothing is
excluded that was never a risk in the first place):
- Warwick's personal knowledge (`PKM/`-equivalent content) — structurally impossible if `INSTANCES/Buggly`
  starts with its own empty private root, per the data-migration approach in `07`.
- Warwick's development machinery — `CORE/audit-and-qa`'s exact-head merge-QA gate, the worker-commissioning
  pattern, and any `services/control-plane`-derived governance are **not required** for study support and
  should not be installed by default.
- Commercial consultancy capability — `PACKS/business-operations` (Client Delivery) excluded entirely, not
  merely unused. This also sidesteps the licensing question in `09` for this instance specifically, since the
  capability simply isn't present.
- Health data — no `PACKS/health` capability installed.
- Unnecessary agents — only a study-support-relevant subset of the specialist roster (a research/tutoring
  persona, a task-tracking persona); not the full 16-specialist team this repo currently carries.
- Upstream myPKA content — moot by construction, since `Fusion Core` never carries it forward at all (`07`).

| Boundary | Definition |
|---|---|
| Required core services | `CORE/bootstrap`, `orchestration` (minimal), `task-and-decision-store` |
| Required capability packs | `study-support` (new — not evidenced in this repo at all; must be built from requirements, not extracted) |
| Optional capabilities | `research` (light — for finding study material), `knowledge` (light — for organizing notes) |
| Private data boundary | Buggly's own study notes/progress, entirely separate root from Warwick's or Jola's |
| Secret boundary | At most one LLM API credential; no third-party service integrations required |
| User identity boundary | Single principal (Buggly), no administrative access to Warwick's or Jola's instance data |
| Deployment model | Local-first, minimal — no cloud-runtime dependency (Neo4j/LightRAG/Honcho) needed for study support |
| Backup and recovery | Same markdown-first pattern, scaled down — no regeneratable `.db` needed at this size |
| Minimum useful visible proof | One study session captured, organized, and retrievable in a later session — nothing more |

## Jola — minimal private counselling-support and day-to-day instance

**Purpose**: personal/day-to-day support with counselling-adjacent sensitivity. **This audit does not propose
clinical diagnosis capability and does not propose this instance replace professional care** — noted explicitly
per instruction, and there is no evidence anywhere in this repo of a clinical/diagnostic capability existing to
even consider carrying forward.

**Must NOT inherit**:
- Warwick's private content — same structural separation as Buggly.
- Unrelated DevOps machinery — same exclusion of `CORE/audit-and-qa`'s merge-QA gate, worker-commissioning
  pattern, and governance corpus as Buggly; none of it is relevant to day-to-day/counselling support.
- Any of Warwick's business/commercial capability.

**Treat as highly sensitive** (per instruction): counselling and personal data get the strictest boundary of
the three instances — private data should be presumed sensitive by default here, not opt-in-sensitive.

| Boundary | Definition |
|---|---|
| Required core services | `CORE/bootstrap`, `orchestration` (minimal), `task-and-decision-store` |
| Required capability packs | A day-to-day life-support pack (closest existing pattern: `PACKS/life-administration`, genericised away from household-shopping specifics per `07`'s note on that pack) |
| Optional capabilities | `knowledge` (light) |
| Private data boundary | Strictest of the three — presumed sensitive by default; no shared visibility with Warwick's or Buggly's instance under any configuration |
| Secret boundary | Minimal, same principle as Buggly |
| User identity boundary | Single principal (Jola), no administrative access to any other instance |
| Deployment model | Local-first, minimal, with an explicit, easy, and complete data-deletion path — this instance should be the easiest of the three to fully wipe, given the sensitivity of what it may hold |
| Backup and recovery | Same markdown pattern, but backup/export should default to something Jola can independently see and control, not silently synced anywhere |
| Minimum useful visible proof | One day-to-day capture-and-retrieve cycle, with an explicit, working data-deletion demonstration as part of the proof — not just a feature demo |

## Cross-instance summary

| | Warwick | Buggly | Jola |
|---|---|---|---|
| `CORE/audit-and-qa` (merge-QA gate) | Yes | No | No |
| `CORE/agent-framework` (worker commissioning) | Yes | No | No |
| `PACKS/business-operations` | Optional, pending `09` | No | No |
| `PACKS/study-support` | No | Yes (new build) | No |
| `PACKS/health` | Optional | No | No — clinical capability explicitly out of scope entirely |
| Specialist roster size | Full (subset of the 16 evidenced here, reimplemented) | Minimal, study-relevant only | Minimal, day-to-day-relevant only |
| Data sensitivity default | Standard | Standard | Presumed sensitive by default |

None of the three instances exist yet. This blueprint is the design; building any of them is explicitly out of
this audit's parking point.
