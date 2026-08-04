# Proofline

**Proofline is the proof application inside BUILD-020.** It is not a separate build and has no `BUILD-0NN` number of its own.

A standalone, single-process, zero-dependency Node service that lets you paste text under a key you choose, and then **prove by execution — not be told** — that:

- the submission was fsynced to disk *before* you were acknowledged;
- a background worker picked it up, not the request thread;
- the analysis is a pure function of the text alone, reproducible byte for byte;
- a job caught mid-flight by an abrupt process kill comes back and finishes **exactly once** on restart;
- it stops for your approval and will not move past that point on its own.

To operate it, read [RUNBOOK.md](RUNBOOK.md). This file explains what it is and how it is proven.

---

## Running it

Paste this one line into any Windows terminal — Command Prompt or PowerShell, from any folder:

```
C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd
```

Then open **http://127.0.0.1:7317/**.

Zero npm dependencies. Node 22 stdlib only. Nothing to install.

`start-proofline.cmd` is the primary launcher: it invokes `node` directly, so PowerShell, execution policy and `.ps1` file associations are all out of the path. It is deliberately **pure ASCII**, because a `.ps1` with a single em-dash and no byte-order mark is misread as ANSI by Windows PowerShell 5.1 and fails to parse. `scripts\start-proofline.ps1` remains as a PowerShell-only secondary route and **will not run from `cmd.exe` at all**. [RUNBOOK.md](RUNBOOK.md) explains both.

---

## Shape

```
Browser (127.0.0.1:7317)
  │  static HTML/CSS/JS — no build step, no CDN, no framework
  ▼
src/server.mjs      the HTTP contract
  ▼
src/store.mjs       append-only JSONL + fsyncSync, replay on start,
  │                 torn-tail tolerant, mid-file corruption fails LOUD
  │                 .data/journal.jsonl   (gitignored — it holds your text)
  ▼
src/worker.mjs      startup recovery + a periodic scan while live
  │ src/recovery.mjs  isOrphaned(job, epoch) — an injectable pure predicate
  ▼
src/processor.mjs + src/canonical.mjs
                    a PURE function of the text. No I/O, no clock,
                    no locale, no float.
```

`src/config.mjs` validates the environment and fails fast. `src/app.mjs` wires the three together; `bin/proofline.mjs` is the only entrypoint.

---

## The HTTP contract

| Method | Path | Success | Failure |
|---|---|---|---|
| `POST` | `/api/jobs` `{key,text}` | `201 {job}` new · `200 {job, duplicate:true, textMatches}` existing | `400` invalid key/text · `413` text > 1 MiB · `413` body > 2 MiB |
| `GET` | `/api/jobs` | `200 {jobs:[summary]}` | — |
| `GET` | `/api/jobs/:key` | `200 {job}` | `404` |
| `POST` | `/api/jobs/:key/approve` `{note?}` | `200 {job}` | `404` · `409` not awaiting approval |
| `POST` | `/api/jobs/:key/reject` `{note?}` | `200 {job}` | `404` · `409` |
| `GET` | `/api/health` | `200 {ok,epoch,uptimeMs,counts}` | — |

Two size limits, not one, and the body limit is counted **as bytes arrive** rather than after buffering.

`textMatches` matters: re-submitting an existing key returns the original job unchanged — that is the idempotency guarantee — but that would silently discard the text you just typed. The flag lets the UI tell you so.

### States

```
queued ──▶ processing ──▶ awaiting_approval ──▶ approved
   ▲            │                             └▶ rejected
   └────────────┘  recovery: orphaned && attempts < 3
                │
                └──▶ failed   recovery: orphaned && attempts >= 3
```

`attempts` increments at lease time. `awaiting_approval` never self-advances.

---

## How the text is handled

**Hashed exactly as received.** No Unicode normalisation, no CRLF→LF, no trimming — `sha256("a\r\nb") ≠ sha256("a\nb")` and NFC ≠ NFD, and that is correct: the digest describes what arrived. The UI posts `application/json` so newlines survive transit unchanged.

Every value in a result is an **integer**. No float, no timestamp and no locale-dependent API ever reaches the result object, because all three drift between machines:

- `Array.from(s).length`, never `s.length` — the latter counts UTF-16 code units;
- `toLowerCase`, never `toLocaleLowerCase`;
- code-unit comparison, never `localeCompare` — `'Z'.localeCompare('a')` is `1` while code-unit compare gives `-1`;
- `avgWordLengthMilli` is explicitly guarded at zero words, because `0/0` is `NaN` and `JSON.stringify` renders `NaN` as `null`.

`resultSha256` is SHA-256 over the canonical JSON of the result: keys sorted ascending by code unit, recursively, no whitespace, array order preserved.

---

## How the claims are proven

Run the suite. The `cd` is required — `node --test` discovers tests relative to the working directory:

```
cd /d C:\Fusion247PKA-build-020-trial\services\proofline
node --test
```

(`cd /d` is Command Prompt. In PowerShell it is plain `cd`.)

**Assert `# tests` is at least the expected count AND `# fail 0`.** Never the exit code alone — `node --test` exits 0 having run zero tests when its file glob matches nothing.

| Test | Proves |
|---|---|
| T-1 | Same key twice → one job, `200 duplicate:true`, exactly one `job.created` in the journal bytes |
| T-2 | Same text → identical `resultSha256` across keys, across a restart, across separate processes |
| T-3a | The kill is a **crash**: an exit handler that fires on a graceful exit does not fire on the kill |
| T-3b | An acknowledged record survives an abrupt kill; the job is re-queued and completes exactly once |
| T-3c | **Mutation** — swap the durable write for a userspace-buffered stream and the acknowledged record is **lost** |
| T-3d | The `fs` façade records the call sequence: `fsyncSync` **returned** before the response was written. Paired with a mutation that removes fsync and makes the same assertion fail |
| T-4 | An approval survives a kill and comes back byte-identical |
| T-5 | Approving a `queued` job is `409` and writes no decision record |
| T-6a | **Mutation** — `isOrphaned` always false ⇒ the job is stuck in `processing` forever |
| T-6b | **Mutation** — `isOrphaned` always true ⇒ the live worker re-queues its own in-flight job and processes it **twice** |
| T-7 | Every earlier byte of the journal is unchanged after further work — append-only is real |
| T-8 | A synthesised torn tail recovers cleanly; synthesised **mid-file** corruption fails loud |
| T-9 | No HTTP client, `fetch`, DNS or outbound connect in the source; the socket is bound to `127.0.0.1` at runtime |

Each mutation test runs the **same scenario twice** — once with the production value, once with the mutant — so the only difference between the passing run and the failing one is the named part. A control that has never been made to fail is not evidence.

---

## What is deliberately NOT claimed

| Not claimed | Why |
|---|---|
| **Survival of power loss** | `fsync` returning is not a statement about the platter. Permanently out of scope. |
| **That fsync, rather than writeSync, is what saves data under `SIGKILL`** | It is not. A completed `writeSync` is already in the OS page cache, which survives process death — under `SIGKILL` the two are byte-identical, and only power loss distinguishes them. The fsync claim here is strictly an **ordering** claim (T-3d). |
| **That `processing` is visible in the browser** | It is not. A realistic ~1 KB paste is analysed in about 2.5 ms. `processing` is a **journal-observable** state, not a UI-observable one, and the UI shows it from the durable timeline afterwards. Inserting a delay to make it visible would be fabricating the evidence. |
| **Determinism across machines** | Structurally engineered for, and every enabling ban is asserted — but only one machine was available, so the property itself is unproven. |
| **Zero network egress** | A negative claim. What is proven is a static source assertion plus a runtime bind check, not the absence of egress. |
| **That it keeps working after the session that built it** | Partly evidenced, not claimed outright. `--detached` was started from a shell that was then allowed to exit, and the service kept answering `/api/health` — so it survives the terminal that launched it. It has **not** been shown to survive a reboot, a logout, or being run as a Windows service, and none of those is claimed. The first live start in the operator's own browser is still the operator's. |

---

## Files

| Path | What |
|---|---|
| `bin/proofline.mjs` | The only entrypoint |
| `start-proofline.cmd` | **The launcher.** Pure ASCII, invokes `node` directly, works from Command Prompt and PowerShell |
| `scripts/start-proofline.ps1` | Secondary PowerShell-only launcher. ASCII + BOM. Will not run from `cmd.exe` |
| `src/` | Service code |
| `public/` | The browser UI — plain HTML/CSS/ES modules |
| `test/` | The proofs. `test/helpers/harness.mjs` is both the shared utilities and the crash-test child entrypoint |
| `.data/` | The journal. **Gitignored — it holds your text** |
| `RUNBOOK.md` | How to operate, check and recover it |

> **Note on `node --test` on Node v22.18.0:** it discovers and executes **every** `.js`/`.mjs` file under `test/**`, not only `*.test.js`. `test/helpers/harness.mjs` therefore appears in the `# tests` total as one passing entry that runs no assertions. That is why there is exactly one helper file.
