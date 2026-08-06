---
# --- identity and authority ---
name: Install the FusionDevBot send path to the live governor runtime
work_order_id: WO-2026-08-06-20
build: BUILD-020
wp_number: WP-4C
status: draft
authorised_by: Warwick
authorised_date: 2026-08-06
owner: mack
return_to: larry
blocking_dependencies: []
tags: [build-020, wp-4c, phase-4]

# ⚠️ HAND-AUTHORED, and the reason is recorded rather than hidden.
# `tools/wo/envelope.mjs` has NO machine-install shape (map §17.6 G-6). It was run first and
# CORRECTLY returned UNRESOLVED and NOT ISSUABLE for a `~/.mypka/**` surface, because
# `file_surface` is for REPO paths and a tool that resolved a machine path against a contract's
# repo patterns would be fabricating a grant. The envelope below follows the PROVEN WP-3E shape
# (`WO-2026-08-05-16`), not an invented one. This order therefore does NOT count toward AC-5.

# --- scope ---
outcome: >-
  The live governor runtime at ~/.mypka/governor/ carries ding.mjs byte-identical to the git blob
  at the governance head, with a rollback baseline captured BEFORE the first write and shown to work.
acceptance_property: >-
  The installed file's SHA-256 equals the SHA-256 of the git blob at the governance head, verified
  by execution and reported as both figures; and the pre-existing governor still functions after
  the install.
integration_owner: larry
veritas_gate: 1
document_impact:
  - path: Deliverables/2026-08-04-proofline-wayfinder-plan.md
    owner: larry

# --- surfaces ---
# NOTE THE FIELD NAME. This is a MACHINE surface, not a repo `file_surface`. Nothing in the
# repository is written by this order.
file_surface: []
machine_surface:                  # CLOSED LIST. Write permitted here and ONLY here.
  - C:/Users/Buggly/.mypka/governor/ding.mjs
  # AMENDMENT 1, 2026-08-06 (F1 ruling). APPEND-ONLY — add the WP-4C provenance entry; never
  # rewrite or remove an existing one. Added because Mack was right: a one-file closed list is
  # correct for code but silently drops the provenance record, and an installed file whose origin
  # is undocumented ON THE MACHINE is precisely the defect §16.11 was paid for.
  - C:/Users/Buggly/.mypka/governor/INSTALLED-FROM.txt
out_of_scope_policy: report-only

worker_contract:
  path: Team/Mack - Automation Specialist/AGENTS.md
  governance_sha: 8b0528ba3d6af98d77c2546a52ecdc82a9fd5f64

contract_basis:
  - surface: C:/Users/Buggly/.mypka/governor/ding.mjs
    permitted_by: "Larry's explicit authorisation on the WP-3E precedent (WO-2026-08-05-16, `machine_surface`). Mack's contract does not declare a `~/.mypka/**` file pattern — that is a KNOWN CONTRACT GAP, recorded, and NOT closed by this order."
  - action: capture a rollback baseline before writing
    permitted_by: "Larry's explicit authorisation; mandatory precondition below"

contract_conflicts: >-
  CORRECTED BY MACK'S READ-BACK, AMENDMENT 1, 2026-08-06. Larry originally recorded this as a
  contract GAP with the surface resting only on his authorisation plus WP-3E precedent. Mack showed
  that UNDERSELLS it and the correction is accepted: Mack's contract has NO file-pattern grammar at
  all, so the absence of a `~/.mypka/**` pattern is NOT a denial — reading it as one would also
  forbid every `.env`, `.mcp.json` and supervisor registration the same contract explicitly orders.
  The basis is THREE-LEGGED — the contract's affirmative grants ("Mack owns operation of released
  services"; "Keel writes the hook, Mack registers it"; MCP registrations written outside the repo),
  Larry's bounded authorisation, and WP-3E precedent VERIFIED BY EXECUTION rather than trusted.
  The residue is DOCUMENTARY, not authorising. Reported, not fixed — contracts are not Mack's surface.

capability_evidence:
  source: executed probe
  result: >-
    Larry, 2026-08-06 at the governance head: subagent WRITES to ~/.mypka/** now SUCCEED
    (§16.10, Mack WO-16 — WO-07 Amendment 3's BLOCKED is superseded). ~/.mypka/governor/ exists
    and carries the installed governor. Node v22.18.0. Suite at this head: 56/56.

# --- authority: ONE authorised deviation from the standing defaults ---
credential_scope: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none
live_authority: >-
  DEVIATION, authorised by Larry 2026-08-06, bounded: write ~/.mypka/governor/ding.mjs and nothing
  else. ⚠️ Do NOT touch ~/.claude/settings.json or any .claude/**. ⚠️ Do NOT register or alter any
  hook. ⚠️ Do NOT restart the Tower watcher. ⚠️ Do NOT run continuity.mjs write against the live
  store. ⚠️ Do NOT send a Telegram message.

# --- environment ---
worktree: n/a — installs FROM the repo at the governance head TO the machine; writes no repo file
branch: n/a

schema_decision: n/a
security_inputs: n/a
operational_handoff: none
---

# WO-2026-08-06-20 — WP-4C: install the send path

## Why this exists

**`tools/governor/ding.mjs` is inert until the copy at `~/.mypka/governor/` carries it.** That is the §16.11 lesson, paid for once already. **Warwick's J2-e acceptance — one real FusionDevBot message arriving on his phone from the repaired path — is not reachable until this lands.**

## Acceptance criteria

- **AC1** — `~/.mypka/governor/ding.mjs` exists and its **SHA-256 equals the SHA-256 of the git blob** at governance head `8b0528ba3d6af98d77c2546a52ecdc82a9fd5f64`. **Report both figures**, not a claim that they match.
- **AC2** — A **rollback baseline was captured BEFORE the first write**: the prior state of `~/.mypka/governor/` and, if `ding.mjs` already existed, its SHA-256. **If nothing existed, record that as the baseline** — "absent" is a valid and restorable prior state.
- **AC3** — **Rollback is shown to work, not asserted.** Demonstrate it and restore forward again, reporting the hashes at each step.
- **AC4** — **The pre-existing governor still functions.** `node ~/.mypka/governor/footer.mjs` still renders. **If it does not, STOP and report — do not repair it.**

## Required evidence

- The **before** listing of `~/.mypka/governor/` and the baseline hash (or the recorded absence).
- `git rev-parse 8b0528ba3d6af98d77c2546a52ecdc82a9fd5f64:tools/governor/ding.mjs` and the blob's SHA-256.
- The installed file's SHA-256. **Both figures side by side.**
- The rollback demonstration and the restore, with hashes.
- `node ~/.mypka/governor/footer.mjs` output after install.

⚠️ **The CRLF trap applies and has bitten this build FOUR times.** `core.autocrlf=true` with no root `.gitattributes` means **on-disk bytes and git-blob bytes can differ while git reports the tree clean** (map P-10, C-2). **Compare like with like — normalise, or extract via `git cat-file` rather than reading the working-tree file — and state which method you used.** A byte-identity claim built on the wrong comparison is worse than no claim.

## Explicitly out of scope — report, never fix

- **Sending any Telegram message.** J2-e is Larry's to perform after this lands, and it is **not** builder evidence. **A real invocation with a message file WILL deliver to Warwick's phone — do not run one.**
- **Hook registration, `.claude/**`, `~/.claude/settings.json`.** Not in this order.
- **Restarting Tower. Running `continuity.mjs write`.**
- **Any other file under `~/.mypka/governor/`.** The closed list is one file.
- **The legacy `C:/.fusion247/larry-ding.mjs`** — that surface is closed to you and to Larry. **Two paths to one channel is expected and recorded.**
- **Mack's contract gap** (no declared `~/.mypka/**` pattern). **Report it; do not fix it.** Contracts are not your surface.

## Sequencing

1. **Return the WORK ORDER READ-BACK and HOLD.** Reading and probing are fine; writing is not.
2. On acceptance: baseline **first**, then install, then verify, then demonstrate rollback, then restore forward.
3. Nothing to commit — this order writes no repo file. **Your return IS the deliverable.**

**One question to answer in the read-back rather than assume:** the `contract_conflicts` field above discloses that your contract declares no `~/.mypka/**` write pattern, so this surface rests on Larry's authorisation and the WP-3E precedent rather than on a clause of yours. **Tell me whether you consider that a sufficient basis. `REFUSE` is a legitimate answer and I will route it differently rather than pressure it.**
